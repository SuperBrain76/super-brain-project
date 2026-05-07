"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Gated by NEXT_PUBLIC_ADMIN_EMAIL — UI-only guard for private beta.
// The underlying get_all_feedback() RPC is authenticated-only via Supabase.
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

interface FeedbackRow {
  id:             string;
  created_at:     string;
  test_name:      string;
  score:          number;
  result_title:   string;
  felt_options:   string[];
  would_share:    string | null;
  almost_quit:    string | null;
  test_suggestion:string | null;
  user_id:        string | null;
}

function ShareBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-cockpit-muted text-xs">—</span>;
  const colors: Record<string, string> = {
    Yes:   "text-cockpit-green  border-cockpit-green",
    Maybe: "text-cockpit-amber  border-cockpit-amber",
    No:    "text-cockpit-red    border-cockpit-red",
  };
  const cls = colors[value] ?? "text-cockpit-muted border-cockpit-border";
  return (
    <span className={`text-xs font-semibold border px-2 py-0.5 rounded-sm ${cls}`} style={{ borderColor: "currentColor", opacity: 0.8 }}>
      {value}
    </span>
  );
}

export default function AdminFeedbackPage() {
  const { user, loading } = useAuth();
  const [rows,    setRows]    = useState<FeedbackRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error,   setError]   = useState("");

  const isAdmin = !!ADMIN_EMAIL && user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (loading || !isAdmin) return;
    setFetching(true);
    supabase
      .rpc("get_all_feedback")
      .then(({ data, error: err }) => {
        setFetching(false);
        if (err) { setError("Could not load feedback — check RPC permissions."); return; }
        setRows((data as FeedbackRow[]) ?? []);
      });
  }, [loading, isAdmin]);

  // ── Auth loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  // ── Access denied ──────────────────────────────────────────
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-4 px-5 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff3d00" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p className="text-cockpit-dim text-lg font-semibold">Access denied</p>
        <p className="text-cockpit-muted text-sm max-w-xs">
          This page is restricted. You must be signed in as the configured admin.
        </p>
      </div>
    );
  }

  // ── Supabase not configured ────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm">Supabase not configured.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-5xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-1 font-mono">Admin</p>
            <h1 className="text-2xl font-extrabold text-white">Feedback Review</h1>
            <p className="text-cockpit-dim text-sm mt-1">{rows.length} response{rows.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse" />
            <span className="text-cockpit-muted text-xs font-mono">{user.email}</span>
          </div>
        </div>

        {/* Loading */}
        {fetching && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-cockpit-card border border-cockpit-border rounded-sm animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {/* Error */}
        {!fetching && error && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-8 text-center">
            <p className="text-cockpit-red text-sm mb-1">{error}</p>
            <p className="text-cockpit-muted text-xs">Make sure the <code className="font-mono">get_all_feedback</code> RPC exists and is granted to authenticated users.</p>
          </div>
        )}

        {/* Empty */}
        {!fetching && !error && rows.length === 0 && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-12 text-center">
            <p className="text-cockpit-dim">No feedback submitted yet.</p>
          </div>
        )}

        {/* Rows */}
        {!fetching && !error && rows.length > 0 && (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <div key={row.id} className="bg-cockpit-card border border-cockpit-border rounded-sm p-5">
                {/* Row header */}
                <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-white font-semibold text-sm">{row.test_name}</span>
                    <span
                      className="text-xs font-bold number-display px-2 py-0.5 rounded-sm border"
                      style={{ color: "#00d4ff", borderColor: "#00d4ff30", background: "#00d4ff10" }}
                    >
                      {row.score}/100
                    </span>
                    <span className="text-cockpit-muted text-xs">{row.result_title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cockpit-muted text-xs font-mono">
                      {new Date(row.created_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <ShareBadge value={row.would_share} />
                  </div>
                </div>

                {/* Sentiment chips */}
                {row.felt_options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {row.felt_options.map((opt) => (
                      <span
                        key={opt}
                        className="text-xs px-2 py-0.5 rounded-sm border border-cockpit-border text-cockpit-dim"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Free-text fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                  {row.almost_quit && (
                    <div>
                      <span className="text-cockpit-muted text-xs">Almost quit: </span>
                      <span className="text-cockpit-dim text-xs">{row.almost_quit}</span>
                    </div>
                  )}
                  {row.test_suggestion && (
                    <div>
                      <span className="text-cockpit-muted text-xs">Suggestion: </span>
                      <span className="text-cockpit-dim text-xs">{row.test_suggestion}</span>
                    </div>
                  )}
                </div>

                {/* User ID */}
                {row.user_id && (
                  <p className="text-cockpit-muted text-xs font-mono mt-2 opacity-40">
                    uid: {row.user_id}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
