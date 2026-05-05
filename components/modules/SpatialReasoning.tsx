"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModuleResult, SpatialQuestion } from "@/types";
import { scoreSpatial, MODULE_WEIGHTS, MODULE_NAMES } from "@/lib/scoring";
import { generateSpatialQuestions, SHAPE_PATHS } from "@/lib/spatialQuestions";
import Timer from "@/components/Timer";

interface Props {
  onComplete: (result: ModuleResult) => void;
}

const DURATION = 4 * 60; // 4 minutes
const QUESTIONS = generateSpatialQuestions(20, Math.floor(Math.random() * 9999));

function ShapeView({
  shapeType,
  rotation,
  mirrored = false,
  size = 80,
}: {
  shapeType: SpatialQuestion["shapeType"];
  rotation: number;
  mirrored?: boolean;
  size?: number;
}) {
  const path = SHAPE_PATHS[shapeType];
  const transform = `rotate(${rotation}, 50, 50)${mirrored ? " scale(-1,1) translate(-100,0)" : ""}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d={path} fill="#00d4ff" transform={transform} />
    </svg>
  );
}

export default function SpatialReasoning({ onComplete }: Props) {
  const [qIndex, setQIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const expiredRef = useRef(false);
  const correctRef = useRef(0);
  const attemptedRef = useRef(0);

  const finish = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    const raw = scoreSpatial(correctRef.current, Math.max(1, attemptedRef.current));
    onComplete({
      moduleId: "spatial",
      moduleName: MODULE_NAMES.spatial,
      rawScore: raw,
      weight: MODULE_WEIGHTS.spatial,
      weightedScore: raw * MODULE_WEIGHTS.spatial,
      completedAt: Date.now(),
      details: {
        correct: correctRef.current,
        attempted: attemptedRef.current,
        total: QUESTIONS.length,
      },
    });
  }, [onComplete]);

  const handleChoice = useCallback((choiceIdx: number) => {
    if (showFeedback || selected !== null || expiredRef.current) return;
    setSelected(choiceIdx);
    const q = QUESTIONS[qIndex];
    const isCorrect = choiceIdx === q.correctIndex;
    if (isCorrect) {
      correctRef.current += 1;
      setCorrect((c) => c + 1);
    }
    attemptedRef.current += 1;
    setShowFeedback(true);

    setTimeout(() => {
      if (expiredRef.current) return;
      const next = qIndex + 1;
      if (next >= QUESTIONS.length) { finish(); return; }
      setQIndex(next);
      setSelected(null);
      setShowFeedback(false);
    }, 500);
  }, [showFeedback, selected, qIndex, finish]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, number> = { KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 };
      if (e.code in map) { e.preventDefault(); handleChoice(map[e.code]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleChoice]);

  const q = QUESTIONS[qIndex];
  const choiceLetters = ["A", "B", "C", "D"];
  const accuracy = attemptedRef.current > 0
    ? Math.round((correctRef.current / attemptedRef.current) * 100)
    : null;

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-5">
          <span className="text-cockpit-dim text-sm">
            Q <span className="text-cockpit-accent number-display font-semibold">{qIndex + 1}</span>
            <span className="text-cockpit-muted"> / {QUESTIONS.length}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cockpit-green" />
            <span className="text-cockpit-green number-display font-semibold text-sm">{correct}</span>
            {accuracy !== null && (
              <span className="text-cockpit-muted text-xs">({accuracy}%)</span>
            )}
          </div>
        </div>
        <Timer totalSeconds={DURATION} onExpire={finish} urgentAt={60} />
      </div>

      {/* Question card */}
      <div className="w-full max-w-2xl bg-cockpit-card border border-cockpit-border rounded-sm p-8 module-enter">
        <p className="text-cockpit-dim text-sm mb-6 tracking-wide text-center">
          Rotate the reference shape{" "}
          <span className="text-cockpit-accent font-semibold">{q.targetLabel}</span>. Which option matches?
        </p>

        {/* Reference shape */}
        <div className="flex justify-center mb-10">
          <div className="flex flex-col items-center gap-3">
            <div className="p-5 bg-cockpit-surface border border-cockpit-border rounded-sm">
              <ShapeView shapeType={q.shapeType} rotation={q.referenceRotation} size={100} />
            </div>
            <span className="text-cockpit-dim text-xs tracking-widest uppercase">Reference</span>
          </div>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-4 gap-4">
          {q.choices.map((choice, i) => {
            const isCorrect = i === q.correctIndex;
            const isSel = selected === i;
            let border = "border-cockpit-border hover:border-cockpit-accent";
            if (showFeedback && isCorrect) border = "border-cockpit-green glow-green";
            else if (showFeedback && isSel && !isCorrect) border = "border-cockpit-red glow-red";

            return (
              <button
                key={i}
                onClick={() => handleChoice(i)}
                disabled={showFeedback}
                className={`flex flex-col items-center gap-2 p-4 bg-cockpit-surface border rounded-sm transition-all duration-150 ${border}`}
              >
                <ShapeView
                  shapeType={q.shapeType}
                  rotation={choice.rotation}
                  mirrored={choice.mirrored}
                  size={70}
                />
                <span className="text-cockpit-dim text-xs font-mono font-semibold">{choiceLetters[i]}</span>
              </button>
            );
          })}
        </div>

        <p className="text-cockpit-muted text-xs text-center mt-4">
          Press A / B / C / D or click
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl h-1 bg-cockpit-border rounded-full overflow-hidden">
        <div
          className="h-full bg-cockpit-accent transition-all duration-300"
          style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
