"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import ScoreInput from "@/components/predictor/ScoreInput";
import {
  getFixture,
  upsertPrediction,
  isPredictionOpen,
  formatKickoff,
  kickoffCountdown,
  stageLabel,
  pointsColor,
  type Fixture,
} from "@/lib/predictor";

// ── Points label ──────────────────────────────────────────────

function PointsResult({ pts }: { pts: number }) {
  const col = pointsColor(pts);
  const label =
    pts === 5 ? "⚡ Exact score!"      :
    pts === 3 ? "✓ Correct goal diff"  :
    pts === 2 ? "~ Correct result"     :
                "✗ Wrong prediction";

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-3 rounded-sm border"
      style={{ borderColor: `${col}40`, background: `${col}10` }}
    >
      <span className="text-lg font-black number-display" style={{ color: col }}>{pts}</span>
      <div>
        <p className="text-sm font-semibold" style={{ color: col }}>{label}</p>
        <p className="text-cockpit-muted text-xs">{pts} point{pts !== 1 ? "s" : ""} awarded</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function FixturePredictPage() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const router        = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [fixture,  setFixture]  = useState<Fixture | null>(null);
  const [fetching, setFetching] = useState(true);

  const [homeScore, setHomeScore] = useState(1);
  const [awayScore, setAwayScore] = useState(1);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Countdown refresh
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => forceRefresh((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!fixtureId) return;
    setFetching(true);
    getFixture(fixtureId).then((f) => {
      setFixture(f);
      if (f?.myPrediction) {
        setHomeScore(f.myPrediction.homeScore);
        setAwayScore(f.myPrediction.awayScore);
      }
      setFetching(false);
    });
  }, [fixtureId]);

  const handleSubmit = useCallback(async () => {
    if (!fixture) return;
    setSaving(true);
    setError(null);
    const { error: err } = await upsertPrediction(fixture.id, homeScore, awayScore);
    setSaving(false);
    if (err) { setError(err); return; }
    setSaved(true);
    // Refresh fixture to show updated prediction
    const updated = await getFixture(fixture.id);
    setFixture(updated);
  }, [fixture, homeScore, awayScore]);

  if (fetching || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-cockpit-muted text-sm">Fixture not found.</p>
        <Link href="/predict" className="text-cockpit-accent text-sm hover:underline">← Back to predictor</Link>
      </div>
    );
  }

  const open        = isPredictionOpen(fixture);
  const done        = fixture.status === "completed";
  const hasPred     = !!fixture.myPrediction;
  const countdown   = kickoffCountdown(fixture.kicksOffAt);
  const homeTeam    = fixture.homeTeam;
  const awayTeam    = fixture.awayTeam;

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono">
          <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
          <span>/</span>
          <span className="text-cockpit-dim truncate">
            {homeTeam?.name ?? "TBD"} vs {awayTeam?.name ?? "TBD"}
          </span>
        </div>

        {/* Match header card */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5">

          {/* Stage + group */}
          <p className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted text-center mb-4">
            {fixture.groupName ? `Group ${fixture.groupName}` : stageLabel(fixture.stage)}
            {fixture.venue ? ` · ${fixture.venue}` : ""}
          </p>

          {/* Teams */}
          <div className="grid grid-cols-3 items-center gap-3 mb-4">
            {/* Home */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-4xl leading-none">{homeTeam?.flagEmoji ?? "🏳"}</span>
              <span className="text-white text-sm font-bold leading-tight">
                {homeTeam?.name ?? "TBD"}
              </span>
            </div>

            {/* Result / vs */}
            <div className="flex flex-col items-center gap-1">
              {done && fixture.homeScore !== null ? (
                <div className="text-center">
                  <p className="text-2xl font-black number-display text-white">
                    {fixture.homeScore}–{fixture.awayScore}
                  </p>
                  <p className="text-[10px] text-cockpit-muted font-mono uppercase">Final</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-cockpit-accent font-mono uppercase tracking-widest">vs</p>
                  <p className="text-[10px] text-cockpit-muted font-mono mt-1">
                    {open ? countdown : "Kicked off"}
                  </p>
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-4xl leading-none">{awayTeam?.flagEmoji ?? "🏳"}</span>
              <span className="text-white text-sm font-bold leading-tight">
                {awayTeam?.name ?? "TBD"}
              </span>
            </div>
          </div>

          {/* Kickoff time */}
          <p className="text-cockpit-muted text-xs text-center font-mono">
            {formatKickoff(fixture.kicksOffAt)}
          </p>
        </div>

        {/* ── Result shown ────────────────────────────────── */}
        {done && hasPred && fixture.myPrediction!.pointsAwarded !== null && (
          <PointsResult pts={fixture.myPrediction!.pointsAwarded} />
        )}

        {/* ── Not signed in ───────────────────────────────── */}
        {!user && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 text-center flex flex-col gap-3">
            <p className="text-white font-semibold">Sign in to predict</p>
            <p className="text-cockpit-dim text-sm">Save your prediction and track your score on the leaderboard.</p>
            <Link href="/login" className="btn-primary w-full justify-center flex items-center">
              Sign in free →
            </Link>
          </div>
        )}

        {/* ── Prediction locked ───────────────────────────── */}
        {user && !open && !done && (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-sm p-4 text-center">
            <p className="text-cockpit-muted text-sm font-mono uppercase tracking-widest">
              🔒 Prediction locked — match has started
            </p>
            {hasPred && (
              <p className="text-cockpit-dim text-sm mt-2">
                Your prediction: {fixture.myPrediction!.homeScore}–{fixture.myPrediction!.awayScore}
              </p>
            )}
          </div>
        )}

        {/* ── Prediction form ──────────────────────────────── */}
        {user && open && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-5">

            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cockpit-accent animate-pulse" />
              <p className="text-cockpit-accent text-xs font-mono uppercase tracking-widest">
                {hasPred ? "Edit your prediction" : "Enter your prediction"}
              </p>
            </div>

            {/* Score spinners */}
            <div className="flex items-center justify-center gap-6">
              <ScoreInput
                value={homeScore}
                onChange={setHomeScore}
                label={homeTeam?.name ?? "Home"}
                disabled={saving}
              />

              <span className="text-cockpit-border text-2xl font-bold mt-6">–</span>

              <ScoreInput
                value={awayScore}
                onChange={setAwayScore}
                label={awayTeam?.name ?? "Away"}
                disabled={saving}
              />
            </div>

            {/* Predicted outcome hint */}
            <p className="text-center text-cockpit-muted text-xs font-mono">
              {homeScore > awayScore
                ? `${homeTeam?.name ?? "Home"} win`
                : awayScore > homeScore
                ? `${awayTeam?.name ?? "Away"} win`
                : "Draw"}
              {" · "}
              Exact score = 5 pts · Correct GD = 3 pts · Correct result = 2 pts
            </p>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            {/* Success flash */}
            {saved && !error && (
              <p className="text-green-400 text-xs text-center font-mono">
                ✓ Prediction saved — {homeScore}–{awayScore}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary w-full justify-center flex items-center gap-2 py-3.5"
            >
              {saving ? "Saving…" : hasPred ? "Update prediction" : "Save prediction →"}
            </button>

            {/* Deadline warning */}
            <p className="text-cockpit-muted text-[10px] text-center font-mono">
              Locks at kickoff · {countdown} remaining
            </p>
          </div>
        )}

        {/* ── Already completed, no prediction ────────────── */}
        {done && !hasPred && (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-sm p-4 text-center">
            <p className="text-cockpit-muted text-sm">
              You didn&apos;t predict this match.
            </p>
          </div>
        )}

        {/* Back */}
        <Link href="/predict" className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono">
          ← Back to all fixtures
        </Link>

      </div>
    </div>
  );
}
