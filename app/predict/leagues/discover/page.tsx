"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  getCompetition,
  getPublicLeagues,
  joinPublicLeague,
  type Competition,
  type PredictionLeague,
} from "@/lib/predictor";

// ── Mock featured league (demo — remove once real data exists) ─

const MOCK_FEATURED: PredictionLeague = {
  id:                 "mock-featured-001",
  competitionId:      "mock",
  name:               "Dubai Business League",
  normalizedName:     "dubai business league",
  inviteCode:         "DUBAI001",
  createdBy:          "admin",
  createdAt:          new Date().toISOString(),
  maxMembers:         null,
  memberCount:        142,
  visibility:         "public",
  isFeatured:         true,
  sponsorName:        "SmartSpace Solutions",
  sponsorUrl:         "https://smartspace.ae",
  sponsorDescription: "Dubai's leading workspace design consultancy. Join our league and compete for exclusive prizes.",
  sponsorLogoUrl:     null,
};

// ── Featured league card ───────────────────────────────────────

function FeaturedLeagueCard({
  league,
  onJoin,
  joining,
  joined,
}: {
  league: PredictionLeague;
  onJoin: (id: string) => void;
  joining: boolean;
  joined: boolean;
}) {
  return (
    <div
      className="relative rounded-sm overflow-hidden border"
      style={{ borderColor: "#ffab0040", background: "linear-gradient(135deg, #1a1400 0%, #111820 60%)" }}
    >
      {/* Gold top bar */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #ffab00, #ff8c00, transparent)" }} />
      {/* Glow */}
      <div
        className="absolute top-0 inset-x-0 h-32 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(255,171,0,0.06), transparent)" }}
      />

      <div className="relative p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Logo placeholder / initial */}
            <div
              className="w-9 h-9 rounded-sm border flex items-center justify-center shrink-0 font-bold text-sm"
              style={{ borderColor: "#ffab0040", background: "#ffab0015", color: "#ffab00" }}
            >
              {league.sponsorLogoUrl
                ? <img src={league.sponsorLogoUrl} alt={league.sponsorName ?? ""} className="w-full h-full object-contain rounded-sm" />
                : (league.sponsorName?.[0] ?? "★")
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-bold text-sm leading-tight">{league.name}</p>
                <span
                  className="text-[9px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-sm border"
                  style={{ color: "#ffab00", borderColor: "#ffab0040", background: "#ffab0015" }}
                >
                  Featured
                </span>
              </div>
              {league.sponsorName && (
                <p className="text-cockpit-muted text-xs mt-0.5">
                  Sponsored by{" "}
                  {league.sponsorUrl
                    ? <a href={league.sponsorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-cockpit-dim transition-colors underline underline-offset-2">{league.sponsorName}</a>
                    : league.sponsorName
                  }
                </p>
              )}
            </div>
          </div>
          <div className="text-center shrink-0">
            <p className="text-cockpit-accent font-bold text-base number-display">
              {league.memberCount ?? "—"}
            </p>
            <p className="text-cockpit-muted text-[10px] uppercase tracking-widest">members</p>
          </div>
        </div>

        {/* Description */}
        {league.sponsorDescription && (
          <p className="text-cockpit-dim text-xs leading-relaxed">{league.sponsorDescription}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onJoin(league.id)}
            disabled={joining || joined}
            className="flex-1 font-semibold py-2.5 px-4 rounded-sm text-xs tracking-widest uppercase transition-all duration-150 border disabled:opacity-60"
            style={{
              background:   joined ? "#00e67615" : "linear-gradient(135deg, #ffab00, #ff8c00)",
              borderColor:  joined ? "#00e67640" : "#ffab0060",
              color:        joined ? "#00e676"   : "#080b0f",
              boxShadow:    joined ? "none"       : "0 0 20px rgba(255,171,0,0.2)",
            }}
          >
            {joining ? "Joining…" : joined ? "✓ Joined" : "Join League →"}
          </button>
          <Link
            href={`/predict/leagues/${league.id}`}
            className="py-2.5 px-4 rounded-sm text-xs border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors tracking-widest uppercase font-mono"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Public league card ─────────────────────────────────────────

function PublicLeagueCard({
  league,
  onJoin,
  joining,
  joined,
}: {
  league: PredictionLeague;
  onJoin: (id: string) => void;
  joining: boolean;
  joined: boolean;
}) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{league.name}</p>
        <p className="text-cockpit-muted text-xs mt-0.5">
          {league.memberCount !== undefined ? `${league.memberCount} member${league.memberCount !== 1 ? "s" : ""}` : "—"}
        </p>
      </div>
      <button
        onClick={() => onJoin(league.id)}
        disabled={joining || joined}
        className="shrink-0 text-xs px-3 py-2 rounded-sm border transition-all duration-150 font-mono tracking-widest uppercase disabled:opacity-60"
        style={{
          color:       joined ? "#00e676" : "#00d4ff",
          borderColor: joined ? "#00e67640" : "#00d4ff40",
          background:  joined ? "#00e67610" : "#00d4ff10",
        }}
      >
        {joining ? "…" : joined ? "✓" : "Join →"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function DiscoverPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [competition,   setCompetition]   = useState<Competition | null>(null);
  const [leagues,       setLeagues]       = useState<PredictionLeague[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [joiningId,     setJoiningId]     = useState<string | null>(null);
  const [joinedIds,     setJoinedIds]     = useState<Set<string>>(new Set());
  const [authPrompt,    setAuthPrompt]    = useState(false);

  useEffect(() => {
    async function load() {
      const { competition: comp } = await getCompetition("wc2026");
      if (!comp) { setLoading(false); return; }
      setCompetition(comp);
      const live = await getPublicLeagues(comp.id);
      // Prepend mock featured league for demo — remove once real data exists
      setLeagues([MOCK_FEATURED, ...live]);
      setLoading(false);
    }
    load();
  }, []);

  const handleJoin = useCallback(async (leagueId: string) => {
    if (!user) { setAuthPrompt(true); return; }
    if (leagueId === MOCK_FEATURED.id) {
      // Mock league — redirect to sign-up / leagues page
      router.push("/predict/leagues");
      return;
    }
    setJoiningId(leagueId);
    const { error } = await joinPublicLeague(leagueId);
    setJoiningId(null);
    if (!error) {
      setJoinedIds((prev) => new Set([...prev, leagueId]));
      router.push(`/predict/leagues/${leagueId}`);
    }
  }, [user, router]);

  const featured = leagues.filter((l) => l.isFeatured);
  const regular  = leagues.filter((l) => !l.isFeatured);

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-3">
            <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
            <span>/</span>
            <Link href="/predict/leagues" className="hover:text-cockpit-dim transition-colors">Leagues</Link>
            <span>/</span>
            <span className="text-cockpit-dim">Discover</span>
          </div>
          <h1 className="text-xl font-bold text-white">Discover Leagues</h1>
          <p className="text-cockpit-dim text-sm mt-1">
            Join a public league and compete with the community — no invite code needed.
          </p>
        </div>

        {/* Auth prompt */}
        {authPrompt && !user && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-3 text-center">
            <p className="text-white font-semibold text-sm">Sign in to join a league</p>
            <Link href="/login" className="btn-primary text-sm w-full flex items-center justify-center">
              Sign in free →
            </Link>
            <button
              onClick={() => setAuthPrompt(false)}
              className="text-cockpit-muted text-xs hover:text-cockpit-dim transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p className="text-cockpit-dim text-sm animate-pulse text-center py-8">Loading leagues…</p>
        )}

        {/* Featured */}
        {!loading && featured.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#ffab00" }} />
              <h2 className="text-white font-semibold text-sm">Featured Leagues</h2>
            </div>
            {featured.map((league) => (
              <FeaturedLeagueCard
                key={league.id}
                league={league}
                onJoin={handleJoin}
                joining={joiningId === league.id}
                joined={joinedIds.has(league.id)}
              />
            ))}
          </section>
        )}

        {/* Public */}
        {!loading && regular.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cockpit-accent shrink-0" />
              <h2 className="text-white font-semibold text-sm">Public Leagues</h2>
            </div>
            {regular.map((league) => (
              <PublicLeagueCard
                key={league.id}
                league={league}
                onJoin={handleJoin}
                joining={joiningId === league.id}
                joined={joinedIds.has(league.id)}
              />
            ))}
          </section>
        )}

        {/* Empty */}
        {!loading && featured.length <= 1 && regular.length === 0 && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-8 text-center">
            <p className="text-cockpit-dim text-sm">No public leagues yet.</p>
            <p className="text-cockpit-muted text-xs mt-1">
              Be the first —{" "}
              <Link href="/predict/leagues" className="text-cockpit-accent hover:underline">
                create a league
              </Link>{" "}
              and set it to Public.
            </p>
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between text-xs font-mono">
          <Link href="/predict/leagues" className="text-cockpit-muted hover:text-cockpit-dim transition-colors">
            ← My Leagues
          </Link>
          <Link href="/predict" className="text-cockpit-muted hover:text-cockpit-dim transition-colors">
            Predictor →
          </Link>
        </div>
      </div>
    </div>
  );
}
