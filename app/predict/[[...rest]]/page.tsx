"use client";

/**
 * Legacy `/predict/...` → `/<competition>/...` redirect.
 *
 * ────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AND MUST KEEP EXISTING
 * ────────────────────────────────────────────────────────────
 * `/predict` URLs are not merely old — they are in circulation and cannot
 * be recalled:
 *
 *   • WhatsApp league invites shared during the World Cup
 *   • every match-day and standings email already sent
 *   • OG cards cached by Facebook, X and WhatsApp
 *   • the App Store / Play Store listing
 *   • bookmarks and the browser history of every existing user
 *
 * An optional catch-all `[[...rest]]` matches `/predict` itself AND every
 * path beneath it, so one file covers the lot.
 *
 * `router.replace` rather than `push`: the legacy URL should not sit in
 * history, or Back from the new page bounces through the redirect again.
 *
 * ⚠️ Do not delete this route. There is no expiry date on a link someone
 *    else has already shared.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultCompetitionSlug } from "@/lib/competitionEngine";
import { legacyPathToCompetitionPath } from "@/lib/competitionRoutes";

export default function LegacyPredictRedirect({
  params,
}: {
  params: { rest?: string[] };
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    async function go() {
      const segments = params.rest ?? [];

      try {
        const slug = await getDefaultCompetitionSlug();
        if (!alive) return;

        const target = legacyPathToCompetitionPath(slug, segments);
        // Preserve the query string — league invite links carry ?join=CODE.
        const qs = typeof window !== "undefined" ? window.location.search : "";
        router.replace(target + qs);
      } catch {
        if (alive) setFailed(true);
      }
    }

    void go();
    return () => { alive = false; };
  }, [params.rest, router]);

  return (
    <div className="predict-shell flex-1 flex flex-col min-h-full">
      <div className="max-w-md mx-auto w-full px-4 py-16 text-center flex flex-col gap-3">
        {failed ? (
          <>
            <p className="text-sm font-semibold" style={{ color: "#334155" }}>
              Could not find a competition to open
            </p>
            <p className="text-xs" style={{ color: "#64748b" }}>
              No competition is marked as the default. An administrator needs to set
              <code className="mx-1 font-mono">is_default</code>
              in competition settings.
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: "#7a8f82" }}>Redirecting…</p>
        )}
      </div>
    </div>
  );
}
