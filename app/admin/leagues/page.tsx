"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { updateLeagueAdmin, type PredictionLeague } from "@/lib/predictor";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// ── Types ─────────────────────────────────────────────────────

interface AdminLeagueRow {
  id:                 string;
  name:               string;
  visibility:         "private" | "public";
  is_featured:        boolean;
  suspended:          boolean;
  sponsor_name:       string | null;
  sponsor_url:        string | null;
  sponsor_description:string | null;
  member_count:       number;
  created_at:         string;
  competition_id:     string;
}

// ── Edit modal ────────────────────────────────────────────────

function EditModal({
  league,
  onClose,
  onSaved,
}: {
  league:   AdminLeagueRow;
  onClose:  () => void;
  onSaved:  (id: string, updates: Partial<AdminLeagueRow>) => void;
}) {
  const [visibility,   setVisibility]   = useState<"private" | "public">(league.visibility);
  const [isFeatured,   setIsFeatured]   = useState(league.is_featured);
  const [suspended,    setSuspended]    = useState(league.suspended);
  const [sponsorName,  setSponsorName]  = useState(league.sponsor_name ?? "");
  const [sponsorUrl,   setSponsorUrl]   = useState(league.sponsor_url ?? "");
  const [sponsorDesc,  setSponsorDesc]  = useState(league.sponsor_description ?? "");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: err } = await updateLeagueAdmin(league.id, {
      visibility,
      isFeatured,
      suspended,
      sponsorName:        sponsorName.trim() || null,
      sponsorUrl:         sponsorUrl.trim()  || null,
      sponsorDescription: sponsorDesc.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err); return; }
    onSaved(league.id, {
      visibility,
      is_featured:         isFeatured,
      suspended,
      sponsor_name:        sponsorName.trim() || null,
      sponsor_url:         sponsorUrl.trim()  || null,
      sponsor_description: sponsorDesc.trim() || null,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-cockpit-card border border-cockpit-border rounded-sm flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">{league.name}</h2>
          <button onClick={onClose} className="text-cockpit-muted hover:text-cockpit-dim text-lg leading-none">✕</button>
        </div>

        {/* Visibility */}
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Visibility</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "private" | "public")}
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>

        {/* Toggles */}
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4 accent-yellow-400"
            />
            <span className="text-cockpit-dim text-sm">Featured</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={suspended}
              onChange={(e) => setSuspended(e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-cockpit-dim text-sm">Suspended</span>
          </label>
        </div>

        {/* Sponsor fields */}
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Sponsor name</span>
          <input type="text" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)}
            placeholder="e.g. SmartSpace Solutions"
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Sponsor website</span>
          <input type="url" value={sponsorUrl} onChange={(e) => setSponsorUrl(e.target.value)}
            placeholder="https://example.com"
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Sponsor description</span>
          <textarea value={sponsorDesc} onChange={(e) => setSponsorDesc(e.target.value)}
            placeholder="Short description shown on the league card"
            rows={2}
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent resize-none" />
        </label>

        {error && <p className="text-cockpit-red text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex-1 disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function AdminLeaguesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [leagues,    setLeagues]    = useState<AdminLeagueRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editTarget, setEditTarget] = useState<AdminLeagueRow | null>(null);
  const [filter,     setFilter]     = useState<"all" | "public" | "featured" | "suspended">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace("/predict");
      return;
    }
    loadLeagues();
  }, [user, authLoading, router]);

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("prediction_leagues")
      .select(`
        id, name, visibility, is_featured, suspended,
        sponsor_name, sponsor_url, sponsor_description,
        created_at, competition_id,
        member_count:prediction_league_members(count)
      `)
      .order("created_at", { ascending: false });

    if (data) {
      const rows = (data as Record<string, unknown>[]).map((r) => ({
        id:                  r.id as string,
        name:                r.name as string,
        visibility:          (r.visibility as "private" | "public") ?? "private",
        is_featured:         (r.is_featured as boolean) ?? false,
        suspended:           (r.suspended as boolean) ?? false,
        sponsor_name:        r.sponsor_name as string | null,
        sponsor_url:         r.sponsor_url as string | null,
        sponsor_description: r.sponsor_description as string | null,
        member_count:        (Array.isArray(r.member_count) ? r.member_count[0]?.count : r.member_count) as number ?? 0,
        created_at:          r.created_at as string,
        competition_id:      r.competition_id as string,
      }));
      setLeagues(rows);
    }
    setLoading(false);
  }, []);

  function handleSaved(id: string, updates: Partial<AdminLeagueRow>) {
    setLeagues((prev) => prev.map((l) => l.id === id ? { ...l, ...updates } : l));
  }

  const filtered = leagues.filter((l) => {
    if (filter === "public")    return l.visibility === "public" && !l.is_featured;
    if (filter === "featured")  return l.is_featured;
    if (filter === "suspended") return l.suspended;
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-4xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-2">
              <Link href="/admin" className="hover:text-cockpit-dim transition-colors">Admin</Link>
              <span>/</span>
              <span className="text-cockpit-dim">Leagues</span>
            </div>
            <h1 className="text-xl font-bold text-white">League Management</h1>
            <p className="text-cockpit-dim text-sm mt-1">{leagues.length} total leagues</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 p-1 bg-cockpit-surface border border-cockpit-border rounded-sm">
          {(["all", "public", "featured", "suspended"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 py-1.5 rounded-sm text-xs font-semibold transition-all capitalize"
              style={{
                background: filter === f ? "#1e2a38" : "transparent",
                color:      filter === f ? "#fff"    : "#64748b",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* League list */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 && (
            <p className="text-cockpit-muted text-sm text-center py-8">No leagues match this filter.</p>
          )}
          {filtered.map((league) => (
            <div
              key={league.id}
              className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex items-start gap-3"
              style={{
                borderColor: league.suspended ? "#ff3d0030" : league.is_featured ? "#ffab0030" : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-white font-semibold text-sm">{league.name}</p>
                  {league.is_featured && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm" style={{ color: "#ffab00", background: "#ffab0015" }}>FEATURED</span>
                  )}
                  {league.visibility === "public" && !league.is_featured && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm" style={{ color: "#00e676", background: "#00e67615" }}>PUBLIC</span>
                  )}
                  {league.suspended && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm" style={{ color: "#ff3d00", background: "#ff3d0015" }}>SUSPENDED</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-cockpit-muted font-mono flex-wrap">
                  <span>{league.member_count} members</span>
                  {league.sponsor_name && <span>Sponsor: {league.sponsor_name}</span>}
                  <span>{new Date(league.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/predict/leagues/${league.id}`}
                  className="text-[10px] font-mono px-2 py-1.5 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors"
                >
                  View
                </Link>
                <button
                  onClick={() => setEditTarget(league)}
                  className="text-[10px] font-mono px-2 py-1.5 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        <Link href="/admin" className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono">
          ← Back to admin
        </Link>
      </div>

      {editTarget && (
        <EditModal
          league={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
