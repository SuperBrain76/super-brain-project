/**
 * lib/streak.ts — the prediction streak.
 *
 * From a per-matchweek "did you predict?" list, work out the current streak
 * (consecutive matchweeks predicted, ending at the most recent one you played)
 * and the longest ever. Future matchweeks you simply haven't reached don't
 * break it — only skipping a week you could have played does.
 */

export interface RoundParticipation {
  sort_order: number;
  predicted:  boolean;
}

export interface Streak {
  current: number;
  longest: number;
}

export function computeStreak(rows: RoundParticipation[]): Streak {
  const ordered = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  let longest = 0, run = 0, lastPredicted = -1;
  ordered.forEach((r, i) => {
    if (r.predicted) { run++; longest = Math.max(longest, run); lastPredicted = i; }
    else run = 0;
  });

  // Current = consecutive predicted rounds ending at the most recent one played.
  let current = 0;
  for (let i = lastPredicted; i >= 0 && ordered[i].predicted; i--) current++;

  return { current, longest };
}
