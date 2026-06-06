"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getLeague,
  isLeagueMember,
  joinLeague,
  joinPublicLeague,
  getLeagueLeaderboard,
  getLeagueMemberCount,
  getLeagueMembers,
  getCompetition,
  getMyStats,
  type PredictionLeague,
  type LeaderboardRow,
  type LeagueMember,
  type MyStats,
} from "@/lib/predictor";

// ── Helpers ───────────────────────────────────────────────────

const SITE = "https://superbrain.social";

function inviteUrl(code: string) {
  return `${SITE}/predict/leagues?join=${code}`;
}

function whatsappUrl(league: PredictionLeague) {
  const msg = `Join my "${league.name}" World Cup Predictor league on SuperBrain!\n\nUse code: ${league.inviteCode}\nOr join here: ${inviteUrl(league.inviteCode)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

// ── Copy button ───────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="text-[10px] font-mono px-2 py-1 rounded-sm border transition-all shrink-0"
      style={{
        color:       copied ? "#00e676" : "#a8b8cc",
        borderColor: copied ? "#00e67640" : "#1e2a38",
        background:  copied ? "#00e67610" : "transparent",
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

// ── Rank badge ────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-black"
      style={{ color: "#ffab00", background: "#ffab0018" }}>1</span>
  );
  if (rank === 2) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-black"
      style={{ color: "#a8b8cc", background: "#a8b8cc15" }}>2</span>
  );
  if (rank === 3) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-black"
      style={{ color: "#cd7c32", background: "#cd7c3215" }}>3</span>
  );
  return (
    <span className="w-7 h-7 flex items-center justify-center text-xs font-mono text-cockpit-muted">
      {rank}
    </span>
  );
}

// ── Leaderboard table ─────────────────────────────────────────

function LeaderboardTable({
  rows,
  currentUserId,
  ownerId,
}: {
  rows:          LeaderboardRow[];
  currentUserId: string | null;
  ownerId:       string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center px-4">
        <p className="text-cockpit-dim text-sm">Standings will appear after predictions are scored.</p>
        <p className="text-cockpit-muted text-xs mt-1">Results are entered after each match.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cockpit-border">
        <div className="w-7 shrink-0" />
        <span className="flex-1 text-[10px] text-cockpit-muted uppercase tracking-widest font-mono">Player</span>
        <span className="w-12 text-right text-[10px] text-cockpit-muted uppercase tracking-widest font-mono hidden sm:block">Match</span>
        <span className="w-12 text-right text-[10px] text-cockpit-amber uppercase tracking-widest font-mono hidden sm:block">Bonus</span>
        <span className="w-12 text-right text-[10px] text-cockpit-accent uppercase tracking-widest font-mono">Total</span>
      </div>

      {rows.map((row) => {
        const isMe      = row.userId === currentUserId;
        const isOwner   = row.userId === ownerId;
        return (
          <div
            key={`${row.rank}-${row.displayName}`}
            className="flex items-center gap-2 px-3 py-3 border-b border-cockpit-border last:border-0 transition-colors"
            style={{
              background:   isMe ? "#00d4ff06" : undefined,
              borderLeft:   isMe ? "2px solid #00d4ff40" : "2px solid transparent",
            }}
          >
            <RankBadge rank={row.rank} />

            {/* Player */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-white text-sm font-medium truncate">
                {row.displayName}
              </span>
              {isOwner && (
                <span
                  className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm shrink-0"
                  style={{ color: "#ffab00", background: "#ffab0015" }}
                  title="League owner"
                >
                  OWNER
                </span>
              )}
              {isMe && (
                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm shrink-0"
                  style={{ color: "#00d4ff", background: "#00d4ff15" }}>
                  YOU
                </span>
              )}
            </div>

            {/* Match pts */}
            <span
              className="w-12 text-right text-xs font-mono tabular-nums hidden sm:block"
              style={{ color: row.matchPoints > 0 ? "#a8b8cc" : "#8899aa" }}
            >
              {row.matchPoints}
            </span>

            {/* Bonus pts */}
            <span
              className="w-12 text-right text-xs font-mono tabular-nums hidden sm:block"
              style={{ color: row.bonusPoints > 0 ? "#ffab00" : "#8899aa" }}
            >
              {row.bonusPoints > 0 ? `+${row.bonusPoints}` : "—"}
            </span>

            {/* Total pts */}
            <span
              className="w-12 text-right font-bold font-mono text-sm tabular-nums"
              style={{ color: row.totalPoints > 0 ? "#00d4ff" : "#8899aa" }}
            >
              {row.totalPoints}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Members list ──────────────────────────────────────────────

function MembersList({
  members,
  currentUserId,
}: {
  members:       LeagueMember[];
  currentUserId: string | null;
}) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-white font-semibold text-sm">Members</h2>
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 text-center">
          <p className="text-cockpit-dim text-sm">No members found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-white font-semibold text-sm">Members</h2>
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
        {members.map((m, i) => {
          const isMe = m.userId === currentUserId;
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 px-4 py-3 border-b border-cockpit-border last:border-0"
              style={{
                background: isMe ? "#00d4ff06" : undefined,
                borderLeft: isMe ? "2px solid #00d4ff40" : "2px solid transparent",
              }}
            >
              {/* Avatar initial */}
              <div
                className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: isMe ? "#00d4ff20" : "#1e2a38", color: isMe ? "#00d4ff" : "#a8b8cc" }}
              >
                {m.displayName[0]?.toUpperCase() ?? "?"}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-white text-sm font-medium truncate">{m.displayName}</span>
                {m.country && (
                  <span className="text-cockpit-muted text-xs">{m.country}</span>
                )}
                {m.isOwner && (
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm"
                    style={{ color: "#ffab00", background: "#ffab0015" }}>OWNER</span>
                )}
                {isMe && (
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm"
                    style={{ color: "#00d4ff", background: "#00d4ff15" }}>YOU</span>
                )}
              </div>

              {/* Joined date */}
              {m.joinedAt && (
                <span className="text-cockpit-muted text-[10px] font-mono shrink-0">
                  {new Date(m.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}

              {/* Position indicator */}
              <span className="text-cockpit-muted text-[10px] font-mono w-5 text-right shrink-0">
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function LeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router       = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [league,      setLeague]      = useState<PredictionLeague | null>(null);
  const [rows,        setRows]        = useState<LeaderboardRow[]>([]);
  const [members,     setMembers]     = useState<LeagueMember[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [isMember,    setIsMember]    = useState<boolean | null>(null);
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Join flow (for non-members)
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    setError(null);

    const [lg, count] = await Promise.all([
      getLeague(leagueId),
      getLeagueMemberCount(leagueId),
    ]);

    if (!lg) {
      setError("League not found. The link may be invalid.");
      setLoading(false);
      return;
    }

    setLeague(lg);
    setMemberCount(count);

    // Check membership and load leaderboard + user stats in parallel
    if (user) {
      const member = await isLeagueMember(leagueId, user.id);
      setIsMember(member);
      if (member) {
        const [leaderboard, memberList, compResult] = await Promise.all([
          getLeagueLeaderboard(leagueId),
          getLeagueMembers(leagueId),
          getCompetition("wc2026"),
        ]);
        setRows(leaderboard.map((r) => ({ ...r, isMe: r.userId === user.id })));
        setMembers(memberList.map((m) => ({ ...m, isOwner: m.userId === lg.createdBy })));
        if (compResult.competition) {
          const stats = await getMyStats(compResult.competition.id);
          setMyStats(stats);
        }
      }
    } else {
      setIsMember(false);
    }

    setLoading(false);
  }, [leagueId, user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const handleJoin = async () => {
    if (!league || !user) return;
    setJoining(true);
    setJoinError(null);
    const fn = (league.visibility === "public" || league.isFeatured)
      ? joinPublicLeague
      : joinLeague;
    const { error: err } = await fn(league.id);
    setJoining(false);
    if (err) { setJoinError(err); return; }
    load();
  };

  // ── Loading ────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-cockpit-red text-sm">{error}</p>
        <Link href="/predict/leagues" className="text-cockpit-accent text-sm hover:underline">
          ← Back to leagues
        </Link>
      </div>
    );
  }

  if (!league) return null;

  // ── Not signed in ──────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">
          <Breadcrumb leagueName={league.name} />
          <LeagueHeader league={league} memberCount={memberCount} />
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 text-center flex flex-col gap-3">
            <p className="text-white font-semibold">Sign in to view this league</p>
            <p className="text-cockpit-dim text-sm">League leaderboards are only visible to members.</p>
            <Link href="/login" className="btn-primary w-full flex items-center justify-center">
              Sign in →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Not a member ───────────────────────────────────────────
  if (isMember === false) {
    const isOpen = league.visibility === "public" || league.isFeatured;
    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">
          <Breadcrumb leagueName={league.name} />
          <LeagueHeader league={league} memberCount={memberCount} />
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-4">
            <div>
              <p className="text-white font-semibold text-sm">You&apos;re not a member of this league</p>
              <p className="text-cockpit-dim text-sm mt-1">
                {isOpen
                  ? "This is a public league — join instantly, no invite code needed."
                  : "Join to see the leaderboard and compete with the other members."}
              </p>
            </div>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="btn-primary w-full flex items-center justify-center"
            >
              {joining ? "Joining…" : `Join "${league.name}" →`}
            </button>
            {joinError && <p className="text-cockpit-red text-xs">{joinError}</p>}
          </div>
          <Link href="/predict/leagues" className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono">
            ← Back to leagues
          </Link>
        </div>
      </div>
    );
  }

  // ── Member view ────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        <Breadcrumb leagueName={league.name} />
        <LeagueHeader league={league} memberCount={memberCount} />

        {/* ── Share / Invite section ───────────────────────── */}
        {(league.visibility === "public" || league.isFeatured) ? (
          /* Public / Featured — no invite code */
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex flex-col gap-3">
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Share league</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green shrink-0" />
              <p className="text-cockpit-dim text-sm">
                {league.isFeatured ? "Featured league" : "Public league"} · Anyone can join without an invite code.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton
                text={`${SITE}/predict/leagues/${league.id}`}
                label="Copy league link"
              />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Join the "${league.name}" World Cup Predictor league on SuperBrain!\n\n${SITE}/predict/leagues/${league.id}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-sm border transition-all"
                style={{ color: "#25D366", borderColor: "#25D36640", background: "#25D36610" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        ) : (
          /* Private — show invite code */
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex flex-col gap-3">
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Invite friends</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-cockpit-accent font-mono font-bold text-base tracking-[0.25em]">
                {league.inviteCode}
              </code>
              <CopyButton text={league.inviteCode} label="Copy code" />
              <CopyButton text={inviteUrl(league.inviteCode)} label="Copy link" />
              <a
                href={whatsappUrl(league)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-sm border transition-all"
                style={{ color: "#25D366", borderColor: "#25D36640", background: "#25D36610" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            </div>
            <p className="text-cockpit-muted text-[10px] font-mono">
              Only people with this code or link can join — your league stays private.
            </p>
          </div>
        )}

        {/* ── Your completion ─────────────────────────────── */}
        {myStats && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-cockpit-surface border border-cockpit-border rounded-sm flex-wrap">
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest shrink-0">Your progress</p>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono font-bold"
                style={{ color: myStats.predictions >= 104 ? "#00e676" : "#a8b8cc" }}
              >
                {myStats.predictions}/104
              </span>
              <span className="text-cockpit-muted text-[10px]">match predictions</span>
            </div>
            {myStats.bonusTotal > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{ color: myStats.bonusAnswered >= myStats.bonusTotal ? "#00e676" : "#a8b8cc" }}
                >
                  {myStats.bonusAnswered}/{myStats.bonusTotal}
                </span>
                <span className="text-cockpit-muted text-[10px]">bonus questions</span>
              </div>
            )}
          </div>
        )}

        {/* ── Members ─────────────────────────────────────── */}
        <MembersList members={members} currentUserId={user?.id ?? null} />

        {/* ── Standings ───────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">Standings</h2>
            <span className="text-cockpit-muted text-xs font-mono">
              Match + Bonus = Total
            </span>
          </div>
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
            <LeaderboardTable
              rows={rows}
              currentUserId={user?.id ?? null}
              ownerId={league.createdBy}
            />
          </div>
        </div>

        {/* Back */}
        <Link href="/predict/leagues" className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono">
          ← Back to leagues
        </Link>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function Breadcrumb({ leagueName }: { leagueName: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono">
      <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
      <span>/</span>
      <Link href="/predict/leagues" className="hover:text-cockpit-dim transition-colors">Leagues</Link>
      <span>/</span>
      <span className="text-cockpit-dim truncate max-w-[140px]">{leagueName}</span>
    </div>
  );
}

function LeagueHeader({
  league,
  memberCount,
}: {
  league: PredictionLeague;
  memberCount: number | null;
}) {
  const visibilityLabel = league.isFeatured ? "Featured" : league.visibility === "public" ? "Public" : "Private";
  const visibilityColor = league.isFeatured ? "#ffab00" : league.visibility === "public" ? "#00e676" : "#64748b";

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h1 className="text-xl font-bold text-white leading-tight">{league.name}</h1>
        <span
          className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm border shrink-0"
          style={{ color: visibilityColor, borderColor: `${visibilityColor}40`, background: `${visibilityColor}12` }}
        >
          {visibilityLabel.toUpperCase()}
        </span>
      </div>
      <p className="text-cockpit-dim text-sm">
        {memberCount === null ? "…" : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
