"use client";

// Phase 4 — Dual Track
// Two independent stimulus streams run simultaneously.
// TOP: letters flash — tap TOP zone when you see a VOWEL.
// BOTTOM: numbers flash — tap BOTTOM zone when you see an EVEN number.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sounds } from "@/lib/sounds";
import type { PhaseResult } from "@/lib/focus-test";

interface Props {
  soundEnabled: boolean;
  onComplete:   (result: PhaseResult) => void;
}

const DURATION_MS   = 60_000;
const VOWELS        = new Set(["A","E","I","O","U"]);
const ALL_LETTERS   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ALL_NUMBERS   = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

interface Stream {
  value:   string;
  key:     number;
  correct: boolean; // is a tap correct for this stimulus?
  tapped:  boolean;
}

let _sk = 0;

export default function DualTrack({ soundEnabled, onComplete }: Props) {
  const [topStream,    setTopStream]    = useState<Stream | null>(null);
  const [bottomStream, setBottomStream] = useState<Stream | null>(null);
  const [timeLeft,     setTimeLeft]     = useState(DURATION_MS);
  const [score,        setScore]        = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [streakMax,    setStreakMax]     = useState(0);
  const [topFeedback,    setTopFeedback]    = useState<string | null>(null);
  const [bottomFeedback, setBottomFeedback] = useState<string | null>(null);

  const startRef       = useRef(Date.now());
  const completedRef   = useRef(false);
  const topRef         = useRef<Stream | null>(null);
  const bottomRef      = useRef<Stream | null>(null);
  const hitsRef        = useRef(0);
  const missesRef      = useRef(0);
  const falseTapsRef   = useRef(0);
  const streakRef      = useRef(0);
  const streakMaxRef   = useRef(0);
  const scoreRef       = useRef(0);

  const finish = useCallback(() => {
    const total    = hitsRef.current + missesRef.current + falseTapsRef.current;
    const accuracy = total > 0 ? hitsRef.current / total : 0;
    const raw      = accuracy * 100;
    if (soundEnabled) Sounds.phaseComplete();
    onComplete({
      phase:         4,
      score:         Math.min(100, Math.round(raw)),
      accuracy,
      avgReactionMs: 0,
      streakMax:     streakMaxRef.current,
      extras:        { hits: hitsRef.current, misses: missesRef.current, false: falseTapsRef.current },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, onComplete]);

  const updateStreak = (hit: boolean) => {
    if (hit) {
      const ns = streakRef.current + 1;
      streakRef.current = ns;
      if (ns > streakMaxRef.current) streakMaxRef.current = ns;
      setStreak(ns);
      setStreakMax(streakMaxRef.current);
    } else {
      streakRef.current = 0;
      setStreak(0);
    }
  };

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, DURATION_MS - (Date.now() - startRef.current));
      setTimeLeft(left);
      if (left === 0 && !completedRef.current) {
        completedRef.current = true;
        finish();
      }
    }, 80);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top stream (letters, 750ms→450ms)
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= DURATION_MS) return;
      const progress = elapsed / DURATION_MS;
      const speed    = 750 - progress * 300;

      // Miss check on previous
      if (topRef.current?.correct && !topRef.current.tapped) {
        missesRef.current++;
      }

      const letter  = ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)];
      const correct = VOWELS.has(letter);
      const next    = { value: letter, key: _sk++, correct, tapped: false };
      topRef.current = next;
      setTopStream(next);
      setTimeout(tick, speed);
    };
    const t = setTimeout(tick, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bottom stream (numbers, 850ms→500ms, offset)
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= DURATION_MS) return;
      const progress = elapsed / DURATION_MS;
      const speed    = 850 - progress * 350;

      if (bottomRef.current?.correct && !bottomRef.current.tapped) {
        missesRef.current++;
      }

      const num     = ALL_NUMBERS[Math.floor(Math.random() * ALL_NUMBERS.length)];
      const correct = num % 2 === 0;
      const next    = { value: String(num), key: _sk++, correct, tapped: false };
      bottomRef.current = next;
      setBottomStream(next);
      setTimeout(tick, speed);
    };
    const t = setTimeout(tick, 700); // offset from top stream
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = (which: "top" | "bottom") => {
    if (completedRef.current) return;
    const stream = which === "top" ? topRef.current : bottomRef.current;
    if (!stream || stream.tapped) return;

    stream.tapped = true;

    if (stream.correct) {
      hitsRef.current++;
      updateStreak(true);
      const mult   = streakRef.current >= 12 ? 2 : streakRef.current >= 6 ? 1.5 : 1;
      const points = Math.round(10 * mult);
      scoreRef.current += points;
      setScore(scoreRef.current);
      if (which === "top") { setTopFeedback(`+${points}`); setTimeout(() => setTopFeedback(null), 500); }
      else { setBottomFeedback(`+${points}`); setTimeout(() => setBottomFeedback(null), 500); }
      if (soundEnabled) {
        if (streakRef.current === 6 || streakRef.current === 12) Sounds.streak();
        else Sounds.hit();
      }
    } else {
      falseTapsRef.current++;
      updateStreak(false);
      scoreRef.current = Math.max(0, scoreRef.current - 6);
      setScore(scoreRef.current);
      if (which === "top") { setTopFeedback("✕"); setTimeout(() => setTopFeedback(null), 500); }
      else { setBottomFeedback("✕"); setTimeout(() => setBottomFeedback(null), 500); }
      if (soundEnabled) Sounds.miss();
    }
  };

  const progress    = 1 - timeLeft / DURATION_MS;
  const secsLeft    = Math.ceil(timeLeft / 1000);
  const streakColor = streak >= 12 ? "#ff6d00" : streak >= 6 ? "#ffab00" : streak >= 3 ? "#00d4ff" : "#64748b";

  const streamStyle = (stream: Stream | null, isVowel: boolean) => {
    if (!stream) return "#cbd5e1";
    return stream.correct ? (isVowel ? "#c084fc" : "#00d4ff") : "#94a3b8";
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-white text-lg font-extrabold number-display tabular-nums">{score}</span>
          {streak >= 2 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-sm border"
              style={{ color: streakColor, borderColor: `${streakColor}40`, background: `${streakColor}15` }}>
              ×{streak >= 12 ? "2.0" : "1.5"} STREAK
            </span>
          )}
        </div>
        <span className="text-cockpit-muted text-sm font-mono">{secsLeft}s</span>
      </div>

      {/* Timer bar */}
      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full bg-[#c084fc]" style={{ width: `${(1-progress)*100}%`, transition: "width 0.08s linear" }} />
      </div>

      {/* TOP channel — VOWELS */}
      <button
        onClick={() => handleTap("top")}
        className="flex-1 relative flex flex-col items-center justify-center rounded-sm border border-cockpit-border hover:border-[#c084fc]/40 active:scale-[0.98] transition-all duration-75 focus:outline-none overflow-hidden"
        style={{ background: "var(--surface,#0d1117)", minHeight: 110 }}
      >
        <p className="text-[10px] uppercase tracking-widest font-mono text-cockpit-muted mb-2">
          TAP ON VOWEL
        </p>
        {topStream && (
          <span
            key={topStream.key}
            className="text-6xl font-extrabold module-enter"
            style={{ color: streamStyle(topStream, true), textShadow: topStream.correct ? "0 0 20px #c084fc80" : "none" }}
          >
            {topStream.value}
          </span>
        )}
        {topFeedback && (
          <span className="absolute top-2 right-3 text-sm font-bold" style={{ color: topFeedback === "✕" ? "#ff3d00" : "#00e676" }}>
            {topFeedback}
          </span>
        )}
      </button>

      {/* BOTTOM channel — EVENS */}
      <button
        onClick={() => handleTap("bottom")}
        className="flex-1 relative flex flex-col items-center justify-center rounded-sm border border-cockpit-border hover:border-[#00d4ff]/40 active:scale-[0.98] transition-all duration-75 focus:outline-none overflow-hidden"
        style={{ background: "var(--surface,#0d1117)", minHeight: 110 }}
      >
        <p className="text-[10px] uppercase tracking-widest font-mono text-cockpit-muted mb-2">
          TAP ON EVEN
        </p>
        {bottomStream && (
          <span
            key={bottomStream.key}
            className="text-6xl font-extrabold number-display module-enter"
            style={{ color: streamStyle(bottomStream, false), textShadow: bottomStream.correct ? "0 0 20px #00d4ff80" : "none" }}
          >
            {bottomStream.value}
          </span>
        )}
        {bottomFeedback && (
          <span className="absolute top-2 right-3 text-sm font-bold" style={{ color: bottomFeedback === "✕" ? "#ff3d00" : "#00e676" }}>
            {bottomFeedback}
          </span>
        )}
      </button>
    </div>
  );
}
