"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  resolveCompetition,
  getTeams,
  getBonusQuestions,
  adminLockBonusQuestion,
  adminSetBonusAnswer,
  type Competition,
  type Team,
  type BonusQuestion,
} from "@/lib/predictor";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const BONUS_META: Record<string, { icon: string }> = {
  winner:        { icon: "🏆" },
  runner_up:     { icon: "🥈" },
  golden_boot:   { icon: "👟" },
  most_goals:    { icon: "⚽" },
  best_defence:  { icon: "🛡️" },
  surprise_team: { icon: "⭐" },
};

// ── Question admin row ────────────────────────────────────────

function QuestionRow({
  question,
  teams,
  teamsMap,
  onUpdated,
}: {
  question:  BonusQuestion;
  teams:     Team[];
  teamsMap:  Map<string, Team>;
  onUpdated: (q: BonusQuestion) => void;
}) {
  const meta = BONUS_META[question.questionKey] ?? { icon: "❓" };

  const [expanded,    setExpanded]    = useState(false);
  const [teamId,      setTeamId]      = useState(question.correctTeamId ?? "");
  const [answerText,  setAnswerText]  = useState(question.correctAnswerText ?? "");
  const [locking,     setLocking]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState<{ text: string; ok: boolean } | null>(null);
  const [predCount,   setPredCount]   = useState<number | null>(null);

  useEffect(() => {
    if (!expanded) return;
    supabase
      .from("bonus_predictions")
      .select("*", { count: "exact", head: true })
      .eq("question_id", question.id)
      .then(({ count }) => setPredCount(count ?? 0));
  }, [expanded, question.id]);

  const corrTeam = teamsMap.get(question.correctTeamId ?? "");

  const handleLock = async () => {
    setLocking(true); setMsg(null);
    const { error } = await adminLockBonusQuestion(question.id);
    setLocking(false);
    if (error) { setMsg({ text: error, ok: false }); return; }
    setMsg({ text: "Question locked. Predictions are now closed.", ok: true });
    onUpdated({ ...question, status: "locked" });
  };

  const handleSave = async () => {
    const tId = question.answerType === "team" ? (teamId || null) : null;
    const txt  = question.answerType === "player" ? (answerText.trim() || null) : null;
    if (question.answerType === "team"   && !tId)  { setMsg({ text: "Select a team.", ok: false }); return; }
    if (question.answerType === "player" && !txt)  { setMsg({ text: "Enter a player name.", ok: false }); return; }

    setSaving(true); setMsg(null);
    const { updated, error } = await adminSetBonusAnswer(question.id, tId, txt);
    setSaving(false);

    if (error) { setMsg({ text: error, ok: false }); return; }
    setMsg({ text: `Answered. ${updated} prediction${updated !== 1 ? "s" : ""} scored.`, ok: true });

    const corrT = tId ? teams.find((t) => t.id === tId) ?? null : null;
    onUpdated({
      ...question,
      status:             "answered",
      correctTeamId:      tId,
      correctAnswerText:  txt,
      correctTeam:        corrT,
    });
  };

  const statusColors = {
    open:     "#00e676",
    locked:   "#ffab00",
    answered: "#00d4ff",
  };

  return (
    <div className="border-b border-cockpit-border last:border-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cockpit-surface transition-colors"
      >
        <span className="text-xl shrink-0">{meta.icon}</span>
        <span className="flex-1 text-white text-sm font-semibold">{question.questionText}</span>
        <span
          className="text-[10px] font-bold font-mono shrink-0"
          style={{ color: statusColors[question.status] }}
        >
          {question.status.toUpperCase()}
        </span>
        <span className="text-cockpit-muted text-xs font-mono shrink-0 hidden sm:block">
          {question.pointsValue} pts
        </span>
        {question.status === "answered" && corrTeam && (
          <span className="text-cockpit-dim text-xs shrink-0 hidden sm:block">
            {corrTeam.flagEmoji} {corrTeam.name}
          </span>
        )}
        {question.status === "answered" && question.answerType === "player" && (
          <span className="text-cockpit-dim text-xs shrink-0 hidden sm:block">
            {question.correctAnswerText}
          </span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#8899aa" strokeWidth="2.5"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-cockpit-surface flex flex-col gap-3">
          {predCount !== null && (
            <p className="text-cockpit-muted text-xs font-mono">
              {predCount} prediction{predCount !== 1 ? "s" : ""} submitted
            </p>
          )}

          {/* Lock button */}
          {question.status === "open" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleLock}
                disabled={locking}
                className="btn-ghost text-sm text-cockpit-amber border-cockpit-amber border-opacity-40 hover:border-opacity-80"
              >
                {locking ? "Locking…" : "🔒 Lock predictions"}
              </button>
              <p className="text-cockpit-muted text-xs">Prevents further predictions without setting the answer.</p>
            </div>
          )}

          {/* Answer form */}
          {(question.status === "locked" || question.status === "answered") && (
            <div className="flex flex-col gap-2">
              <p className="text-cockpit-muted text-xs font-mono uppercase tracking-widest">
                {question.status === "answered" ? "Update answer + rescore" : "Set correct answer"}
              </p>

              {question.answerType === "team" ? (
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="bg-cockpit-card border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
                >
                  <option value="">— Select the correct team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.flagEmoji ?? ""} {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="e.g. Kylian Mbappé"
                    className="bg-cockpit-card border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent placeholder:text-cockpit-muted"
                  />
                  <p className="text-cockpit-muted text-[10px] font-mono">
                    Matching is case-insensitive. Enter the name exactly as users are likely to type it.
                  </p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm py-2 self-start"
              >
                {saving ? "Saving…" : question.status === "answered" ? "Update & Rescore" : "Set Answer & Score →"}
              </button>
            </div>
          )}

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-cockpit-green" : "text-cockpit-red"}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function AdminBonusPage() {
  const { user, loading: authLoading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams,       setTeams]       = useState<Team[]>([]);
  const [questions,   setQuestions]   = useState<BonusQuestion[]>([]);
  const [loading,     setLoading]     = useState(true);

  const isAdmin = !!ADMIN_EMAIL && user?.email === ADMIN_EMAIL;

  const teamsMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      const { competition: comp } = await resolveCompetition();
      if (!comp) { setLoading(false); return; }
      setCompetition(comp);
      const [qs, ts] = await Promise.all([
        getBonusQuestions(comp.id),
        getTeams(comp.id),
      ]);
      setQuestions(qs);
      setTeams(ts);
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  const handleUpdated = (updated: BonusQuestion) => {
    setQuestions((prev) => prev.map((q) => q.id === updated.id ? updated : q));
  };

  const totalPts   = questions.reduce((s, q) => s + q.pointsValue, 0);
  const answeredN  = questions.filter((q) => q.status === "answered").length;

  if (authLoading) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-4">
        <p className="text-cockpit-red text-sm">Access denied.</p>
        <Link href="/" className="text-cockpit-accent text-sm hover:underline">← Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-4 py-8 w-full">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-2">
              <Link href="/admin" className="hover:text-cockpit-dim">Admin</Link>
              <span>/</span>
              <span className="text-cockpit-dim">Bonus Questions</span>
            </div>
            <h1 className="text-xl font-bold text-white">Bonus Questions</h1>
            <p className="text-cockpit-muted text-xs mt-1">
              Lock questions before the tournament starts. Enter answers after the tournament ends.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse" />
            <span className="text-cockpit-muted text-xs font-mono">{user.email}</span>
          </div>
        </div>

        {/* Stats */}
        {!loading && questions.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Questions",  value: questions.length,  color: "#00d4ff" },
              { label: "Answered",   value: answeredN,          color: "#00e676" },
              { label: "Max Bonus",  value: `${totalPts} pts`,  color: "#ffab00" },
            ].map((s) => (
              <div key={s.label} className="bg-cockpit-card border border-cockpit-border rounded-sm p-3 text-center">
                <div className="text-xl font-bold number-display" style={{ color: s.color }}>{s.value}</div>
                <div className="text-cockpit-muted text-xs uppercase tracking-widest mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Workflow guide */}
        <div className="bg-cockpit-surface border border-cockpit-border rounded-sm p-4 mb-5">
          <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-2">Workflow</p>
          <div className="flex flex-col gap-1">
            {[
              { step: "1", text: "Before June 11: Lock all open questions to close predictions.", color: "#00e676" },
              { step: "2", text: "After the tournament: expand each question and set the correct answer.", color: "#00d4ff" },
              { step: "3", text: 'Clicking "Set Answer" automatically scores all user predictions.', color: "#ffab00" },
              { step: "4", text: 'If you correct an answer, click "Update & Rescore" — it rescores everything.', color: "#ff6d00" },
            ].map((r) => (
              <div key={r.step} className="flex items-start gap-2">
                <span
                  className="w-5 h-5 rounded-sm text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5"
                  style={{ color: r.color, background: `${r.color}15` }}
                >
                  {r.step}
                </span>
                <p className="text-cockpit-dim text-xs leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Question list */}
        {loading ? (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-10 text-center">
            <p className="text-cockpit-dim text-sm animate-pulse">Loading questions…</p>
          </div>
        ) : (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
            {questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                teams={teams}
                teamsMap={teamsMap}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
