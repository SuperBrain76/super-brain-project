"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModuleId, ModuleResult } from "@/types";
import { buildSession } from "@/lib/scoring";
import { saveSession } from "@/lib/storage";
import ProgressBar from "@/components/ProgressBar";
import ModuleInstructions from "@/components/ModuleInstructions";
import ReactionSpeed from "@/components/modules/ReactionSpeed";
import VisualMemory from "@/components/modules/VisualMemory";
import SpatialReasoning from "@/components/modules/SpatialReasoning";
import MultitaskingStress from "@/components/modules/MultitaskingStress";
import MentalMath from "@/components/modules/MentalMath";

type Phase = "instructions" | "active" | "transition";

interface ModuleConfig {
  id: ModuleId;
  num: number;
  title: string;
  duration: string;
  weight: string;
  description: string;
  instructions: { icon: string; text: string }[];
  warning?: string;
}

const MODULE_CONFIGS: ModuleConfig[] = [
  {
    id: "reaction",
    num: 1,
    title: "Reaction Speed",
    duration: "~5 minutes · 10 trials",
    weight: "20%",
    description:
      "Tests the speed and accuracy of your response to a sudden visual stimulus — a key metric in pilot screening.",
    instructions: [
      { icon: "🟡", text: 'A "WAIT" screen will appear. Do not click yet.' },
      { icon: "🟢", text: "When the screen turns green and shows CLICK, react immediately by clicking or pressing SPACE." },
      { icon: "⚡", text: "Your reaction time is measured in milliseconds. Ten valid trials will be recorded." },
      { icon: "❌", text: "Clicking before the stimulus is a false start and will be penalised." },
    ],
    warning: "Do not click before the screen changes. False starts reduce your score.",
  },
  {
    id: "visual",
    num: 2,
    title: "Visual Memory",
    duration: "5–6 minutes · 7 levels",
    weight: "20%",
    description:
      "Measures your ability to encode and reproduce spatial patterns from short-term memory. Grid size and complexity increase each level.",
    instructions: [
      { icon: "👁", text: "A grid appears with highlighted cells. Study the pattern carefully." },
      { icon: "⏱", text: "After a few seconds the grid clears. Click the cells you remembered." },
      { icon: "📈", text: "Each level increases grid size and the number of cells to memorise." },
      { icon: "✅", text: "Click Submit Recall when done. Above 55% accuracy advances you to the next level." },
    ],
  },
  {
    id: "spatial",
    num: 3,
    title: "Spatial Reasoning",
    duration: "4 minutes",
    weight: "15%",
    description:
      "Assesses your ability to mentally rotate objects in space — essential for instrument reading and situational awareness.",
    instructions: [
      { icon: "🔄", text: "A reference shape is shown. You are told how many degrees to rotate it." },
      { icon: "🅰", text: "Four options (A–D) each show the shape at a different rotation. Select the correct one." },
      { icon: "⌨️", text: "Press A, B, C, or D on your keyboard for fastest input, or click the options." },
      { icon: "⏱", text: "You have 4 minutes. All four options are always visually distinct — no duplicates." },
    ],
  },
  {
    id: "multitask",
    num: 4,
    title: "Multitasking Stress Test",
    duration: "4 minutes",
    weight: "25%",
    description:
      "Track a moving target with your mouse while responding to random character prompts that flash on screen. Dual-task cognitive load.",
    instructions: [
      { icon: "🎯", text: "A green target moves across the field. Keep your mouse cursor on it at all times." },
      { icon: "🔠", text: "Periodically, a character (letter or digit) will flash on screen for ~1 second." },
      { icon: "⌨️", text: "Press that character on your keyboard — you can type it while it's still visible or just after it hides." },
      { icon: "⚖️", text: "Score = 50% tracking accuracy + 50% recall accuracy (correct / total prompts including missed)." },
    ],
    warning:
      "This module uses your keyboard for recall responses. Keep your hand on the keyboard and mouse simultaneously.",
  },
  {
    id: "math",
    num: 5,
    title: "Mental Math Under Pressure",
    duration: "5 minutes",
    weight: "20%",
    description:
      "Tests rapid arithmetic computation under time pressure. Difficulty adapts upward on consecutive correct answers.",
    instructions: [
      { icon: "🧮", text: "An arithmetic problem appears on screen. Type your answer and press Enter or →." },
      { icon: "📈", text: "Three correct answers in a row increases difficulty. A wrong answer reduces it." },
      { icon: "🎯", text: "Accuracy dominates scoring: score = accuracy×90% + speed bonus×10%." },
      { icon: "⚡", text: "Answer as many questions as possible — both speed and accuracy are rewarded." },
    ],
  },
];

export default function TestPage() {
  const router = useRouter();
  const [moduleIndex, setModuleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("instructions");
  const [results, setResults] = useState<ModuleResult[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleModuleComplete = useCallback(
    (result: ModuleResult) => {
      const newResults = [...results, result];
      setResults(newResults);
      setTransitioning(true);

      if (moduleIndex + 1 >= MODULE_CONFIGS.length) {
        const session = buildSession(newResults, startedAt.current);
        saveSession(session);
        setTimeout(() => router.push("/results"), 1500);
        return;
      }

      setTimeout(() => {
        setModuleIndex((i) => i + 1);
        setPhase("instructions");
        setTransitioning(false);
      }, 1200);
    },
    [results, moduleIndex, router],
  );

  const cfg = MODULE_CONFIGS[moduleIndex];

  const renderActiveModule = () => {
    switch (cfg.id) {
      case "reaction":  return <ReactionSpeed onComplete={handleModuleComplete} />;
      case "visual":    return <VisualMemory onComplete={handleModuleComplete} />;
      case "spatial":   return <SpatialReasoning onComplete={handleModuleComplete} />;
      case "multitask": return <MultitaskingStress onComplete={handleModuleComplete} />;
      case "math":      return <MentalMath onComplete={handleModuleComplete} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col hud-grid">
      <header className="border-b border-cockpit-border px-8 py-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cockpit-green animate-pulse" />
          <span className="text-cockpit-dim text-xs font-mono tracking-widest uppercase">PCST Assessment</span>
        </div>
        <div className="flex-1">
          <ProgressBar current={moduleIndex} total={MODULE_CONFIGS.length} />
        </div>
        <div className="text-cockpit-dim text-xs font-mono">
          {moduleIndex + 1}/{MODULE_CONFIGS.length}
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-8 py-12">
        <div className="w-full max-w-3xl">
          {transitioning ? (
            <div className="flex flex-col items-center justify-center gap-6 py-24 module-enter">
              {moduleIndex + 1 >= MODULE_CONFIGS.length ? (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-cockpit-green flex items-center justify-center glow-green">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-cockpit-green text-lg font-semibold tracking-wide">
                    Assessment Complete — Calculating Results…
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-cockpit-accent flex items-center justify-center glow-accent">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-cockpit-accent text-sm tracking-widest uppercase font-semibold">Module Complete</p>
                    <p className="text-cockpit-dim text-sm mt-1">
                      Loading: {MODULE_CONFIGS[moduleIndex + 1]?.title}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : phase === "instructions" ? (
            <ModuleInstructions
              moduleNumber={cfg.num}
              title={cfg.title}
              duration={cfg.duration}
              weight={cfg.weight}
              description={cfg.description}
              instructions={cfg.instructions}
              warning={cfg.warning}
              onBegin={() => setPhase("active")}
            />
          ) : (
            <div className="module-enter">{renderActiveModule()}</div>
          )}
        </div>
      </main>
    </div>
  );
}
