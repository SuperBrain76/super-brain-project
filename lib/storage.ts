import type { TestSession } from "@/types";

const KEY = "pct_session";

export function saveSession(session: TestSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadSession(): TestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TestSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
