"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";

interface Props {
  onComplete: (result: TestResult) => void;
}

const DURATION = 10; // seconds

function scoreTaps(taps: number): number {
  // Curve: 50 taps = 40pts, 100 = 71pts, 130 = 93pts, 150 = 100pts
  // Avg mobile user ≈ 7-9/s (70-90 taps); elite ≈ 14-15/s (140-150 taps)
  return Math.min(100, Math.round(Math.pow(taps / 150, 0.7) * 100));
}

export default function TapSpeed({ onComplete }: Props) {
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [flash, setFlash] = useState(false);

  const tapsRef    = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalTaps = tapsRef.current;
    const score = scoreTaps(finalTaps);
    setFinished(true);
    onComplete({
      testId: "tap-speed",
      testName: "Tap Speed Test",
      score,
      percentileEstimate: scoreToPercentile(score),
      resultTitle: getResultTitle("tap-speed", score),
      resultDescription: getResultDescription("tap-speed", score),
      rawMetrics: {
        taps: finalTaps,
        "taps/sec": parseFloat((finalTaps / DURATION).toFixed(1)),
        duration: `${DURATION}s`,
      },
      createdAt: new Date().toISOString(),
    });
  }, [onComplete]);

  const start = useCallback(() => {
    setStarted(true);
    setTaps(0);
    tapsRef.current = 0;
    setTimeLeft(DURATION);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [finish]);

  const handleTap = useCallback(() => {
    if (!started || finished) return;
    tapsRef.current += 1;
    setTaps(tapsRef.current);
    // brief flash
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 80);
  }, [started, finished]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handleTap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTap]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const progress = ((DURATION - timeLeft) / DURATION) * 100;

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-8 py-10 text-center max-w-sm">
        <h2 className="text-2xl font-bold text-white">Tap Speed Test</h2>
        <p className="text-cockpit-dim leading-relaxed">
          Tap the zone as fast as you can for{" "}
          <span className="text-white font-semibold">10 seconds</span>.
          Elite speed is 14+ taps/sec — most people hit 7-9.
        </p>
        <div className="flex flex-col items-center gap-2 text-cockpit-muted text-sm">
          <p>📱 Designed for mobile — works great on touch</p>
          <p>⌨️ Or hammer the <kbd className="bg-cockpit-card border border-cockpit-border px-2 py-0.5 rounded text-xs">SPACE</kbd> key</p>
        </div>
        <button className="btn-primary" onClick={start}>
          Start Test
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm select-none">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-cockpit-border rounded-full overflow-hidden">
        <div
          className="h-full bg-cockpit-accent transition-all duration-1000 linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between w-full px-1">
        <div className="text-center">
          <div className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-0.5">Taps</div>
          <div className="text-white text-3xl font-extrabold number-display">{taps}</div>
        </div>
        <div className="text-center">
          <div className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-0.5">Time</div>
          <div
            className="text-3xl font-extrabold number-display"
            style={{ color: timeLeft <= 3 ? "#ff3d00" : "#00d4ff" }}
          >
            {timeLeft}s
          </div>
        </div>
        <div className="text-center">
          <div className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-0.5">Rate</div>
          <div className="text-cockpit-dim text-3xl font-extrabold number-display">
            {taps > 0 && timeLeft < DURATION
              ? ((taps / (DURATION - timeLeft)) || 0).toFixed(1)
              : "—"}
          </div>
        </div>
      </div>

      {/* Tap zone */}
      <div
        className="w-full rounded-sm border transition-all duration-75 cursor-pointer flex items-center justify-center"
        style={{
          height: "280px",
          background: flash ? "#00d4ff18" : "#0d1117",
          borderColor: flash ? "#00d4ff80" : "#1e2a38",
          transform: flash ? "scale(0.99)" : "scale(1)",
        }}
        onClick={handleTap}
        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
      >
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div
            className="text-6xl font-black tracking-widest transition-colors duration-75"
            style={{ color: flash ? "#00d4ff" : "#1e2a38" }}
          >
            TAP
          </div>
          <p className="text-cockpit-muted text-xs">tap here or press SPACE</p>
        </div>
      </div>
    </div>
  );
}
