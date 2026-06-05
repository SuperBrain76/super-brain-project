"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const TEST_NAMES = [
  "All tests",
  "Tap Speed Test",
  "Stroop Test",
  "Verbal Memory Test",
  "Reaction Speed Test",
  "Pressure Decision Test",
  "Memory & Focus Test",
  "Focus & Attention Test",
  "Fighter Pilot Cognitive Test",
  "Career Cognitive Profile",
];

interface Row {
  id:           string;
  user_id:      string;
  test_name:    string;
  score:        number;
  result_title: string;
  created_at:   string;
  share_id:     string | null;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router            = useRouter();

  const [rows,     setRows]     = useState<Row[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [test,     setTest]     = useState("All tests");
  const [search,   setSearch]   = useState("");
  const [fetching, setFetching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard: only admin can see this page
  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const fetchRows = useCallback(async (p: number, t: string, s: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setFetching(true);
    setSelected(new Set());

    const params = new URLSearchParams({ page: String(p) });
    if (t !== "All tests") params.set("test", t);
    if (s) params.set("search", s);

    const res = await fetch(`/api/admin/results?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    setFetching(false);
    if (res.ok) { setRows(json.results); setTotal(json.total); }
    else setMsg({ text: json.error ?? "Failed to load", ok: false });
  }, []);

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) fetchRows(page, test, search);
  }, [user, page, test, fetchRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchRows(1, test, val), 400);
  };

  const handleTestChange = (t: string) => {
    setTest(t);
    setPage(1);
    fetchRows(1, t, search);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} result(s)? This cannot be undone.`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setDeleting(true);
    const res = await fetch("/api/admin/results", {
      method:  "DELETE",
      headers: {
        "Content-Type":  "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ids: [...selected] }),
    });
    const json = await res.json();
    setDeleting(false);

    if (res.ok) {
      setMsg({ text: `✓ Deleted ${json.deleted} result(s)`, ok: true });
      fetchRows(page, test, search);
    } else {
      setMsg({ text: json.error ?? "Delete failed", ok: false });
    }
    setTimeout(() => setMsg(null), 3500);
  };

  if (loading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-muted text-sm animate-pulse">Checking access…</p>
      </div>
    );
  }

  const pages = Math.ceil(total / 50);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">

      {/* Header */}
      <div className="mb-6">
        <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-1">Admin</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Score Manager</h1>
          <a
            href="/admin/leagues"
            className="text-xs px-3 py-2 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors font-mono tracking-widest uppercase"
          >
            League Admin →
          </a>
        </div>
        <p className="text-cockpit-dim text-sm mt-0.5">
          {total.toLocaleString()} results total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={test}
          onChange={(e) => handleTestChange(e.target.value)}
          className="bg-cockpit-card border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
        >
          {TEST_NAMES.map((t) => <option key={t}>{t}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search player…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="bg-cockpit-card border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent w-48"
        />

        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="ml-auto px-4 py-2 bg-red-900/30 border border-red-700/50 text-red-400 text-sm font-bold rounded-sm hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : `Delete ${selected.size} selected`}
          </button>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm font-medium border ${
          msg.ok
            ? "bg-green-900/20 border-green-700/40 text-green-400"
            : "bg-red-900/20 border-red-700/40 text-red-400"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[32px_1fr_140px_60px_120px_100px_36px] gap-3 px-4 py-2.5 bg-cockpit-surface border-b border-cockpit-border text-cockpit-muted text-xs tracking-widest uppercase">
          <input
            type="checkbox"
            checked={rows.length > 0 && selected.size === rows.length}
            onChange={toggleAll}
            className="accent-cockpit-accent"
          />
          <span>Player / Test</span>
          <span>Title</span>
          <span className="text-right">Score</span>
          <span>Date</span>
          <span>User ID</span>
          <span />
        </div>

        {/* Skeleton */}
        {fetching && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[32px_1fr_140px_60px_120px_100px_36px] gap-3 px-4 py-3 border-b border-cockpit-border last:border-0">
            <div className="h-4 w-4 bg-cockpit-border rounded animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-32 bg-cockpit-border rounded animate-pulse" />
              <div className="h-2.5 w-24 bg-cockpit-border rounded animate-pulse opacity-60" />
            </div>
            <div className="h-3 w-20 bg-cockpit-border rounded animate-pulse" />
            <div className="h-3 w-8 bg-cockpit-border rounded animate-pulse ml-auto" />
            <div className="h-3 w-20 bg-cockpit-border rounded animate-pulse" />
            <div className="h-3 w-14 bg-cockpit-border rounded animate-pulse" />
            <div className="h-3 w-6 bg-cockpit-border rounded animate-pulse" />
          </div>
        ))}

        {/* Empty */}
        {!fetching && rows.length === 0 && (
          <div className="py-12 text-center text-cockpit-muted text-sm">No results found.</div>
        )}

        {/* Rows */}
        {!fetching && rows.map((r) => {
          const isSelected = selected.has(r.id);
          const date = new Date(r.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          });
          return (
            <div
              key={r.id}
              onClick={() => toggleSelect(r.id)}
              className={`grid grid-cols-[32px_1fr_140px_60px_120px_100px_36px] gap-3 px-4 py-3 border-b border-cockpit-border last:border-0 cursor-pointer transition-colors ${
                isSelected ? "bg-cockpit-accent/5 border-l-2 border-l-cockpit-accent" : "hover:bg-cockpit-surface"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(r.id)}
                onClick={(e) => e.stopPropagation()}
                className="accent-cockpit-accent"
              />
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{r.test_name}</p>
                <p className="text-cockpit-muted text-xs truncate">{r.user_id.slice(0, 8)}…</p>
              </div>
              <span className="text-cockpit-dim text-xs self-center truncate">{r.result_title}</span>
              <span className="text-white font-bold text-sm number-display self-center text-right">{r.score}</span>
              <span className="text-cockpit-muted text-xs self-center">{date}</span>
              <span className="text-cockpit-muted text-xs self-center font-mono">{r.user_id.slice(0, 8)}…</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(new Set([r.id]));
                  setTimeout(() => deleteSelected(), 0);
                }}
                className="self-center text-cockpit-border hover:text-red-400 transition-colors"
                title="Delete this result"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-cockpit-muted text-xs">
            Page {page} of {pages} · {total} results
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-cockpit-border text-cockpit-dim rounded-sm hover:border-cockpit-accent disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-3 py-1.5 text-xs border border-cockpit-border text-cockpit-dim rounded-sm hover:border-cockpit-accent disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
