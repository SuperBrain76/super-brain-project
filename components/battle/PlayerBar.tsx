"use client";

import { getDivision } from "@/lib/battle";
import type { BattleMatch } from "@/lib/battle";

interface Props {
  match:  BattleMatch;
  myId:   string;
}

function Avatar({ name, elo, score, isMe, isWinner, isDone }: {
  name: string; elo: number; score: number;
  isMe: boolean; isWinner?: boolean; isDone?: boolean;
}) {
  const div = getDivision(elo);
  return (
    <div className={`flex-1 flex flex-col items-center gap-1 ${isMe ? "items-start" : "items-end"}`}>
      <div className={`flex items-center gap-2 ${isMe ? "flex-row" : "flex-row-reverse"}`}>
        {/* Avatar circle */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2"
          style={{
            background:   `${div.color}20`,
            borderColor:  isWinner ? "#00e676" : div.color,
            boxShadow:    isWinner ? `0 0 12px #00e67660` : "none",
          }}>
          <span className="text-sm font-black" style={{ color: div.color }}>
            {name.slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div className={`${isMe ? "text-left" : "text-right"}`}>
          <p className="text-white text-sm font-bold leading-none truncate max-w-[90px]">
            {isMe ? "YOU" : name}
          </p>
          <p className="text-xs font-semibold" style={{ color: div.color }}>{div.name}</p>
        </div>
      </div>
      {isDone && (
        <span className="text-[10px] text-cockpit-accent font-mono uppercase tracking-widest">answered</span>
      )}
    </div>
  );
}

export default function PlayerBar({ match, myId }: Props) {
  const iP1 = match.player1_id === myId;
  const my  = iP1 ? { name: match.player1_name, elo: match.player1_elo, score: match.player1_score }
                  : { name: match.player2_name, elo: match.player2_elo, score: match.player2_score };
  const op  = iP1 ? { name: match.player2_name, elo: match.player2_elo, score: match.player2_score }
                  : { name: match.player1_name, elo: match.player1_elo, score: match.player1_score };

  const myWins = iP1 ? match.player1_score : match.player2_score;
  const opWins = iP1 ? match.player2_score : match.player1_score;

  return (
    <div className="w-full bg-cockpit-card border border-cockpit-border rounded-sm px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={my.name} elo={my.elo} score={my.score} isMe={true} />

        {/* Score pills */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1">
            {Array.from({ length: match.total_rounds }).map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-sm flex items-center justify-center border text-xs font-black"
                style={{
                  borderColor: i < myWins ? "#00e676" : "#1e2a38",
                  background:  i < myWins ? "#00e67620" : "transparent",
                  color:       i < myWins ? "#00e676" : "#1e2a38",
                }}>
                {i < myWins ? "W" : "·"}
              </div>
            ))}
          </div>
          <span className="text-cockpit-border text-xs font-mono">VS</span>
          <div className="flex gap-1 flex-row-reverse">
            {Array.from({ length: match.total_rounds }).map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-sm flex items-center justify-center border text-xs font-black"
                style={{
                  borderColor: i < opWins ? "#ff3d00" : "#1e2a38",
                  background:  i < opWins ? "#ff3d0020" : "transparent",
                  color:       i < opWins ? "#ff3d00" : "#1e2a38",
                }}>
                {i < opWins ? "W" : "·"}
              </div>
            ))}
          </div>
        </div>

        <Avatar name={op.name} elo={op.elo} score={op.score} isMe={false} />
      </div>
    </div>
  );
}
