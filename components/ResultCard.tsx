"use client";

import { useState, useRef } from "react";
import type { TestSession } from "@/types";
import { getRankingColor, exportCSV } from "@/lib/scoring";

interface Props {
  session: TestSession;
}

function downloadCSV(session: TestSession) {
  const csv = exportCSV(session);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pilot-cognitive-test-${session.sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MODULE_ICONS: Record<string, string> = {
  reaction:  "⚡",
  visual:    "👁",
  spatial:   "🔄",
  multitask: "🎯",
  math:      "🧮",
};

// ── Debug row component ──────────────────────────────────────────────────────
function DebugRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-xs py-1 border-b border-cockpit-border last:border-0">
      <span className="text-cockpit-muted font-mono">{label}</span>
      <span className="text-cockpit-accent font-mono font-semibold">{value}</span>
    </div>
  );
}

export default function ResultCard({ session }: Props) {
  const [showDebug, setShowDebug] = useState(false);
  const rankColor = getRankingColor(session.totalScore);
  const duration = Math.round((session.completedAt - session.startedAt) / 60000);

  const reactionMod  = session.modules.find((m) => m.moduleId === "reaction");
  const visualMod    = session.modules.find((m) => m.moduleId === "visual");
  const spatialMod   = session.modules.find((m) => m.moduleId === "spatial");
  const multitaskMod = session.modules.find((m) => m.moduleId === "multitask");
  const mathMod      = session.modules.find((m) => m.moduleId === "math");

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      {/* ── Score card ────────────────────────────────────────────────────── */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
        {/* Banner */}
        <div className="px-8 py-6 border-b border-cockpit-border"
          style={{ background: `linear-gradient(135deg, ${rankColor}12, transparent)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">
                Pilot Cognitive Stress Test
              </p>
              <h2 className="text-2xl font-bold text-white">Assessment Complete</h2>
              <p className="text-cockpit-dim text-xs mt-1">
                {new Date(session.completedAt).toLocaleString()} · {duration} min
              </p>
            </div>
            <div className="text-right">
              <div
                className="text-6xl font-extrabold number-display tabular-nums"
                style={{ color: rankColor, textShadow: `0 0 30px ${rankColor}60` }}
              >
                {session.totalScore}
              </div>
              <div className="text-cockpit-dim text-xs">/100</div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2">
            <div className="px-4 py-1.5 rounded-sm border text-sm font-semibold tracking-widest uppercase"
              style={{ borderColor: rankColor, color: rankColor, background: `${rankColor}15` }}>
              {session.ranking}
            </div>
          </div>
        </div>

        {/* Module breakdown bars */}
        <div className="px-8 py-6">
          <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-4">Module Breakdown</p>
          <div className="space-y-4">
            {session.modules.map((m) => (
              <div key={m.moduleId}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{MODULE_ICONS[m.moduleId] ?? "●"}</span>
                    <span className="text-cockpit-text text-sm">{m.moduleName}</span>
                    <span className="text-cockpit-muted text-xs">{Math.round(m.weight * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cockpit-dim text-xs number-display">
                      ×{m.weight} = {m.weightedScore.toFixed(1)}
                    </span>
                    <span className="number-display text-white font-semibold w-10 text-right">
                      {Math.round(m.rawScore)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-cockpit-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${m.rawScore}%`,
                      background: `linear-gradient(90deg, ${getRankingColor(m.rawScore)}, ${getRankingColor(m.rawScore)}aa)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score table */}
        <div className="px-8 pb-6">
          <div className="border border-cockpit-border rounded-sm overflow-hidden">
            <div className="grid grid-cols-4 text-xs text-cockpit-muted tracking-widest uppercase bg-cockpit-surface px-4 py-2">
              <span>Module</span>
              <span className="text-center">Raw</span>
              <span className="text-center">Weight</span>
              <span className="text-right">Points</span>
            </div>
            {session.modules.map((m) => (
              <div key={m.moduleId} className="grid grid-cols-4 px-4 py-2.5 border-t border-cockpit-border text-sm">
                <span className="text-cockpit-text">{m.moduleName}</span>
                <span className="text-center number-display text-cockpit-accent">{Math.round(m.rawScore)}</span>
                <span className="text-center text-cockpit-dim">{Math.round(m.weight * 100)}%</span>
                <span className="text-right number-display text-cockpit-text">{m.weightedScore.toFixed(2)}</span>
              </div>
            ))}
            <div className="grid grid-cols-4 px-4 py-3 border-t border-cockpit-border bg-cockpit-surface text-sm font-semibold">
              <span className="text-cockpit-dim">TOTAL</span>
              <span /><span />
              <span className="text-right number-display text-xl" style={{ color: rankColor }}>
                {session.totalScore}
              </span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-8 pb-6">
          <p className="text-cockpit-muted text-xs leading-relaxed border-t border-cockpit-border pt-4">
            This is an unofficial cognitive challenge and not affiliated with any air force,
            military, or official pilot selection process. Results are for personal
            self-assessment only and have no bearing on professional qualifications.
          </p>
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <button onClick={() => downloadCSV(session)} className="flex-1 flex items-center justify-center gap-2 btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
        <button
          onClick={() => {
            const text = `Pilot Cognitive Stress Test — Score: ${session.totalScore}/100 (${session.ranking})\n\n${session.modules.map((m) => `${m.moduleName}: ${Math.round(m.rawScore)}`).join("\n")}`;
            navigator.clipboard.writeText(text).catch(() => {});
            alert("Result copied to clipboard!");
          }}
          className="flex-1 flex items-center justify-center gap-2 btn-ghost"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Share Result
        </button>
        <button
          onClick={() => { localStorage.removeItem("pct_session"); window.location.href = "/"; }}
          className="flex-1 flex items-center justify-center gap-2 btn-ghost"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
          </svg>
          Retake
        </button>
      </div>

      {/* ── Debug / Raw values panel ──────────────────────────────────────── */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
        <button
          onClick={() => setShowDebug((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-cockpit-surface transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cockpit-dim">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="text-cockpit-dim text-xs tracking-widest uppercase">Debug · Raw Values</span>
          </div>
          <span className="text-cockpit-muted text-xs">{showDebug ? "▲ hide" : "▼ show"}</span>
        </button>

        {showDebug && (
          <div className="px-6 pb-6 space-y-5 border-t border-cockpit-border pt-5">
            {/* Reaction */}
            {reactionMod && (
              <div>
                <p className="text-cockpit-accent text-xs font-semibold tracking-widest uppercase mb-2">
                  ⚡ Reaction Speed
                </p>
                <DebugRow label="avg RT"          value={`${reactionMod.details.avgRT ?? "—"} ms`} />
                <DebugRow label="best RT"         value={`${reactionMod.details.bestRT ?? "—"} ms`} />
                <DebugRow label="trials"          value={String(reactionMod.details.trials ?? "—")} />
                <DebugRow label="false starts"    value={String(reactionMod.details.falseStarts ?? 0)} />
                <DebugRow label="raw score"       value={Math.round(reactionMod.rawScore)} />
              </div>
            )}
            {/* Visual Memory */}
            {visualMod && (
              <div>
                <p className="text-cockpit-accent text-xs font-semibold tracking-widest uppercase mb-2">
                  👁 Visual Memory
                </p>
                <DebugRow label="levels completed" value={String(visualMod.details.levelsCompleted ?? "—")} />
                <DebugRow label="max level"        value={String(visualMod.details.maxLevel ?? "—")} />
                <DebugRow label="avg accuracy"     value={`${visualMod.details.avgAccuracy ?? "—"}%`} />
                <DebugRow label="raw score"        value={Math.round(visualMod.rawScore)} />
              </div>
            )}
            {/* Spatial Reasoning */}
            {spatialMod && (
              <div>
                <p className="text-cockpit-accent text-xs font-semibold tracking-widest uppercase mb-2">
                  🔄 Spatial Reasoning
                </p>
                <DebugRow label="correct"      value={String(spatialMod.details.correct ?? "—")} />
                <DebugRow label="attempted"    value={String(spatialMod.details.attempted ?? "—")} />
                <DebugRow label="total Qs"     value={String(spatialMod.details.total ?? "—")} />
                <DebugRow label="accuracy"     value={`${spatialMod.details.attempted ? Math.round((Number(spatialMod.details.correct) / Number(spatialMod.details.attempted)) * 100) : 0}%`} />
                <DebugRow label="raw score"    value={Math.round(spatialMod.rawScore)} />
              </div>
            )}
            {/* Multitasking */}
            {multitaskMod && (
              <div>
                <p className="text-cockpit-accent text-xs font-semibold tracking-widest uppercase mb-2">
                  🎯 Multitasking Stress
                </p>
                <DebugRow label="tracking score"    value={`${multitaskMod.details.trackingScore ?? "—"}`} />
                <DebugRow label="avg track distance" value={`${multitaskMod.details.avgTrackingDistance ?? "—"}%`} />
                <DebugRow label="tracking samples"  value={String(multitaskMod.details.trackingSamples ?? "—")} />
                <DebugRow label="recall correct"    value={String(multitaskMod.details.recallCorrect ?? "—")} />
                <DebugRow label="recall wrong"      value={String(multitaskMod.details.recallWrong ?? "—")} />
                <DebugRow label="recall missed"     value={String(multitaskMod.details.recallMissed ?? "—")} />
                <DebugRow label="recall total"      value={String(multitaskMod.details.recallTotal ?? "—")} />
                <DebugRow label="recall score"      value={`${multitaskMod.details.recallScore ?? "—"}`} />
                <DebugRow label="raw score"         value={Math.round(multitaskMod.rawScore)} />
              </div>
            )}
            {/* Mental Math */}
            {mathMod && (
              <div>
                <p className="text-cockpit-accent text-xs font-semibold tracking-widest uppercase mb-2">
                  🧮 Mental Math
                </p>
                <DebugRow label="correct"       value={String(mathMod.details.correct ?? "—")} />
                <DebugRow label="wrong"         value={String(mathMod.details.wrong ?? "—")} />
                <DebugRow label="attempted"     value={String(mathMod.details.attempted ?? "—")} />
                <DebugRow label="accuracy"      value={`${mathMod.details.accuracy ?? "—"}%`} />
                <DebugRow label="avg time/Q"    value={`${mathMod.details.avgTimeMs ?? "—"} ms`} />
                <DebugRow label="max difficulty" value={String(mathMod.details.maxDifficulty ?? "—")} />
                <DebugRow label="raw score"     value={Math.round(mathMod.rawScore)} />
              </div>
            )}
            {/* Weighted totals */}
            <div className="border-t border-cockpit-border pt-4">
              <p className="text-cockpit-accent text-xs font-semibold tracking-widest uppercase mb-2">
                Weighted Totals
              </p>
              {session.modules.map((m) => (
                <DebugRow
                  key={m.moduleId}
                  label={`${m.moduleName} (×${m.weight})`}
                  value={`${Math.round(m.rawScore)} × ${m.weight} = ${m.weightedScore.toFixed(2)}`}
                />
              ))}
              <div className="flex justify-between text-sm pt-2 mt-2 border-t border-cockpit-border">
                <span className="text-cockpit-dim font-mono font-semibold">TOTAL SCORE</span>
                <span className="font-mono font-bold" style={{ color: rankColor }}>
                  {session.totalScore} / 100 — {session.ranking}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ranking legend */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6">
        <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-4">Ranking Scale</p>
        <div className="grid grid-cols-5 gap-2">
          {[
            { range: "90–100", label: "Elite",          color: "#00d4ff" },
            { range: "80–89",  label: "High Performer", color: "#00e676" },
            { range: "70–79",  label: "Strong",         color: "#69f0ae" },
            { range: "60–69",  label: "Average",        color: "#ffab00" },
            { range: "<60",    label: "Needs Work",     color: "#ff3d00" },
          ].map((r) => (
            <div
              key={r.label}
              className="text-center p-3 rounded-sm border transition-all"
              style={{
                borderColor: session.ranking === r.label ? r.color : `${r.color}50`,
                background: session.ranking === r.label ? `${r.color}20` : "transparent",
                opacity: session.ranking === r.label ? 1 : 0.5,
              }}
            >
              <div className="text-xs font-mono font-semibold" style={{ color: r.color }}>{r.range}</div>
              <div className="text-cockpit-dim text-xs mt-1 leading-tight">{r.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
