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
      <div className="flex-1 hud-grid py-4 px-5 overflow-y-auto">
        <ResultSummary
          result={result}
          onRetake={() => { setResult(null); setKey((k) => k + 1); }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-3">
      <VerbalMemory key={key} onComplete={setResult} />
    </div>
  );
}
