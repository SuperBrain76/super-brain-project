"use client";

/**
 * /v/<slug> — a venue's real branded prediction league.
 *
 * This is the page /venues was a mock-up of. Everything on it is read from
 * get_venue_page() (migration 063): the venue's own colours and logo, its
 * league, its actual leaderboard, its actual next fixtures.
 *
 * The owner control room is the same page with an extra tab, shown only when
 * the signed-in user owns the venue — the RPC decides that server-side and
 * simply omits the data otherwise, so there is nothing to leak client-side.
 *
 * Metrics are the ones the database can actually answer. The sales demo's
 * "avg visits / member" is not here, because nothing measures it.
 */

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

interface VenuePage {
  found: boolean;
  suspended?: boolean;
  is_owner?: boolean;
  venue?: { name: string; slug: string; city: string | null; country: string;
            language: string; website: string | null; logo_url: string | null;
            banner_url: string | null; colour_primary: string; colour_ink: string };
  league?: { id: string; name: string; invite_code: string; member_count: number };
  competition?: { name: string; slug: string };
  round?: { label: string; sort_order: number } | null;
  leaderboard?: Array<{ rank: number; name: string; avatar_url: string | null; points: number; predictions: number }>;
  next_fixtures?: Array<{ home: string; away: string; kicks_off_at: string }>;
  owner?: {
    members_total: number; joined_this_week: number;
    playing_this_round: number; predictions_this_round: number;
    weekly_active: Array<{ sort_order: number; label: string; active: number }>;
    members: Array<{ name: string; joined_at: string; points: number; predictions: number }>;
  };
}

const COPY = {
  en: { join: "Join the league", scan: "Ask at the bar or scan the table card",
        table: "Leaderboard", next: "Next up", players: "playing", owner: "Owner control room",
        fan: "League", empty: "No one has played yet — you could be first." },
  es: { join: "Únete a la liga", scan: "Pregunta en la barra o escanea el cartel",
        table: "Clasificación", next: "Próximos partidos", players: "jugando", owner: "Panel del local",
        fan: "Liga", empty: "Todavía no juega nadie — puedes ser el primero." },
  it: { join: "Entra nel campionato", scan: "Chiedi al bancone o inquadra la locandina",
        table: "Classifica", next: "Prossime partite", players: "in gioco", owner: "Pannello del locale",
        fan: "Campionato", empty: "Non ha ancora giocato nessuno — puoi essere il primo." },
  fr: { join: "Rejoindre la ligue", scan: "Demandez au bar ou scannez l'affichette",
        table: "Classement", next: "Prochains matchs", players: "en jeu", owner: "Espace gérant",
        fan: "Ligue", empty: "Personne n'a encore joué — soyez le premier." },
  de: { join: "Zur Liga", scan: "Fragen Sie an der Theke oder scannen Sie den Aufsteller",
        table: "Tabelle", next: "Als Nächstes", players: "spielen", owner: "Betreiber-Cockpit",
        fan: "Liga", empty: "Es hat noch niemand gespielt — seien Sie der Erste." },
};

export default function VenueLeaguePage({ params }: { params: { slug: string } }) {
  const { user } = useAuth();
  const [page, setPage]   = useState<VenuePage | null>(null);
  const [view, setView]   = useState<"fan" | "owner">("fan");
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase.rpc("get_venue_page", { p_slug: params.slug }).then(({ data, error: err }) => {
      if (err || !data) { setError(true); return; }
      setPage(data as VenuePage);
    });
    // Re-fetch on sign-in: the owner block only appears for an authenticated owner.
  }, [params.slug, user?.id]);

  if (error) return <Center>Something went wrong loading this league.</Center>;
  if (!page) return <Center>Loading…</Center>;
  if (!page.found) notFound();

  const v = page.venue!;
  const t = COPY[(v.language as keyof typeof COPY)] ?? COPY.en;
  const amber = v.colour_primary || "#F5B301";
  const ink   = v.colour_ink || "#12100E";
  const cream = "#FBF5E9";
  const muted = "#B7AC97";
  const panel = "rgba(255,255,255,0.04)";
  const line  = "rgba(255,255,255,0.10)";

  const joinUrl = `/${page.competition!.slug}/leagues/join?code=${page.league!.invite_code}`;

  return (
    <div style={{ background: ink, color: cream, minHeight: "100vh" }}>
      {page.suspended && (
        <div className="text-center text-[11px] font-bold tracking-widest py-1.5"
             style={{ background: "#E23B3B", color: "#fff" }}>
          THIS LEAGUE IS PAUSED
        </div>
      )}

      {page.is_owner && (
        <div className="flex justify-center gap-2 py-4 px-4 sticky top-0 z-30"
             style={{ background: `${ink}f2`, backdropFilter: "blur(8px)" }}>
          <Toggle active={view === "fan"}   onClick={() => setView("fan")}   amber={amber} ink={ink}>{t.fan}</Toggle>
          <Toggle active={view === "owner"} onClick={() => setView("owner")} amber={amber} ink={ink}>{t.owner}</Toggle>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pb-24 pt-6">
        {view === "fan" || !page.owner ? (
          <>
            {/* Hero */}
            <div className="relative rounded-3xl overflow-hidden mb-8" style={{ border: `1px solid ${line}` }}>
              <div className="absolute inset-0" style={{
                background: `radial-gradient(120% 120% at 15% 0%, ${amber}22 0%, transparent 55%), linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 70%)`,
              }} />
              <div className="relative px-6 sm:px-9 py-9">
                {v.logo_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={v.logo_url} alt="" style={{ maxHeight: 52, marginBottom: 18 }} />
                )}
                <div className="text-2xl sm:text-3xl font-black tracking-tight">{v.name.toUpperCase()}</div>
                {v.city && <div className="text-xs tracking-[0.25em] uppercase mt-1" style={{ color: amber }}>{v.city}</div>}

                <h1 className="text-3xl sm:text-5xl font-black leading-[0.98] mt-6 mb-5">{page.league!.name}</h1>

                <div className="flex flex-wrap items-center gap-3">
                  <a href={joinUrl} className="text-sm font-black px-5 py-3 rounded-full"
                     style={{ background: amber, color: ink }}>
                    {t.join} →
                  </a>
                  <span className="text-xs px-3 py-2 rounded-full"
                        style={{ background: "#ffffff10", color: muted, border: `1px solid ${line}` }}>
                    {page.league!.member_count} {t.players}
                  </span>
                </div>
                <p className="text-xs mt-4" style={{ color: muted }}>{t.scan}</p>
              </div>
            </div>

            {/* Leaderboard */}
            <H>{t.table}{page.round ? ` · ${page.round.label}` : ""}</H>
            {page.leaderboard!.length === 0 ? (
              <p className="text-sm mb-8" style={{ color: muted }}>{t.empty}</p>
            ) : (
              <div className="mb-10 rounded-2xl overflow-hidden" style={{ background: panel, border: `1px solid ${line}` }}>
                {page.leaderboard!.map((r) => (
                  <div key={r.rank} className="flex items-center gap-3 px-4 py-3"
                       style={{ borderTop: r.rank === 1 ? "none" : `1px solid ${line}` }}>
                    <span className="w-6 text-sm font-black tabular-nums"
                          style={{ color: r.rank <= 3 ? amber : muted }}>{r.rank}</span>
                    <span className="flex-1 text-sm font-semibold truncate">{r.name}</span>
                    <span className="text-[11px] tabular-nums" style={{ color: muted }}>{r.predictions}</span>
                    <span className="text-sm font-black tabular-nums w-12 text-right"
                          style={{ color: amber }}>{r.points}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fixtures */}
            {page.next_fixtures!.length > 0 && (
              <>
                <H>{t.next}</H>
                <div className="rounded-2xl overflow-hidden" style={{ background: panel, border: `1px solid ${line}` }}>
                  {page.next_fixtures!.map((f, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-3"
                         style={{ borderTop: i === 0 ? "none" : `1px solid ${line}` }}>
                      <span className="text-sm font-semibold">{f.home} <span style={{ color: muted }}>v</span> {f.away}</span>
                      <span className="text-[11px] whitespace-nowrap" style={{ color: muted }}>
                        {new Date(f.kicks_off_at).toLocaleString(undefined,
                          { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <OwnerView o={page.owner!} amber={amber} muted={muted} line={line} panel={panel}
                     inviteCode={page.league!.invite_code} slug={v.slug} round={page.round?.label ?? null} />
        )}
      </div>
    </div>
  );
}

function OwnerView({ o, amber, muted, line, panel, inviteCode, slug, round }: {
  o: NonNullable<VenuePage["owner"]>; amber: string; muted: string; line: string;
  panel: string; inviteCode: string; slug: string; round: string | null;
}) {
  const peak = Math.max(1, ...o.weekly_active.map((w) => w.active));
  const playRate = o.members_total ? Math.round((o.playing_this_round / o.members_total) * 100) : 0;
  const perPlayer = o.playing_this_round
    ? (o.predictions_this_round / o.playing_this_round).toFixed(1) : "0";

  return (
    <>
      <H>This matchweek{round ? ` · ${round}` : ""}</H>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 mb-10">
        <K label="Members"            value={o.members_total}          amber={amber} muted={muted} />
        <K label="Joined this week"   value={`+${o.joined_this_week}`}  amber={amber} muted={muted} />
        <K label="Playing"            value={o.playing_this_round}      amber={amber} muted={muted}
           sub={`${playRate}% of members`} />
        <K label="Predictions"        value={o.predictions_this_round}  amber={amber} muted={muted}
           sub={`${perPlayer} per player`} />
      </div>

      <H>Playing each week</H>
      <div className="rounded-2xl px-5 py-5 mb-10" style={{ background: panel, border: `1px solid ${line}` }}>
        {o.weekly_active.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>No completed matchweeks yet.</p>
        ) : (
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {[...o.weekly_active].map((w) => (
              <div key={w.sort_order} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                <span className="text-[11px] tabular-nums" style={{ color: muted }}>{w.active}</span>
                <div style={{
                  width: "100%", background: amber, borderRadius: 4,
                  height: `${Math.max(4, (w.active / peak) * 88)}px`, opacity: 0.85,
                }} />
                <span className="text-[10px]" style={{ color: muted }}>{w.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <H>Share your league</H>
      <div className="rounded-2xl px-5 py-5 mb-10 flex flex-wrap items-center gap-5"
           style={{ background: panel, border: `1px solid ${line}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/venues/${slug}/qr.png?size=320`} alt="QR"
             width={104} height={104} style={{ background: "#fff", padding: 6, borderRadius: 10 }} />
        <div className="flex-1 min-w-[200px]">
          <div className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: muted }}>Invite code</div>
          <div className="text-2xl font-black tracking-[0.15em]" style={{ color: amber }}>{inviteCode}</div>
          <a href={`/venues/${slug}/poster`} className="text-xs underline mt-2 inline-block" style={{ color: muted }}>
            Print the table poster →
          </a>
        </div>
      </div>

      <H>Members</H>
      <div className="rounded-2xl overflow-hidden" style={{ background: panel, border: `1px solid ${line}` }}>
        {o.members.length === 0 ? (
          <p className="text-sm px-4 py-4" style={{ color: muted }}>No one has joined yet.</p>
        ) : o.members.map((m, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3"
               style={{ borderTop: i === 0 ? "none" : `1px solid ${line}` }}>
            <span className="flex-1 text-sm font-semibold truncate">{m.name}</span>
            <span className="text-[11px] whitespace-nowrap" style={{ color: muted }}>
              joined {new Date(m.joined_at).toLocaleDateString()}
            </span>
            <span className="text-[11px] tabular-nums w-10 text-right" style={{ color: muted }}>{m.predictions}</span>
            <span className="text-sm font-black tabular-nums w-12 text-right" style={{ color: amber }}>{m.points}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Small pieces ──────────────────────────────────────────────
function H({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.25em] mb-3"
            style={{ color: "#B7AC97" }}>{children}</p>;
}

function K({ label, value, sub, amber, muted }: {
  label: string; value: string | number; sub?: string; amber: string; muted: string;
}) {
  return (
    <div>
      <div className="text-3xl font-black tabular-nums leading-none" style={{ color: amber }}>{value}</div>
      <div className="text-[11px] mt-1.5" style={{ color: muted }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: muted, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

function Toggle({ active, onClick, amber, ink, children }: {
  active: boolean; onClick: () => void; amber: string; ink: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="text-xs font-bold px-4 py-2 rounded-full"
      style={{
        background: active ? amber : "transparent",
        color: active ? ink : "#B7AC97",
        border: `1px solid ${active ? amber : "rgba(255,255,255,0.14)"}`,
      }}>
      {children}
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#12100E", minHeight: "100vh" }}
         className="flex items-center justify-center">
      <p className="text-sm" style={{ color: "#B7AC97" }}>{children}</p>
    </div>
  );
}
