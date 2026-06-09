"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { updateLeagueAdmin } from "@/lib/predictor";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// ── Types ─────────────────────────────────────────────────────

interface AdminLeagueRow {
  id:                  string;
  name:                string;
  invite_code:         string;
  visibility:          "private" | "public";
  is_featured:         boolean;
  suspended:           boolean;
  sponsor_name:        string | null;
  sponsor_url:         string | null;
  sponsor_description: string | null;
  member_count:        number;
  created_at:          string;
  competition_id:      string;
  // creator info (joined from user_profiles)
  creator_display_name: string | null;
  creator_id:           string;
}

interface MemberRow {
  user_id:      string;
  display_name: string | null;
  country:      string | null;
  joined_at:    string | null;
  is_owner:     boolean;
}

// ── Edit modal ────────────────────────────────────────────────

function EditModal({
  league, onClose, onSaved,
}: {
  league:  AdminLeagueRow;
  onClose: () => void;
  onSaved: (id: string, updates: Partial<AdminLeagueRow>) => void;
}) {
  const [visibility,  setVisibility]  = useState<"private" | "public">(league.visibility);
  const [isFeatured,  setIsFeatured]  = useState(league.is_featured);
  const [suspended,   setSuspended]   = useState(league.suspended);
  const [sponsorName, setSponsorName] = useState(league.sponsor_name ?? "");
  const [sponsorUrl,  setSponsorUrl]  = useState(league.sponsor_url  ?? "");
  const [sponsorDesc, setSponsorDesc] = useState(league.sponsor_description ?? "");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setError(null);
    const { error: err } = await updateLeagueAdmin(league.id, {
      visibility, isFeatured, suspended,
      sponsorName:        sponsorName.trim() || null,
      sponsorUrl:         sponsorUrl.trim()  || null,
      sponsorDescription: sponsorDesc.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err); return; }
    onSaved(league.id, {
      visibility, is_featured: isFeatured, suspended,
      sponsor_name: sponsorName.trim() || null,
      sponsor_url:  sponsorUrl.trim()  || null,
      sponsor_description: sponsorDesc.trim() || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-cockpit-card border border-cockpit-border rounded-sm flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">{league.name}</h2>
          <button onClick={onClose} className="text-cockpit-muted hover:text-cockpit-dim text-lg leading-none">✕</button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Visibility</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as "private" | "public")}
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent">
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="w-4 h-4 accent-yellow-400" />
            <span className="text-cockpit-dim text-sm">Featured</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={suspended} onChange={(e) => setSuspended(e.target.checked)} className="w-4 h-4 accent-red-500" />
            <span className="text-cockpit-dim text-sm">Suspended</span>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Sponsor name</span>
          <input value={sponsorName} onChange={(e) => setSponsorName(e.target.value)}
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Sponsor URL</span>
          <input value={sponsorUrl} onChange={(e) => setSponsorUrl(e.target.value)}
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Sponsor description</span>
          <textarea value={sponsorDesc} onChange={(e) => setSponsorDesc(e.target.value)} rows={2}
            className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent resize-none" />
        </label>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-cockpit-muted hover:text-cockpit-dim transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-xs bg-cockpit-accent/20 border border-cockpit-accent/40 text-cockpit-accent rounded-sm hover:bg-cockpit-accent/30 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Members panel (expandable) ────────────────────────────────

function MembersPanel({ leagueId, creatorId }: { leagueId: string; creatorId: string }) {
  const [members,  setMembers]  = useState<MemberRow[] | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data: memberData } = await supabase
        .from("prediction_league_members")
        .select("user_id, joined_at")
        .eq("league_id", leagueId);

      if (!memberData) { setLoading(false); return; }

      const ids = memberData.map((m) => m.user_id as string);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, country")
        .in("id", ids);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id as string, p])
      );

      setMembers(memberData.map((m) => {
        const p = profileMap.get(m.user_id as string);
        return {
          user_id:      m.user_id as string,
          display_name: (p?.display_name as string | null) ?? null,
          country:      (p?.country as string | null) ?? null,
          joined_at:    m.joined_at as string | null,
          is_owner:     m.user_id === creatorId,
        };
      }).sort((a, b) => (a.is_owner ? -1 : b.is_owner ? 1 : 0)));

      setLoading(false);
    })();
  }, [leagueId, creatorId]);

  if (loading) return (
    <div className="px-4 pb-3 pt-1">
      <p className="text-cockpit-muted text-xs animate-pulse">Loading members…</p>
    </div>
  );
  if (!members || members.length === 0) return (
    <div className="px-4 pb-3 pt-1">
      <p className="text-cockpit-muted text-xs">No members yet.</p>
    </div>
  );

  return (
    <div className="border-t border-cockpit-border mt-2 pt-2 pb-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted px-4 mb-2">
        {members.length} member{members.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col divide-y divide-cockpit-border/40">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 px-4 py-1.5">
            <div className="flex-1 min-w-0">
              <span className="text-white text-xs font-medium">
                {m.display_name ?? "—"}
              </span>
              {m.is_owner && (
                <span className="ml-2 text-[9px] font-mono px-1 py-0.5 rounded-sm"
                  style={{ color: "#ffab00", background: "#ffab0015" }}>OWNER</span>
              )}
            </div>
            {m.country && (
              <span className="text-cockpit-muted text-[10px] font-mono shrink-0">{m.country}</span>
            )}
            <span className="text-cockpit-muted text-[10px] font-mono shrink-0">
              {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "—"}
            </span>
            <span className="text-cockpit-border text-[9px] font-mono shrink-0">
              {m.user_id.slice(0, 8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── League card ───────────────────────────────────────────────

function LeagueCard({
  league,
  onEdit,
}: {
  league: AdminLeagueRow;
  onEdit: (l: AdminLeagueRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden"
      style={{
        borderColor: league.suspended ? "#ff3d0030" :
                     league.is_featured ? "#ffab0030" : undefined,
      }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          {/* Name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-white font-semibold text-sm">{league.name}</p>
            {league.is_featured && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
                style={{ color: "#ffab00", background: "#ffab0015" }}>FEATURED</span>
            )}
            {league.visibility === "public" && !league.is_featured && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
                style={{ color: "#00e676", background: "#00e67615" }}>PUBLIC</span>
            )}
            {league.suspended && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm"
                style={{ color: "#ff3d00", background: "#ff3d0015" }}>SUSPENDED</span>
            )}
          </div>

          {/* Meta: invite code, creator, member count, date */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-cockpit-muted uppercase tracking-widest">Code</span>
              <span className="text-[11px] font-mono font-bold text-cockpit-accent">{league.invite_code}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-cockpit-muted uppercase tracking-widest">Members</span>
              <span className="text-[11px] font-mono text-cockpit-dim">{league.member_count}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-cockpit-muted uppercase tracking-widest">Created by</span>
              <span className="text-[11px] text-cockpit-dim truncate max-w-[120px]">
                {league.creator_display_name ?? league.creator_id.slice(0, 8)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-cockpit-muted uppercase tracking-widest">Date</span>
              <span className="text-[11px] font-mono text-cockpit-muted">
                {new Date(league.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Creator user ID */}
          <p className="text-[9px] font-mono text-cockpit-border mt-1">
            Creator ID: {league.creator_id}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex gap-1.5">
            <Link href={`/predict/leagues/${league.id}`} target="_blank"
              className="text-[10px] font-mono px-2 py-1.5 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors">
              View
            </Link>
            <button onClick={() => onEdit(league)}
              className="text-[10px] font-mono px-2 py-1.5 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors">
              Edit
            </button>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] font-mono px-2 py-1 rounded-sm text-cockpit-muted hover:text-cockpit-dim transition-colors"
          >
            {expanded ? "▲ Hide members" : "▼ Show members"}
          </button>
        </div>
      </div>

      {/* Members panel */}
      {expanded && <MembersPanel leagueId={league.id} creatorId={league.creator_id} />}
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
  const [search,     setSearch]     = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) { router.replace("/predict"); return; }
    loadLeagues();
  }, [user, authLoading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("prediction_leagues")
      .select(`
        id, name, invite_code, visibility, is_featured, suspended,
        sponsor_name, sponsor_url, sponsor_description,
        created_at, competition_id, created_by,
        member_count:prediction_league_members(count)
      `)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Fetch creator display names
    const creatorIds = [...new Set(data.map((r) => r.created_by as string))];
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", creatorIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));

    setLeagues((data as Record<string, unknown>[]).map((r) => ({
      id:                  r.id as string,
      name:                r.name as string,
      invite_code:         r.invite_code as string,
      visibility:          (r.visibility as "private" | "public") ?? "private",
      is_featured:         (r.is_featured as boolean) ?? false,
      suspended:           (r.suspended as boolean) ?? false,
      sponsor_name:        r.sponsor_name as string | null,
      sponsor_url:         r.sponsor_url as string | null,
      sponsor_description: r.sponsor_description as string | null,
      member_count:        (Array.isArray(r.member_count) ? r.member_count[0]?.count : r.member_count) as number ?? 0,
      created_at:          r.created_at as string,
      competition_id:      r.competition_id as string,
      creator_id:          r.created_by as string,
      creator_display_name: profileMap.get(r.created_by as string) ?? null,
    })));

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
  }).filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.invite_code.toLowerCase().includes(q) ||
      (l.creator_display_name ?? "").toLowerCase().includes(q) ||
      l.creator_id.includes(q)
    );
  });

  const totalMembers = leagues.reduce((sum, l) => sum + l.member_count, 0);

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
            <p className="text-cockpit-dim text-sm mt-1">
              {leagues.length} leagues · {totalMembers} total memberships
            </p>
          </div>
          <Link href="/admin/users"
            className="text-xs px-3 py-2 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors font-mono">
            All Users →
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total",     val: leagues.length },
            { label: "Public",    val: leagues.filter((l) => l.visibility === "public").length },
            { label: "Featured",  val: leagues.filter((l) => l.is_featured).length },
            { label: "Suspended", val: leagues.filter((l) => l.suspended).length },
          ].map((s) => (
            <div key={s.label} className="bg-cockpit-surface border border-cockpit-border rounded-sm px-3 py-2 text-center">
              <p className="text-lg font-black text-white">{s.val}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 p-1 bg-cockpit-surface border border-cockpit-border rounded-sm">
            {(["all", "public", "featured", "suspended"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-sm text-xs font-semibold transition-all capitalize"
                style={{
                  background: filter === f ? "#1e2a38" : "transparent",
                  color:      filter === f ? "#fff"    : "#64748b",
                }}>
                {f}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, creator…"
            className="flex-1 min-w-[200px] bg-cockpit-surface border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-1.5 text-xs focus:outline-none focus:border-cockpit-accent placeholder-cockpit-border"
          />
        </div>

        {/* League list */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 && (
            <p className="text-cockpit-muted text-sm text-center py-8">No leagues match.</p>
          )}
          {filtered.map((league) => (
            <LeagueCard key={league.id} league={league} onEdit={setEditTarget} />
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-cockpit-muted font-mono pt-2">
          <Link href="/admin" className="hover:text-cockpit-dim transition-colors">← Back to admin</Link>
          <Link href="/admin/users" className="hover:text-cockpit-dim transition-colors">All users →</Link>
        </div>
      </div>

      {editTarget && (
        <EditModal league={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
