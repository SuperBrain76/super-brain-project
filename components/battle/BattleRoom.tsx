"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getMatch, startBattleRound, submitBattleAnswer, ROUND_META,
  type BattleMatch, type ChallengeData,
} from "@/lib/battle";
import PlayerBar    from "@/components/battle/PlayerBar";
import MatchResult  from "@/components/battle/MatchResult";
import ReactionRound  from "@/components/battle/rounds/ReactionRound";
import MathRound      from "@/components/battle/rounds/MathRound";
import SequenceRound  from "@/components/battle/rounds/SequenceRound";

interface Props {
  matchId: string;
  myId:    string;
  myName:  string;
}

type LocalPhase = "lobby" | "countdown" | "playing" | "round_result" | "complete";

export default function BattleRoom({ matchId, myId, myName }: Props) {
  const router = useRouter();
  const [match,         setMatch]         = useState<BattleMatch | null>(null);
  const [localPhase,    setLocalPhase]    = useState<LocalPhase>("lobby");
  const [countdown,     setCountdown]     = useState(3);
  const [roundWinner,   setRoundWinner]   = useState<string | null | undefined>(undefined);
  const [myAnswered,    setMyAnswered]     = useState(false);
  const [opAnswered,    setOpAnswered]     = useState(false);
  const [startedRound,  setStartedRound]  = useState(0); // which round we triggered start for

  const matchRef        = useRef<BattleMatch | null>(null);
  const answeredRef     = useRef(false);
  const startTriggered  = useRef(false);

  // ── Load match ──────────────────────────────────────────────
  useEffect(() => {
    getMatch(matchId).then((m) => {
      if (m) { setMatch(m); matchRef.current = m; }
    });
  }, [matchId]);

  // ── Realtime subscription ───────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`battle:${matchId}`)
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "battle_matches",
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        const updated = payload.new as BattleMatch;
        setMatch(updated);
        matchRef.current = updated;
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [matchId]);

  // ── State machine: react to match status changes ────────────
  useEffect(() => {
    if (!match) return;

    if (match.status === "lobby" && localPhase === "lobby") {
      // If I'm player1, trigger the first round
      if (match.player1_id === myId && !startTriggered.current) {
        startTriggered.current = true;
        setTimeout(() => {
          startBattleRound(matchId, 0);
        }, 1500);
      }
    }

    if (match.status === "active" && match.round_started_at) {
      const goAt   = new Date(match.round_started_at).getTime();
      const nowMs  = Date.now();
      const waitMs = Math.max(0, goAt - nowMs - 3200); // show countdown BEFORE round

      answeredRef.current = false;
      setMyAnswered(false);
      setOpAnswered(false);
      setRoundWinner(undefined);

      // Countdown phase
      const t1 = setTimeout(() => {
        setLocalPhase("countdown");
        let c = 3;
        setCountdown(c);
        const iv = setInterval(() => {
          c--;
          if (c <= 0) {
            clearInterval(iv);
            setLocalPhase("playing");
          } else {
            setCountdown(c);
          }
        }, 1000);
      }, waitMs);

      return () => clearTimeout(t1);
    }

    if (match.status === "result") {
      // Check round results to determine winner display
      supabase
        .from("battle_round_results")
        .select("winner_id, player1_answer, player2_answer")
        .eq("match_id", matchId)
        .eq("round_number", match.current_round)
        .single()
        .then(({ data }) => {
          if (data) {
            setRoundWinner(data.winner_id);
            setOpAnswered(
              match.player1_id === myId
                ? data.player2_answer !== null
                : data.player1_answer !== null,
            );
          }
          setLocalPhase("round_result");
        });

      // Advance to next round after 3s (player1 triggers)
      if (match.player1_id === myId) {
        const t = setTimeout(() => {
          startBattleRound(matchId, match.current_round);
        }, 3000);
        return () => clearTimeout(t);
      }
    }

    if (match.status === "complete") {
      setLocalPhase("complete");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, match?.current_round]);

  // ── Answer submission ───────────────────────────────────────
  const handleAnswer = useCallback(async (answer: string, timeMs: number) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setMyAnswered(true);
    await submitBattleAnswer(matchId, myId, answer, timeMs);
  }, [matchId, myId]);

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-muted animate-pulse">Connecting to battle…</p>
      </div>
    );
  }

  const isP1         = match.player1_id === myId;
  const challenge    = match.challenge_data as ChallengeData | null;
  const roundType    = match.round_types?.[match.current_round - 1];
  const meta         = roundType ? ROUND_META[roundType] : null;
  const startedAt    = match.round_started_at ? new Date(match.round_started_at) : new Date();
  const myWins       = isP1 ? match.player1_score : match.player2_score;
  const opWins       = isP1 ? match.player2_score : match.player1_score;
  const iWon         = roundWinner === myId;
  const isDraw       = roundWinner === null;

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg mx-auto px-4 py-4 flex-1">

      {/* Player bar — always visible */}
      <PlayerBar match={match} myId={myId} />

      {/* Phase: lobby */}
      {localPhase === "lobby" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="flex gap-2">
            {[0,1,2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-cockpit-accent animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-cockpit-dim text-sm">Battle starting…</p>
        </div>
      )}

      {/* Phase: countdown */}
      {localPhase === "countdown" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {meta && (
            <div className="text-center mb-2">
              <p className="text-xs uppercase tracking-widest font-mono mb-1"
                style={{ color: meta.color }}>
                Round {match.current_round} — {meta.label}
              </p>
              <p className="text-cockpit-muted text-xs">{meta.desc}</p>
            </div>
          )}
          <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center"
            style={{ borderColor: meta?.color ?? "#00d4ff", boxShadow: `0 0 40px ${meta?.color ?? "#00d4ff"}40` }}>
            <span className="text-6xl font-black text-white number-display">{countdown}</span>
          </div>
        </div>
      )}

      {/* Phase: playing */}
      {localPhase === "playing" && challenge && (
        <div className="flex-1 flex flex-col gap-3">
          {/* Round label */}
          {meta && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs uppercase tracking-widest font-mono" style={{ color: meta.color }}>
                {meta.icon} Round {match.current_round} — {meta.label}
              </p>
              {myAnswered && (
                <span className="text-cockpit-accent text-xs font-mono animate-pulse">Waiting…</span>
              )}
            </div>
          )}

          {/* Round component */}
          {challenge.type === "reaction" && (
            <ReactionRound
              challenge={challenge}
              startedAt={startedAt}
              onAnswer={handleAnswer}
              opponentDone={opAnswered}
              disabled={myAnswered}
            />
          )}
          {challenge.type === "math" && (
            <MathRound
              challenge={challenge}
              startedAt={startedAt}
              onAnswer={handleAnswer}
              opponentDone={opAnswered}
              disabled={myAnswered}
            />
          )}
          {challenge.type === "sequence" && (
            <SequenceRound
              challenge={challenge}
              startedAt={startedAt}
              onAnswer={handleAnswer}
              opponentDone={opAnswered}
              disabled={myAnswered}
            />
          )}
        </div>
      )}

      {/* Phase: round result */}
      {localPhase === "round_result" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {roundWinner !== undefined && (
            <div className="text-center">
              {isDraw ? (
                <>
                  <p className="text-5xl font-black text-cockpit-muted">DRAW</p>
                  <p className="text-cockpit-dim text-sm mt-2">No point awarded</p>
                </>
              ) : iWon ? (
                <>
                  <p className="text-5xl font-black" style={{ color: "#00e676" }}>ROUND WIN</p>
                  <p className="text-cockpit-dim text-sm mt-2">+1 point</p>
                </>
              ) : (
                <>
                  <p className="text-5xl font-black" style={{ color: "#ff3d00" }}>ROUND LOST</p>
                  <p className="text-cockpit-dim text-sm mt-2">Opponent takes the point</p>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-black number-display" style={{ color: "#00e676" }}>{myWins}</p>
              <p className="text-cockpit-muted text-xs mt-1">YOU</p>
            </div>
            <p className="text-cockpit-border text-2xl">–</p>
            <div className="text-center">
              <p className="text-4xl font-black number-display" style={{ color: "#ff3d00" }}>{opWins}</p>
              <p className="text-cockpit-muted text-xs mt-1">OPP</p>
            </div>
          </div>
          {match.current_round < match.total_rounds && (
            <p className="text-cockpit-muted text-xs animate-pulse">Next round starting…</p>
          )}
        </div>
      )}

      {/* Phase: complete */}
      {localPhase === "complete" && (
        <div className="flex-1 overflow-y-auto">
          <MatchResult
            match={match}
            myId={myId}
            onRematch={() => router.push("/battle")}
          />
        </div>
      )}
    </div>
  );
}
