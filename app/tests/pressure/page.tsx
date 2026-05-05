"use client";

import { useState } from "react";
import PressureDecision from "@/components/tests/PressureDecision";
import ResultSummary from "@/components/ResultSummary";
import type { TestResult } from "@/types";

export default function PressureTestPage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [key, setKey] = useState(0);

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
      <PressureDecision key={key} onComplete={setResult} />
    </div>
  );
}
