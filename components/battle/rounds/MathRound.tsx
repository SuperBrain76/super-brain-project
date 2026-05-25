"use client";

import { useEffect, useRef, useState } from "react";
import type { MathChallenge } from "@/lib/battle";

interface Props {
  challenge:    MathChallenge;
  startedAt:    Date;
  onAnswer:     (answer: string, timeMs: number) => void;
  opponentDone: boolean;
  disabled:     boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MathRound({ challenge, startedAt, onAnswer, opponentDone, disabled }: Props) {
  const [active,   setActive]   = useState(false);
  const [picked,   setPicked]   = useState<number | null>(null);
  const [timeBar,  setTimeBar]  = useState(100);
  const startRef  = useRef(0);
  const answeredRef = useRef(false);
  const options   = useRef(shuffle(challenge.options)).current;
  const TIME_LIMIT = 8000;

  useEffect(() => {
    const now   = Date.now();
    const goAt  = startedAt.getTime();
    const waitMs = Math.max(0, goAt - now);
    const t = setTimeout(() => {
      startRef.current = Date.now();
      setActive(true);
    }, waitMs);
    return () => clearTimeout(t);
  }, [startedAt]);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / TIME_LIMIT) * 100);
      setTimeBar(pct);
      if (pct <= 0 && !answeredRef.current) {
        answeredRef.current = true;
        onAnswer("TIMEOUT", TIME_LIMIT);
      }
    }, 30);
    return () => clearInterval(iv);
  }, [active, onAnswer]);

  const handlePick = (opt: number) => {
    if (!active || disabled || answeredRef.current) return;
    answeredRef.current = true;
    const ms = Date.now() - startRef.current;
    setPicked(opt);
    onAnswer(String(opt), ms);
  };

  const correct = Number(challenge.correct_answer);

  return (
    <div className="flex flex-col items-center gap-6 w-full select-none">
      {/* Time bar */}
      <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full transition-none rounded-full"
          style={{ width: `${timeBar}%`, background: timeBar > 50 ? "#00e676" : timeBar > 25 ? "#ffab00" : "#ff3d00" }} />
      </div>

      {/* Problem */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-sm w-full py-10 flex items-center justify-center">
        <p className="text-5xl font-black text-white tracking-wider">
          {challenge.a} <span className="text-cockpit-accent">{challenge.op}</span> {challenge.b} =&nbsp;
          <span className={active ? "text-cockpit-muted" : "text-cockpit-border"}>?</span>
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((opt) => {
          const isCorrect = opt === correct;
          const isPicked  = picked === opt;
          let bg    = "#0d111710";
          let border = "#1e2a38";
          let color  = "text-white";
          if (isPicked) {
            bg     = isCorrect ? "#00e67620" : "#ff3d0020";
            border = isCorrect ? "#00e676"   : "#ff3d00";
          }
          return (
            <button
              key={opt}
              onClick={() => handlePick(opt)}
              disabled={!!picked || disabled || !active}
              className={`py-6 rounded-sm border text-2xl font-extrabold number-display transition-all duration-75 active:scale-95 focus:outline-none ${color}`}
              style={{ background: bg, borderColor: border }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {opponentDone && !picked && (
        <p className="text-cockpit-accent text-xs font-mono">Opponent answered</p>
      )}
    </div>
  );
}
