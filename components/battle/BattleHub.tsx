"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ensureBattleProfile, findOrCreateBattle, leaveQueue,
  getDivision, eloProgress, DIVISIONS,
  type BattleProfile, type BattleMatch,
} from "@/lib/battle";

interface Props {
  userId:   string;
  userName: string;
  country?: string;
}

type HubPhase = "loading" | "ready" | "searching" | "error";

export default function BattleHub({ userId, userName, country }: Props) {
  const router = useRouter();
  const [profile,   setProfile]   = useState<BattleProfile | null>(null);
  const [phase,     setPhase]     = useState<HubPhase>("loading");
  const [dotCount,  setDotCount]  = useState(0);
  const [recentMatches, setRecentMatches] = useState<BattleMatch[]>([]);
  const queueChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Ensure profile + load recent matches ──────────────────────
  useEffect(() => {
    (async () => {
      const prof = await ensureBattleProfile(userId, userName, country);
      if (!prof) { setPhase("error"); return; }
      setProfile(prof);

      const { data } = await supabase
        .from("battle_matches")
        .select("*")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq("status", "complete")
        .order("ended_at", { ascending: false })
        .limit(5);
      if (data) setRecentMatches(data as BattleMatch[]);

      setPhase("ready");
    })();
  }, [userId, userName, country]);

  // ── Animated dots while searching ────────────────────────────
  useEffect(() => {
    if (phase !== "searching") return;
    const iv = setInterval(() => setDotCount((c) => (c + 1) % 4), 500);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Find match ────────────────────────────────────────────────
  const handleFindMatch = useCallback(async () => {
    if (!profile) return;
    setPhase("searching");

    const result = await findOrCreateBattle(userId, profile.display_name, profile.elo, country);

    if (result.status === "matched" && result.match_id) {
      router.push(`/battle/${result.match_id}`);
      return;
    }

    // Queued — wait for a match via Realtime
    const ch = supabase
      .channel(`queue:${userId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "battle_matches",
        filter: `player1_id=eq.${userId}`,
      }, (payload) => {
        const m = payload.new as BattleMatch;
        router.push(`/battle/${m.id}`);
      })
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "battle_matches",
        filter: `player2_id=eq.${userId}`,
      }, (payload) => {
        const m = payload.new as BattleMatch;
        router.push(`/battle/${m.id}`);
      })
      .subscribe();

    queueChannelRef.current = ch;
  }, [profile, userId, country, router]);

  // ── Cancel search ─────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (queueChannelRef.current) {
      supabase.removeChannel(queueChannelRef.current);
      queueChannelRef.current = null;
    }
    await leaveQueue(userId);
    setPhase("ready");
  }, [userId]);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (queueChannelRef.current) {
        supabase.removeChannel(queueChannelRef.current);
        leaveQueue(userId);
      }
    };
  }, [userId]);

  if (phase === "loading" || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-muted animate-pulse text-sm">Initializing battle profile…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-red text-sm">Failed to load battle profile. Try refreshing.</p>
      </div>
    );
  }

  const div      = getDivision(profile.elo);
  const progress = eloProgress(profile.elo);
  const totalGames = profile.wins + profile.losses;
  const winRate    = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto px-4 py-4 flex-1">

      {/* Player card */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm px-5 py-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 shrink-0"
            style={{ background: `${div.color}20`, borderColor: div.color, boxShadow: `0 0 20px ${div.color}30` }}>
            <span className="text-xl font-black" style={{ color: div.color }}>
              {profile.display_name.slice(0, 1).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">{profile.display_name}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: div.color }}>{div.name}</p>
            {/* Elo progress bar */}
            <div className="mt-2 h-1 bg-cockpit-border rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: div.color }} />
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-2xl font-black number-display text-white">{profile.elo}</p>
            <p className="text-cockpit-muted text-xs font-mono">ELO</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 pt-4 border-t border-cockpit-border grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Wins",   value: profile.wins },
            { label: "Losses", value: profile.losses },
            { label: "Win %",  value: `${winRate}%` },
            { label: "Streak", value: profile.win_streak },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-white font-extrabold number-display text-lg">{value}</p>
              <p className="text-cockpit-muted text-[10px] uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Find match / searching */}
      {phase === "ready" && (
        <button
          onClick={handleFindMatch}
          className="w-full py-5 rounded-sm border font-black text-lg tracking-widest uppercase transition-all active:scale-95"
          style={{
            background:   "#00d4ff15",
            borderColor:  "#00d4ff",
            color:        "#00d4ff",
            boxShadow:    "0 0 30px #00d4ff20",
          }}
        >
          ⚔ Find Match
        </button>
      )}

      {phase === "searching" && (
        <div className="w-full py-5 rounded-sm border text-center"
          style={{ background: "#ffab0010", borderColor: "#ffab0060" }}>
          <p className="text-white font-black text-lg tracking-widest uppercase mb-1">
            Searching{".".repeat(dotCount)}
          </p>
          <p className="text-cockpit-muted text-xs mb-3">Looking for an opponent at your level</p>
          <button onClick={handleCancel}
            className="text-cockpit-muted hover:text-cockpit-red text-xs font-mono tracking-widest uppercase transition-colors">
            Cancel
          </button>
        </div>
      )}

      {/* Division ladder */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
        <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono px-4 py-2.5 border-b border-cockpit-border">
          Division Ladder
        </p>
        {[...DIVISIONS].reverse().map((d) => {
          const isCurrent = d.name === div.name;
          return (
            <div key={d.name}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-cockpit-border last:border-0"
              style={{ background: isCurrent ? `${d.color}08` : undefined }}>
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: isCurrent ? d.color : "#1e2a38" }} />
              <span className="text-sm font-semibold flex-1" style={{ color: isCurrent ? d.color : "#475569" }}>
                {d.name}
              </span>
              <span className="text-cockpit-muted text-xs font-mono">
                {d.name === "Grandmaster" ? `${d.min}+` : `${d.min}–${d.max}`}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm"
                  style={{ color: d.color, background: `${d.color}20` }}>
                  YOU
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
          <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono px-4 py-2.5 border-b border-cockpit-border">
            Recent Matches
          </p>
          {recentMatches.map((m) => {
            const iP1     = m.player1_id === userId;
            const iWon    = m.winner_id === userId;
            const isDraw  = m.winner_id === null;
            const opName  = iP1 ? m.player2_name : m.player1_name;
            const myScore = iP1 ? m.player1_score : m.player2_score;
            const opScore = iP1 ? m.player2_score : m.player1_score;
            const delta   = iP1 ? m.player1_elo_delta : m.player2_elo_delta;
            const accent  = isDraw ? "#ffab00" : iWon ? "#00e676" : "#ff3d00";
            const label   = isDraw ? "DRAW"    : iWon ? "WIN"     : "LOSS";
            return (
              <div key={m.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-cockpit-border last:border-0">
                <span className="text-xs font-black w-10 shrink-0 text-center"
                  style={{ color: accent }}>{label}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">vs {opName}</p>
                  <p className="text-cockpit-muted text-xs">{myScore}–{opScore} rounds</p>
                </div>
                {delta !== null && (
                  <span className="text-sm font-bold number-display shrink-0"
                    style={{ color: delta >= 0 ? "#00e676" : "#ff3d00" }}>
                    {delta >= 0 ? "+" : ""}{delta}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
