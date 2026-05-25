"use client";

import { useEffect, useRef, useState } from "react";
import type { SequenceChallenge } from "@/lib/battle";

interface Props {
  challenge:    SequenceChallenge;
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

export default function SequenceRound({ challenge, startedAt, onAnswer, opponentDone, disabled }: Props) {
  const [active,  setActive]  = useState(false);
  const [picked,  setPicked]  = useState<number | null>(null);
  const [timeBar, setTimeBar] = useState(100);
  const startRef    = useRef(0);
  const answeredRef = useRef(false);
  const options     = useRef(shuffle(challenge.options)).current;
  const TIME_LIMIT  = 9000;

  useEffect(() => {
    const waitMs = Math.max(0, startedAt.getTime() - Date.now());
    const t = setTimeout(() => { startRef.current = Date.now(); setActive(true); }, waitMs);
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
    setPicked(opt);
    onAnswer(String(opt), Date.now() - startRef.current);
  };

  const correct = Number(challenge.correct_answer);

  return (
    <div className="flex flex-col items-center gap-6 w-full select-none">
      {/* Time bar */}
      <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full transition-none rounded-full"
          style={{ width: `${timeBar}%`, background: timeBar > 50 ? "#a855f7" : timeBar > 25 ? "#ffab00" : "#ff3d00" }} />
      </div>

      {/* Sequence display */}
      <div className="w-full bg-cockpit-surface border border-cockpit-border rounded-sm py-8 px-4">
        <p className="text-cockpit-muted text-xs uppercase tracking-widest font-mono text-center mb-5">
          What comes next?
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {challenge.nums.map((n, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-sm bg-cockpit-card border border-cockpit-border flex items-center justify-center">
                <span className="text-2xl font-black text-white number-display">{n}</span>
              </div>
              {i < challenge.nums.length - 1 && (
                <span className="text-cockpit-border text-lg">→</span>
              )}
            </div>
          ))}
          <span className="text-cockpit-border text-lg">→</span>
          <div className="w-14 h-14 rounded-sm border-2 border-dashed border-cockpit-accent flex items-center justify-center">
            <span className="text-cockpit-accent text-2xl font-black">?</span>
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((opt) => {
          const isCorrect = opt === correct;
          const isPicked  = picked === opt;
          let bg     = "#0d111710";
          let border = "#1e2a38";
          if (isPicked) {
            bg     = isCorrect ? "#a855f720" : "#ff3d0020";
            border = isCorrect ? "#a855f7"   : "#ff3d00";
          }
          return (
            <button
              key={opt}
              onClick={() => handlePick(opt)}
              disabled={!!picked || disabled || !active}
              className="py-6 rounded-sm border text-2xl font-extrabold number-display text-white transition-all duration-75 active:scale-95 focus:outline-none"
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
