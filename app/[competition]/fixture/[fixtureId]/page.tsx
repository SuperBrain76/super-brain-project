"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { track } from "@/lib/analytics";
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
import { getKnockoutSeeds } from "@/lib/knockoutSeeds";
import SeedPill from "@/components/predictor/SeedPill";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Points label ──────────────────────────────────────────────
function PointsResult({ pts }: { pts: number }) {
  const label =
    pts === 5 ? "⚡ Exact score!"     :
    pts === 3 ? "✓ Correct goal diff" :
    pts === 2 ? "~ Correct result"    :
                "✗ Wrong prediction";

  const col =
    pts === 5 ? GREEN  :
    pts === 3 ? "#0e1e35" :
    pts === 2 ? GOLD   :
                "#c0392b";

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl"
      style={{ border: `1px solid ${col}40`, background: `${col}10` }}
    >
      <span className="text-2xl font-black tabular-nums" style={{ color: col }}>{pts}</span>
      <div>
        <p className="text-sm font-semibold" style={{ color: col }}>{label}</p>
        <p className="text-xs" style={{ color: MUTED }}>{pts} point{pts !== 1 ? "s" : ""} awarded</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function FixturePredictPage() {
  // Competition Engine V2: competition comes from the first path segment.
  const { competition: competitionSlug } = useParams<{ competition: string }>();

  const { fixtureId } = useParams<{ fixtureId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [fixture,   setFixture]   = useState<Fixture | null>(null);
  const [fetching,  setFetching]  = useState(true);
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
    const isEdit = !!fixture.myPrediction;
    setSaving(true); setError(null);
    const { error: err } = await upsertPrediction(fixture.id, homeScore, awayScore);
    setSaving(false);
    if (err) { setError(err); return; }
    track.predictionSaved(fixture.id, isEdit);
    setSaved(true);
    const updated = await getFixture(fixture.id);
    setFixture(updated);
  }, [fixture, homeScore, awayScore]);

  if (fetching || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading…</p>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm" style={{ color: TEXT2 }}>Fixture not found.</p>
        <Link href={`/${competitionSlug}`} className="text-sm hover:underline" style={{ color: GREEN }}>← Back to predictor</Link>
      </div>
    );
  }

  const open      = isPredictionOpen(fixture);
  const done      = fixture.status === "completed";
  const hasPred   = !!fixture.myPrediction;
  const countdown = kickoffCountdown(fixture.kicksOffAt);
  const homeTeam  = fixture.homeTeam;
  const awayTeam  = fixture.awayTeam;
  const seeds     = getKnockoutSeeds(fixture.fixtureNumber);

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href={`/${competitionSlug}`} className="hover:underline" style={{ color: MUTED }}>Predictor</Link>
          <span>/</span>
          <span className="truncate" style={{ color: TEXT2, fontWeight: 600 }}>
            {homeTeam?.name ?? seeds?.home ?? "TBD"} vs {awayTeam?.name ?? seeds?.away ?? "TBD"}
          </span>
        </div>

        {/* Match header card */}
        <div className="rounded-xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {/* Stage */}
          <p className="text-[10px] uppercase tracking-widest text-center mb-4" style={{ color: MUTED }}>
            {fixture.groupName ? `Group ${fixture.groupName}` : stageLabel(fixture.stage)}
            {fixture.venue ? ` · ${fixture.venue}` : ""}
          </p>

          {/* Teams */}
          <div className="grid grid-cols-3 items-center gap-3 mb-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-4xl leading-none">
                {homeTeam?.flagEmoji ?? (seeds ? "🛡" : "🏳")}
              </span>
              <span className="text-sm font-bold leading-tight" style={{ color: homeTeam ? TEXT1 : "#7a5e14" }}>
                {homeTeam?.name ?? seeds?.home ?? "TBD"}
              </span>
              {homeTeam && seeds?.home && (
                <SeedPill label={seeds.home} />
              )}
            </div>

            <div className="flex flex-col items-center gap-1">
              {(done || fixture.status === "live") && fixture.homeScore !== null ? (
                <div className="text-center">
                  <p className="text-2xl font-black tabular-nums" style={{ color: fixture.status === "live" ? "#e53e3e" : TEXT1 }}>
                    {fixture.status === "live" && <span className="text-sm align-middle">● </span>}{fixture.homeScore}–{fixture.awayScore}
                  </p>
                  <p className="text-[10px] uppercase font-semibold" style={{ color: fixture.status === "live" ? "#e53e3e" : MUTED }}>{fixture.status === "live" ? "Live" : "Final"}</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: GREEN }}>vs</p>
                  <p className="text-[10px] mt-1" style={{ color: MUTED }}>
                    {open ? countdown : "Kicked off"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-4xl leading-none">
                {awayTeam?.flagEmoji ?? (seeds ? "🛡" : "🏳")}
              </span>
              <span className="text-sm font-bold leading-tight" style={{ color: awayTeam ? TEXT1 : "#7a5e14" }}>
                {awayTeam?.name ?? seeds?.away ?? "TBD"}
              </span>
              {awayTeam && seeds?.away && (
                <SeedPill label={seeds.away} />
              )}
            </div>
          </div>

          {/* Kickoff */}
          <p className="text-xs text-center" style={{ color: MUTED }}>
            {formatKickoff(fixture.kicksOffAt)}
          </p>
        </div>

        {/* Result */}
        {done && hasPred && fixture.myPrediction!.pointsAwarded !== null && (
          <PointsResult pts={fixture.myPrediction!.pointsAwarded} />
        )}

        {/* Not signed in */}
        {!user && (
          <div className="p-5 text-center flex flex-col gap-3 rounded-xl"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-semibold text-sm" style={{ color: TEXT1 }}>Sign in to predict</p>
            <p className="text-sm" style={{ color: TEXT2 }}>Save your prediction and track your score on the leaderboard.</p>
            <Link href="/login" className="py-2.5 rounded-lg font-bold text-sm w-full flex items-center justify-center"
              style={{ background: GREEN, color: "#fff" }}>
              Sign in free →
            </Link>
          </div>
        )}

        {/* Locked — match started */}
        {user && !open && !done && (
          <div className="p-4 text-center rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
              🔒 Prediction locked — match has started
            </p>
            {hasPred && (
              <p className="text-sm mt-2" style={{ color: TEXT2 }}>
                Your prediction: <span className="font-bold" style={{ color: TEXT1 }}>{fixture.myPrediction!.homeScore}–{fixture.myPrediction!.awayScore}</span>
              </p>
            )}
          </div>
        )}

        {/* Prediction form */}
        {user && open && (
          <div className="p-5 flex flex-col gap-5 rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: GREEN }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: GREEN }}>
                {hasPred ? "Edit your prediction" : "Enter your prediction"}
              </p>
            </div>

            {/* Score spinners */}
            <div className="flex items-center justify-center gap-6">
              <ScoreInput value={homeScore} onChange={setHomeScore} label={homeTeam?.name ?? seeds?.home ?? "Home"} disabled={saving} />
              <span className="text-2xl font-bold mt-6" style={{ color: BORDER }}>–</span>
              <ScoreInput value={awayScore} onChange={setAwayScore} label={awayTeam?.name ?? seeds?.away ?? "Away"} disabled={saving} />
            </div>

            {/* Outcome hint */}
            <p className="text-center text-xs" style={{ color: MUTED }}>
              {homeScore > awayScore
                ? `${homeTeam?.name ?? seeds?.home ?? "Home"} win`
                : awayScore > homeScore
                ? `${awayTeam?.name ?? seeds?.away ?? "Away"} win`
                : "Draw"}
              {" · "}Exact score = 5 pts · Correct GD = 3 pts · Correct result = 2 pts
            </p>

            {error && <p className="text-red-600 text-xs text-center">{error}</p>}

            {saved && !error && (
              <p className="text-xs text-center font-semibold" style={{ color: GREEN }}>
                ✓ Prediction saved — {homeScore}–{awayScore}
              </p>
            )}

            <button
              onClick={handleSubmit} disabled={saving}
              className="py-3.5 rounded-lg font-bold text-sm w-full flex items-center justify-center gap-2"
              style={{ background: GREEN, color: "#fff" }}
            >
              {saving ? "Saving…" : hasPred ? "Update prediction" : "Save prediction →"}
            </button>

            <p className="text-[10px] text-center" style={{ color: MUTED }}>
              Locks at kickoff · {countdown} remaining
            </p>
          </div>
        )}

        {/* Done, no prediction */}
        {done && !hasPred && (
          <div className="p-4 text-center rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm" style={{ color: MUTED }}>You didn&apos;t predict this match.</p>
          </div>
        )}

        <Link href={`/${competitionSlug}`} className="text-xs text-center hover:underline" style={{ color: MUTED }}>
          ← Back to all fixtures
        </Link>
      </div>
    </div>
  );
}
