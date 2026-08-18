"use client";

import FeaturedLeagueBanner from "@/components/FeaturedLeagueBanner";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  resolveCompetition,
  getPublicLeagues,
  joinPublicLeague,
  type Competition,
  type PredictionLeague,
} from "@/lib/predictor";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

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
  sponsorUrl:         "https://smartspace-me.com",
  sponsorDescription: "Dubai's leading workspace design consultancy. Join our league and compete for exclusive prizes.",
  sponsorLogoUrl:     null,
  suspended:          false,
};

// ── Featured league card ───────────────────────────────────────
// (The old small featured card was replaced by FeaturedLeagueBanner.)

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
    <div
      className="flex items-center gap-3 p-4 rounded-xl"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      {/* Initials avatar */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
        style={{ background: `${GREEN}12`, color: GREEN }}
      >
        {league.name?.[0]?.toUpperCase() ?? "L"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: TEXT1 }}>{league.name}</p>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>
          {league.memberCount !== undefined ? `${league.memberCount} member${league.memberCount !== 1 ? "s" : ""}` : "—"}
        </p>
      </div>

      <button
        onClick={() => onJoin(league.id)}
        disabled={joining || joined}
        className="shrink-0 text-xs px-3 py-2 rounded-lg font-bold transition-all duration-150 disabled:opacity-60"
        style={{
          color:      joined ? GREEN       : "#fff",
          background: joined ? `${GREEN}15` : GREEN,
          border:     joined ? `1px solid ${GREEN}30` : "none",
        }}
      >
        {joining ? "…" : joined ? "✓" : "Join →"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function DiscoverPage() {
  // Competition Engine V2: the competition is the first path segment
  // (/premier-league/...), not a hardcoded slug.
  const { competition: competitionSlug } = useParams<{ competition: string }>();
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
      const { competition: comp } = await resolveCompetition(competitionSlug);
      if (!comp) { setLoading(false); return; }
      setCompetition(comp);
      const live = await getPublicLeagues(comp.id);
      // Prepend mock featured league for demo — remove once real data exists
      setLeagues([MOCK_FEATURED, ...live]);
      setLoading(false);
    }
    load();
  }, [competitionSlug]);

  const handleJoin = useCallback(async (leagueId: string) => {
    if (!user) { setAuthPrompt(true); return; }
    // Mock league has no real DB entry — just show joined state
    if (leagueId === MOCK_FEATURED.id) {
      setJoinedIds((prev) => new Set([...prev, leagueId]));
      return;
    }
    setJoiningId(leagueId);
    const { error } = await joinPublicLeague(leagueId);
    setJoiningId(null);
    if (!error) {
      setJoinedIds((prev) => new Set([...prev, leagueId]));
      router.push(`/${competitionSlug}/leagues/${leagueId}`);
    }
  }, [user, router]);

  const featured = leagues.filter((l) => l.isFeatured);
  const regular  = leagues.filter((l) => !l.isFeatured);

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href={`/${competitionSlug}`} className="hover:underline" style={{ color: MUTED }}>Predictor</Link>
          <span>/</span>
          <Link href={`/${competitionSlug}/leagues`} className="hover:underline" style={{ color: MUTED }}>Leagues</Link>
          <span>/</span>
          <span style={{ color: TEXT2, fontWeight: 600 }}>Discover</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT1 }}>Discover Leagues</h1>
          <p className="text-sm mt-1" style={{ color: TEXT2 }}>
            Join a public league and compete with the community — no invite code needed.
          </p>
        </div>

        {/* Auth prompt */}
        {authPrompt && !user && (
          <div
            className="flex flex-col gap-3 p-5 rounded-xl text-center"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <p className="font-semibold text-sm" style={{ color: TEXT1 }}>Sign in to join a league</p>
            <Link
              href="/login"
              className="py-2.5 px-4 rounded-lg font-bold text-sm w-full flex items-center justify-center"
              style={{ background: GREEN, color: "#fff" }}
            >
              Sign in free →
            </Link>
            <button
              onClick={() => setAuthPrompt(false)}
              className="text-xs hover:underline"
              style={{ color: MUTED }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p className="text-sm animate-pulse text-center py-8" style={{ color: MUTED }}>Loading leagues…</p>
        )}

        {/* Featured */}
        {!loading && featured.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
              <h2 className="font-semibold text-sm" style={{ color: TEXT1 }}>Featured Leagues</h2>
            </div>
            {featured.map((league) => (
              <FeaturedLeagueBanner
                key={league.id}
                league={league}
                onJoin={handleJoin}
                joining={joiningId === league.id}
                joined={joinedIds.has(league.id)}
                competitionSlug={competitionSlug}
              />
            ))}
          </section>
        )}

        {/* Public */}
        {!loading && regular.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GREEN }} />
              <h2 className="font-semibold text-sm" style={{ color: TEXT1 }}>Public Leagues</h2>
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
          <div
            className="p-8 rounded-xl text-center"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <p className="text-sm" style={{ color: TEXT2 }}>No public leagues yet.</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              Be the first —{" "}
              <Link href={`/${competitionSlug}/leagues`} className="hover:underline" style={{ color: GREEN }}>
                create a league
              </Link>{" "}
              and set it to Public.
            </p>
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href={`/${competitionSlug}/leagues`} className="text-xs hover:underline" style={{ color: MUTED }}>
            ← My Leagues
          </Link>
          <Link href={`/${competitionSlug}`} className="text-xs hover:underline" style={{ color: MUTED }}>
            Predictor →
          </Link>
        </div>
      </div>
    </div>
  );
}
