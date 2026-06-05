"use client";

import { useEffect, useState } from "react";

const KICKOFF = new Date("2026-06-12T00:00:00Z"); // June 11, 8 PM ET

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CountdownTimer() {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0, done: false });

  useEffect(() => {
    function tick() {
      const diff = KICKOFF.getTime() - Date.now();
      if (diff <= 0) {
        setTime({ d: 0, h: 0, m: 0, s: 0, done: true });
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime({ d, h, m, s, done: false });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (time.done) {
    return (
      <div className="inline-flex items-center gap-2 text-cockpit-green font-mono text-sm tracking-widest uppercase">
        <span className="w-2 h-2 rounded-full bg-cockpit-green animate-pulse" />
        Tournament Live
      </div>
    );
  }

  const units = [
    { v: pad(time.d), l: "Days" },
    { v: pad(time.h), l: "Hours" },
    { v: pad(time.m), l: "Mins" },
    { v: pad(time.s), l: "Secs" },
  ];

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {units.map((u, i) => (
        <div key={u.l} className="flex items-center gap-3 sm:gap-5">
          <div className="text-center">
            <div
              className="text-3xl sm:text-4xl font-extrabold number-display text-white tabular-nums"
              style={{ textShadow: "0 0 30px rgba(0,212,255,0.4)" }}
            >
              {u.v}
            </div>
            <div className="text-cockpit-muted text-xs tracking-widest uppercase mt-1 font-mono">
              {u.l}
            </div>
          </div>
          {i < units.length - 1 && (
            <span className="text-cockpit-border text-2xl font-light mb-3">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
