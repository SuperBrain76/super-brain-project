"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getCompetition,
  getMyLeaguesBySlug,
  createLeague,
  joinLeague,
  getLeagueByInviteCode,
  getLeagueMemberCount,
  type Competition,
  type PredictionLeague,
} from "@/lib/predictor";

// ── Invite URL helper ─────────────────────────────────────────

const SITE = "https://superbrain.social";

function inviteUrl(code: string) {
  return `${SITE}/predict/leagues/join?code=${code}`;
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-https / older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={copy}
      className="text-[10px] font-mono px-2 py-1 rounded-sm border transition-all"
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

// ── League card ───────────────────────────────────────────────

function LeagueCard({ league }: { league: PredictionLeague }) {
  // Fast path: memberCount already in the object when RPC is available (migration 005b).
  // Fallback: load separately when RPC wasn't available and memberCount is undefined.
  const [memberCount, setMemberCount] = useState<number | null>(
    league.memberCount !== undefined ? league.memberCount : null,
  );

  useEffect(() => {
    if (league.memberCount !== undefined) return; // already have it
    getLeagueMemberCount(league.id).then(setMemberCount);
  }, [league.id, league.memberCount]);

  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex flex-col gap-3">
      {/* Name + member count */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white font-semibold text-sm leading-tight">{league.name}</p>
          <p className="text-cockpit-muted text-xs mt-0.5">
            {memberCount === null ? "…" : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href={`/predict/leagues/${league.id}`}
          className="shrink-0 text-xs px-3 py-1.5 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors"
        >
          View →
        </Link>
      </div>

      {/* Invite code */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-cockpit-muted font-mono uppercase tracking-widest">Code:</span>
        <code className="text-cockpit-accent font-mono font-bold text-sm tracking-widest">
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
    </div>
  );
}

// ── Inner page (uses useSearchParams) ────────────────────────

function LeaguesContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [competition,    setCompetition]    = useState<Competition | null>(null);
  const [myLeagues,      setMyLeagues]      = useState<PredictionLeague[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [leagueLoadWarn, setLeagueLoadWarn] = useState<string | null>(null);

  // Create form
  const [createName,       setCreateName]       = useState("");
  const [createVisibility, setCreateVisibility] = useState<"private" | "public">("private");
  const [creating,         setCreating]         = useState(false);
  const [createError,      setCreateError]      = useState<string | null>(null);

  // Join form
  const [joinCode,       setJoinCode]       = useState(searchParams.get("join") ?? "");
  const [confirming,     setConfirming]     = useState(false);
  const [foundLeague,    setFoundLeague]    = useState<PredictionLeague | null>(null);
  const [joinLookupErr,  setJoinLookupErr]  = useState<string | null>(null);
  const [joining,        setJoining]        = useState(false);
  const [joinError,      setJoinError]      = useState<string | null>(null);

  const autoLooked = useRef(false);

  // Load competition + user leagues in parallel.
  // getMyLeaguesBySlug tries the fast RPC, then falls back to a direct
  // query if the RPC isn't deployed yet. Returns { leagues, error }.
  useEffect(() => {
    async function load() {
      const [compResult, leaguesResult] = await Promise.all([
        getCompetition("wc2026"),
        user
          ? getMyLeaguesBySlug("wc2026")
          : Promise.resolve({ leagues: [] as PredictionLeague[], error: null }),
      ]);

      const { competition: comp, error: compError } = compResult;
      if (compError || !comp) {
        setLoadError(compError ?? "Competition not found.");
        setLoading(false);
        return;
      }

      setCompetition(comp);
      setMyLeagues(leaguesResult.leagues);

      // Surface a non-blocking warning if league loading partially failed
      if (leaguesResult.error) {
        setLeagueLoadWarn("Could not load your leagues. Please refresh the page.");
      }

      setLoading(false);
    }
    if (!authLoading) load();
  }, [user, authLoading]);

  // Auto-lookup if ?join= param present
  useEffect(() => {
    if (autoLooked.current || !joinCode || !user) return;
    autoLooked.current = true;
    handleLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode, user]);

  const handleLookup = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 0) { setJoinLookupErr("Enter an invite code."); return; }
    setConfirming(true);
    setJoinLookupErr(null);
    setFoundLeague(null);
    const league = await getLeagueByInviteCode(code);
    setConfirming(false);
    if (!league) { setJoinLookupErr("No league found with that code. Check the code and try again."); return; }
    setFoundLeague(league);
  }, [joinCode]);

  const handleJoin = useCallback(async () => {
    if (!foundLeague) return;
    // Already a member?
    if (myLeagues.some((l) => l.id === foundLeague.id)) {
      router.push(`/predict/leagues/${foundLeague.id}`);
      return;
    }
    setJoining(true);
    setJoinError(null);
    const { error } = await joinLeague(foundLeague.id);
    setJoining(false);
    if (error) { setJoinError(error); return; }
    router.push(`/predict/leagues/${foundLeague.id}`);
  }, [foundLeague, myLeagues, router]);

  const handleCreate = useCallback(async () => {
    if (!competition) return;
    setCreating(true);
    setCreateError(null);
    const { league, error } = await createLeague(competition.id, createName, createVisibility);
    setCreating(false);
    if (error) { setCreateError(error); return; }
    if (league) {
      setMyLeagues((prev) => [league, ...prev]);
      setCreateName("");
      router.push(`/predict/leagues/${league.id}`);
    }
  }, [competition, createName, createVisibility, router]);

  // ── Loading ───────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-cockpit-red text-sm">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-6">

        {/* ── Header ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-3">
            <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
            <span>/</span>
            <span className="text-cockpit-dim">My Leagues</span>
          </div>
          <h1 className="text-xl font-bold text-white">My Leagues</h1>
          <p className="text-cockpit-dim text-sm mt-1">Create or join a league to compete with your crew.</p>
        </div>

        {/* ── Discover CTA ──────────────────────────────────── */}
        <Link
          href="/predict/leagues/discover"
          className="flex items-center gap-3 px-4 py-3.5 rounded-sm border transition-colors"
          style={{ background: "#ffab0008", borderColor: "#ffab0030" }}
        >
          <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0" style={{ background: "#ffab0015" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffab00" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-none">Discover Public Leagues</p>
            <p className="text-cockpit-muted text-[10px] mt-0.5">Browse featured &amp; open leagues — no invite needed</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffab00" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* ── Guest gate ───────────────────────────────────── */}
        {!user && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-3 text-center">
            <p className="text-white font-semibold">Sign in to create or join leagues</p>
            <p className="text-cockpit-dim text-sm">Your predictions and standings are tied to your account.</p>
            <Link
              href={joinCode
                ? `/login?next=${encodeURIComponent(`/predict/leagues/join?code=${joinCode}`)}`
                : "/login"}
              className="btn-primary w-full flex items-center justify-center"
            >
              Sign in free →
            </Link>
          </div>
        )}

        {/* ── My leagues ───────────────────────────────────── */}
        {user && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">My Leagues</h2>
              <span className="text-cockpit-muted text-xs font-mono">{myLeagues.length} league{myLeagues.length !== 1 ? "s" : ""}</span>
            </div>

            {/* League load warning — shown when league query failed but didn't crash */}
            {leagueLoadWarn && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-cockpit-amber border-opacity-30 bg-cockpit-surface">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffab00" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-cockpit-amber text-xs">{leagueLoadWarn}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="ml-auto text-[10px] font-mono text-cockpit-amber hover:underline shrink-0"
                >
                  Refresh
                </button>
              </div>
            )}

            {myLeagues.length === 0 && !leagueLoadWarn ? (
              <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 text-center">
                <p className="text-cockpit-dim text-sm">You haven&apos;t joined any leagues yet.</p>
                <p className="text-cockpit-muted text-xs mt-1">Create one below or ask a friend for their invite code.</p>
              </div>
            ) : (
              myLeagues.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))
            )}
          </section>
        )}

        {/* ── Create league ─────────────────────────────────── */}
        {user && (
          <section className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cockpit-accent" />
              <h2 className="text-white font-semibold text-sm">Create a League</h2>
            </div>

            {/* Visibility toggle */}
            <div className="flex gap-1 p-1 bg-cockpit-bg border border-cockpit-border rounded-sm">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCreateVisibility(v)}
                  className="flex-1 py-1.5 rounded-sm text-xs font-semibold transition-all duration-150 capitalize"
                  style={{
                    background: createVisibility === v ? "#1e2a38" : "transparent",
                    color:      createVisibility === v ? "#fff"    : "#64748b",
                  }}
                >
                  {v === "private" ? "🔒 Private" : "🌐 Public"}
                </button>
              ))}
            </div>
            <p className="text-cockpit-muted text-[10px] font-mono -mt-1">
              {createVisibility === "private"
                ? "Invite-only · not listed publicly · share a code to invite friends"
                : "Listed on Discover · anyone can join · no invite code needed"}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creating && createName.trim() && handleCreate()}
                placeholder="League name (e.g. The Office)"
                maxLength={40}
                className="flex-1 bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="btn-primary text-sm py-2 px-4 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Creating…" : "Create →"}
              </button>
            </div>

            <p className="text-cockpit-muted text-[10px] font-mono">
              2–40 characters · Max 100 members
            </p>

            {createError && (
              <p className="text-cockpit-red text-xs">{createError}</p>
            )}
          </section>
        )}

        {/* ── Join by invite code ───────────────────────────── */}
        {user && (
          <section className="bg-cockpit-card border border-cockpit-border rounded-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green" />
              <h2 className="text-white font-semibold text-sm">Join a League</h2>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                  setFoundLeague(null);
                  setJoinLookupErr(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && !confirming && handleLookup()}
                placeholder="Enter 8-character invite code"
                maxLength={8}
                className="flex-1 bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm font-mono uppercase tracking-widest focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted placeholder:normal-case placeholder:tracking-normal"
              />
              <button
                onClick={handleLookup}
                disabled={confirming || joinCode.trim().length === 0}
                className="btn-ghost text-sm py-2 px-4 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? "Looking…" : "Look up"}
              </button>
            </div>

            {joinLookupErr && (
              <p className="text-cockpit-red text-xs">{joinLookupErr}</p>
            )}

            {/* Confirm join */}
            {foundLeague && (
              <div className="border border-cockpit-border rounded-sm p-3 flex items-center justify-between gap-3 bg-cockpit-surface">
                <div>
                  <p className="text-white text-sm font-semibold">{foundLeague.name}</p>
                  <p className="text-cockpit-muted text-xs">Code: {foundLeague.inviteCode}</p>
                </div>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn-primary text-sm py-1.5 px-4 shrink-0"
                >
                  {joining ? "Joining…" : myLeagues.some((l) => l.id === foundLeague.id) ? "View →" : "Join →"}
                </button>
              </div>
            )}

            {joinError && (
              <p className="text-cockpit-red text-xs">{joinError}</p>
            )}
          </section>
        )}

        {/* Back */}
        <Link href="/predict" className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono">
          ← Back to predictor
        </Link>
      </div>
    </div>
  );
}

// ── Page export (Suspense wrapper for useSearchParams) ────────

export default function LeaguesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
        </div>
      }
    >
      <LeaguesContent />
    </Suspense>
  );
}
