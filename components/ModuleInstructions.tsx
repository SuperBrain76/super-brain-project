"use client";

interface Instruction {
  icon: string;
  text: string;
}

interface ModuleInstructionsProps {
  moduleNumber: number;
  title: string;
  duration: string;
  weight: string;
  description: string;
  instructions: Instruction[];
  onBegin: () => void;
  warning?: string;
}

export default function ModuleInstructions({
  moduleNumber,
  title,
  duration,
  weight,
  description,
  instructions,
  onBegin,
  warning,
}: ModuleInstructionsProps) {
  return (
    <div className="module-enter max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">
            Module {moduleNumber} of 5
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
        </div>
        <div className="text-right">
          <div className="text-cockpit-accent number-display text-lg font-semibold">{weight}</div>
          <div className="text-cockpit-dim text-xs mt-0.5">of final score</div>
        </div>
      </div>

      {/* Duration badge */}
      <div className="inline-flex items-center gap-2 bg-cockpit-card border border-cockpit-border px-4 py-2 rounded-sm mb-6">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cockpit-accent">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="text-cockpit-dim text-sm font-mono">{duration}</span>
      </div>

      {/* Description */}
      <p className="text-cockpit-dim leading-relaxed mb-8">{description}</p>

      {/* Instructions list */}
      <div className="space-y-3 mb-8">
        {instructions.map((inst, i) => (
          <div
            key={i}
            className="flex items-start gap-4 p-4 bg-cockpit-card border border-cockpit-border rounded-sm"
          >
            <span className="text-xl shrink-0">{inst.icon}</span>
            <span className="text-cockpit-text text-sm leading-relaxed">{inst.text}</span>
          </div>
        ))}
      </div>

      {/* Warning */}
      {warning && (
        <div className="flex items-center gap-3 p-4 bg-cockpit-amber bg-opacity-10 border border-cockpit-amber border-opacity-40 rounded-sm mb-8">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cockpit-amber shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-cockpit-amber text-sm">{warning}</span>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onBegin}
        className="btn-primary w-full flex items-center justify-center gap-3"
      >
        <span>Begin Module</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>

      <p className="text-center text-cockpit-muted text-xs mt-4">
        Once started, the module cannot be paused or retried.
      </p>
    </div>
  );
}
