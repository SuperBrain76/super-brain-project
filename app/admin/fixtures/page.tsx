"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getFixtures,
  listCompetitions,
  adminSetResult,
  adminRescoreFixture,
  adminRescoreCompetition,
  formatKickoff,
  stageLabel,
  type Fixture,
  type Competition,
} from "@/lib/predictor";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// ── Helpers ───────────────────────────────────────────────────

function teamName(fixture: Fixture, side: "home" | "away"): string {
  const team = side === "home" ? fixture.homeTeam : fixture.awayTeam;
  return team ? `${team.flagEmoji ?? ""} ${team.name}` : "TBD";
}

function resultLabel(fixture: Fixture): string {
  if (fixture.homeScore === null || fixture.awayScore === null) return "—";
  return `${fixture.homeScore}–${fixture.awayScore}`;
}

// ── Score input row ───────────────────────────────────────────

function FixtureRow({
  fixture,
  onSaved,
}: {
  fixture:  Fixture;
  onSaved:  () => void;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [homeScore, setHomeScore] = useState(fixture.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(fixture.awayScore?.toString() ?? "");
  const [saving,    setSaving]    = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  const isComplete = fixture.status === "completed";
  const isPast     = new Date(fixture.kicksOffAt) <= new Date();

  const save = async () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 20 || a > 20) {
      setMsg({ text: "Enter valid scores (0–20).", ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await adminSetResult(fixture.id, h, a);
    setSaving(false);
    if (error) { setMsg({ text: error, ok: false }); return; }
    setMsg({ text: `Saved ${h}–${a}. Predictions scored automatically.`, ok: true });
    onSaved();
  };

  const rescore = async () => {
    setRescoring(true);
    setMsg(null);
    const { updated, error } = await adminRescoreFixture(fixture.id);
    setRescoring(false);
    if (error) { setMsg({ text: error, ok: false }); return; }
    setMsg({ text: `Rescored ${updated} prediction${updated === 1 ? "" : "s"}.`, ok: true });
  };

  return (
    <div className="border-b border-cockpit-border last:border-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cockpit-surface transition-colors"
      >
        <span className="text-cockpit-muted text-xs font-mono w-7 shrink-0">
          #{fixture.fixtureNumber}
        </span>

        {/* Teams */}
        <span className="flex-1 text-sm text-white truncate font-medium">
          {teamName(fixture, "home")} vs {teamName(fixture, "away")}
        </span>

        {/* Result / status */}
        <span
          className="text-sm font-mono shrink-0 ml-2"
          style={{
            color: isComplete ? "#00e676"
                 : isPast     ? "#ffab00"
                 : "#4a5568",
          }}
        >
          {resultLabel(fixture)}
        </span>

        {/* Stage badge */}
        <span className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted hidden sm:block shrink-0 w-20 text-right">
          {fixture.groupName ?? stageLabel(fixture.stage)}
        </span>

        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          className={`shrink-0 text-cockpit-border transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-cockpit-surface">
          <p className="text-cockpit-muted text-xs mb-3">
            {formatKickoff(fixture.kicksOffAt)} · {fixture.venue ?? "—"}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Score inputs */}
            <div className="flex items-center gap-2">
              <span className="text-cockpit-dim text-xs font-mono w-20 truncate">
                {fixture.homeTeam?.name ?? "Home"}
              </span>
              <input
                type="number"
                min={0} max={20}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-14 bg-cockpit-card border border-cockpit-border text-white text-center rounded-sm px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-cockpit-accent"
                placeholder="0"
              />
              <span className="text-cockpit-border font-mono">–</span>
              <input
                type="number"
                min={0} max={20}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-14 bg-cockpit-card border border-cockpit-border text-white text-center rounded-sm px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-cockpit-accent"
                placeholder="0"
              />
              <span className="text-cockpit-dim text-xs font-mono w-20 truncate">
                {fixture.awayTeam?.name ?? "Away"}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary text-sm py-1.5 px-4"
              >
                {saving ? "Saving…" : isComplete ? "Update result" : "Set result"}
              </button>

              {isComplete && (
                <button
                  onClick={rescore}
                  disabled={rescoring}
                  className="btn-ghost text-xs py-1.5 px-3"
                  title="Recalculate all predictions for this fixture"
                >
                  {rescoring ? "Rescoring…" : "↻ Rescore"}
                </button>
              )}
            </div>
          </div>

          {msg && (
            <p className={`mt-2 text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function AdminFixturesPage() {
  const { user, loading } = useAuth();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [fixtures,     setFixtures]     = useState<Fixture[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [stageFilter,  setStageFilter]  = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rescoring,    setRescoring]    = useState(false);
  const [rescoreMsg,   setRescoreMsg]   = useState<string | null>(null);
  const [search,       setSearch]       = useState("");

  const isAdmin = !loading && !!user && user.email === ADMIN_EMAIL;

  const loadFixtures = useCallback(async (comp: Competition) => {
    setFetching(true);
    const { fixtures: data } = await getFixtures(comp.id);
    setFixtures(data);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    listCompetitions().then((comps) => {
      setCompetitions(comps);
      if (comps.length > 0) {
        setSelectedComp(comps[0]);
        loadFixtures(comps[0]);
      }
    });
  }, [isAdmin, loadFixtures]);

  const handleCompChange = (compId: string) => {
    const comp = competitions.find((c) => c.id === compId) ?? null;
    setSelectedComp(comp);
    setStageFilter("all");
    setStatusFilter("all");
    setSearch("");
    if (comp) loadFixtures(comp);
  };

  const rescoreAll = async () => {
    if (!selectedComp) return;
    if (!confirm("Rescore ALL completed fixtures in this competition? This recalculates every prediction.")) return;
    setRescoring(true);
    setRescoreMsg(null);
    const { updated, error } = await adminRescoreCompetition(selectedComp.id);
    setRescoring(false);
    setRescoreMsg(error ? `Error: ${error}` : `Done. Updated ${updated} predictions.`);
  };

  // Auth guard
  if (loading) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-4">
        <p className="text-cockpit-red text-sm">Access denied.</p>
        <Link href="/" className="text-cockpit-accent text-sm hover:underline">← Home</Link>
      </div>
    );
  }

  // Filter and search
  const stages = ["all", ...Array.from(new Set(fixtures.map((f) => f.stage)))];

  const filtered = fixtures.filter((f) => {
    if (stageFilter !== "all" && f.stage !== stageFilter) return false;
    if (statusFilter === "pending"   && f.status === "completed") return false;
    if (statusFilter === "completed" && f.status !== "completed") return false;
    if (search) {
      const q = search.toLowerCase();
      const home = f.homeTeam?.name.toLowerCase() ?? "";
      const away = f.awayTeam?.name.toLowerCase() ?? "";
      const group = f.groupName?.toLowerCase() ?? "";
      if (!home.includes(q) && !away.includes(q) && !group.includes(q)) return false;
    }
    return true;
  });

  const completedCount = fixtures.filter((f) => f.status === "completed").length;
  const pendingCount   = fixtures.filter((f) => f.status !== "completed").length;

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-4 py-8 w-full">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-2">
              <Link href="/admin" className="hover:text-cockpit-dim">Admin</Link>
              <span>/</span>
              <span className="text-cockpit-dim">Fixtures</span>
            </div>
            <h1 className="text-xl font-bold text-white">Fixture Management</h1>
            <p className="text-cockpit-muted text-xs mt-1">
              Enter results to trigger automatic prediction scoring.
            </p>
          </div>

          {/* Competition selector */}
          {competitions.length > 1 && (
            <select
              value={selectedComp?.id ?? ""}
              onChange={(e) => handleCompChange(e.target.value)}
              className="bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {selectedComp && (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Total",     value: fixtures.length,  color: "#00d4ff" },
                { label: "Done",      value: completedCount,   color: "#00e676" },
                { label: "Pending",   value: pendingCount,     color: "#ffab00" },
              ].map((s) => (
                <div key={s.label} className="bg-cockpit-card border border-cockpit-border rounded-sm p-3 text-center">
                  <div className="text-xl font-bold number-display" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-cockpit-muted text-xs uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team or group…"
                className="bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-cockpit-accent flex-1 min-w-40 placeholder:text-cockpit-muted"
              />

              {/* Stage filter */}
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-cockpit-accent"
              >
                <option value="all">All stages</option>
                {stages.filter((s) => s !== "all").map((s) => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-cockpit-accent"
              >
                <option value="all">All status</option>
                <option value="pending">Pending only</option>
                <option value="completed">Completed only</option>
              </select>
            </div>

            {/* Fixture list */}
            <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden mb-5">
              {fetching ? (
                <p className="text-cockpit-dim text-sm text-center py-10 animate-pulse">Loading fixtures…</p>
              ) : filtered.length === 0 ? (
                <p className="text-cockpit-muted text-sm text-center py-10">No fixtures match your filters.</p>
              ) : (
                filtered.map((fixture) => (
                  <FixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    onSaved={() => selectedComp && loadFixtures(selectedComp)}
                  />
                ))
              )}
            </div>

            {/* Danger zone: rescore all */}
            <div className="border border-cockpit-border rounded-sm p-4">
              <p className="text-white font-semibold text-sm mb-1">Recalculate all scores</p>
              <p className="text-cockpit-muted text-xs mb-3 leading-relaxed">
                Use if you corrected a result after auto-scoring, or after changing the scoring rules.
                Rescores every completed fixture in this competition.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={rescoreAll}
                  disabled={rescoring}
                  className="btn-ghost text-sm text-red-400 border-red-500 border-opacity-30 hover:border-red-400"
                >
                  {rescoring ? "Rescoring…" : "↻ Rescore entire competition"}
                </button>
                {rescoreMsg && (
                  <p className={`text-xs ${rescoreMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                    {rescoreMsg}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
