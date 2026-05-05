import TestCard from "@/components/TestCard";

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

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {ALL_TESTS.map((t) => (
            <TestCard key={t.testId} {...t} />
          ))}
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
