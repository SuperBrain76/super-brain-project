"use client";

import Link from "next/link";
import { getDivision, ROUND_META } from "@/lib/battle";
import type { BattleMatch } from "@/lib/battle";

interface Props {
  match:  BattleMatch;
  myId:   string;
  onRematch: () => void;
}

export default function MatchResult({ match, myId, onRematch }: Props) {
  const iP1    = match.player1_id === myId;
  const iWon   = match.winner_id === myId;
  const isDraw = match.winner_id === null;
  const myScore = iP1 ? match.player1_score : match.player2_score;
  const opScore = iP1 ? match.player2_score : match.player1_score;
  const myDelta = iP1 ? match.player1_elo_delta : match.player2_elo_delta;
  const myElo   = (iP1 ? match.player1_elo : match.player2_elo) + (myDelta ?? 0);
  const div     = getDivision(myElo);

  const label  = isDraw ? "DRAW" : iWon ? "VICTORY" : "DEFEAT";
  const accent = isDraw ? "#ffab00" : iWon ? "#00e676" : "#ff3d00";

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Result banner */}
      <div className="w-full rounded-sm border text-center py-8"
        style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
        <p className="text-xs font-mono tracking-widest uppercase mb-2"
          style={{ color: `${accent}90` }}>
          Match Complete
        </p>
        <p className="text-5xl font-black tracking-wider" style={{ color: accent }}>
          {label}
        </p>
        <p className="text-cockpit-dim text-sm mt-3">
          {myScore} – {opScore} rounds
        </p>
      </div>

      {/* Elo change */}
      {myDelta !== null && (
        <div className="w-full bg-cockpit-card border border-cockpit-border rounded-sm px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono">Rating</p>
              <p className="text-white text-xl font-extrabold number-display mt-0.5">{myElo}</p>
            </div>
            <div className="text-right">
              <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono">Change</p>
              <p className="text-xl font-extrabold number-display mt-0.5"
                style={{ color: myDelta >= 0 ? "#00e676" : "#ff3d00" }}>
                {myDelta >= 0 ? "+" : ""}{myDelta}
              </p>
            </div>
            <div className="text-right">
              <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono">Division</p>
              <p className="text-base font-bold mt-0.5" style={{ color: div.color }}>{div.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Round breakdown */}
      <div className="w-full bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
        <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono px-4 py-2.5 border-b border-cockpit-border">
          Round Breakdown
        </p>
        {match.round_types.map((rt, i) => {
          const meta = ROUND_META[rt];
          const roundNum = i + 1;
          const iPlayed = roundNum <= match.total_rounds;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-cockpit-border last:border-0">
              <span className="text-lg shrink-0">{meta.icon}</span>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Round {roundNum}</p>
                <p className="text-cockpit-muted text-xs">{meta.label}</p>
              </div>
              {iPlayed && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-sm" style={{ color: meta.color, background: `${meta.color}15` }}>
                  {meta.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full">
        <button onClick={onRematch} className="flex-1 btn-primary">
          Rematch
        </button>
        <Link href="/battle" className="flex-1">
          <button className="w-full btn-ghost">Find New Match</button>
        </Link>
      </div>
    </div>
  );
}
