/**
 * Mulberry32 — fast, deterministic PRNG.
 * Returns a factory: call rng() to get [0,1).
 */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return function rng(): number {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random integer in [0, n) */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Shuffle a copy of an array in-place using given rng */
export function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick n distinct items from arr */
export function pick<T>(rng: () => number, arr: T[], n: number): T[] {
  return shuffle(rng, arr).slice(0, n);
}
