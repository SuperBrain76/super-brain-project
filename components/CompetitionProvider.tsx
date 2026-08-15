"use client";

/**
 * CompetitionProvider — Competition Engine V2
 *
 * Resolves the competition ONCE per route and shares it with every page and
 * component beneath it. Without this, each of ~14 pages would resolve the
 * competition independently on mount.
 *
 * Two hooks, deliberately different:
 *
 *   useCompetition()      — inside /[competition]/*. Throws if the provider
 *                           is missing, because a competition page that
 *                           cannot name its competition is a bug, not a
 *                           state to render around.
 *
 *   useCompetitionSlug()  — anywhere, including global nav that sits OUTSIDE
 *                           the segment. Returns the context slug when there
 *                           is one, otherwise the default competition, and
 *                           null until that resolves.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Competition } from "@/lib/predictor";
import {
  getCompetitionSettings,
  getDefaultCompetitionSlug,
  getStages,
  listVisibleCompetitions,
  DEFAULT_SETTINGS,
  type CompetitionSettings,
  type CompetitionStage,
} from "@/lib/competitionEngine";

interface CompetitionContextValue {
  competition: Competition;
  slug:        string;
  settings:    CompetitionSettings;
  stages:      CompetitionStage[];
}

const CompetitionContext = createContext<CompetitionContextValue | null>(null);

export function CompetitionProvider({
  competition,
  settings,
  stages,
  children,
}: {
  competition: Competition;
  settings:    CompetitionSettings;
  stages:      CompetitionStage[];
  children:    ReactNode;
}) {
  return (
    <CompetitionContext.Provider
      value={{ competition, slug: competition.slug, settings, stages }}
    >
      {children}
    </CompetitionContext.Provider>
  );
}

/** The current competition. Only valid beneath /[competition]/. */
export function useCompetition(): CompetitionContextValue {
  const ctx = useContext(CompetitionContext);
  if (!ctx) {
    throw new Error(
      "useCompetition() was called outside a CompetitionProvider. " +
      "Competition-scoped pages must live under app/[competition]/. " +
      "For global navigation, use useCompetitionSlug() instead.",
    );
  }
  return ctx;
}

/** The current competition, or null outside the segment. Never throws. */
export function useCompetitionOptional(): CompetitionContextValue | null {
  return useContext(CompetitionContext);
}

// ── Slug resolution for global components ─────────────────────
// Module-level cache and in-flight promise so N nav components mounting
// together produce ONE lookup, not N.

let _cachedDefaultSlug: string | null = null;
let _inFlight: Promise<string> | null = null;

function resolveDefaultSlug(): Promise<string> {
  if (_cachedDefaultSlug) return Promise.resolve(_cachedDefaultSlug);
  if (!_inFlight) {
    _inFlight = getDefaultCompetitionSlug()
      .then((s) => { _cachedDefaultSlug = s; return s; })
      .finally(() => { _inFlight = null; });
  }
  return _inFlight;
}

/**
 * The competition slug in the current URL, if the first path segment names
 * a real competition.
 *
 * Global navigation lives in the ROOT layout, which is a parent of
 * `/[competition]/`, so it cannot read CompetitionProvider's context. It
 * still has to answer "is the user inside a competition, and which one?" —
 * this is how.
 *
 * Checked against the real competition list rather than a regex, because
 * `/settings` and `/premier-league` are indistinguishable by shape.
 */
export function useActiveCompetitionSlug(): string | null {
  const pathname = usePathname();
  const [known, setKnown] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    listVisibleCompetitions()
      .then((cs) => { if (alive) setKnown(cs.map((c) => c.slug)); })
      .catch(() => { if (alive) setKnown([]); });
    return () => { alive = false; };
  }, []);

  if (!pathname || !known) return null;
  const first = pathname.split("/").filter(Boolean)[0];
  if (!first) return null;
  return known.includes(first) ? first : null;
}

/** True when the user is on a competition route (or a legacy /predict one). */
export function useIsCompetitionRoute(): boolean {
  const pathname = usePathname();
  const active   = useActiveCompetitionSlug();
  return !!active || (pathname?.startsWith("/predict") ?? false);
}

/**
 * The slug to build links with, from anywhere in the app.
 *
 * Order: provider context → the competition in the URL → the default.
 *
 * Returns null while resolving. Callers should fall back to the legacy
 * `/predict/...` path in that window — it redirects to the same place, so a
 * link is never broken, merely one hop longer for a moment.
 */
export function useCompetitionSlug(): string | null {
  const ctx    = useContext(CompetitionContext);
  const active = useActiveCompetitionSlug();
  const [slug, setSlug] = useState<string | null>(ctx?.slug ?? _cachedDefaultSlug);

  useEffect(() => {
    if (ctx?.slug) { setSlug(ctx.slug); return; }
    if (active)    { setSlug(active);   return; }
    if (_cachedDefaultSlug) { setSlug(_cachedDefaultSlug); return; }

    let alive = true;
    resolveDefaultSlug()
      .then((s) => { if (alive) setSlug(s); })
      .catch(() => { /* leave null; callers fall back to /predict */ });
    return () => { alive = false; };
  }, [ctx?.slug, active]);

  return ctx?.slug ?? active ?? slug;
}

/**
 * Name and slug of the competition the navigation should present.
 *
 * Falls back to a generic label rather than a competition name while
 * resolving — navigation that flashes "WC 2026" before correcting
 * itself to "Premier League" is worse than one that briefly says "Sports".
 */
export function useCompetitionNav(): { slug: string | null; name: string } {
  const slug = useCompetitionSlug();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setName(null); return; }
    let alive = true;
    listVisibleCompetitions()
      .then((cs) => {
        if (!alive) return;
        setName(cs.find((c) => c.slug === slug)?.name ?? null);
      })
      .catch(() => { if (alive) setName(null); });
    return () => { alive = false; };
  }, [slug]);

  return { slug, name: name ?? "Sports" };
}

/**
 * Build a competition-scoped href that is safe to render before the slug
 * has resolved.
 *
 *   const href = useCompetitionHref("leaderboard");
 *   // → "/predict/leaderboard"  while resolving  (redirects correctly)
 *   // → "/premier-league/leaderboard"  once resolved
 */
export function useCompetitionHref(sub?: string): string {
  const slug = useCompetitionSlug();
  const tail = sub ? `/${sub.replace(/^\/+/, "")}` : "";
  return slug ? `/${slug}${tail}` : `/predict${tail}`;
}

// ── Loading + settings for the segment layout ─────────────────

export async function loadCompetitionContext(
  competition: Competition,
): Promise<{ settings: CompetitionSettings; stages: CompetitionStage[] }> {
  const [settings, stages] = await Promise.all([
    getCompetitionSettings(competition.id).catch(() => DEFAULT_SETTINGS),
    getStages(competition.id).catch(() => [] as CompetitionStage[]),
  ]);
  return { settings, stages };
}
