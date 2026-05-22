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
      <div className="flex-1 hud-grid py-4 px-5 overflow-y-auto">
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
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-3">
      <FocusTest key={key} onComplete={setOutput} />
    </div>
  );
}
