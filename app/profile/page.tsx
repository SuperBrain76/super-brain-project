"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadMyResults } from "@/lib/results";
import { getRankingColor } from "@/lib/scoring";
import type { SavedResult } from "@/types";

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [results, setResults]   = useState<SavedResult[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    loadMyResults().then((r) => { setResults(r); setFetching(false); });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">Profile</p>
            <h1 className="text-3xl font-bold text-white">{user.email}</h1>
          </div>
          <button
            onClick={signOut}
            className="btn-ghost text-sm"
          >
            Sign out
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: "Tests taken", value: results.length },
            {
              label: "Best score",
              value: results.length > 0 ? Math.max(...results.map((r) => r.score)) : "—",
            },
            {
              label: "Avg score",
              value:
                results.length > 0
                  ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
                  : "—",
            },
          ].map((s) => (
            <div key={s.label} className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 text-center">
              <div className="text-2xl font-bold number-display text-cockpit-accent">{s.value}</div>
              <div className="text-cockpit-muted text-xs tracking-widest uppercase mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Results list */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Previous Results</h2>
          <Link href="/tests" className="text-cockpit-accent text-sm hover:opacity-80">
            Take a test →
          </Link>
        </div>

        {fetching && (
          <p className="text-cockpit-dim text-sm animate-pulse">Loading results…</p>
        )}

        {!fetching && results.length === 0 && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-12 text-center">
            <p className="text-cockpit-dim mb-4">No saved results yet.</p>
            <Link href="/tests">
              <button className="btn-primary">Take your first test</button>
            </Link>
          </div>
        )}

        {!fetching && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r) => {
              const color = getRankingColor(r.score);
              return (
                <div
                  key={r.id}
                  className="bg-cockpit-card border border-cockpit-border rounded-sm px-6 py-4 flex items-center justify-between gap-4 hover:border-opacity-60 transition-colors"
                  style={{ borderColor: `${color}30` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{r.testName}</p>
                    <p className="text-cockpit-muted text-xs mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                      <span style={{ color }}>{r.resultTitle}</span>
                    </p>
                  </div>

                  {/* Score */}
                  <div
                    className="text-2xl font-extrabold number-display shrink-0"
                    style={{ color }}
                  >
                    {r.score}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {r.shareId && (
                      <Link
                        href={`/share/${r.shareId}`}
                        className="text-xs border border-cockpit-border px-3 py-1.5 rounded-sm text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors"
                      >
                        Share
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
