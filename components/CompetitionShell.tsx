"use client";

/**
 * CompetitionShell — the client boundary for /[competition]/*.
 *
 * Resolves the competition named in the URL exactly once, then hands it to
 * every page beneath via CompetitionProvider.
 *
 * ────────────────────────────────────────────────────────────
 * WHY THE GUARD MATTERS
 * ────────────────────────────────────────────────────────────
 * `app/[competition]/` is a TOP-LEVEL dynamic segment, so it catches every
 * path Next.js could not match statically. `/premier-leage` (typo),
 * `/robots.txt`, a stale link — all arrive here.
 *
 * Without a guard those would render an empty predictor rather than a 404,
 * which is worse than useless: it looks like a real page with no data. So an
 * unknown or reserved slug calls notFound().
 *
 * A competition that exists but is NOT yet visible renders only for admins.
 * That is the launch flag from migration 043 — no feature-flag system, just
 * a settings row.
 */

import { useEffect, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { resolveCompetition, type Competition } from "@/lib/predictor";
import {
  DEFAULT_SETTINGS,
  isArchived,
  isAdminOnly,
  type CompetitionSettings,
  type CompetitionStage,
} from "@/lib/competitionEngine";
import {
  CompetitionProvider,
  loadCompetitionContext,
} from "@/components/CompetitionProvider";
import { isValidCompetitionSlug } from "@/lib/competitionRoutes";
import CompetitionSwitcher from "@/components/CompetitionSwitcher";
import EmailVerificationBanner from "@/components/predictor/EmailVerificationBanner";

type State =
  | { phase: "loading" }
  | { phase: "ready"; competition: Competition; settings: CompetitionSettings; stages: CompetitionStage[] }
  | { phase: "hidden" }
  | { phase: "missing" }
  | { phase: "error"; message: string };

export default function CompetitionShell({
  slug,
  children,
}: {
  slug:     string;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let alive = true;

    async function load() {
      // Cheap client-side rejection before any network call.
      if (!isValidCompetitionSlug(slug)) {
        if (alive) setState({ phase: "missing" });
        return;
      }

      const { competition, error } = await resolveCompetition(slug);
      if (!alive) return;

      if (!competition) {
        // Distinguish "this competition does not exist" (404) from "the
        // database is unreachable" (error card). Rendering a 404 for an
        // outage would tell the user their link is wrong when it is not.
        if (!isSupabaseConfigured || (error && !error.includes("No competition found"))) {
          setState({ phase: "error", message: error ?? "Could not load competition." });
        } else {
          setState({ phase: "missing" });
        }
        return;
      }

      const { settings, stages } = await loadCompetitionContext(competition);
      if (!alive) return;

      // Draft / internal competitions are admin-only. Public and archived are
      // open to everyone (archived is read-only, shown with a banner below).
      if (isAdminOnly(settings)) {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        let isAdmin = false;
        if (uid) {
          const { data: adminRow } = await supabase
            .from("app_admins").select("user_id").eq("user_id", uid).maybeSingle();
          isAdmin = !!adminRow;
        }
        if (!alive) return;
        if (!isAdmin) { setState({ phase: "hidden" }); return; }
      }

      setState({ phase: "ready", competition, settings, stages });
    }

    void load();
    return () => { alive = false; };
  }, [slug]);

  if (state.phase === "missing" || state.phase === "hidden") {
    // `hidden` deliberately renders the same 404 as `missing`. An unlaunched
    // competition must not be discoverable by probing URLs — "this exists but
    // you cannot see it" is itself a leak.
    notFound();
  }

  if (state.phase === "error") {
    return (
      <div className="predict-shell flex-1 flex flex-col min-h-full">
        <div className="max-w-md mx-auto w-full px-4 py-16 flex flex-col gap-3 text-center">
          <p className="text-sm font-semibold" style={{ color: "#334155" }}>
            Could not load this competition
          </p>
          <p className="text-xs font-mono break-all" style={{ color: "#64748b" }}>
            {state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 mx-auto px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#1a3a2a", color: "#f8f5f0" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <div className="predict-shell flex-1 flex flex-col min-h-full">
        <div className="max-w-md mx-auto w-full px-4 py-16 text-center">
          <p className="text-sm" style={{ color: "#7a8f82" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <CompetitionProvider
      competition={state.competition}
      settings={state.settings}
      stages={state.stages}
    >
      <div className="predict-shell flex-1 flex flex-col min-h-full">
        <EmailVerificationBanner />
        {/* Renders nothing while only one competition is visible, so today's
            World Cup experience is unchanged. */}
        <div className="flex justify-end px-4 pt-3">
          <CompetitionSwitcher />
        </div>
        {isArchived(state.settings) && (
          <div
            className="px-4 py-2 text-center text-xs font-semibold"
            style={{ background: "#e6ebe4", color: "#3a4a3f", borderBottom: "1px solid #cfe0d3" }}
          >
            🗄 ARCHIVED — this competition has finished. It's read-only.
          </div>
        )}
        {isAdminOnly(state.settings) && (
          <div
            className="px-4 py-2 text-center text-xs font-semibold"
            style={{ background: "#b8972a", color: "#1a1a1a" }}
          >
            ADMIN PREVIEW — {state.settings.lifecycle === "internal" ? "internal testing" : "draft"}, not visible to users yet
          </div>
        )}
        {children}
      </div>
    </CompetitionProvider>
  );
}

export { DEFAULT_SETTINGS };
