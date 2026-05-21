"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SPEED_QUESTIONS,
  SCENARIO_QUESTIONS,
  RANKING_QUESTIONS,
  TRADEOFF_QUESTIONS,
  ALLOCATION_QUESTIONS,
  computeDimensions,
  matchArchetypes,
  clarityScore,
  type AnswerRecord,
  type Question,
  type SpeedQuestion,
  type ScenarioQuestion,
  type RankingQuestion,
  type TradeoffQuestion,
  type AllocationQuestion,
  type Dimensions,
  type ArchetypeResult,
} from "@/lib/career-profile";
import type { TestResult } from "@/types";

// ── Public types ──────────────────────────────────────────────────────────────

export interface AssessmentOutput {
  testResult:       TestResult;
  dimensions:       Dimensions;
  archetypeResults: ArchetypeResult[];
}

interface Props {
  onComplete: (out: AssessmentOutput) => void;
}

// ── Module configuration ──────────────────────────────────────────────────────

const MODULES: {
  num:         number;
  id:          string;
  title:       string;
  description: string;
  tag:         string;
  questions:   Question[];
}[] = [
  {
    num:         1,
    id:          "instinct",
    title:       "Instinct Round",
    description: "6 rapid binary choices. 4.5 seconds each. Your instinct is the signal — don't deliberate.",
    tag:         "Reaction speed · Decision style",
    questions:   SPEED_QUESTIONS,
  },
  {
    num:         2,
    id:          "judgment",
    title:       "Situational Judgment",
    description: "6 workplace scenarios. Select the response that most accurately reflects how you actually operate.",
    tag:         "Decision-making · Leadership · Risk",
    questions:   SCENARIO_QUESTIONS,
  },
  {
    num:         3,
    id:          "values",
    title:       "Values & Priorities",
    description: "Rank your work energisers. Then distribute your ideal workweek. There are no right answers.",
    tag:         "Motivation · Work style · Preferences",
    questions:   [...RANKING_QUESTIONS, ...ALLOCATION_QUESTIONS] as Question[],
  },
  {
    num:         4,
    id:          "tradeoffs",
    title:       "Risk & Tradeoffs",
    description: "4 binary tradeoffs. Both options are equally valid — choose the one you'd genuinely prefer.",
    tag:         "Risk appetite · Autonomy · Impact",
    questions:   TRADEOFF_QUESTIONS,
  },
];

const TOTAL_Q = MODULES.reduce((s, m) => s + m.questions.length, 0);

type Phase = "intro" | "module-intro" | "question" | "analyzing";

// ── Allocation helpers ────────────────────────────────────────────────────────

function makeEqualAlloc(ids: string[]): Record<string, number> {
  const each = Math.floor(100 / ids.length);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = i === ids.length - 1 ? 100 - each * (ids.length - 1) : each;
  });
  return out;
}

function adjustAlloc(
  catId: string,
  newVal: number,
  current: Record<string, number>,
): Record<string, number> {
  const clamped = Math.max(0, Math.min(100, newVal));
  const others  = Object.keys(current).filter((k) => k !== catId);
  const othersTotal  = others.reduce((s, k) => s + current[k], 0);
  const newRemaining = 100 - clamped;
  const next: Record<string, number> = { ...current, [catId]: clamped };

  if (othersTotal === 0) {
    const each = Math.floor(newRemaining / others.length);
    others.forEach((k, i) => {
      next[k] = i === others.length - 1 ? newRemaining - each * (others.length - 1) : each;
    });
  } else {
    let distributed = 0;
    others.forEach((k, i) => {
      if (i === others.length - 1) {
        next[k] = Math.max(0, newRemaining - distributed);
      } else {
        const v = Math.round((current[k] / othersTotal) * newRemaining);
        next[k] = v;
        distributed += v;
      }
    });
  }

  return next;
}

// ── Speed question renderer ───────────────────────────────────────────────────

function SpeedQ({
  q,
  onAnswer,
}: {
  q: SpeedQuestion;
  onAnswer: (optIdx: number | null, ms: number) => void;
}) {
  const startRef  = useRef(Date.now());
  const answered  = useRef(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    answered.current = false;
    setElapsed(0);

    const interval = setInterval(() => {
      const e = Date.now() - startRef.current;
      setElapsed(e);
      if (e >= q.timeLimit) {
        clearInterval(interval);
        if (!answered.current) {
          answered.current = true;
          onAnswer(null, q.timeLimit);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  const pick = (idx: number) => {
    if (answered.current) return;
    answered.current = true;
    onAnswer(idx, Date.now() - startRef.current);
  };

  const pct        = Math.min(1, elapsed / q.timeLimit);
  const timerColor = pct < 0.5 ? "#00d4ff" : pct < 0.8 ? "#ffab00" : "#ff3d00";
  const secsLeft   = Math.ceil((q.timeLimit - elapsed) / 1000);

  return (
    <div className="flex flex-col gap-6 w-full module-enter">
      {/* Countdown bar */}
      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div
          style={{
            height:     "100%",
            width:      `${(1 - pct) * 100}%`,
            background: timerColor,
            transition: "width 0.05s linear, background-color 0.3s ease",
          }}
        />
      </div>

      <p className="text-white text-xl sm:text-2xl font-semibold text-center leading-tight">
        {q.prompt}
      </p>

      <div className="flex flex-col gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className="w-full px-6 py-5 bg-cockpit-card border border-cockpit-border rounded-sm text-white font-medium text-base text-left hover:border-cockpit-accent hover:bg-cockpit-surface transition-all duration-150 active:scale-[0.98]"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="text-cockpit-muted text-xs text-center font-mono">
        {secsLeft}s remaining
      </p>
    </div>
  );
}

// ── Scenario question renderer ────────────────────────────────────────────────

function ScenarioQ({
  q,
  onAnswer,
}: {
  q: ScenarioQuestion;
  onAnswer: (optIdx: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    setTimeout(() => onAnswer(i), 350);
  };

  return (
    <div className="flex flex-col gap-5 w-full module-enter">
      <div className="bg-cockpit-surface border border-cockpit-border rounded-sm px-5 py-4">
        <p className="text-cockpit-muted text-[10px] uppercase tracking-widest font-mono mb-1.5">
          Scenario
        </p>
        <p className="text-cockpit-dim text-sm leading-relaxed">{q.context}</p>
      </div>

      <p className="text-white text-lg font-semibold text-center">{q.prompt}</p>

      <div className="flex flex-col gap-2.5">
        {q.options.map((opt, i) => {
          const isChosen = selected === i;
          const isDimmed = selected !== null && !isChosen;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              className={`w-full px-5 py-4 rounded-sm text-left text-sm font-medium transition-all duration-200 border ${
                isChosen
                  ? "bg-cockpit-accent/10 border-cockpit-accent text-cockpit-accent"
                  : isDimmed
                  ? "opacity-25 bg-cockpit-card border-cockpit-border text-cockpit-dim cursor-default"
                  : "bg-cockpit-card border-cockpit-border text-white hover:border-cockpit-accent/50 hover:bg-cockpit-surface"
              }`}
            >
              <span className="font-mono text-cockpit-muted text-xs mr-3 opacity-60">
                {String.fromCharCode(65 + i)}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Ranking question renderer ─────────────────────────────────────────────────

function RankingQ({
  q,
  onAnswer,
}: {
  q: RankingQuestion;
  onAnswer: (orderedIds: string[]) => void;
}) {
  const [ranked, setRanked] = useState<string[]>([]);

  const pick = (itemId: string) => {
    if (ranked.includes(itemId)) return;
    const next = [...ranked, itemId];
    setRanked(next);
    if (next.length === q.items.length) {
      setTimeout(() => onAnswer(next), 350);
    }
  };

  const undo = () => setRanked((r) => r.slice(0, -1));

  return (
    <div className="flex flex-col gap-5 w-full module-enter">
      <p className="text-white text-lg font-semibold text-center">{q.prompt}</p>

      <div className="flex flex-col gap-2.5">
        {q.items.map((item) => {
          const rankIdx = ranked.indexOf(item.id);
          const isRanked = rankIdx !== -1;
          return (
            <button
              key={item.id}
              onClick={() => pick(item.id)}
              disabled={isRanked}
              className={`w-full px-5 py-4 rounded-sm text-left transition-all duration-200 border flex items-center gap-4 ${
                isRanked
                  ? "border-cockpit-accent/30 bg-cockpit-accent/5 opacity-60 cursor-default"
                  : "bg-cockpit-card border-cockpit-border hover:border-cockpit-accent/50 hover:bg-cockpit-surface"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-sm border flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  isRanked
                    ? "border-cockpit-accent/40 text-cockpit-accent bg-cockpit-accent/10"
                    : "border-cockpit-border text-cockpit-muted"
                }`}
              >
                {isRanked ? rankIdx + 1 : "·"}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${isRanked ? "text-cockpit-dim" : "text-white"}`}>
                  {item.label}
                </p>
                <p className="text-cockpit-muted text-xs mt-0.5">{item.detail}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-1">
        {ranked.length > 0 && ranked.length < q.items.length ? (
          <button
            onClick={undo}
            className="text-cockpit-muted text-xs hover:text-cockpit-dim transition-colors"
          >
            ↩ Undo
          </button>
        ) : (
          <span />
        )}
        <p className="text-cockpit-muted text-xs">
          {ranked.length === 0
            ? "Tap your top choice first"
            : ranked.length < q.items.length
            ? `${q.items.length - ranked.length} more to rank`
            : "✓ Ranked"}
        </p>
      </div>
    </div>
  );
}

// ── Tradeoff question renderer ────────────────────────────────────────────────

function TradeoffQ({
  q,
  onAnswer,
}: {
  q: TradeoffQuestion;
  onAnswer: (choice: "A" | "B") => void;
}) {
  const [chosen, setChosen] = useState<"A" | "B" | null>(null);

  const pick = (c: "A" | "B") => {
    if (chosen) return;
    setChosen(c);
    setTimeout(() => onAnswer(c), 350);
  };

  return (
    <div className="flex flex-col gap-5 w-full module-enter">
      <p className="text-white text-lg font-semibold text-center">{q.prompt}</p>

      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((side) => {
          const opt      = side === "A" ? q.optionA : q.optionB;
          const isChosen = chosen === side;
          const isDimmed = chosen !== null && !isChosen;
          return (
            <button
              key={side}
              onClick={() => pick(side)}
              className={`flex flex-col gap-3 p-5 rounded-sm border text-left transition-all duration-200 ${
                isChosen
                  ? "border-cockpit-accent bg-cockpit-accent/10"
                  : isDimmed
                  ? "border-cockpit-border bg-cockpit-card opacity-25 cursor-default"
                  : "border-cockpit-border bg-cockpit-card hover:border-cockpit-accent/50 hover:bg-cockpit-surface"
              }`}
            >
              <span
                className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm border self-start"
                style={
                  isChosen
                    ? { color: "#00d4ff", borderColor: "#00d4ff40", background: "#00d4ff12" }
                    : { color: "#64748b", borderColor: "#1e2a38" }
                }
              >
                {opt.tag}
              </span>
              <p className={`text-sm font-medium leading-snug ${isChosen ? "text-white" : "text-cockpit-dim"}`}>
                {opt.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Allocation question renderer ──────────────────────────────────────────────

function AllocationQ({
  q,
  onAnswer,
}: {
  q: AllocationQuestion;
  onAnswer: (alloc: Record<string, number>) => void;
}) {
  const [alloc, setAlloc] = useState<Record<string, number>>(() =>
    makeEqualAlloc(q.categories.map((c) => c.id)),
  );
  const total = Object.values(alloc).reduce((s, v) => s + v, 0);

  const handleChange = (catId: string, val: number) => {
    setAlloc((cur) => adjustAlloc(catId, val, cur));
  };

  return (
    <div className="flex flex-col gap-6 w-full module-enter">
      <p className="text-white text-lg font-semibold text-center">{q.prompt}</p>

      <div className="flex flex-col gap-5">
        {q.categories.map((cat) => {
          const pct = alloc[cat.id] ?? 0;
          return (
            <div key={cat.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{cat.label}</p>
                  <p className="text-cockpit-muted text-xs">{cat.detail}</p>
                </div>
                <span className="text-cockpit-accent font-bold number-display text-sm w-10 text-right">
                  {pct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                onChange={(e) => handleChange(cat.id, Number(e.target.value))}
                className="w-full cursor-pointer accent-[#00d4ff] h-1.5"
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-cockpit-muted text-xs text-center">
          Total:{" "}
          <span className={total === 100 ? "text-cockpit-green font-semibold" : "text-cockpit-amber"}>
            {total}/100
          </span>
        </p>
        <button
          onClick={() => onAnswer(alloc)}
          disabled={total !== 100}
          className={`btn-primary w-full ${total !== 100 ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          Confirm →
        </button>
      </div>
    </div>
  );
}

// ── Main assessment component ─────────────────────────────────────────────────

export default function CareerAssessment({ onComplete }: Props) {
  const [phase,       setPhase]       = useState<Phase>("intro");
  const [moduleIdx,   setModuleIdx]   = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);

  // Use a ref so the analyzing effect always reads the final array
  const answersRef = useRef<AnswerRecord[]>([]);

  const currentMod = MODULES[moduleIdx];
  const questions  = currentMod?.questions ?? [];
  const currentQ   = questions[questionIdx] as Question | undefined;

  const answeredSoFar =
    MODULES.slice(0, moduleIdx).reduce((s, m) => s + m.questions.length, 0) + questionIdx;

  const recordAnswer = useCallback(
    (record: AnswerRecord) => {
      answersRef.current = [...answersRef.current, record];

      const modQs  = MODULES[moduleIdx].questions;
      const nextQ  = questionIdx + 1;

      if (nextQ < modQs.length) {
        setQuestionIdx(nextQ);
      } else {
        const nextMod = moduleIdx + 1;
        if (nextMod < MODULES.length) {
          setModuleIdx(nextMod);
          setQuestionIdx(0);
          setPhase("module-intro");
        } else {
          setPhase("analyzing");
        }
      }
    },
    [moduleIdx, questionIdx],
  );

  // Build output after analyzing animation
  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setTimeout(() => {
      const dims            = computeDimensions(answersRef.current);
      const archetypeResults = matchArchetypes(dims);
      const score           = clarityScore(archetypeResults);
      const top             = archetypeResults[0].archetype;

      onComplete({
        testResult: {
          testId:             "career-profile",
          testName:           "Career Cognitive Profile",
          score,
          percentileEstimate: score,
          resultTitle:        top.name,
          resultDescription:  top.tagline,
          rawMetrics:         {},
          createdAt:          new Date().toISOString(),
        },
        dimensions: dims,
        archetypeResults,
      });
    }, 2800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Intro screen ────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-8 module-enter">
        <div className="text-center">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-3">
            SuperBrain · Assessment
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
            Career Cognitive<br />Profile
          </h1>
          <p className="text-cockpit-dim text-sm leading-relaxed max-w-sm mx-auto">
            20 questions across 4 modules. Maps your cognitive fingerprint across 7 dimensions to identify your dominant archetype and strongest career paths.
          </p>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm divide-y divide-cockpit-border">
          {MODULES.map((mod) => (
            <div key={mod.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-7 h-7 rounded-sm border border-cockpit-border bg-cockpit-surface flex items-center justify-center shrink-0">
                <span className="text-cockpit-muted text-xs font-bold">{mod.num}</span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold">{mod.title}</p>
                <p className="text-cockpit-muted text-xs mt-0.5">{mod.tag}</p>
              </div>
              <span className="text-cockpit-muted text-xs font-mono ml-auto shrink-0">
                {mod.questions.length}q
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-cockpit-muted text-xs">
            <div className="w-1 h-1 rounded-full bg-cockpit-green shrink-0" />
            ~8 minutes · no login required to start
          </div>
          <div className="flex items-center gap-3 text-cockpit-muted text-xs">
            <div className="w-1 h-1 rounded-full bg-cockpit-green shrink-0" />
            Answer how you actually operate, not how you aspire to
          </div>
        </div>

        <button
          onClick={() => setPhase("module-intro")}
          className="btn-primary w-full text-center"
        >
          Begin Assessment →
        </button>
      </div>
    );
  }

  // ── Module intro screen ─────────────────────────────────────────────────────

  if (phase === "module-intro") {
    const mod = MODULES[moduleIdx];
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-8 items-center text-center module-enter">
        <div>
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-3">
            Module {mod.num} of {MODULES.length}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">{mod.title}</h2>
          <p className="text-cockpit-dim text-sm leading-relaxed max-w-sm">{mod.description}</p>
        </div>

        <div className="w-full bg-cockpit-card border border-cockpit-border rounded-sm px-5 py-3 flex items-center gap-3">
          <div className="w-1 h-1 rounded-full bg-cockpit-accent shrink-0" />
          <p className="text-cockpit-muted text-xs">{mod.tag}</p>
          <span className="ml-auto text-cockpit-muted text-xs font-mono shrink-0">
            {mod.questions.length} questions
          </span>
        </div>

        <button
          onClick={() => setPhase("question")}
          className="btn-primary w-full"
        >
          Start Module →
        </button>
      </div>
    );
  }

  // ── Analyzing screen ────────────────────────────────────────────────────────

  if (phase === "analyzing") {
    const steps = [
      "Scoring decision patterns",
      "Calibrating archetype distances",
      "Building your cognitive profile",
    ];
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-8 items-center text-center module-enter py-8">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-sm border border-cockpit-accent/20 animate-ping" />
          <div className="w-16 h-16 rounded-sm border border-cockpit-accent/40 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
              <path d="M12 3a9 9 0 0 1 9 9" className="animate-spin origin-center" style={{ animationDuration: "1s" }} />
            </svg>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Analyzing your profile</h2>
          <p className="text-cockpit-muted text-sm">
            Mapping 7 cognitive dimensions across {TOTAL_Q} data points…
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div
                className="w-1.5 h-1.5 rounded-full bg-cockpit-accent animate-pulse shrink-0"
                style={{ animationDelay: `${i * 0.5}s` }}
              />
              <p className="text-cockpit-muted text-xs text-left">{step}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Active question ─────────────────────────────────────────────────────────

  if (!currentQ) return null;

  const progress = answeredSoFar / TOTAL_Q;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      {/* Global progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-0.5 bg-cockpit-border rounded-full overflow-hidden">
          <div
            className="h-full bg-cockpit-accent transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-cockpit-muted text-xs font-mono shrink-0 tabular-nums">
          {answeredSoFar}/{TOTAL_Q}
        </span>
      </div>

      {/* Module label */}
      <div className="flex items-center gap-2">
        <span className="text-cockpit-muted text-xs uppercase tracking-widest font-mono">
          {currentMod.title}
        </span>
        <span className="text-cockpit-border text-xs">·</span>
        <span className="text-cockpit-muted text-xs">
          {questionIdx + 1}/{questions.length}
        </span>
      </div>

      {/* Question renderer — keyed by question id to force fresh mount */}
      {currentQ.type === "speed" && (
        <SpeedQ
          key={currentQ.id}
          q={currentQ}
          onAnswer={(optIdx, ms) =>
            recordAnswer({ type: "speed", qId: currentQ.id, value: optIdx ?? -1, responseMs: ms })
          }
        />
      )}

      {currentQ.type === "scenario" && (
        <ScenarioQ
          key={currentQ.id}
          q={currentQ}
          onAnswer={(optIdx) =>
            recordAnswer({ type: "scenario", qId: currentQ.id, value: optIdx })
          }
        />
      )}

      {currentQ.type === "ranking" && (
        <RankingQ
          key={currentQ.id}
          q={currentQ}
          onAnswer={(ids) =>
            recordAnswer({ type: "ranking", qId: currentQ.id, value: ids })
          }
        />
      )}

      {currentQ.type === "tradeoff" && (
        <TradeoffQ
          key={currentQ.id}
          q={currentQ}
          onAnswer={(choice) =>
            recordAnswer({ type: "tradeoff", qId: currentQ.id, value: choice })
          }
        />
      )}

      {currentQ.type === "allocation" && (
        <AllocationQ
          key={currentQ.id}
          q={currentQ}
          onAnswer={(alloc) =>
            recordAnswer({ type: "allocation", qId: currentQ.id, value: alloc })
          }
        />
      )}
    </div>
  );
}
