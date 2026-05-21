import TestCard from "@/components/TestCard";

const MOBILE_TESTS = [
  {
    testId: "tap-speed",
    title: "Tap Speed Test",
    description: "10 seconds. Tap as fast as humanly possible. No tricks, no setup — just pure speed. Designed for thumbs.",
    duration: "~30 sec",
    difficulty: "Easy" as const,
    href: "/tests/tap-speed",
  },
  {
    testId: "verbal-memory",
    title: "Verbal Memory Test",
    description: "Study 16 words, then identify them in a mixed list. Seen or new? Simple concept — brutal in practice.",
    duration: "~90 sec",
    difficulty: "Medium" as const,
    href: "/tests/verbal-memory",
  },
  {
    testId: "stroop",
    title: "Stroop Test",
    description: "The word says RED but it's printed in green. Tap the ink colour — not the word. Your brain will sabotage you.",
    duration: "~45 sec",
    difficulty: "Hard" as const,
    href: "/tests/stroop",
  },
];

const FOCUS_TESTS = [
  {
    testId:      "focus",
    title:       "Focus & Attention Test",
    description: "5 escalating phases. Target tracking, signal filtering, interruption recovery, dual-task processing, and priority management under pressure. Gets harder every round.",
    duration:    "~5 min",
    difficulty:  "Hard" as const,
    href:        "/tests/focus",
    featured:    true,
  },
];

const PROFILE_TESTS = [
  {
    testId: "career-profile",
    title: "Career Cognitive Profile",
    description: "20 questions. Maps your cognitive fingerprint across 7 dimensions — identifies your dominant archetype, strongest career paths, leadership mode, and ideal work environments.",
    duration: "~8 min",
    difficulty: "Medium" as const,
    href: "/tests/career-profile",
    featured: true,
  },
];

const ALL_TESTS = [
  {
    testId: "reaction",
    title: "Reaction Speed Test",
    description: "5 trials. Click the instant the screen changes. Millisecond-precise. False starts are penalised. Harder than it sounds.",
    duration: "~2 min",
    difficulty: "Easy" as const,
    href: "/tests/reaction",
  },
  {
    testId: "pressure",
    title: "Pressure Decision Test",
    description: "10 decisions. 8 seconds each. Speed and accuracy both count. The clock doesn't care if you're sure.",
    duration: "~3 min",
    difficulty: "Medium" as const,
    href: "/tests/pressure",
  },
  {
    testId: "memory",
    title: "Memory & Focus Test",
    description: "A sequence lights up. You repeat it. Each round gets longer. One wrong move ends it.",
    duration: "~5 min",
    difficulty: "Medium" as const,
    href: "/tests/memory",
  },
  {
    testId: "fighter-pilot",
    title: "Fighter Pilot Cognitive Test",
    description: "Five modules. Reaction, memory, spatial reasoning, multitasking, and mental math — running simultaneously. This is the full assessment.",
    duration: "~25 min",
    difficulty: "Expert" as const,
    href: "/test",
    featured: true,
  },
];

export default function TestsPage() {
  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-4xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Choose your test</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">All Tests</h1>
          <p className="text-cockpit-dim text-base max-w-md leading-relaxed">
            No login required. Pick a test, start immediately, get your score.
          </p>
        </div>

        {/* Focus & attention */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-cockpit-muted text-xs tracking-widest uppercase font-mono">Focus</span>
            <div className="flex-1 h-px bg-cockpit-border" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {FOCUS_TESTS.map((t) => (
              <TestCard key={t.testId} {...t} />
            ))}
          </div>
        </div>

        {/* Career & cognitive profile */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-cockpit-muted text-xs tracking-widest uppercase font-mono">Cognitive Profile</span>
            <div className="flex-1 h-px bg-cockpit-border" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {PROFILE_TESTS.map((t) => (
              <TestCard key={t.testId} {...t} />
            ))}
          </div>
        </div>

        {/* Mobile-first quick tests */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-cockpit-muted text-xs tracking-widest uppercase font-mono">📱 Mobile-friendly</span>
            <div className="flex-1 h-px bg-cockpit-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MOBILE_TESTS.map((t) => (
              <TestCard key={t.testId} {...t} />
            ))}
          </div>
        </div>

        {/* Classic tests */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-cockpit-muted text-xs tracking-widest uppercase font-mono">All tests</span>
            <div className="flex-1 h-px bg-cockpit-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_TESTS.map((t) => (
              <TestCard key={t.testId} {...t} />
            ))}
          </div>
        </div>

        {/* Info strip */}
        <div className="border border-cockpit-border rounded-sm px-5 py-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cockpit-green animate-pulse shrink-0" />
          <p className="text-cockpit-dim text-sm">
            All tests run in your browser. Nothing is sent anywhere unless you choose to save your result.
          </p>
        </div>
      </div>
    </div>
  );
}
