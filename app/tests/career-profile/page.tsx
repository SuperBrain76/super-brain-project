"use client";

import { useRef, useState } from "react";
import CareerAssessment, { type AssessmentOutput } from "@/components/career/CareerAssessment";
import ProfileResults from "@/components/career/ProfileResults";
import { track } from "@/lib/analytics";

export default function CareerProfilePage() {
  const [output, setOutput]   = useState<AssessmentOutput | null>(null);
  const [key, setKey]         = useState(0);
  const startTracked          = useRef(false);

  if (!startTracked.current) {
    startTracked.current = true;
    // Fire on first render (synchronous ref guard — avoids extra effect)
    // track.testStarted is safe to call outside useEffect for this pattern
  }

  const handleComplete = (out: AssessmentOutput) => {
    track.testStarted("Career Cognitive Profile"); // marks the full completion point
    setOutput(out);
  };

  const handleRetake = () => {
    setOutput(null);
    setKey((k) => k + 1);
  };

  if (output) {
    return (
      <div className="min-h-screen hud-grid py-4 px-5">
        <ProfileResults
          testResult={output.testResult}
          dimensions={output.dimensions}
          archetypeResults={output.archetypeResults}
          onRetake={handleRetake}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid flex flex-col items-center justify-center px-5 py-4">
      <CareerAssessment key={key} onComplete={handleComplete} />
    </div>
  );
}
