"use client";

/**
 * lib/leadTrack.ts — top-of-funnel attribution for the venue funnel.
 *
 * An outreach link carries `?v=<venue uuid>` (the lead_id — see lib/instantly.ts).
 * We capture it on first load, persist it for the session so it survives the
 * hop from the marketing landing to /venues/start, and beacon a handful of web
 * events to /api/venues/track. Everything is best-effort and no-op when there
 * is no lead id (someone who arrived without an outreach link).
 */

const KEY = "sb_lead_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read `?v=` from the URL (capturing it into sessionStorage), else the stored id. */
export function leadId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("v");
    if (fromUrl && UUID.test(fromUrl)) {
      sessionStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(KEY);
    return stored && UUID.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Fire a funnel beacon. No-op without a lead id. Never throws. */
export function leadTrack(event: "landing_viewed" | "start_clicked" | "signup_started", detail?: Record<string, unknown>) {
  const v = leadId();
  if (!v) return;
  try {
    const body = JSON.stringify({ v, event, detail, path: window.location.pathname });
    // sendBeacon survives the page unloading on a CTA click/navigation.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/venues/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/venues/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

/**
 * Fire a funnel beacon for an EXPLICIT venue, independent of the outreach lead id.
 *
 * leadTrack() only fires for someone who arrived from a cold email. A customer
 * scanning a poster in the bar has no lead id, but their join is still the
 * venue's most important funnel milestone — hence the separate entry point.
 */
export function venueTrack(venueId: string, event: "player_joined", detail?: Record<string, unknown>) {
  if (typeof window === "undefined" || !UUID.test(venueId)) return;
  try {
    const body = JSON.stringify({ v: venueId, event, detail, path: window.location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/venues/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/venues/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* best-effort */ }
}

/** Fire an event at most once per session (for page-view style beacons). */
export function leadTrackOnce(event: "landing_viewed" | "signup_started", detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const v = leadId();
  if (!v) return;
  const once = `sb_lt_${event}_${v}`;
  try {
    if (sessionStorage.getItem(once)) return;
    sessionStorage.setItem(once, "1");
  } catch { /* ignore */ }
  leadTrack(event, detail);
}
