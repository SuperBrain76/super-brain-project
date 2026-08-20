"use client";

/**
 * /admin/funnel — the founder conversion funnel.
 *
 * Emails → Clicks → Signups → Trials → Completed onboarding → Active venues,
 * with drop-off at each step, plus a per-venue timeline: search "Blood Sports
 * Bar" and see every event in chronological order. Reads the admin-gated
 * get_venue_funnel / find_venues / get_venue_timeline RPCs directly (they are
 * security definer + assert_admin, same pattern as /admin/growth).
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const INK = "#0B0B0D", PANEL = "#141418", LINE = "rgba(255,255,255,0.10)";
const GOLD = "#E8C15A", CREAM = "#F5F5F2", MUTED = "#9A9AA3", GREEN = "#35C56F";

interface Funnel {
  prospects: number; emailed: number; clicked: number; signups: number;
  trials: number; onboarded: number; paying: number;
  active_venues: number; venues_with_predictions: number;
  events: { landing_views: number; start_clicks: number; signup_starts: number; checkouts_opened: number; launch_packs: number; qr_scans: number };
  generated_at: string;
}
interface TEvent { created_at: string; kind: string; label: string; category: string; severity: string; source: string; detail: any }
interface Timeline {
  found: boolean;
  venue?: { id: string; name: string; slug: string; status: string; city: string | null; country: string; contact_email: string | null; source: string; created_at: string };
  milestones?: Record<string, string | null>;
  product?: { players: number; first_player_at: string | null; predictions: number; first_prediction_at: string | null };
  events?: TEvent[];
}

const STAGES: { key: keyof Funnel; label: string }[] = [
  { key: "emailed",    label: "Emails" },
  { key: "clicked",    label: "Clicks" },
  { key: "signups",    label: "Signups" },
  { key: "trials",     label: "Trials" },
  { key: "onboarded",  label: "Onboarded" },
  { key: "active_venues", label: "Active venues" },
];

export default function FunnelPage() {
  const [f, setF]       = useState<Funnel | null>(null);
  const [err, setErr]   = useState("");
  const [q, setQ]       = useState("");
  const [tl, setTl]     = useState<Timeline | null>(null);
  const [tlBusy, setTlBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_venue_funnel");
    if (error) { setErr(error.message.includes("Admin") ? "Admin privileges required — your account isn't in app_admins." : error.message); return; }
    setErr(""); setF(data as Funnel);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const search = useCallback(async () => {
    if (!q.trim()) return;
    setTlBusy(true);
    const { data, error } = await supabase.rpc("get_venue_timeline", { p_query: q.trim() });
    setTlBusy(false);
    if (error) { setErr(error.message); return; }
    setTl(data as Timeline);
  }, [q]);

  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-black">Conversion funnel</h1>
          <a href="/admin/growth" className="text-xs" style={{ color: GOLD }}>Growth dashboard →</a>
        </div>

        {err && <div className="rounded-xl px-4 py-3 mb-5 text-sm" style={{ background: "#3a1414", border: "1px solid #5a2020", color: "#ffb4b4" }}>{err}</div>}

        {/* ── Funnel ── */}
        {f && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
            <div className="flex flex-col gap-2.5">
              {STAGES.map((s, i) => {
                const val = Number(f[s.key] ?? 0);
                const prev = i === 0 ? val : Number(f[STAGES[i - 1].key] ?? 0);
                const top = Number(f[STAGES[0].key] ?? 0) || 1;
                const pctOfTop = Math.round((val / top) * 100);
                // "—" when there is no prior-stage volume to convert from
                // (e.g. pre-outreach, or inbound venues that skipped email).
                const conv = (i === 0 || prev === 0) ? null : Math.round((val / prev) * 100);
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className="w-28 text-sm font-bold shrink-0">{s.label}</div>
                    <div className="flex-1 h-9 rounded-lg overflow-hidden relative" style={{ background: "#ffffff08" }}>
                      <div className="h-full rounded-lg flex items-center px-3" style={{ width: `${Math.max(pctOfTop, 6)}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD}bb)`, minWidth: 44 }}>
                        <span className="text-sm font-black" style={{ color: "#2A2205" }}>{val}</span>
                      </div>
                    </div>
                    <div className="w-24 text-right text-xs shrink-0" style={{ color: MUTED }}>
                      {conv === null ? "—" : <><span style={{ color: conv >= 50 ? GREEN : conv >= 20 ? GOLD : "#ff8a8a" }}>{conv}%</span> of prev</>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] mt-4" style={{ color: MUTED }}>
              {f.prospects} prospects in CRM · {f.paying} paying · {f.venues_with_predictions} venues with live predictions ·
              updated {new Date(f.generated_at).toLocaleTimeString()}
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: "#6b6b73" }}>
              Each stage is an independent count of venues that reached it. A venue can enter mid-funnel (a direct/inbound
              signup skips Emails &amp; Clicks) — once outreach runs, Emails is the top and the funnel fills top-down.
              &ldquo;Active venues&rdquo; = a real customer (not the owner) has joined a league.
            </div>
          </div>
        )}

        {/* ── Web event volumes ── */}
        {f && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              ["Landing views", f.events.landing_views],
              ["Start clicks", f.events.start_clicks],
              ["Signup starts", f.events.signup_starts],
              ["Checkouts", f.events.checkouts_opened],
              ["Launch Packs", f.events.launch_packs],
              ["QR scans", f.events.qr_scans],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-xl p-3.5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                <div className="text-xl font-black" style={{ color: GOLD }}>{val as number}</div>
                <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{label as string}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Per-venue timeline ── */}
        <div className="rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
          <div className="text-sm font-black mb-3">Per-venue timeline</div>
          <div className="flex gap-2 mb-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder='Search a venue — e.g. "Blood Sports Bar"'
              className="flex-1 rounded-lg px-3.5 py-2.5 text-sm outline-none"
              style={{ background: "#ffffff08", border: `1px solid ${LINE}`, color: CREAM }} />
            <button onClick={search} disabled={tlBusy} className="px-5 rounded-lg text-sm font-black" style={{ background: GOLD, color: "#2A2205" }}>{tlBusy ? "…" : "Open"}</button>
          </div>

          {tl && !tl.found && <div className="text-sm" style={{ color: MUTED }}>No venue matches that.</div>}

          {tl?.found && tl.venue && (
            <div>
              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <span className="text-lg font-black">{tl.venue.name}</span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: `${GOLD}22`, color: GOLD }}>{tl.venue.status}</span>
                <span className="text-xs" style={{ color: MUTED }}>{[tl.venue.city, tl.venue.country].filter(Boolean).join(", ")} · {tl.venue.contact_email ?? "no email"}</span>
              </div>
              {tl.product && (
                <div className="text-xs mb-4" style={{ color: MUTED }}>
                  <b style={{ color: tl.product.players ? GREEN : MUTED }}>{tl.product.players} players</b> ·{" "}
                  <b style={{ color: tl.product.predictions ? GREEN : MUTED }}>{tl.product.predictions} predictions</b>
                  {tl.product.first_player_at && ` · first player ${fmt(tl.product.first_player_at)}`}
                </div>
              )}

              {/* Chronological event stream */}
              <div className="flex flex-col">
                {(tl.events ?? []).length === 0 && <div className="text-sm" style={{ color: MUTED }}>No events yet.</div>}
                {(tl.events ?? []).map((e, i) => (
                  <div key={i} className="flex gap-3 py-2" style={{ borderTop: i ? `1px solid ${LINE}` : "none" }}>
                    <div className="w-36 shrink-0 text-[11px]" style={{ color: MUTED }}>{fmt(e.created_at)}</div>
                    <div className="w-1.5 shrink-0 rounded-full" style={{ background: sevColor(e.severity) }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{e.label}</div>
                      <div className="text-[11px]" style={{ color: MUTED }}>
                        <span style={{ color: catColor(e.category) }}>{e.category}</span> · {e.source}{detailLine(e.detail) ? ` · ${detailLine(e.detail)}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(iso: string) { try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } }
function sevColor(s: string) { return s === "error" ? "#ff5a5a" : s === "warn" ? "#E8C15A" : "#3a3a42"; }
function catColor(c: string) { return { acquisition: "#5aa0ff", onboarding: "#E8C15A", billing: "#35C56F", product: "#c77dff", provisioning: "#35C56F" }[c] ?? "#9A9AA3"; }
function detailLine(d: any): string {
  if (!d || typeof d !== "object") return "";
  const bits: string[] = [];
  if (d.competition) bits.push(String(d.competition));
  if (Array.isArray(d.slugs)) bits.push(d.slugs.join(", "));
  if (d.plan) bits.push(String(d.plan));
  if (d.path) bits.push(String(d.path));
  if (d.error) bits.push(`error: ${String(d.error).slice(0, 60)}`);
  return bits.slice(0, 2).join(" · ");
}
