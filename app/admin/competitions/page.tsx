"use client";

/**
 * /admin/competitions — every competition on the platform.
 *
 * Shows the full hierarchy at a glance (Sport → Competition → Season →
 * Rounds → Fixtures) so a half-built competition is visible as such, and
 * offers the launch gate for anything still hidden.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { checkReadiness, launchCompetition, setLifecycle, type ReadinessReport } from "@/lib/competitionAdmin";
import { getCompetitionSettings, invalidateEngineCache, type Lifecycle } from "@/lib/competitionEngine";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const LIFECYCLE_STYLE: Record<Lifecycle, { label: string; bg: string; fg: string }> = {
  draft:    { label: "DRAFT",    bg: "#1a1a10", fg: "#8899aa" },
  internal: { label: "INTERNAL", bg: "#2a2010", fg: "#ffab00" },
  public:   { label: "● LIVE",   bg: "#0a2018", fg: "#00e676" },
  archived: { label: "🗄 ARCHIVED", bg: "#141a20", fg: "#8899aa" },
};

function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle }) {
  const s = LIFECYCLE_STYLE[lifecycle];
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
          style={{ background: s.bg, color: s.fg, border: `1px solid ${s.fg}55` }}>
      {s.label}
    </span>
  );
}

const BG = "#080b0f", SURFACE = "#0d1117", CARD = "#111820", BORDER = "#1e2a38";
const ACCENT = "#00d4ff", GREEN = "#00e676", AMBER = "#ffab00", RED = "#ff3d00";
const DIM = "#a8b8cc", MUTED = "#8899aa", TEXT = "#e2e8f0";

interface Row {
  id:        string;
  slug:      string;
  name:      string;
  sportCode: string;
  status:    string;
  visible:   boolean;
  lifecycle: Lifecycle;
  seasons:   number;
  rounds:    number;
  fixtures:  number;
  teams:     number;
}

export default function AdminCompetitionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [rows, setRows]       = useState<Row[]>([]);
  const [busy, setBusy]       = useState(false);
  const [err,  setErr]        = useState<string | null>(null);
  const [check, setCheck]     = useState<Record<string, ReadinessReport>>({});

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.replace("/");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setBusy(true); setErr(null);

    const { data, error } = await supabase
      .from("competitions")
      .select("id, slug, name, sport_code, status")
      .order("created_at", { ascending: false });

    if (error) { setErr(error.message); setBusy(false); return; }

    const out: Row[] = [];
    for (const c of (data ?? []) as Record<string, unknown>[]) {
      const id = c.id as string;

      // Counts per level. Head-only requests: we want the count, not the rows.
      const [seasons, fixtures, teams] = await Promise.all([
        supabase.from("seasons").select("id", { count: "exact", head: true }).eq("competition_id", id),
        supabase.from("fixtures").select("id", { count: "exact", head: true }).eq("competition_id", id),
        supabase.from("teams").select("id", { count: "exact", head: true }).eq("competition_id", id),
      ]);

      const { data: seasonIds } = await supabase.from("seasons").select("id").eq("competition_id", id);
      let rounds = 0;
      if (seasonIds?.length) {
        const { count } = await supabase
          .from("rounds").select("id", { count: "exact", head: true })
          .in("season_id", (seasonIds as { id: string }[]).map((s) => s.id));
        rounds = count ?? 0;
      }

      const settings = await getCompetitionSettings(id);

      out.push({
        id,
        slug:      c.slug as string,
        name:      c.name as string,
        sportCode: (c.sport_code as string) ?? "football",
        status:    c.status as string,
        visible:   settings.visible,
        lifecycle: settings.lifecycle,
        seasons:   seasons.count ?? 0,
        rounds,
        fixtures:  fixtures.count ?? 0,
        teams:     teams.count ?? 0,
      });
    }

    setRows(out);
    setBusy(false);
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);

  async function runCheck(id: string) {
    const { report, error } = await checkReadiness(id);
    if (error) { setErr(error); return; }
    if (report) setCheck((c) => ({ ...c, [id]: report }));
  }

  async function changeLifecycle(id: string, lifecycle: Lifecycle) {
    // Going public runs the launch gate first — never make a broken
    // competition live. Every other transition is immediate.
    if (lifecycle === "public") {
      const res = await launchCompetition(id, false);
      if (res.error) { setErr(res.error); return; }
      if (!res.launched) {
        setCheck((c) => ({ ...c, [id]: { ready: false, competition: "", problems: res.problems, warnings: res.warnings } }));
        return;
      }
    }
    // Record the lifecycle for every transition (including public, so the
    // setting matches the launch gate's visibility flip).
    const { error } = await setLifecycle(id, lifecycle);
    if (error) { setErr(error); return; }
    await load();
  }

  if (loading || !user) return <div style={{ background: BG, minHeight: "100vh" }} />;

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Competitions</h1>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              Sport → Competition → Season → Round → Fixture
            </p>
          </div>
          <Link
            href="/admin/competitions/new"
            className="px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: ACCENT, color: "#03151c" }}
          >
            + Launch competition
          </Link>
        </div>

        {err && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "#2a0f0a", border: `1px solid ${RED}`, color: "#ffb3a0" }}>
            {err}
          </div>
        )}

        {busy && <p className="text-xs mb-3" style={{ color: MUTED }}>Loading…</p>}

        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const report = check[r.id];
            return (
              <div key={r.id} className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{r.name}</span>
                      <LifecycleBadge lifecycle={r.lifecycle} />
                    </div>
                    <Link href={`/${r.slug}`} className="text-xs font-mono" style={{ color: ACCENT }}>
                      /{r.slug}
                    </Link>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* The one operational control: draft → internal → public
                        → archived. Going public runs the launch gate first. */}
                    <select
                      value={r.lifecycle}
                      onChange={(e) => void changeLifecycle(r.id, e.target.value as Lifecycle)}
                      className="px-2 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: SURFACE, color: DIM, border: `1px solid ${BORDER}` }}
                    >
                      <option value="draft">Draft</option>
                      <option value="internal">Internal testing</option>
                      <option value="public">Public (live)</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button onClick={() => void runCheck(r.id)}
                            className="px-3 py-1 rounded-lg text-[11px] font-semibold"
                            style={{ border: `1px solid ${BORDER}`, color: DIM }}>
                      Run checks
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center">
                  {([
                    ["Sport",    r.sportCode],
                    ["Seasons",  r.seasons],
                    ["Rounds",   r.rounds],
                    ["Teams",    r.teams],
                    ["Fixtures", r.fixtures],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="py-2 rounded-lg" style={{ background: SURFACE }}>
                      <div className="text-sm font-bold" style={{ color: value === 0 ? RED : TEXT }}>{value}</div>
                      <div className="text-[10px]" style={{ color: MUTED }}>{label}</div>
                    </div>
                  ))}
                </div>

                {report && (
                  <div className="mt-3 text-xs">
                    {report.problems.length === 0 ? (
                      <p style={{ color: GREEN }}>✓ All launch checks pass</p>
                    ) : (
                      <>
                        <p className="font-semibold mb-1" style={{ color: AMBER }}>Blocking:</p>
                        <ul className="flex flex-col gap-0.5" style={{ color: "#ffd280" }}>
                          {report.problems.map((p, i) => <li key={i}>· {p}</li>)}
                        </ul>
                      </>
                    )}
                    {report.warnings.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5" style={{ color: MUTED }}>
                        {report.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!busy && rows.length === 0 && (
          <p className="text-xs text-center py-10" style={{ color: MUTED }}>
            No competitions yet.
          </p>
        )}
      </div>
    </div>
  );
}
