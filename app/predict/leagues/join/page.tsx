"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getLeagueByInviteCode,
  joinLeague,
  joinPublicLeague,
  type PredictionLeague,
} from "@/lib/predictor";

const PENDING_LEAGUE_JOIN_KEY = "pendingLeagueJoin";

type Status = "idle" | "looking" | "joining" | "success" | "already-member" | "error";

function JoinContent() {
  const searchParams             = useSearchParams();
  const router                   = useRouter();
  const { user, loading: authLoading } = useAuth();

  const codeFromUrl = searchParams.get("code")?.trim().toUpperCase() ?? "";

  const [status,   setStatus]   = useState<Status>("idle");
  const [league,   setLeague]   = useState<PredictionLeague | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const didRun = useRef(false);

  // ── Not authed — save code and redirect to login ───────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (codeFromUrl) localStorage.setItem(PENDING_LEAGUE_JOIN_KEY, codeFromUrl);
      const dest = codeFromUrl
        ? `/predict/leagues/join?code=${encodeURIComponent(codeFromUrl)}`
        : "/predict/leagues/join";
      router.replace(`/login?next=${encodeURIComponent(dest)}`);
    }
  }, [authLoading, user, codeFromUrl, router]);

  // ── Authed — resolve code and join ─────────────────────────
  useEffect(() => {
    if (authLoading || !user || didRun.current) return;
    didRun.current = true;

    const joinCode = codeFromUrl || localStorage.getItem(PENDING_LEAGUE_JOIN_KEY) || "";

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
        // "already a member" is not a real error — surface as success
        const isAlready = error.toLowerCase().includes("already") ||
                          error.toLowerCase().includes("duplicate");
        if (isAlready) {
          localStorage.removeItem(PENDING_LEAGUE_JOIN_KEY);
          setStatus("already-member");
          setTimeout(() => router.replace(`/predict/leagues/${found.id}`), 1500);
          return;
        }
        setStatus("error");
        setErrorMsg(error);
        return;
      }

      localStorage.removeItem(PENDING_LEAGUE_JOIN_KEY);
      setStatus("success");
      setTimeout(() => router.replace(`/predict/leagues/${found.id}`), 1800);
    }

    doJoin();
  }, [authLoading, user, codeFromUrl, router]);

  // ── UI ─────────────────────────────────────────────────────

  const isWorking = status === "idle" || status === "looking" || status === "joining";

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Icon header */}
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto rounded-sm flex items-center justify-center mb-4"
            style={{ background: "#00d4ff10", border: "1px solid #00d4ff30" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">
            {status === "success"      ? "You're in!" :
             status === "already-member" ? "Already a member" :
             status === "error"        ? "Join failed" :
             "Joining league…"}
          </h1>
        </div>

        {/* Status card */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 text-center flex flex-col items-center gap-4">

          {isWorking && (
            <>
              <p className="text-cockpit-dim text-sm animate-pulse">
                {status === "looking"  ? "Looking up league…" :
                 status === "joining"  ? `Joining${league ? ` "${league.name}"` : ""}…` :
                 "Loading…"}
              </p>
              {codeFromUrl && (
                <p className="text-cockpit-muted text-xs font-mono tracking-widest">{codeFromUrl}</p>
              )}
            </>
          )}

          {(status === "success" || status === "already-member") && league && (
            <>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "#00e67610", border: "1px solid #00e67640" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">
                  {status === "success" ? `Joined league: ${league.name}` : `Already in: ${league.name}`}
                </p>
                <p className="text-cockpit-muted text-xs mt-1">Taking you there now…</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "#ff525210", border: "1px solid #ff525240" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5252" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
              <p className="text-cockpit-red text-sm leading-relaxed">{errorMsg}</p>
              <Link
                href="/predict/leagues"
                className="btn-primary w-full flex items-center justify-center text-sm"
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

export default function LeagueJoinPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
