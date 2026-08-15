/**
 * lib/localTime.ts — kickoff times in the viewer's own timezone.
 *
 * Games are played in the UK, and we store every kickoff in UTC, but a fan in
 * Dubai should see Dubai time and a fan in Stockholm should see Swedish time —
 * no mental arithmetic. These helpers format in the BROWSER's local zone
 * (Intl uses it when timeZone is omitted) and expose a short zone label so the
 * time is never ambiguous.
 *
 * Safe against SSR/hydration mismatch ONLY because every caller renders after a
 * client-side data fetch — the server never formats these times. Don't call
 * these in server-rendered markup.
 */

/** Short label for the viewer's timezone, e.g. "GMT+4", "BST", "CEST". */
export function localZoneLabel(d: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "20:00" in the viewer's local time. */
export function localTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** "Mon 24 Aug" (or with weekday long) in the viewer's local time. */
export function localDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("en-GB", opts).format(new Date(iso));
}
