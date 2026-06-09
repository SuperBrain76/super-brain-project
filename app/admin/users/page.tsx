"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// ── Types ─────────────────────────────────────────────────────

interface UserRow {
  id:              string;
  display_name:    string | null;
  country:         string | null;
  created_at:      string | null;
  prediction_count: number;
  league_count:    number;
}

// ── Page ──────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [users,    setUsers]    = useState<UserRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [sortBy,   setSortBy]   = useState<"joined" | "name" | "preds" | "leagues">("joined");
  const [sortAsc,  setSortAsc]  = useState(false);
  const [copied,   setCopied]   = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) { router.replace("/predict"); return; }
    loadUsers();
  }, [user, authLoading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = useCallback(async () => {
    setLoading(true);

    // Fetch all user profiles
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name, country, created_at")
      .order("created_at", { ascending: false });

    if (!profiles) { setLoading(false); return; }

    const ids = profiles.map((p) => p.id as string);

    // Fetch prediction counts per user
    const { data: predCounts } = await supabase
      .from("predictions")
      .select("user_id")
      .in("user_id", ids);

    // Fetch league membership counts per user
    const { data: memberCounts } = await supabase
      .from("prediction_league_members")
      .select("user_id")
      .in("user_id", ids);

    // Build count maps
    const predMap = new Map<string, number>();
    for (const p of (predCounts ?? [])) {
      const uid = p.user_id as string;
      predMap.set(uid, (predMap.get(uid) ?? 0) + 1);
    }

    const leagueMap = new Map<string, number>();
    for (const m of (memberCounts ?? [])) {
      const uid = m.user_id as string;
      leagueMap.set(uid, (leagueMap.get(uid) ?? 0) + 1);
    }

    setUsers(profiles.map((p) => ({
      id:               p.id as string,
      display_name:     (p.display_name as string | null) ?? null,
      country:          (p.country as string | null) ?? null,
      created_at:       p.created_at as string | null,
      prediction_count: predMap.get(p.id as string) ?? 0,
      league_count:     leagueMap.get(p.id as string) ?? 0,
    })));

    setLoading(false);
  }, []);

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  // Filter
  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.display_name ?? "").toLowerCase().includes(q) ||
      (u.country ?? "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let v = 0;
    if (sortBy === "joined") v = (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
    if (sortBy === "name")   v = (a.display_name ?? "").localeCompare(b.display_name ?? "");
    if (sortBy === "preds")  v = a.prediction_count - b.prediction_count;
    if (sortBy === "leagues") v = a.league_count - b.league_count;
    return sortAsc ? v : -v;
  });

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortAsc((v) => !v);
    else { setSortBy(col); setSortAsc(false); }
  }

  function SortHeader({ col, label }: { col: typeof sortBy; label: string }) {
    const active = sortBy === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest transition-colors"
        style={{ color: active ? "#e2e8f0" : "#64748b" }}
      >
        {label}
        {active && <span style={{ color: "#94a3b8" }}>{sortAsc ? "↑" : "↓"}</span>}
      </button>
    );
  }

  const withPreds = users.filter((u) => u.prediction_count > 0).length;
  const withLeagues = users.filter((u) => u.league_count > 0).length;
  const totalPreds = users.reduce((s, u) => s + u.prediction_count, 0);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading users…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-2">
            <Link href="/admin" className="hover:text-cockpit-dim transition-colors">Admin</Link>
            <span>/</span>
            <Link href="/admin/leagues" className="hover:text-cockpit-dim transition-colors">Leagues</Link>
            <span>/</span>
            <span className="text-cockpit-dim">Users</span>
          </div>
          <h1 className="text-xl font-bold text-white">Signed-up Users</h1>
          <p className="text-cockpit-dim text-sm mt-1">
            {users.length} total · {withPreds} have predicted · {totalPreds.toLocaleString()} predictions submitted
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total users",     val: users.length.toLocaleString() },
            { label: "Have predicted",  val: withPreds.toLocaleString() },
            { label: "In a league",     val: withLeagues.toLocaleString() },
            { label: "Total preds",     val: totalPreds.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="bg-cockpit-surface border border-cockpit-border rounded-sm px-3 py-2 text-center">
              <p className="text-lg font-black text-white">{s.val}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, country or user ID…"
          className="bg-cockpit-surface border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent placeholder-cockpit-border w-full"
        />

        {/* Table */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_70px_70px_130px_28px] gap-3 px-4 py-2.5 bg-cockpit-surface border-b border-cockpit-border">
            <SortHeader col="name"    label="Name" />
            <SortHeader col="preds"   label="Preds" />
            <SortHeader col="leagues" label="Leagues" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted">Country</span>
            <SortHeader col="joined"  label="Joined" />
            <span />
          </div>

          {/* Skeleton */}
          {loading && Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_70px_70px_130px_28px] gap-3 px-4 py-3 border-b border-cockpit-border last:border-0">
              <div className="h-3 w-32 bg-cockpit-border rounded animate-pulse" />
              <div className="h-3 w-10 bg-cockpit-border rounded animate-pulse" />
              <div className="h-3 w-8  bg-cockpit-border rounded animate-pulse" />
              <div className="h-3 w-12 bg-cockpit-border rounded animate-pulse" />
              <div className="h-3 w-20 bg-cockpit-border rounded animate-pulse" />
              <div className="h-3 w-5  bg-cockpit-border rounded animate-pulse" />
            </div>
          ))}

          {/* Empty */}
          {!loading && sorted.length === 0 && (
            <div className="py-12 text-center text-cockpit-muted text-sm">No users found.</div>
          )}

          {/* Rows */}
          {sorted.map((u) => {
            const joined = u.created_at
              ? new Date(u.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                })
              : "—";
            const hasActivity = u.prediction_count > 0 || u.league_count > 0;
            return (
              <div
                key={u.id}
                className="grid grid-cols-[1fr_80px_70px_70px_130px_28px] gap-3 px-4 py-3 border-b border-cockpit-border last:border-0 hover:bg-cockpit-surface transition-colors"
              >
                {/* Name + ID */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">
                      {u.display_name ?? <span className="text-cockpit-muted italic">No name</span>}
                    </p>
                    {!hasActivity && (
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded-sm shrink-0"
                        style={{ color: "#64748b", background: "#1e293b" }}>inactive</span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-cockpit-border mt-0.5 truncate">{u.id}</p>
                </div>

                {/* Prediction count */}
                <span className={`text-sm font-bold self-center tabular-nums ${
                  u.prediction_count > 0 ? "text-white" : "text-cockpit-border"
                }`}>
                  {u.prediction_count > 0 ? u.prediction_count : "—"}
                </span>

                {/* League count */}
                <span className={`text-sm font-bold self-center tabular-nums ${
                  u.league_count > 0 ? "text-cockpit-accent" : "text-cockpit-border"
                }`}>
                  {u.league_count > 0 ? u.league_count : "—"}
                </span>

                {/* Country */}
                <span className="text-cockpit-muted text-xs self-center font-mono">
                  {u.country ?? "—"}
                </span>

                {/* Joined */}
                <span className="text-cockpit-muted text-xs self-center font-mono">{joined}</span>

                {/* Copy ID */}
                <button
                  onClick={() => copyId(u.id)}
                  title="Copy user ID"
                  className="self-center text-cockpit-border hover:text-cockpit-accent transition-colors"
                >
                  {copied === u.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer count */}
        <p className="text-center text-cockpit-muted text-xs font-mono">
          Showing {sorted.length} of {users.length} users
        </p>

        <div className="flex items-center justify-between text-xs text-cockpit-muted font-mono pt-2">
          <Link href="/admin/leagues" className="hover:text-cockpit-dim transition-colors">← Leagues</Link>
          <Link href="/admin" className="hover:text-cockpit-dim transition-colors">Admin home</Link>
        </div>
      </div>
    </div>
  );
}
