"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getCompetition,
  getTeams,
  getBonusQuestions,
  getMyBonusPredictions,
  upsertBonusPrediction,
  pointsColor,
  type Competition,
  type Team,
  type BonusQuestion,
  type BonusPrediction,
} from "@/lib/predictor";

// ── Question metadata ─────────────────────────────────────────

const BONUS_META: Record<string, { icon: string; hint: string }> = {
  winner:        { icon: "🏆", hint: "Which team will lift the trophy?" },
  runner_up:     { icon: "🥈", hint: "Which team will reach the final but lose?" },
  golden_boot:   { icon: "👟", hint: "Which player will score the most goals?" },
  most_goals:    { icon: "⚽", hint: "Which team will score the most goals overall?" },
  best_defence:  { icon: "🛡️", hint: "Which team will concede the fewest goals?" },
  surprise_team: { icon: "⭐", hint: "Highest finishing team ranked outside FIFA Top 20 immediately before the tournament begins." },
};

// ── Status pill ───────────────────────────────────────────────

function StatusPill({ status }: { status: BonusQuestion["status"] }) {
  const map = {
    open:     { label: "Open",     color: "#00e676", bg: "#00e67615" },
    locked:   { label: "Locked",   color: "#ffab00", bg: "#ffab0015" },
    answered: { label: "Answered", color: "#00d4ff", bg: "#00d4ff15" },
  };
  const m = map[status];
  return (
    <span
      className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-sm"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

// ── Team select ───────────────────────────────────────────────

function TeamSelect({
  teams,
  value,
  onChange,
  disabled,
}: {
  teams:    Team[];
  value:    string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex-1 bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— Select a team —</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.flagEmoji ?? ""} {t.name}
        </option>
      ))}
    </select>
  );
}

// ── Question card ─────────────────────────────────────────────

function QuestionCard({
  question,
  prediction,
  teams,
  teamsMap,
  onSave,
}: {
  question:   BonusQuestion;
  prediction: BonusPrediction | undefined;
  teams:      Team[];
  teamsMap:   Map<string, Team>;
  onSave:     (qId: string, teamId: string | null, text: string | null) => Promise<void>;
}) {
  const meta = BONUS_META[question.questionKey] ?? { icon: "❓", hint: "" };

  // Form state
  const [teamId,   setTeamId]   = useState(prediction?.answerTeamId  ?? "");
  const [text,     setText]     = useState(prediction?.answerText     ?? "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [justSaved,setJustSaved]= useState(false);

  // Sync if parent reloads prediction
  useEffect(() => {
    setTeamId(prediction?.answerTeamId  ?? "");
    setText(prediction?.answerText      ?? "");
  }, [prediction?.answerTeamId, prediction?.answerText]);

  // Double-gate: status must be 'open' AND we must be before locks_at.
  // Mirrors the server-side check in upsert_bonus_prediction RPC.
  const open   = question.status === "open" && new Date(question.locksAt) > new Date();
  const done   = question.status === "answered";
  const locked = question.status === "locked";
  const pts    = prediction?.pointsAwarded;

  const handleSave = async () => {
    const tId   = question.answerType === "team"   ? (teamId || null) : null;
    const tText = question.answerType === "player" ? (text.trim() || null) : null;
    if (question.answerType === "team"   && !tId)    { setError("Please select a team."); return; }
    if (question.answerType === "player" && !tText)  { setError("Please enter a player name."); return; }
    setSaving(true); setError(null);
    await onSave(question.id, tId, tText);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const myTeam   = teamsMap.get(prediction?.answerTeamId ?? "");
  const corrTeam = question.correctTeam;

  return (
    <div
      className="bg-cockpit-card border rounded-sm p-4 flex flex-col gap-3"
      style={{
        borderColor: done && pts === question.pointsValue ? "#00e67630" :
                     done && (pts ?? 0) > 0               ? "#00d4ff25" :
                     done                                  ? "#1e2a38"   :
                     locked                                ? "#ffab0025" :
                     "#1e2a38",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none shrink-0">{meta.icon}</span>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">
              {question.questionText}
            </p>
            <p className="text-cockpit-muted text-xs mt-0.5">{meta.hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold font-mono text-cockpit-accent">
            {question.pointsValue} pts
          </span>
          <StatusPill status={question.status} />
        </div>
      </div>

      {/* ── Answered: show result ──────────────────────── */}
      {done && (
        <div
          className="rounded-sm p-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: "#0d1117", border: "1px solid #1e2a38" }}
        >
          <div>
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-1">
              Correct answer
            </p>
            {question.answerType === "team" && corrTeam ? (
              <p className="text-white text-sm font-semibold">
                {corrTeam.flagEmoji} {corrTeam.name}
              </p>
            ) : (
              <p className="text-white text-sm font-semibold">
                {question.correctAnswerText ?? "—"}
              </p>
            )}
          </div>
          {prediction && (
            <div className="text-right">
              <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-1">
                Your pick
              </p>
              {question.answerType === "team" && myTeam ? (
                <p className="text-cockpit-dim text-sm">{myTeam.flagEmoji} {myTeam.name}</p>
              ) : (
                <p className="text-cockpit-dim text-sm">{prediction.answerText ?? "—"}</p>
              )}
            </div>
          )}
          {pts !== null && pts !== undefined && (
            <div
              className="text-lg font-black number-display shrink-0"
              style={{ color: pointsColor(pts === question.pointsValue ? 5 : pts > 0 ? 3 : 0) }}
            >
              {pts === question.pointsValue ? `+${pts} pts ⚡` :
               pts > 0                       ? `+${pts} pts ✓` :
               !prediction                   ? "—"             :
               "0 pts ✗"}
            </div>
          )}
          {!prediction && (
            <p className="text-cockpit-muted text-xs">No prediction made</p>
          )}
        </div>
      )}

      {/* ── Locked: show my pick ──────────────────────── */}
      {locked && (
        <div className="flex items-center gap-2 text-cockpit-muted text-sm">
          <span>🔒</span>
          {prediction ? (
            question.answerType === "team" && myTeam ? (
              <span>Your pick: <span className="text-cockpit-dim font-semibold">{myTeam.flagEmoji} {myTeam.name}</span></span>
            ) : (
              <span>Your pick: <span className="text-cockpit-dim font-semibold">{prediction.answerText}</span></span>
            )
          ) : (
            <span>No prediction submitted before deadline.</span>
          )}
        </div>
      )}

      {/* ── Open: prediction form ─────────────────────── */}
      {open && (
        <div className="flex flex-col gap-2">
          {question.answerType === "team" ? (
            <TeamSelect
              teams={teams}
              value={teamId}
              onChange={setTeamId}
              disabled={saving}
            />
          ) : (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter player name…"
              disabled={saving}
              className="bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent transition-colors disabled:opacity-50 placeholder:text-cockpit-muted"
            />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm py-2 px-5 disabled:opacity-40"
            >
              {saving ? "Saving…" : justSaved ? "✓ Saved" : prediction ? "Update" : "Save"}
            </button>
            {prediction && !saving && !justSaved && (
              <span className="text-cockpit-muted text-xs font-mono">
                {question.answerType === "team" && myTeam
                  ? `Current: ${myTeam.flagEmoji} ${myTeam.name}`
                  : `Current: ${prediction.answerText}`}
              </span>
            )}
          </div>
          {error && <p className="text-cockpit-red text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function BonusPage() {
  const { user, loading: authLoading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams,       setTeams]       = useState<Team[]>([]);
  const [questions,   setQuestions]   = useState<BonusQuestion[]>([]);
  const [predictions, setPredictions] = useState<BonusPrediction[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const teamsMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  const predMap = useMemo(
    () => new Map(predictions.map((p) => [p.questionId, p])),
    [predictions],
  );

  useEffect(() => {
    async function load() {
      const { competition: comp, error: compErr } = await getCompetition("wc2026");
      if (compErr || !comp) { setError(compErr ?? "Competition not found."); setLoading(false); return; }
      setCompetition(comp);

      const [qs, ts] = await Promise.all([
        getBonusQuestions(comp.id),
        getTeams(comp.id),
      ]);
      setQuestions(qs);
      setTeams(ts);

      if (user && qs.length > 0) {
        const preds = await getMyBonusPredictions(qs.map((q) => q.id));
        setPredictions(preds);
      }

      setLoading(false);
    }
    if (!authLoading) load();
  }, [authLoading, user]);

  const handleSave = useCallback(async (
    questionId: string,
    teamId:     string | null,
    text:       string | null,
  ) => {
    const { error: err } = await upsertBonusPrediction(questionId, teamId, text);
    if (err) { alert(err); return; }
    // Refresh prediction for this question
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;
    const newPred: BonusPrediction = {
      id:            crypto.randomUUID(),
      userId:        user?.id ?? "",
      questionId,
      answerTeamId:  teamId,
      answerText:    text,
      pointsAwarded: null,
      submittedAt:   new Date().toISOString(),
    };
    setPredictions((prev) => {
      const without = prev.filter((p) => p.questionId !== questionId);
      return [...without, newPred];
    });
  }, [questions, user]);

  const now = new Date();
  const openCount = questions.filter(
    (q) => q.status === "open" && new Date(q.locksAt) > now,
  ).length;
  const savedCount  = predictions.filter((p) => {
    const q = questions.find((q) => q.id === p.questionId);
    return q?.status === "open" || q?.status === "locked";
  }).length;
  const earnedPts   = predictions.reduce((s, p) => s + (p.pointsAwarded ?? 0), 0);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading bonus questions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-cockpit-red text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono">
          <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
          <span>/</span>
          <span className="text-cockpit-dim">Bonus Questions</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Bonus Questions</h1>
          <p className="text-cockpit-dim text-sm mt-1 leading-relaxed">
            Earn up to <span className="text-white font-semibold">75 bonus points</span> by
            predicting tournament-wide outcomes. All questions lock when the first match kicks off.
          </p>
        </div>

        {/* Stats strip */}
        {user && (
          <div className="flex items-center gap-4 px-4 py-3 bg-cockpit-surface border border-cockpit-border rounded-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cockpit-accent" />
              <span className="text-cockpit-dim text-xs">
                <span className="text-white font-semibold">{savedCount}</span> / {questions.length} predicted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green" />
              <span className="text-cockpit-dim text-xs">
                <span className="text-white font-semibold">{openCount}</span> still open
              </span>
            </div>
            {earnedPts > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-cockpit-accent font-black number-display text-sm">+{earnedPts} pts</span>
                <span className="text-cockpit-muted text-xs">earned</span>
              </div>
            )}
          </div>
        )}

        {/* Guest gate */}
        {!user && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-3 text-center">
            <p className="text-white font-semibold">Sign in to make bonus predictions</p>
            <p className="text-cockpit-dim text-sm">Earn up to 75 extra points beyond your match predictions.</p>
            <Link href="/login" className="btn-primary w-full flex items-center justify-center">
              Sign in free →
            </Link>
          </div>
        )}

        {/* Scoring guide */}
        <div className="flex flex-wrap gap-2">
          {questions.map((q) => {
            const m = BONUS_META[q.questionKey];
            return (
              <span
                key={q.id}
                className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-sm border border-cockpit-border text-cockpit-muted"
              >
                {m?.icon} {q.pointsValue} pts
              </span>
            );
          })}
        </div>

        {/* Question cards */}
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              prediction={predMap.get(q.id)}
              teams={teams}
              teamsMap={teamsMap}
              onSave={handleSave}
            />
          ))}
        </div>

        <Link href="/predict" className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono">
          ← Back to predictor
        </Link>
      </div>
    </div>
  );
}
