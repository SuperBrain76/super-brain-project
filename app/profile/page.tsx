"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { loadMyResults } from "@/lib/results";
import { loadMyProfile } from "@/lib/profile";
import { getRankingColor } from "@/lib/scoring";
import type { SavedResult, UserProfile } from "@/types";

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-cockpit-border last:border-0">
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 w-40 bg-cockpit-border rounded animate-pulse" />
        <div className="h-2.5 w-24 bg-cockpit-border rounded animate-pulse opacity-60" />
      </div>
      <div className="h-7 w-10 bg-cockpit-border rounded animate-pulse" />
      <div className="w-4 h-4 bg-cockpit-border rounded animate-pulse opacity-40" />
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [results,    setResults]    = useState<SavedResult[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadMyProfile(), loadMyResults(user.id)]).then(([p, r]) => {
      setProfile(p);
      setResults(r);
      setFetching(false);
    });
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data }) => {
        setIsVerified(!!data.user?.email_confirmed_at);
      });
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  const displayName = profile?.displayName ?? user.email?.split("@")[0] ?? "—";
  const memberSince  = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  // Best per test — deduplicates repeated attempts, keeps highest score
  const bestByTest = results.reduce((acc, r) => {
    const existing = acc.get(r.testName);
    if (!existing || r.score > existing.score) acc.set(r.testName, r);
    return acc;
  }, new Map<string, SavedResult>());
  const displayResults = [...bestByTest.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const attemptsFor = (name: string) => results.filter((r) => r.testName === name).length;

  const bestScore = displayResults.length > 0 ? Math.max(...displayResults.map((r) => r.score)) : null;
  const avgScore  = displayResults.length > 0
    ? Math.round(displayResults.reduce((s, r) => s + r.score, 0) / displayResults.length)
    : null;

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-2xl mx-auto px-5 py-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-1 font-mono">Dashboard</p>
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-cockpit-muted text-xs">{user.email}</span>
              {isVerified === true  && (
                <span className="text-xs font-semibold text-cockpit-green" title="Email verified">✅ Verified</span>
              )}
              {isVerified === false && (
                <span className="text-xs font-semibold text-cockpit-amber" title="Email not yet verified">⚠️ Not Verified</span>
              )}
              {profile?.country && (
                <>
                  <span className="text-cockpit-border text-xs">·</span>
                  <span className="text-cockpit-muted text-xs">{profile.country}</span>
                </>
              )}
              {memberSince && (
                <>
                  <span className="text-cockpit-border text-xs">·</span>
                  <span className="text-cockpit-muted text-xs">Since {memberSince}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/settings/profile" className="btn-ghost text-sm">Edit profile</Link>
            <button onClick={signOut} className="btn-ghost text-sm">Sign out</button>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Tests",      value: fetching ? "—" : bestByTest.size || "—" },
            { label: "Best score", value: fetching ? "—" : bestScore ?? "—" },
            { label: "Avg score",  value: fetching ? "—" : avgScore  ?? "—" },
          ].map((s) => (
            <div key={s.label} className="bg-cockpit-card border border-cockpit-border rounded-sm p-3 text-center">
              <div className="text-2xl font-bold number-display text-cockpit-accent">{s.value}</div>
              <div className="text-cockpit-muted text-xs tracking-widest uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Best Results ───────────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Best Results</h2>
          <Link href="/tests" className="text-cockpit-accent text-sm hover:opacity-80 transition-opacity">
            Take a test →
          </Link>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
          {fetching && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}

          {!fetching && displayResults.length === 0 && (
            <div className="py-10 px-6 text-center">
              <p className="text-cockpit-dim mb-1">No results yet.</p>
              <p className="text-cockpit-muted text-xs mb-5">
                Complete a test while signed in — your score saves automatically.
              </p>
              <Link href="/tests">
                <button className="btn-primary">Take your first test</button>
              </Link>
            </div>
          )}

          {!fetching && displayResults.map((r) => {
            const color    = getRankingColor(r.score);
            const date     = new Date(r.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            });
            const attempts = attemptsFor(r.testName);

            const inner = (
              <div className="relative flex items-center gap-4 px-5 py-3.5 border-b border-cockpit-border last:border-0 transition-colors hover:bg-cockpit-surface group">
                <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: color, opacity: 0.5 }} />
                <div className="flex-1 min-w-0 pl-2">
                  <p className="text-white font-medium text-sm truncate leading-snug">{r.testName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-cockpit-muted text-xs">{date}</span>
                    <span className="text-cockpit-border text-xs">·</span>
                    <span className="text-xs font-semibold" style={{ color }}>{r.resultTitle}</span>
                    {attempts > 1 && (
                      <>
                        <span className="text-cockpit-border text-xs">·</span>
                        <span className="text-cockpit-muted text-xs">{attempts} attempts</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-extrabold number-display shrink-0 tabular-nums" style={{ color }}>
                  {r.score}
                </div>
                <div className="shrink-0 text-cockpit-border group-hover:text-cockpit-accent transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            );

            return r.shareId ? (
              <Link key={r.id} href={`/share/${r.shareId}`} className="block">{inner}</Link>
            ) : (
              <div key={r.id}>{inner}</div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
