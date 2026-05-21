"use client";

import { useEffect, useRef, useState } from "react";
import VerbalMemory from "@/components/tests/VerbalMemory";
import ResultSummary from "@/components/ResultSummary";
import { track } from "@/lib/analytics";
import type { TestResult } from "@/types";

export default function VerbalMemoryPage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [key,    setKey]    = useState(0);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track.testStarted("Verbal Memory Test");
  }, []);

  if (result) {
    return (
      <div className="min-h-screen hud-grid py-16 px-6">
        <ResultSummary
          result={result}
          onRetake={() => { setResult(null); setKey((k) => k + 1); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid flex flex-col items-center justify-center px-6 py-16">
      <VerbalMemory key={key} onComplete={setResult} />
    </div>
  );
}
