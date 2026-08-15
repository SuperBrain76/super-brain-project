/**
 * lib/sports.ts — client-side sport metadata.
 *
 * The database `sports` table (migration 045) is the source of truth and holds
 * the same facts (has_draw, icon), but nothing read it into the UI. This is the
 * small read model the client uses to make the experience sport-aware:
 *   - hasDraw   → whether the predictor offers a "Draw" pick and the league
 *                 table shows a Drawn column. Ice hockey never ties (overtime /
 *                 shootout always decides), so both are suppressed.
 *   - icon/label → section headers on the Sports hub and landing.
 *
 * Keyed by `competitions.sport_code`. Anything unknown falls back to football,
 * which is how every existing competition behaved before this file existed.
 */

export interface SportMeta {
  code:    string;
  label:   string;
  icon:    string;    // emoji — no trademarked marks
  hasDraw: boolean;
}

export const SPORTS: Record<string, SportMeta> = {
  football:   { code: "football",   label: "Football",   icon: "⚽", hasDraw: true  },
  ice_hockey: { code: "ice_hockey", label: "Ice Hockey", icon: "🏒", hasDraw: false },
};

export const FOOTBALL = SPORTS.football;

/** Sport metadata for a competition's sport_code; football for anything unknown. */
export function sportOf(code: string | null | undefined): SportMeta {
  return (code && SPORTS[code]) || FOOTBALL;
}
