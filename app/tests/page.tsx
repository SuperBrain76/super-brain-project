import TestCard from "@/components/TestCard";
import SignUpNudge from "@/components/SignUpNudge";
import { BRAND, MATERIAL } from "@/lib/brand";

// ── Test data ─────────────────────────────────────────────────

const QUICK_TESTS = [
  {
    testId: "tap-speed",
    title: "Tap Speed",
    description: "10 seconds. Tap as fast as humanly possible. Designed for thumbs.",
    duration: "~30 sec",
    difficulty: "Easy" as const,
    href: "/tests/tap-speed",
  },
  {
    testId: "reaction",
    title: "Reaction Speed",
    description: "5 trials. Click the instant the screen changes. Millisecond-precise. False starts are penalised.",
    duration: "~2 min",
    difficulty: "Easy" as const,
    href: "/tests/reaction",
  },
  {
    testId: "stroop",
    title: "Stroop Test",
    description: "The word says RED but it's printed in green. Tap the ink colour. Your brain will fight you.",
    duration: "~45 sec",
    difficulty: "Hard" as const,
    href: "/tests/stroop",
  },
];

const MEMORY_TESTS = [
  {
    testId: "verbal-memory",
    title: "Verbal Memory",
    description: "Study 16 words, then identify them in a mixed list. Seen or new? Simple concept — brutal in practice.",
    duration: "~90 sec",
    difficulty: "Medium" as const,
    href: "/tests/verbal-memory",
  },
  {
    testId: "memory",
    title: "Sequence Memory",
    description: "A sequence lights up. You repeat it. Each round gets longer. One wrong move ends it.",
    duration: "~5 min",
    difficulty: "Medium" as const,
    href: "/tests/memory",
  },
];

const FOCUS_TESTS = [
  {
    testId: "focus",
    title: "Focus & Attention Test",
    description: "5 escalating phases. Target tracking, signal filtering, interruption recovery, dual-task processing, and priority management under pressure.",
    duration: "~5 min",
    difficulty: "Hard" as const,
    href: "/tests/focus",
    featured: true,
  },
  {
    testId: "pressure",
    title: "Pressure Decision Test",
    description: "10 decisions. 8 seconds each. Speed and accuracy both count. The clock doesn't care if you're sure.",
    duration: "~3 min",
    difficulty: "Medium" as const,
    href: "/tests/pressure",
  },
];

const PROFILE_TESTS = [
  {
    testId: "matrix",
    title: "Fluid Intelligence Assessment",
    description: "18 adaptive matrix reasoning questions. Abstract patterns, logical progressions, spatial transformations. Difficulty adjusts in real time to your performance.",
    duration: "~12 min",
    difficulty: "Hard" as const,
    href: "/tests/matrix",
    featured: true,
  },
  {
    testId: "career-profile",
    title: "Career Cognitive Profile",
    description: "20 questions. Maps your cognitive fingerprint across 7 dimensions — identifies your dominant archetype, strongest career paths, and ideal work environments.",
    duration: "~8 min",
    difficulty: "Medium" as const,
    href: "/tests/career-profile",
    featured: true,
  },
  {
    testId: "fighter-pilot",
    title: "Fighter Pilot Assessment",
    description: "Five modules running simultaneously. Reaction, memory, spatial reasoning, multitasking, and mental math. The full evaluation.",
    duration: "~25 min",
    difficulty: "Expert" as const,
    href: "/test",
    featured: true,
  },
];

// ── Section header component ──────────────────────────────────

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
        style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
        {icon}
      </div>
      <span className="text-xs font-bold tracking-[0.22em] uppercase" style={{ color: BRAND.muted }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${BRAND.hairline}, transparent)` }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function TestsPage() {
  return (
    <div className="flex-1" style={{ background: MATERIAL.vignette }}>
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 w-full">

        {/* Header */}
        <div className="mb-7">
          <p className="text-[10px] tracking-[0.28em] uppercase mb-1.5" style={{ color: BRAND.dim }}>Choose your test</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: BRAND.ink }}>
            All Tests
          </h1>
          <p className="text-sm mt-1.5" style={{ color: BRAND.muted }}>
            Start instantly — no setup needed.
          </p>
        </div>

        {/* Sign-up nudge — only shown to guests */}
        <SignUpNudge />

        {/* ── Quick Hits ── */}
        <div className="mb-8">
          <SectionHeader icon="⚡" label="Quick Hits" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* ── Memory ── */}
        <div className="mb-8">
          <SectionHeader icon="🧩" label="Memory" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MEMORY_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* ── Focus & Pressure ── */}
        <div className="mb-8">
          <SectionHeader icon="🎯" label="Focus & Pressure" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FOCUS_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* ── Full Assessments ── */}
        <div className="mb-6">
          <SectionHeader icon="🧠" label="Full Assessments" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROFILE_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* Info strip — boxless */}
        <div className="px-1 py-3 flex items-center gap-2.5" style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: BRAND.sports }} />
          <p className="text-xs" style={{ color: BRAND.dim }}>
            All tests run in your browser. Nothing is sent anywhere unless you choose to save your result.
          </p>
        </div>
      </div>
    </div>
  );
}
