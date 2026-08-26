/**
 * lib/sports.ts — client-side sport metadata.
 *
 * The database `sports` table (migration 045) is the source of truth and holds
 * the same facts (has_draw, icon, max_score), but nothing read it into the UI.
 * This is the small read model the client uses to make the experience
 * sport-aware:
 *   - hasDraw   → whether the predictor offers a "Draw" pick and the league
 *                 table shows a Drawn column. Ice hockey never ties (overtime /
 *                 shootout always decides), so both are suppressed.
 *   - maxScore  → per-team score ceiling for the steppers; mirrors
 *                 sports.max_score, which the DB trigger enforces (072).
 *   - defaultScoreline → the stored score for a one-tap Home/Draw/Away pick.
 *                 Modal results for the sport, so a one-tap pick is a
 *                 defensible prediction, not a placeholder.
 *   - scoreNoun / cleanSheetLabel → terminology ("goals" vs "points").
 *   - icon/label → section headers on the Sports hub and landing.
 *
 * Keyed by `competitions.sport_code`. Anything unknown falls back to football,
 * which is how every existing competition behaved before this file existed.
 */

export interface SportScoreline {
  home: { home: number; away: number };
  draw: { home: number; away: number };
  away: { home: number; away: number };
}

export interface SportMeta {
  code:     string;
  label:    string;
  icon:     string;    // emoji — no trademarked marks
  /**
   * How predictions are expressed (mirrors fixtures.prediction_type):
   *   "score"    — home/away integers; MatchweekSheet, H/D/A, steppers.
   *   "ordering" — ranked top-5 entrants (F1); SessionOrderSheet, payload.
   * Every prediction surface MUST branch on this — rendering an ordering
   * sport through the score UI is the silent mis-render 045 warned about.
   */
  kind:     "score" | "ordering";
  hasDraw:  boolean;
  maxScore: number;    // mirrors sports.max_score (DB-enforced, migration 072)
  /** Stored score for a one-tap H/D/A pick — the sport's modal results. */
  defaultScoreline: SportScoreline;
  /** "Fill remaining" bulk default — the sport's single most defensible pick. */
  fillDefault: { home: number; away: number };
  scoreNoun: "goals" | "points";
  cleanSheetLabel: string;
}

export const SPORTS: Record<string, SportMeta> = {
  football: {
    code: "football", label: "Football", icon: "⚽", kind: "score", hasDraw: true, maxScore: 20,
    defaultScoreline: {
      home: { home: 1, away: 0 },   // 1-0 is the modal home win
      draw: { home: 1, away: 1 },   // 1-1 the modal draw
      away: { home: 0, away: 1 },   // 0-1 the modal away win
    },
    fillDefault: { home: 1, away: 1 },
    scoreNoun: "goals", cleanSheetLabel: "Clean Sheets",
  },
  ice_hockey: {
    code: "ice_hockey", label: "Ice Hockey", icon: "🏒", kind: "score", hasDraw: false, maxScore: 20,
    defaultScoreline: {
      home: { home: 3, away: 2 },
      draw: { home: 2, away: 2 },   // unreachable (hasDraw false) but keeps the shape total
      away: { home: 2, away: 3 },
    },
    fillDefault: { home: 2, away: 1 },
    scoreNoun: "goals", cleanSheetLabel: "Shutouts",
  },
  rugby: {
    code: "rugby", label: "Rugby", icon: "🏉", kind: "score", hasDraw: true, maxScore: 100,
    defaultScoreline: {
      home: { home: 24, away: 17 }, // one-converted-try margin, typical scoreline
      draw: { home: 20, away: 20 },
      away: { home: 17, away: 24 },
    },
    // Draws happen in ~1-2% of matches, so the bulk default is a home win,
    // not the draw football uses.
    fillDefault: { home: 24, away: 17 },
    scoreNoun: "points", cleanSheetLabel: "Shutouts",
  },
  motorsport: {
    code: "motorsport", label: "Formula 1", icon: "🏎️", kind: "ordering", hasDraw: false,
    // Score fields are structurally required but meaningless for an ordering
    // sport — no surface may read them (kind gates every prediction UI).
    maxScore: 20,
    defaultScoreline: {
      home: { home: 0, away: 0 },
      draw: { home: 0, away: 0 },
      away: { home: 0, away: 0 },
    },
    fillDefault: { home: 0, away: 0 },
    scoreNoun: "points", cleanSheetLabel: "Podiums",
  },
};

export const FOOTBALL = SPORTS.football;

/** Sport metadata for a competition's sport_code; football for anything unknown. */
export function sportOf(code: string | null | undefined): SportMeta {
  return (code && SPORTS[code]) || FOOTBALL;
}
