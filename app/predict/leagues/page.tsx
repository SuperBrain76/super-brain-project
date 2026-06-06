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

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Helpers ───────────────────────────────────────────────────
const SITE = "https://www.superbrain.social";
function inviteUrl(code: string) { return `${SITE}/predict/leagues/join?code=${code}`; }
function whatsappUrl(league: PredictionLeague) {
  const msg = `Join my "${league.name}" World Cup Predictor league on SuperBrain!\n\nUse code: ${league.inviteCode}\nOr join here: ${inviteUrl(league.inviteCode)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

// ── Breadcrumb ────────────────────────────────────────────────
function Crumb({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
      <Link href="/predict" style={{ color: MUTED }} className="hover:underline">Predictor</Link>
      <span>/</span>
      <span style={{ color: TEXT2, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all"
      style={{
        color:       copied ? GREEN  : MUTED,
        borderColor: copied ? `${GREEN}50` : BORDER,
        background:  copied ? "#eef3ec" : "transparent",
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

// ── WhatsApp button ───────────────────────────────────────────
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

// ── League card ───────────────────────────────────────────────
function LeagueCard({ league }: { league: PredictionLeague }) {
  const [memberCount, setMemberCount] = useState<number | null>(
    league.memberCount !== undefined ? league.memberCount : null,
  );
  useEffect(() => {
    if (league.memberCount !== undefined) return;
    getLeagueMemberCount(league.id).then(setMemberCount);
  }, [league.id, league.memberCount]);

  const initials = league.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Name row */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
          style={{ background: GREEN, color: "#fff" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight" style={{ color: TEXT1 }}>{league.name}</p>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            {memberCount === null ? "…" : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
            {" · "}
            {league.visibility === "public" ? "Public" : "Private"}
          </p>
        </div>
        <Link
          href={`/predict/leagues/${league.id}`}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
          style={{ color: GREEN, borderColor: `${GREEN}40`, background: "#eef3ec" }}
        >
          View →
        </Link>
      </div>

      {/* Invite tools */}
      <div
        className="flex items-center gap-2 flex-wrap pt-2"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Code:</span>
        <code className="font-mono font-bold text-sm tracking-widest" style={{ color: GREEN }}>
          {league.inviteCode}
        </code>
        <CopyButton text={league.inviteCode} label="Copy code" />
        <CopyButton text={inviteUrl(league.inviteCode)} label="Copy link" />
        <a
          href={whatsappUrl(league)}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border"
          style={{ color: "#25D366", borderColor: "#25D36640", background: "#f0fdf4" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d={WA_PATH}/>
          </svg>
          WhatsApp
        </a>
      </div>
    </div>
  );
}

// ── Inner page ────────────────────────────────────────────────
function LeaguesContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [competition,    setCompetition]    = useState<Competition | null>(null);
  const [myLeagues,      setMyLeagues]      = useState<PredictionLeague[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [leagueLoadWarn, setLeagueLoadWarn] = useState<string | null>(null);

  const [createName,       setCreateName]       = useState("");
  const [createVisibility, setCreateVisibility] = useState<"private" | "public">("private");
  const [creating,         setCreating]         = useState(false);
  const [createError,      setCreateError]      = useState<string | null>(null);

  const [joinCode,      setJoinCode]      = useState(searchParams.get("join") ?? "");
  const [confirming,    setConfirming]    = useState(false);
  const [foundLeague,   setFoundLeague]   = useState<PredictionLeague | null>(null);
  const [joinLookupErr, setJoinLookupErr] = useState<string | null>(null);
  const [joining,       setJoining]       = useState(false);
  const [joinError,     setJoinError]     = useState<string | null>(null);

  const autoLooked = useRef(false);

  useEffect(() => {
    async function load() {
      const [compResult, leaguesResult] = await Promise.all([
        getCompetition("wc2026"),
        user
          ? getMyLeaguesBySlug("wc2026")
          : Promise.resolve({ leagues: [] as PredictionLeague[], error: null }),
      ]);
      const { competition: comp, error: compError } = compResult;
      if (compError || !comp) { setLoadError(compError ?? "Competition not found."); setLoading(false); return; }
      setCompetition(comp);
      setMyLeagues(leaguesResult.leagues);
      if (leaguesResult.error) setLeagueLoadWarn("Could not load your leagues. Please refresh.");
      setLoading(false);
    }
    if (!authLoading) load();
  }, [user, authLoading]);

  useEffect(() => {
    if (autoLooked.current || !joinCode || !user) return;
    autoLooked.current = true;
    handleLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode, user]);

  const handleLookup = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 0) { setJoinLookupErr("Enter an invite code."); return; }
    setConfirming(true); setJoinLookupErr(null); setFoundLeague(null);
    const league = await getLeagueByInviteCode(code);
    setConfirming(false);
    if (!league) { setJoinLookupErr("No league found with that code. Check and try again."); return; }
    setFoundLeague(league);
  }, [joinCode]);

  const handleJoin = useCallback(async () => {
    if (!foundLeague) return;
    if (myLeagues.some((l) => l.id === foundLeague.id)) { router.push(`/predict/leagues/${foundLeague.id}`); return; }
    setJoining(true); setJoinError(null);
    const { error } = await joinLeague(foundLeague.id);
    setJoining(false);
    if (error) { setJoinError(error); return; }
    router.push(`/predict/leagues/${foundLeague.id}`);
  }, [foundLeague, myLeagues, router]);

  const handleCreate = useCallback(async () => {
    if (!competition) return;
    setCreating(true); setCreateError(null);
    const { league, error } = await createLeague(competition.id, createName, createVisibility);
    setCreating(false);
    if (error) { setCreateError(error); return; }
    if (league) {
      setMyLeagues((prev) => [league, ...prev]);
      setCreateName("");
      router.push(`/predict/leagues/${league.id}?new=1`);
    }
  }, [competition, createName, createVisibility, router]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-6">

        <Crumb label="My Leagues" />

        {/* Header */}
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT1 }}>My Leagues</h1>
          <p className="text-sm mt-1" style={{ color: TEXT2 }}>
            Create or join a league to compete with your crew.
          </p>
        </div>

        {/* Discover CTA */}
        <Link
          href="/predict/leagues/discover"
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors"
          style={{ background: CARD, borderColor: BORDER }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#eef3ec" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: TEXT1 }}>Discover Public Leagues</p>
            <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>Browse featured &amp; open leagues — no invite needed</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* Guest gate */}
        {!user && (
          <div className="rounded-xl p-5 flex flex-col gap-3 text-center"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-semibold" style={{ color: TEXT1 }}>Sign in to create or join leagues</p>
            <p className="text-sm" style={{ color: TEXT2 }}>Your predictions and standings are tied to your account.</p>
            <Link
              href={joinCode
                ? `/login?next=${encodeURIComponent(`/predict/leagues/join?code=${joinCode}`)}`
                : "/login"}
              className="font-bold text-sm py-3 rounded-xl block"
              style={{ background: GREEN, color: "#fff" }}
            >
              Sign in free →
            </Link>
          </div>
        )}

        {/* My leagues list */}
        {user && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: MUTED }}>Your Leagues</h2>
              <span className="text-xs" style={{ color: MUTED }}>{myLeagues.length} league{myLeagues.length !== 1 ? "s" : ""}</span>
            </div>

            {leagueLoadWarn && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "#fef9ee", border: "1px solid #f0e7c4" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-sm" style={{ color: "#92400e" }}>{leagueLoadWarn}</p>
                <button onClick={() => window.location.reload()} className="ml-auto text-[10px] font-semibold hover:underline" style={{ color: "#92400e" }}>Refresh</button>
              </div>
            )}

            {myLeagues.length === 0 && !leagueLoadWarn ? (
              <div className="rounded-xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-sm" style={{ color: TEXT2 }}>You haven&apos;t joined any leagues yet.</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>Create one below or enter an invite code.</p>
              </div>
            ) : (
              myLeagues.map((league) => <LeagueCard key={league.id} league={league} />)
            )}
          </section>
        )}

        {/* ── Create league ─────────────────────────────────── */}
        {user && (
          <section className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h2 className="font-bold text-sm" style={{ color: TEXT1 }}>Create a League</h2>

            {/* Visibility toggle */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: BG }}>
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCreateVisibility(v)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize"
                  style={{
                    background:  createVisibility === v ? CARD : "transparent",
                    color:       createVisibility === v ? TEXT1 : MUTED,
                    boxShadow:   createVisibility === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {v === "private" ? "🔒 Private" : "🌐 Public"}
                </button>
              ))}
            </div>
            <p className="text-[10px]" style={{ color: MUTED }}>
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
                className="flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT1 }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="font-bold text-sm py-2.5 px-4 rounded-lg shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: GREEN, color: "#fff" }}
              >
                {creating ? "Creating…" : "Create →"}
              </button>
            </div>

            <p className="text-[10px]" style={{ color: MUTED }}>2–40 characters · Max 100 members</p>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </section>
        )}

        {/* ── Join by invite code ───────────────────────────── */}
        {user && (
          <section className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h2 className="font-bold text-sm" style={{ color: TEXT1 }}>Join a League</h2>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                  setFoundLeague(null); setJoinLookupErr(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && !confirming && handleLookup()}
                placeholder="Enter 8-character invite code"
                maxLength={8}
                className="flex-1 rounded-lg px-3 py-2.5 text-sm font-mono uppercase tracking-widest focus:outline-none"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT1 }}
              />
              <button
                onClick={handleLookup}
                disabled={confirming || joinCode.trim().length === 0}
                className="text-sm font-semibold py-2.5 px-4 rounded-lg shrink-0 disabled:opacity-40"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT1 }}
              >
                {confirming ? "Looking…" : "Look up"}
              </button>
            </div>

            {joinLookupErr && <p className="text-xs text-red-600">{joinLookupErr}</p>}

            {foundLeague && (
              <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{ background: "#eef3ec", border: `1px solid ${GREEN}30` }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: TEXT1 }}>{foundLeague.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>Code: {foundLeague.inviteCode}</p>
                </div>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="font-bold text-sm py-2 px-4 rounded-lg shrink-0"
                  style={{ background: GREEN, color: "#fff" }}
                >
                  {joining ? "Joining…" : myLeagues.some((l) => l.id === foundLeague.id) ? "View →" : "Join →"}
                </button>
              </div>
            )}

            {joinError && <p className="text-xs text-red-600">{joinError}</p>}
          </section>
        )}

        <Link href="/predict" className="text-xs text-center hover:underline" style={{ color: MUTED }}>
          ← Back to predictor
        </Link>
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────
export default function LeaguesPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading…</p>
      </div>
    }>
      <LeaguesContent />
    </Suspense>
  );
}
