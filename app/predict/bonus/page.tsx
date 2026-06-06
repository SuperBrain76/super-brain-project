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
  type Competition,
  type Team,
  type BonusQuestion,
  type BonusPrediction,
} from "@/lib/predictor";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const NAVY   = "#0e1e35";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Question metadata ─────────────────────────────────────────
const BONUS_META: Record<string, { icon: string; hint: string }> = {
  winner:        { icon: "🏆", hint: "Which team will lift the trophy?" },
  runner_up:     { icon: "🥈", hint: "Which team will reach the final but lose?" },
  golden_boot:   { icon: "👟", hint: "Which player will score the most goals?" },
  most_goals:    { icon: "⚽", hint: "Which team will score the most goals overall?" },
  best_defence:  { icon: "🛡️", hint: "Which team will concede the fewest goals?" },
  surprise_team: { icon: "⭐", hint: "Highest finishing team ranked outside FIFA Top 20 before the tournament." },
};

// ── Breadcrumb ────────────────────────────────────────────────
function Crumb({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
      <Link href="/predict" style={{ color: MUTED }} className="hover:underline">Predictor</Link>
      <span>/</span>
      <span style={{ color: TEXT2, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────
function StatusPill({ status }: { status: BonusQuestion["status"] }) {
  const map = {
    open:     { label: "Open",     color: GREEN,    bg: "#eef3ec" },
    locked:   { label: "Locked",   color: "#92400e", bg: "#fef3c7" },
    answered: { label: "Answered", color: GOLD,     bg: "#fdf6e3" },
  };
  const m = map[status];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

// ── Team select ───────────────────────────────────────────────
function TeamSelect({
  teams, value, onChange, disabled,
}: {
  teams: Team[]; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: BG, border: `1px solid ${BORDER}`,
        color: TEXT1,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <option value="">— Select a team —</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.flagEmoji ?? ""} {t.name}</option>
      ))}
    </select>
  );
}

// ── Question card ─────────────────────────────────────────────
function QuestionCard({
  question, prediction, teams, teamsMap, onSave,
}: {
  question:   BonusQuestion;
  prediction: BonusPrediction | undefined;
  teams:      Team[];
  teamsMap:   Map<string, Team>;
  onSave:     (qId: string, teamId: string | null, text: string | null) => Promise<void>;
}) {
  const meta = BONUS_META[question.questionKey] ?? { icon: "❓", hint: "" };

  const [teamId,    setTeamId]    = useState(prediction?.answerTeamId ?? "");
  const [text,      setText]      = useState(prediction?.answerText   ?? "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setTeamId(prediction?.answerTeamId ?? "");
    setText(prediction?.answerText     ?? "");
  }, [prediction?.answerTeamId, prediction?.answerText]);

  const open   = question.status === "open" && new Date(question.locksAt) > new Date();
  const done   = question.status === "answered";
  const locked = question.status === "locked";
  const pts    = prediction?.pointsAwarded;

  const handleSave = async () => {
    const tId   = question.answerType === "team"   ? (teamId || null) : null;
    const tText = question.answerType === "player" ? (text.trim() || null) : null;
    if (question.answerType === "team"   && !tId)   { setError("Please select a team."); return; }
    if (question.answerType === "player" && !tText) { setError("Please enter a player name."); return; }
    setSaving(true); setError(null);
    await onSave(question.id, tId, tText);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const myTeam   = teamsMap.get(prediction?.answerTeamId ?? "");
  const corrTeam = question.correctTeam;

  // Border accent by state
  const borderLeft =
    done && pts === question.pointsValue ? `3px solid ${GOLD}` :
    done && (pts ?? 0) > 0               ? `3px solid ${GREEN}` :
    open && prediction                    ? `3px solid ${GREEN}` :
    "3px solid transparent";

  return (
    <div
      className="rounded-xl flex flex-col gap-3 p-4"
      style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xl"
            style={{ background: "#f0f3ef" }}>
            {meta.icon}
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight" style={{ color: TEXT1 }}>
              {question.questionText}
            </p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>{meta.hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            {question.pointsValue} pts
          </span>
          <StatusPill status={question.status} />
        </div>
      </div>

      {/* ── Answered: result block ────────────────────────── */}
      {done && (
        <div
          className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: BG, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: MUTED }}>
              Correct answer
            </p>
            {question.answerType === "team" && corrTeam ? (
              <p className="text-sm font-semibold" style={{ color: TEXT1 }}>
                {corrTeam.flagEmoji} {corrTeam.name}
              </p>
            ) : (
              <p className="text-sm font-semibold" style={{ color: TEXT1 }}>
                {question.correctAnswerText ?? "—"}
              </p>
            )}
          </div>
          {prediction && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                Your pick
              </p>
              {question.answerType === "team" && myTeam ? (
                <p className="text-sm" style={{ color: TEXT2 }}>{myTeam.flagEmoji} {myTeam.name}</p>
              ) : (
                <p className="text-sm" style={{ color: TEXT2 }}>{prediction.answerText ?? "—"}</p>
              )}
            </div>
          )}
          {pts !== null && pts !== undefined && (
            <div
              className="text-lg font-black shrink-0"
              style={{ color: pts === question.pointsValue ? GOLD : pts > 0 ? GREEN : MUTED }}
            >
              {pts === question.pointsValue ? `+${pts} pts ⚡` :
               pts > 0                       ? `+${pts} pts ✓`  :
               !prediction                   ? "—"              :
               "0 pts ✗"}
            </div>
          )}
          {!prediction && (
            <p className="text-xs" style={{ color: MUTED }}>No prediction made</p>
          )}
        </div>
      )}

      {/* ── Locked: show my pick ─────────────────────────── */}
      {locked && (
        <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: "#fef9ee", color: "#92400e" }}>
          <span>🔒</span>
          {prediction ? (
            question.answerType === "team" && myTeam ? (
              <span>Your pick: <strong>{myTeam.flagEmoji} {myTeam.name}</strong></span>
            ) : (
              <span>Your pick: <strong>{prediction.answerText}</strong></span>
            )
          ) : (
            <span style={{ color: MUTED }}>No prediction submitted before deadline.</span>
          )}
        </div>
      )}

      {/* ── Open: prediction form ────────────────────────── */}
      {open && (
        <div className="flex flex-col gap-2">
          {question.answerType === "team" ? (
            <TeamSelect teams={teams} value={teamId} onChange={setTeamId} disabled={saving} />
          ) : (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter player name…"
              disabled={saving}
              className="rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors disabled:opacity-50"
              style={{
                background: BG, border: `1px solid ${BORDER}`, color: TEXT1,
              }}
            />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: GREEN, color: "#fff" }}
            >
              {saving ? "Saving…" : justSaved ? "✓ Saved" : prediction ? "Update" : "Save prediction"}
            </button>
            {prediction && !saving && !justSaved && (
              <span className="text-xs" style={{ color: MUTED }}>
                {question.answerType === "team" && myTeam
                  ? `Current: ${myTeam.flagEmoji} ${myTeam.name}`
                  : `Current: ${prediction.answerText}`}
              </span>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
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

  const teamsMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const predMap  = useMemo(() => new Map(predictions.map((p) => [p.questionId, p])), [predictions]);

  useEffect(() => {
    async function load() {
      const { competition: comp, error: compErr } = await getCompetition("wc2026");
      if (compErr || !comp) { setError(compErr ?? "Competition not found."); setLoading(false); return; }
      setCompetition(comp);
      const [qs, ts] = await Promise.all([getBonusQuestions(comp.id), getTeams(comp.id)]);
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

  const handleSave = useCallback(async (questionId: string, teamId: string | null, text: string | null) => {
    const { error: err } = await upsertBonusPrediction(questionId, teamId, text);
    if (err) { alert(err); return; }
    const newPred: BonusPrediction = {
      id: crypto.randomUUID(), userId: user?.id ?? "", questionId,
      answerTeamId: teamId, answerText: text,
      pointsAwarded: null, submittedAt: new Date().toISOString(),
    };
    setPredictions((prev) => [...prev.filter((p) => p.questionId !== questionId), newPred]);
  }, [user]);

  const now        = new Date();
  const openCount  = questions.filter((q) => q.status === "open" && new Date(q.locksAt) > now).length;
  const savedCount = predictions.filter((p) => {
    const q = questions.find((q) => q.id === p.questionId);
    return q?.status === "open" || q?.status === "locked";
  }).length;
  const earnedPts = predictions.reduce((s, p) => s + (p.pointsAwarded ?? 0), 0);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading bonus questions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        <Crumb label="Bonus Questions" />

        {/* Header */}
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT1 }}>Bonus Questions</h1>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: TEXT2 }}>
            Earn up to <span className="font-semibold" style={{ color: GOLD }}>75 bonus points</span> by
            predicting tournament-wide outcomes. Questions lock individually — check the status of each.
          </p>
        </div>

        {/* Stats strip */}
        {user && (
          <div
            className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />
              <span className="text-xs" style={{ color: TEXT2 }}>
                <span className="font-bold" style={{ color: TEXT1 }}>{savedCount}</span> / {questions.length} predicted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
              <span className="text-xs" style={{ color: TEXT2 }}>
                <span className="font-bold" style={{ color: TEXT1 }}>{openCount}</span> still open
              </span>
            </div>
            {earnedPts > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="font-black text-sm" style={{ color: GOLD }}>+{earnedPts} pts</span>
                <span className="text-xs" style={{ color: MUTED }}>earned so far</span>
              </div>
            )}
          </div>
        )}

        {/* Guest gate */}
        {!user && (
          <div
            className="rounded-xl p-5 flex flex-col gap-3 text-center"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <p className="font-semibold" style={{ color: TEXT1 }}>Sign in to make bonus predictions</p>
            <p className="text-sm" style={{ color: TEXT2 }}>Earn up to 75 extra points beyond your match predictions.</p>
            <Link
              href="/login"
              className="font-bold text-sm py-3 rounded-xl"
              style={{ background: GREEN, color: "#fff", display: "block" }}
            >
              Sign in free →
            </Link>
          </div>
        )}

        {/* Points guide chips */}
        {questions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {questions.map((q) => {
              const m = BONUS_META[q.questionKey];
              return (
                <span
                  key={q.id}
                  className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}
                >
                  {m?.icon} {q.pointsValue} pts
                </span>
              );
            })}
          </div>
        )}

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

        <Link href="/predict" className="text-xs text-center hover:underline" style={{ color: MUTED }}>
          ← Back to predictor
        </Link>
      </div>
    </div>
  );
}
