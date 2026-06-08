"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getLeagueByInviteCode,
  joinLeague,
  joinPublicLeague,
  getLeagueSummary,
  type PredictionLeague,
  type LeagueSummary,
} from "@/lib/predictor";
import { signInWithGoogle } from "@/lib/googleAuth";
import { track } from "@/lib/analytics";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";

const PENDING_LEAGUE_JOIN_KEY = "pendingLeagueJoin";

type Status = "idle" | "looking" | "joining" | "success" | "already-member" | "error";

// ── Google "G" logo ───────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function JoinContent({ code }: { code: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [status,      setStatus]      = useState<Status>("idle");
  const [league,      setLeague]      = useState<PredictionLeague | null>(null);
  const [summary,     setSummary]     = useState<LeagueSummary | null>(null);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [googleBusy,  setGoogleBusy]  = useState(false);
  const didRun = useRef(false);

  // Pre-fetch league name + social proof stats as soon as code is known.
  // Also fires invite_page_viewed with the real leagueId once resolved.
  useEffect(() => {
    if (!code) {
      track.invitePageViewed(null, "unknown");
      return;
    }
    async function fetchPreview() {
      const found = await getLeagueByInviteCode(code);
      if (!found) { track.invitePageViewed(null, "link"); return; }
      setLeague(found);
      track.invitePageViewed(found.id, "link");
      const s = await getLeagueSummary(found.id);
      setSummary(s);
    }
    fetchPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Not authed — save code to localStorage for after sign-in
  // (We now show an inline sign-in card instead of hard-redirecting)
  useEffect(() => {
    if (authLoading || user) return;
    if (code) {
      try { localStorage.setItem(PENDING_LEAGUE_JOIN_KEY, code); } catch { /* private mode */ }
    }
  }, [authLoading, user, code]);

  // Authed — resolve code and join
  useEffect(() => {
    if (authLoading || !user || didRun.current) return;
    didRun.current = true;

    let joinCode = code;
    if (!joinCode) {
      try { joinCode = localStorage.getItem(PENDING_LEAGUE_JOIN_KEY) ?? ""; } catch { /* ignore */ }
    }

    if (!joinCode) {
      setStatus("error");
      setErrorMsg("No invite code found. Please use the original invite link.");
      return;
    }

    async function doJoin() {
      setStatus("looking");
      const found = await getLeagueByInviteCode(joinCode);
      if (!found) {
        setStatus("error");
        setErrorMsg("No league found with that invite code. The link may be expired or invalid.");
        return;
      }
      setLeague(found);
      setStatus("joining");

      const fn = (found.visibility === "public" || found.isFeatured)
        ? joinPublicLeague
        : joinLeague;

      const { error } = await fn(found.id);

      if (error) {
        const isAlready = error.toLowerCase().includes("already") ||
                          error.toLowerCase().includes("duplicate");
        if (isAlready) {
          try { localStorage.removeItem(PENDING_LEAGUE_JOIN_KEY); } catch { /* ignore */ }
          setStatus("already-member");
          setTimeout(() => router.replace(`/predict/leagues/${found.id}`), 1500);
          return;
        }
        setStatus("error");
        setErrorMsg(error);
        return;
      }

      try { localStorage.removeItem(PENDING_LEAGUE_JOIN_KEY); } catch { /* ignore */ }
      setStatus("success");
      setTimeout(() => router.replace(`/predict/leagues/${found.id}`), 1800);
    }

    doJoin();
  }, [authLoading, user, code, router]);

  const isWorking = status === "idle" || status === "looking" || status === "joining";

  // ── Not signed in — show social proof + inline Google sign-in ──
  if (!authLoading && !user) {
    const dest = code
      ? `/predict/leagues/join?code=${encodeURIComponent(code)}`
      : "/predict/leagues/join";

    const handleGoogle = async () => {
      setGoogleBusy(true);
      track.googleLoginClicked("join_page");
      const err = await signInWithGoogle(dest);
      if (err) setGoogleBusy(false);
    };

    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm flex flex-col gap-4">

          {/* ── League identity header ── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: GREEN, position: "relative" }}
          >
            {/* Subtle gold radial glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 60% 100% at 90% 50%, rgba(184,151,42,0.10), transparent)" }} />
            <div className="relative px-5 py-5 flex flex-col gap-3">
              {/* Trophy + league name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(184,151,42,0.15)", border: "1px solid rgba(184,151,42,0.3)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8972a"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                    style={{ color: "rgba(255,255,255,0.45)" }}>
                    You&apos;ve been invited to
                  </p>
                  <h1 className="font-extrabold text-lg leading-tight text-white truncate">
                    {league?.name ?? (code ? `League ${code}` : "a league")}
                  </h1>
                </div>
              </div>

              {/* Social proof stats strip */}
              {summary && (summary.memberCount > 0 || summary.leaderName) && (
                <div
                  className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {[
                    {
                      value: String(summary.memberCount),
                      label: summary.memberCount === 1 ? "Member" : "Members",
                    },
                    {
                      value: String(summary.totalPredictions),
                      label: "Predictions",
                    },
                    {
                      value: summary.leaderPoints !== null ? `${summary.leaderPoints}` : "—",
                      label: "Leader pts",
                    },
                  ].map((s, i) => (
                    <div
                      key={s.label}
                      className="flex flex-col items-center py-2.5 px-1"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        borderRight: i < 2 ? "1px solid rgba(255,255,255,0.10)" : undefined,
                      }}
                    >
                      <span className="text-base font-black tabular-nums leading-none text-white">{s.value}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
                        style={{ color: "rgba(255,255,255,0.4)" }}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Leader name */}
              {summary?.leaderName && (
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  🏆 Currently led by <span className="font-semibold text-white">{summary.leaderName}</span>
                  {summary.leaderPoints !== null && (
                    <span> with {summary.leaderPoints} pts</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* ── Sign-in card ── */}
          <div className="rounded-xl p-5 flex flex-col gap-4"
            style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}>
            <p className="text-sm font-semibold text-center" style={{ color: TEXT1 }}>
              Sign in to join and start predicting
            </p>

            {/* Google button */}
            <button
              onClick={handleGoogle}
              disabled={googleBusy}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "#ffffff",
                border:     "1px solid #dadce0",
                color:      "#3c4043",
                boxShadow:  "0 1px 3px rgba(0,0,0,0.08)",
                opacity:    googleBusy ? 0.7 : 1,
                touchAction: "manipulation",
              }}
            >
              {googleBusy ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#dadce0" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              ) : <GoogleLogo />}
              {googleBusy ? "Redirecting…" : "Continue with Google"}
            </button>

            {/* OR divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: BORDER }} />
              <span className="text-xs tracking-widest uppercase" style={{ color: MUTED }}>or</span>
              <div className="flex-1 h-px" style={{ background: BORDER }} />
            </div>

            {/* Email login link */}
            <Link
              href={`/login?next=${encodeURIComponent(dest)}`}
              className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background: `${GREEN}08`,
                border:     `1px solid ${GREEN}30`,
                color:      GREEN,
              }}
            >
              Sign in with Email
            </Link>

            <p className="text-[10px] text-center" style={{ color: MUTED }}>
              Free to play · No spam · Unsubscribe anytime
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Icon header */}
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4"
            style={{ background: `${GREEN}12`, border: `1px solid ${GREEN}30` }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GREEN}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: TEXT1 }}>
            {status === "success"        ? "You're in!" :
             status === "already-member" ? "Already a member" :
             status === "error"          ? "Join failed" :
             "Joining league…"}
          </h1>
        </div>

        {/* Status card */}
        <div className="p-6 text-center flex flex-col items-center gap-4 rounded-xl"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}>

          {isWorking && (
            <>
              <p className="text-sm animate-pulse" style={{ color: TEXT2 }}>
                {status === "looking" ? "Looking up league…" :
                 status === "joining" ? `Joining${league ? ` "${league.name}"` : ""}…` :
                 "Loading…"}
              </p>
              {code && (
                <p className="text-xs font-mono tracking-widest" style={{ color: MUTED }}>{code}</p>
              )}
            </>
          )}

          {(status === "success" || status === "already-member") && league && (
            <>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: `${GREEN}12`, border: `1px solid ${GREEN}30` }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold" style={{ color: TEXT1 }}>
                  {status === "success" ? `Joined league: ${league.name}` : `Already in: ${league.name}`}
                </p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>Taking you there now…</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c0392b"
                  strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
              <p className="text-sm leading-relaxed text-red-600">{errorMsg}</p>
              <Link
                href="/predict/leagues"
                className="py-2.5 px-4 rounded-lg font-bold text-sm w-full flex items-center justify-center"
                style={{ background: GREEN, color: "#fff" }}
              >
                Browse my leagues →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
