"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";

interface Props {
  onComplete: (result: TestResult) => void;
}

// ── Word pool ─────────────────────────────────────────────────────────────────
const WORD_POOL = [
  "APPLE",  "BRIDGE", "CANVAS", "DESERT", "EAGLE",  "FOSSIL",
  "GLOBE",  "HARBOR", "ISLAND", "JUNGLE", "KERNEL", "LANTERN",
  "MARBLE", "NECTAR", "ORBIT",  "PATROL", "QUARTZ", "RIBBON",
  "SAFARI", "TUNDRA", "ULTRA",  "VAPOR",  "WALNUT", "XENON",
  "YACHT",  "ZENITH", "AMBER",  "BLAZE",  "CEDAR",  "DRIFT",
  "FLINT",  "GROVE",  "HAVEN",  "IVORY",  "LASER",  "METRO",
  "NORTH",  "OZONE",  "PULSE",  "RAVEN",  "STORM",  "TORCH",
  "VAULT",  "WARDEN", "PRISM",  "FORGE",  "COAST",  "DELTA",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STUDY_COUNT = 16;
const NEW_COUNT   = 8;  // distractors shown only in test phase
const STUDY_DURATION_MS = 1600; // ms per word

type Phase = "intro" | "study" | "study-break" | "test" | "done";

interface TestWord { word: string; isSeen: boolean }

export default function VerbalMemory({ onComplete }: Props) {
  const [phase,      setPhase]      = useState<Phase>("intro");
  const [wordIdx,    setWordIdx]    = useState(0);
  const [studyWords, setStudyWords] = useState<string[]>([]);
  const [testWords,  setTestWords]  = useState<TestWord[]>([]);
  const [answers,    setAnswers]    = useState<boolean[]>([]); // true = answered correctly
  const [feedback,   setFeedback]   = useState<"correct" | "wrong" | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGame = useCallback(() => {
    const all      = shuffle(WORD_POOL);
    const study    = all.slice(0, STUDY_COUNT);
    const newWords = all.slice(STUDY_COUNT, STUDY_COUNT + NEW_COUNT);

    // Mix seen + new, shuffle for test phase
    const testSet: TestWord[] = shuffle([
      ...study.map((w) => ({ word: w, isSeen: true })),
      ...newWords.map((w) => ({ word: w, isSeen: false })),
    ]);

    setStudyWords(study);
    setTestWords(testSet);
    setAnswers([]);
    setWordIdx(0);
    setPhase("study");
  }, []);

  // Auto-advance study words
  useEffect(() => {
    if (phase !== "study") return;

    timerRef.current = setTimeout(() => {
      if (wordIdx + 1 >= STUDY_COUNT) {
        setPhase("study-break");
      } else {
        setWordIdx((i) => i + 1);
      }
    }, STUDY_DURATION_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, wordIdx]);

  const handleAnswer = useCallback((answeredSeen: boolean) => {
    if (phase !== "test" || feedback) return;
    const current   = testWords[wordIdx];
    const correct   = answeredSeen === current.isSeen;
    const updated   = [...answers, correct];
    setAnswers(updated);

    setFeedback(correct ? "correct" : "wrong");
    timerRef.current = setTimeout(() => {
      setFeedback(null);
      if (wordIdx + 1 >= testWords.length) {
        // done — compute result
        const correctCount = updated.filter(Boolean).length;
        const total  = testWords.length;
        const score  = Math.round((correctCount / total) * 100);
        onComplete({
          testId: "verbal-memory",
          testName: "Verbal Memory Test",
          score,
          percentileEstimate: scoreToPercentile(score),
          resultTitle: getResultTitle("verbal-memory", score),
          resultDescription: getResultDescription("verbal-memory", score),
          rawMetrics: {
            correct: correctCount,
            total,
            "study words": STUDY_COUNT,
            "new words": NEW_COUNT,
          },
          createdAt: new Date().toISOString(),
        });
      } else {
        setWordIdx((i) => i + 1);
      }
    }, 600);
  }, [phase, feedback, testWords, wordIdx, answers, onComplete]);

  // Keyboard support for test phase
  useEffect(() => {
    if (phase !== "test") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key.toLowerCase() === "s") handleAnswer(true);
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") handleAnswer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleAnswer]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center gap-8 py-10 text-center max-w-sm">
        <h2 className="text-2xl font-bold text-white">Verbal Memory Test</h2>
        <div className="text-cockpit-dim leading-relaxed space-y-3 text-sm text-left bg-cockpit-card border border-cockpit-border rounded-sm p-5">
          <p><span className="text-cockpit-accent font-semibold">1. Study phase</span> — {STUDY_COUNT} words flash on screen, one at a time.</p>
          <p><span className="text-cockpit-accent font-semibold">2. Test phase</span> — words appear one by one. Was it in the study list?</p>
          <p><span className="text-white font-semibold">SEEN</span> if you saw it · <span className="text-white font-semibold">NEW</span> if you didn't.</p>
        </div>
        <p className="text-cockpit-muted text-xs">~90 seconds · works perfectly on mobile</p>
        <button className="btn-primary" onClick={startGame}>
          Begin Test
        </button>
      </div>
    );
  }

  // ── STUDY PHASE ───────────────────────────────────────────────────────────
  if (phase === "study") {
    const progress = ((wordIdx + 1) / STUDY_COUNT) * 100;
    return (
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="text-center">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-1">Memorise</p>
          <p className="text-cockpit-dim text-xs">{wordIdx + 1} / {STUDY_COUNT}</p>
        </div>

        <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
          <div
            className="h-full bg-cockpit-accent transition-all"
            style={{ width: `${progress}%`, transitionDuration: `${STUDY_DURATION_MS}ms` }}
          />
        </div>

        <div
          key={wordIdx}
          className="w-full h-48 bg-cockpit-card border border-cockpit-border rounded-sm flex items-center justify-center module-enter"
        >
          <span className="text-4xl font-extrabold text-white tracking-widest">
            {studyWords[wordIdx]}
          </span>
        </div>

        <p className="text-cockpit-muted text-xs">Words are shown automatically — just look</p>
      </div>
    );
  }

  // ── STUDY BREAK ───────────────────────────────────────────────────────────
  if (phase === "study-break") {
    return (
      <div className="flex flex-col items-center gap-8 py-10 text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-cockpit-green bg-opacity-10 border border-cockpit-green border-opacity-30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Study phase complete</h3>
          <p className="text-cockpit-dim text-sm">
            Now you'll see words one at a time — some from the list, some new.
            Tap <span className="text-white font-semibold">SEEN</span> or{" "}
            <span className="text-white font-semibold">NEW</span>.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setWordIdx(0); setPhase("test"); }}>
          Start Test Phase →
        </button>
      </div>
    );
  }

  // ── TEST PHASE ────────────────────────────────────────────────────────────
  if (phase === "test") {
    const current  = testWords[wordIdx];
    const progress = (wordIdx / testWords.length) * 100;
    const correct  = answers.filter(Boolean).length;

    const cardBg =
      feedback === "correct" ? "#00e67615"
      : feedback === "wrong"   ? "#ff3d0015"
      : "#111827";

    const cardBorder =
      feedback === "correct" ? "#00e67650"
      : feedback === "wrong"   ? "#ff3d0050"
      : "#1e2a38";

    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-sm select-none">
        {/* Progress */}
        <div className="flex items-center justify-between w-full px-1 text-xs text-cockpit-muted font-mono">
          <span>{wordIdx} / {testWords.length}</span>
          <span>{correct} correct</span>
        </div>
        <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
          <div className="h-full bg-cockpit-accent transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>

        {/* Word card */}
        <div
          key={wordIdx}
          className="w-full h-44 rounded-sm border flex items-center justify-center module-enter transition-colors duration-200"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <span className="text-4xl font-extrabold text-white tracking-widest">
            {current.word}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 w-full">
          <button
            onClick={() => handleAnswer(true)}
            disabled={!!feedback}
            className="flex-1 py-5 rounded-sm border text-lg font-extrabold tracking-wide transition-all duration-150 active:scale-95"
            style={{
              background: "#00e67608",
              borderColor: feedback === "correct" && testWords[wordIdx]?.isSeen ? "#00e676" : "#00e67630",
              color: "#00e676",
            }}
          >
            SEEN
          </button>
          <button
            onClick={() => handleAnswer(false)}
            disabled={!!feedback}
            className="flex-1 py-5 rounded-sm border text-lg font-extrabold tracking-wide transition-all duration-150 active:scale-95"
            style={{
              background: "#00d4ff08",
              borderColor: "#00d4ff30",
              color: "#00d4ff",
            }}
          >
            NEW
          </button>
        </div>

        <p className="text-cockpit-muted text-xs">
          Keyboard: <kbd className="bg-cockpit-card border border-cockpit-border px-1.5 py-0.5 rounded text-xs">S</kbd> = Seen ·{" "}
          <kbd className="bg-cockpit-card border border-cockpit-border px-1.5 py-0.5 rounded text-xs">N</kbd> = New
        </p>
      </div>
    );
  }

  return null;
}
