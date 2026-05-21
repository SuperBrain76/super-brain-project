"use client";

import { useState } from "react";
import FocusTest, { type FocusOutput } from "@/components/focus/FocusTest";
import FocusResults from "@/components/focus/FocusResults";

export default function FocusTestPage() {
  const [output, setOutput] = useState<FocusOutput | null>(null);
  const [key,    setKey]    = useState(0);

  const handleRetake = () => {
    setOutput(null);
    setKey((k) => k + 1);
  };

  if (output) {
    return (
      <div className="min-h-screen hud-grid py-14 px-5">
        <FocusResults
          testResult={output.testResult}
          phaseResults={output.phaseResults}
          metrics={output.metrics}
          onRetake={handleRetake}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid flex flex-col items-center justify-center px-5 py-14">
      <FocusTest key={key} onComplete={setOutput} />
    </div>
  );
}
