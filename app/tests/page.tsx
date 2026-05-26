import TestCard from "@/components/TestCard";
import SignUpNudge from "@/components/SignUpNudge";

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

function SectionHeader({
  icon, label, color, bg,
}: { icon: string; label: string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-base"
        style={{ background: bg, border: `1px solid ${color}30` }}>
        {icon}
      </div>
      <span className="text-sm font-bold tracking-widest uppercase"
        style={{ color }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}30, transparent)` }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function TestsPage() {
  return (
    <div className="hud-grid flex-1">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 w-full">

        {/* Header */}
        <div className="mb-6">
          <p className="text-cockpit-muted text-[10px] tracking-widest uppercase font-mono mb-1">Choose your test</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            All Tests
          </h1>
          <p className="text-cockpit-dim text-sm mt-1.5">
            Start instantly — no setup needed.
          </p>
        </div>

        {/* Sign-up nudge — only shown to guests */}
        <SignUpNudge />

        {/* ── Quick Hits ── */}
        <div className="mb-8">
          <SectionHeader icon="⚡" label="Quick Hits" color="#00e676" bg="#00e67610" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* ── Memory ── */}
        <div className="mb-8">
          <SectionHeader icon="🧩" label="Memory" color="#a855f7" bg="#a855f710" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MEMORY_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* ── Focus & Pressure ── */}
        <div className="mb-8">
          <SectionHeader icon="🎯" label="Focus & Pressure" color="#ff6d00" bg="#ff6d0010" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FOCUS_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* ── Full Assessments ── */}
        <div className="mb-6">
          <SectionHeader icon="🧠" label="Full Assessments" color="#00d4ff" bg="#00d4ff10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROFILE_TESTS.map((t) => <TestCard key={t.testId} {...t} />)}
          </div>
        </div>

        {/* Info strip */}
        <div className="border border-cockpit-border rounded-sm px-4 py-3 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse shrink-0" />
          <p className="text-cockpit-muted text-xs">
            All tests run in your browser. Nothing is sent anywhere unless you choose to save your result.
          </p>
        </div>
      </div>
    </div>
  );
}
