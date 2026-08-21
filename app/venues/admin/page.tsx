"use client";

/**
 * /venues/admin — the venue owner's control center ("Venue Dashboard").
 *
 * Reached from the "Venue Dashboard" link in the top nav (owners only). Opens
 * on live, measured activity — players, today's predictions, active players,
 * new sign-ups — then competitions, today's fixtures, quick actions and help.
 * The venue is resolved server-side by owner_user_id = auth.uid() (no id in the
 * URL). Everything shown is real: see get_venue_dashboard (migration 070).
 *
 * Degrades gracefully: if that RPC isn't deployed yet, it falls back to the
 * owner-reads-own-venue table read and renders actions + help without stats.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { signInWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";

const INK = "#0B0B0D", PANEL = "#141418", LINE = "rgba(255,255,255,0.10)";
const GOLD = "#E8C15A", CREAM = "#F5F5F2", MUTED = "#9A9AA3";
const SITE = "https://www.superbrain.social";
const SUPPORT = "hello@superbrain.social";

interface Comp { name: string; slug: string }
interface Fx {
  home: string; home_flag: string | null; away: string; away_flag: string | null;
  competition: string; kicks_off_at: string; started: boolean; completed: boolean;
  home_score: number | null; away_score: number | null;
}
interface Dash {
  found: boolean;
  venue: { id: string; slug: string | null; name: string; logo_url: string | null; primary: string | null; status: string; onboarded: boolean };
  stats: { players: number; new_today: number; predictions_today: number; active_today: number };
  competitions: Comp[];
  today_fixtures: Fx[];
}

type State =
  | { kind: "loading" }
  | { kind: "signedout" }
  | { kind: "novenue" }
  | { kind: "ok"; d: Dash }
  | { kind: "degraded"; venue: { id: string; slug: string | null; name: string; logo_url: string | null; primary: string | null; status: string } };

export default function VenueDashboard() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setState({ kind: "signedout" }); return; }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc("get_venue_dashboard");
      if (cancelled) return;

      if (!error && data) {
        const d = data as Dash;
        if (!d.found) { setState({ kind: "novenue" }); return; }
        setState({ kind: "ok", d });
        return;
      }

      // RPC not deployed (or errored) → fall back to the owner table read.
      const { data: v } = await supabase
        .from("venues")
        .select("id, slug, name, logo_url, colour_primary, status")
        .eq("owner_user_id", user.id).limit(1).maybeSingle();
      if (cancelled) return;
      if (!v) { setState({ kind: "novenue" }); return; }
      setState({ kind: "degraded", venue: { id: v.id, slug: v.slug, name: v.name, logo_url: v.logo_url, primary: v.colour_primary, status: v.status } });
    })();

    return () => { cancelled = true; };
  }, [user, loading]);

  if (state.kind === "loading") return <Shell><p style={{ color: MUTED }}>Loading…</p></Shell>;

  if (state.kind === "signedout") return (
    <Shell>
      <h1 className="text-2xl font-black mb-2">Venue Dashboard</h1>
      <p className="text-sm mb-5" style={{ color: MUTED }}>Sign in with the email you signed up with to manage your venue.</p>
      <button onClick={() => signInWithGoogle("/venues/admin")} className="font-black px-6 py-3 rounded-full text-sm" style={{ background: GOLD, color: "#12100E" }}>Continue with Google</button>
      <div className="mt-2"><a href="/login?next=/venues/admin" className="text-xs" style={{ color: GOLD }}>or sign in with email</a></div>
    </Shell>
  );

  if (state.kind === "novenue") return (
    <Shell>
      <h1 className="text-2xl font-black mb-2">No venue on this account</h1>
      <p className="text-sm mb-5" style={{ color: MUTED }}>This login doesn&apos;t own a venue yet. If you just signed up, use the email you paid with.</p>
      <a href="/venues" className="font-black px-6 py-3 rounded-full text-sm inline-block" style={{ background: GOLD, color: "#12100E" }}>How SuperBrain for venues works</a>
    </Shell>
  );

  const venue = state.kind === "ok" ? state.d.venue : state.venue;
  const accent = venue.primary || GOLD;
  const publicUrl = venue.slug ? `${SITE}/v/${venue.slug}` : null;
  const stats = state.kind === "ok" ? state.d.stats : null;
  const comps = state.kind === "ok" ? state.d.competitions : [];
  const today = state.kind === "ok" ? state.d.today_fixtures : [];

  const actions = [
    { href: venue.slug ? `/venues/${venue.slug}/launch-pack` : "/venues/admin", title: "Launch Pack", external: false },
    { href: "/venues/challenges", title: "Matchday Challenge", external: false },
    { href: venue.slug ? `/v/${venue.slug}` : "/venues/admin", title: "Venue Page", external: true },
    { href: `/venues/billing?v=${venue.id}`, title: "Billing", external: false },
  ];

  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          {venue.logo_url
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={venue.logo_url} alt="" style={{ height: 44, maxWidth: 120, objectFit: "contain" }} />
            : <div className="w-11 h-11 rounded-xl grid place-items-center font-black text-lg" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>{venue.name.slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0">
            <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: accent }}>Venue Dashboard</div>
            <h1 className="text-2xl font-black leading-tight truncate">{venue.name}</h1>
          </div>
          <div className="ml-auto shrink-0"><StatusPill status={venue.status} /></div>
        </div>

        {/* Public link */}
        {publicUrl && (
          <div className="rounded-2xl p-4 mt-5 flex items-center justify-between gap-3" style={{ background: `${accent}12`, border: `1px solid ${accent}44` }}>
            <div className="min-w-0">
              <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: accent }}>Your page</div>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold break-all" style={{ color: CREAM }}>{publicUrl}</a>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs font-black px-3.5 py-2 rounded-full shrink-0" style={{ background: accent, color: "#12100E" }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {/* Today's activity */}
        {stats && (
          <div className="mt-7">
            <SectionLabel>Today&apos;s activity</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Stat n={stats.players} label="Players" accent={accent} />
              <Stat n={stats.active_today} label="Active today" accent={accent} />
              <Stat n={stats.predictions_today} label="Predictions today" accent={accent} />
              <Stat n={stats.new_today} label="New today" accent={accent} />
            </div>
            {stats.players === 0 && (
              <p className="text-xs mt-3" style={{ color: MUTED }}>
                No players yet. Print your Launch Pack and put the QR on the tables — numbers show up here the moment people join.
              </p>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-7">
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {actions.map((a) => (
              <a key={a.title} href={a.href} {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="rounded-2xl px-4 py-4 flex items-center justify-between transition-transform active:scale-[0.98]"
                style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                <span className="font-black text-sm">{a.title}</span>
                <span className="text-lg" style={{ color: accent }}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* Competitions */}
        {state.kind === "ok" && (
          <div className="mt-7">
            <SectionLabel>Current competitions</SectionLabel>
            {comps.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {comps.map((c) => (
                  <span key={c.slug} className="text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: `${accent}14`, color: CREAM, border: `1px solid ${accent}44` }}>
                    <span style={{ color: accent }}>✓</span> {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs mt-3" style={{ color: MUTED }}>
                No competitions active yet. <a href="/venues/challenges" style={{ color: accent, fontWeight: 700 }}>Set them up</a> so your crowd can start predicting.
              </p>
            )}
          </div>
        )}

        {/* Today's matches */}
        {state.kind === "ok" && (
          <div className="mt-7">
            <SectionLabel>Today&apos;s matches</SectionLabel>
            {today.length > 0 ? (
              <div className="flex flex-col gap-2 mt-3">
                {today.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                    <div className="text-sm font-bold truncate">
                      {f.home_flag ? `${f.home_flag} ` : ""}{f.home} <span style={{ color: MUTED }}>v</span> {f.away}{f.away_flag ? ` ${f.away_flag}` : ""}
                    </div>
                    <div className="text-xs font-bold shrink-0 ml-3 tabular-nums" style={{ color: f.completed ? accent : f.started ? "#ff8a8a" : MUTED }}>
                      {f.completed ? `${f.home_score}–${f.away_score} · FT`
                        : f.started ? (f.home_score != null && f.away_score != null ? `● ${f.home_score}–${f.away_score}` : "Live")
                        : new Date(f.kicks_off_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs mt-3" style={{ color: MUTED }}>No matches in your competitions today. Check back on a matchday.</p>
            )}
          </div>
        )}

        {/* Help */}
        <div className="mt-8 rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
          <div className="font-black text-sm mb-1">Need help?</div>
          <p className="text-xs mb-3" style={{ color: MUTED }}>We usually reply within a few hours.</p>
          <div className="flex flex-col gap-2">
            <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(`Help — ${venue.name}`)}`} className="text-sm font-bold" style={{ color: GOLD }}>📧 {SUPPORT}</a>
            <a href="/contact" className="text-sm font-bold" style={{ color: GOLD }}>📖 Contact &amp; quick help</a>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px]" style={{ color: "#ffffff55" }}>Powered by SuperBrain</div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { dot: string; label: string; color: string }> = {
    active:      { dot: "🟢", label: "Active",          color: "#57C97D" },
    trialing:    { dot: "🟡", label: "Trial",           color: GOLD },
    trial:       { dot: "🟡", label: "Trial",           color: GOLD },
    past_due:    { dot: "🔴", label: "Payment needed",  color: "#ff8a8a" },
    canceled:    { dot: "⚪", label: "Cancelled",        color: MUTED },
    cancelled:   { dot: "⚪", label: "Cancelled",        color: MUTED },
  };
  const s = map[status] ?? { dot: "⚪", label: status || "—", color: MUTED };
  return (
    <span className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}44` }}>
      {s.dot} {s.label}
    </span>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
      <div className="text-3xl font-black leading-none" style={{ color: accent }}>{n}</div>
      <div className="text-[11px] mt-1.5 font-semibold" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{children}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ background: INK, color: CREAM, minHeight: "100vh" }} className="flex items-center justify-center"><div className="text-center px-6">{children}</div></div>;
}
