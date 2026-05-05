"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  totalSeconds: number;
  onExpire: () => void;
  urgentAt?: number;
  className?: string;
}

export default function Timer({ totalSeconds, onExpire, urgentAt = 60, className = "" }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const firedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep onExpire ref current so the interval always calls the latest version
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    setRemaining(totalSeconds);
    firedRef.current = false;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0 && !firedRef.current) {
          firedRef.current = true;
          clearInterval(intervalRef.current!);
          onExpireRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [totalSeconds]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const pct = remaining / totalSeconds;
  const urgent = remaining <= urgentAt;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-40 h-1.5 bg-cockpit-border rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${urgent ? "bg-cockpit-red" : "bg-cockpit-accent"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span
        className={`number-display text-sm font-semibold tabular-nums ${urgent ? "text-cockpit-red animate-pulse" : "text-cockpit-accent"}`}
      >
        {m}:{s.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
