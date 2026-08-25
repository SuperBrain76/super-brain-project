/**
 * lib/outreachRanking.ts — the one definition of outreach selection order.
 *
 * The route previously ordered by fit_score alone. With venues tied on score,
 * Postgres returned whatever row order it liked, so the dry run and the real
 * push disagreed: an approved roster was reviewed, then a different set of
 * venues was pushed. Nothing was sent — the campaign was still paused — but the
 * defect would have contacted businesses that were never approved.
 *
 * Ordering is therefore decided HERE, in JavaScript, not by the database. The
 * DB order clauses below are an optimisation only; rankVenues() is what actually
 * decides, and both the dry run and the real push call it on the same code path.
 */

export interface RankableVenue {
  id: string;
  name: string | null;
  fit_score: number | null;
  shows_live_sport?: boolean | null;
}

/**
 * Column order handed to the query builder. Kept in step with compareVenues so
 * the database returns rows already close to final order; correctness does not
 * depend on it.
 */
export const SELECTION_ORDER = [
  { column: "fit_score",        ascending: false },
  { column: "shows_live_sport", ascending: false },
  { column: "name",             ascending: true  },
  { column: "id",               ascending: true  },
] as const;

/** Deterministic, locale-independent string compare. localeCompare varies by ICU. */
function byBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The approved ranking, in priority order:
 *   1. fit_score            — the qualification score, highest first
 *   2. shows_live_sport     — a venue that demonstrably shows live sport first
 *   3. name                 — stable, human-checkable
 *   4. id                   — final tie-break; unique, so ordering is total
 *
 * Nulls sort last within their tier rather than winning by accident.
 */
export function compareVenues(a: RankableVenue, b: RankableVenue): number {
  const score = (v: RankableVenue) => (typeof v.fit_score === "number" ? v.fit_score : -Infinity);
  if (score(a) !== score(b)) return score(b) - score(a);

  const sport = (v: RankableVenue) => (v.shows_live_sport === true ? 1 : 0);
  if (sport(a) !== sport(b)) return sport(b) - sport(a);

  const name = (v: RankableVenue) => (v.name ?? "");
  const byName = byBytes(name(a), name(b));
  if (byName !== 0) return byName;

  return byBytes(a.id, b.id);
}

/**
 * Sort a candidate set into selection order. Total ordering, so the result is
 * identical no matter what order the rows arrived in.
 */
export function rankVenues<T extends RankableVenue>(venues: readonly T[]): T[] {
  return [...venues].sort(compareVenues);
}

/** Rank, then take the first `limit`. The single entry point for both paths. */
export function selectForOutreach<T extends RankableVenue>(venues: readonly T[], limit: number): T[] {
  return rankVenues(venues).slice(0, Math.max(0, limit));
}
