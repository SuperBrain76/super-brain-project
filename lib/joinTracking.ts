"use client";

/**
 * lib/joinTracking.ts — the ONE place a successful league join is reported.
 *
 * ── Why this exists ──────────────────────────────────────────
 * There are three surfaces a person can join a league from:
 *
 *   1. /{comp}/leagues            — pasting an invite code
 *   2. /{comp}/leagues/{id}       — the league's own page
 *   3. /{comp}/leagues/join?code= — an invite link, AND the target of the
 *                                   venue QR redirect at /j/<slug>
 *
 * Surfaces 1 and 2 emitted `league_joined` inline. Surface 3 — the busiest one,
 * and the ONLY one a venue's customers ever see — emitted nothing. The
 * historical data made it obvious: 647 invite_page_viewed across 183 people,
 * against 7 league_joined events in total, none after 25 June.
 *
 * That silently broke the venue funnel too, because a venue's players arrive
 * exclusively through surface 3 via the poster QR.
 *
 * Rather than adding a third inline copy — which is how the drift started —
 * every surface now calls this function, once, after a join actually succeeds.
 *
 * ── No double counting ───────────────────────────────────────
 * A join happens on exactly one surface, and each surface calls this exactly
 * once on its success path. The "already a member" branches return before
 * reaching it: re-opening an invite link is not a new join, and counting it
 * would inflate venue activation, which is defined on distinct players.
 */

import { track, setVenueContext } from "@/lib/analytics";
import { venueTrack } from "@/lib/leadTrack";

/** How the player reached the join. `qr` is set by the /j/<slug> redirect. */
export type JoinVia = "qr" | "code" | "link";

interface JoinedLeague {
  id: string;
  venueId?: string | null;
}

/**
 * Report one successful league join.
 *
 * Call AFTER the join has succeeded server-side — never optimistically. A
 * failed join that still emitted would corrupt the venue activation threshold,
 * which counts distinct players who actually joined.
 */
export function trackLeagueJoined(league: JoinedLeague, via: JoinVia): void {
  // Consumer-side: the player's own behaviour.
  track.leagueJoined(league.id);

  // Venue-side: only for venue-owned leagues. This is the B2B activation
  // signal — the first evidence that a venue's customers are actually using
  // what the venue is paying for.
  if (league.venueId) {
    setVenueContext({ venue_id: league.venueId });
    track.venue.playerJoined(league.id, via);
    // Mirror into the venue_events CRM log. First-only server-side, so this is
    // a "someone joined" signal, not a counter — PostHog and
    // prediction_league_members remain authoritative for player counts.
    venueTrack(league.venueId, "player_joined");
  }
}
