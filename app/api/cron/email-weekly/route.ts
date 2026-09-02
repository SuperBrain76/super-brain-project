/**
 * GET /api/cron/email-weekly — ONE weekly digest across every active sport.
 *
 * It used to send per competition: a ramp email, a matchweek email and a
 * results email, each per league. With nine competitions live that meant a
 * single reader could get seven emails inside 48 hours, on a list that has been
 * dormant since July. Volume like that does not just annoy people, it costs the
 * sending domain — and Resend also carries every transactional email the
 * product sends, so a complaint spike there takes password resets and venue
 * trial mail down with it.
 *
 * So: one email a week. What happened last week, what is coming this week,
 * every sport in the same message. Sent when the first kickoff of the coming
 * week is about 36 hours away — Thursday or Friday for a weekend of football —
 * which is while there is still time to pull a league together.
 *
 * State is an ISO week key in competition_settings, written to every active
 * competition so the digest cannot go twice however often the cron runs.
 * Gated behind SEASON_EMAILS_ENABLED.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getResend, FROM, SITE, emailWrapper, ctaButton, divider } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Show the leaderboard for a round only when enough people actually played. */
const MIN_PLAYERS_FOR_LEADERBOARD = Number(process.env.MIN_PLAYERS_FOR_LEADERBOARD ?? "10");
/** How far ahead of the week's first kickoff the digest goes out. */
const LEAD_HOURS = Number(process.env.MATCHWEEK_LEAD_HOURS ?? 36);
/** A digest listing 90 fixtures is not read by anyone. Cap per competition. */
const MAX_ROWS = Number(process.env.DIGEST_MAX_ROWS_PER_COMP ?? 5);
/** With no fixtures ahead — an international break — still wrap up results. */
const QUIET_WEEK_DAYS = 8;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}
function anonDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
}
function fmtKO(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC";
}

/** ISO-8601 week key, e.g. 2026-W36. The digest's once-a-week guarantee. */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function getSetting(db: SupabaseClient, compId: string, key: string): Promise<unknown> {
  const { data } = await db.from("competition_settings").select("value").eq("competition_id", compId).eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(db: SupabaseClient, compId: string, key: string, value: unknown) {
  await db.from("competition_settings")
    .upsert({ competition_id: compId, key, value }, { onConflict: "competition_id,key" });
}

interface Fixture { id: string; round_id: string; home: string; away: string; ko: string; status: string; hs: number | null; as: number | null; }
interface RoundInfo { id: string; code: string; label: string; sort: number; }
interface Comp { id: string; name: string; slug: string; sport_code: string | null; }

interface Gathered {
  comp: Comp;
  results?: { round: RoundInfo; fixtures: Fixture[]; top3: Array<{ rank: number; name: string; pts: number }> };
  upcoming?: { round: RoundInfo; fixtures: Fixture[]; firstKO: string };
}

async function loadUsers(db: SupabaseClient) {
  const { data: optedIn } = await db.from("user_profiles").select("id").eq("email_notifications", true);
  const ids = new Set((optedIn ?? []).map((p) => p.id as string));
  if (ids.size === 0) return [];
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).filter((u) => u.email && ids.has(u.id));
}

function firstName(u: { user_metadata?: Record<string, unknown> }) {
  const n = (u.user_metadata?.full_name ?? u.user_metadata?.name ?? "Predictor") as string;
  return String(n).split(" ")[0];
}

async function sendToAll(
  users: Awaited<ReturnType<typeof loadUsers>>,
  subject: string,
  buildBody: (first: string) => string,
) {
  const resend = getResend();
  const emails = users.map((u) => ({
    from: FROM, to: u.email as string, subject,
    html: emailWrapper(buildBody(firstName(u)), u.id),
  }));
  let sent = 0, failed = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await resend.batch.send(chunk);
    if (error) { console.error("[email-weekly] batch error:", error); failed += chunk.length; }
    else sent += data?.data?.length ?? chunk.length;
  }
  return { sent, failed };
}

function fixtureRows(fixtures: Fixture[], withScores = false) {
  const shown = fixtures.slice(0, MAX_ROWS);
  const rows = shown.map((f) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #e4ebe0;">
      <table width="100%"><tr>
        <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">${f.home}</td>
        <td style="font-size:12px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;">${withScores && f.hs != null ? `${f.hs}-${f.as}` : "vs"}</td>
        <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">${f.away}</td>
      </tr>
      ${withScores ? "" : `<tr><td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:2px;">${fmtDate(f.ko)} · ${fmtKO(f.ko)}</td></tr>`}
      </table>
    </td></tr>`).join("");
  const more = fixtures.length - shown.length;
  return rows + (more > 0
    ? `<tr><td style="padding:8px 0;text-align:center;font-size:12px;color:#7a8f82;font-family:sans-serif;">and ${more} more</td></tr>`
    : "");
}

// ── Gather, never send ───────────────────────────────────────────
async function gather(db: SupabaseClient, comp: Comp, now: Date): Promise<Gathered | null> {
  const { data: season } = await db.from("seasons").select("id").eq("competition_id", comp.id).eq("is_current", true).maybeSingle();
  if (!season) return null;

  const { data: roundsRaw } = await db.from("rounds").select("id, code, label, sort_order").eq("season_id", season.id).order("sort_order");
  const rounds: RoundInfo[] = (roundsRaw ?? []).map((r) => ({ id: r.id as string, code: r.code as string, label: r.label as string, sort: r.sort_order as number }));
  if (!rounds.length) return null;

  const { data: fxRaw } = await db.from("fixtures")
    .select("id, round_id, home_team_id, away_team_id, kicks_off_at, status, home_score, away_score")
    .eq("season_id", season.id).order("kicks_off_at");
  if (!fxRaw?.length) return null;

  const teamIds = [...new Set(fxRaw.flatMap((f) => [f.home_team_id, f.away_team_id]))];
  const { data: teams } = await db.from("teams").select("id, name").in("id", teamIds as string[]);
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name as string]));
  const fixtures: Fixture[] = fxRaw.map((f) => ({
    id: f.id as string, round_id: f.round_id as string,
    home: teamName.get(f.home_team_id as string) ?? "TBD",
    away: teamName.get(f.away_team_id as string) ?? "TBD",
    ko: f.kicks_off_at as string, status: f.status as string,
    hs: f.home_score as number | null, as: f.away_score as number | null,
  }));
  const byRound = (rid: string) => fixtures.filter((f) => f.round_id === rid);

  const out: Gathered = { comp };

  // Last week: the most recent fully-completed round we have not reported.
  const lastReported = (await getSetting(db, comp.id, "email_summary_sent")) as string | null;
  const completed = rounds
    .filter((r) => { const fx = byRound(r.id); return fx.length > 0 && fx.every((f) => f.status === "completed"); })
    .sort((a, b) => b.sort - a.sort);
  const toWrap = completed.find((r) => r.code !== lastReported);
  if (toWrap) {
    const roundFx = byRound(toWrap.id);
    const { data: lb } = await anonDb().rpc("get_predictor_leaderboard", { p_competition_id: comp.id });
    const board = (lb ?? []) as Array<{ rank: number; display_name: string; total_points: number }>;
    out.results = {
      round: toWrap, fixtures: roundFx,
      top3: board.length >= MIN_PLAYERS_FOR_LEADERBOARD
        ? board.slice(0, 3).map((u) => ({ rank: Number(u.rank), name: u.display_name ?? "—", pts: Number(u.total_points) }))
        : [],
    };
  }

  // This week: the round containing the next scheduled kickoff.
  const next = fixtures.find((f) => f.status === "scheduled" && new Date(f.ko) > now);
  if (next) {
    const round = rounds.find((r) => r.id === next.round_id);
    if (round) out.upcoming = { round, fixtures: byRound(round.id).filter((f) => f.status === "scheduled"), firstKO: next.ko };
  }

  return out.results || out.upcoming ? out : null;
}

// ── Body ─────────────────────────────────────────────────────────
function buildBody(first: string, weeks: Gathered[], now: Date) {
  const withResults = weeks.filter((g) => g.results);
  const withUpcoming = weeks.filter((g) => g.upcoming);

  const resultsBlock = withResults.map((g) => `
    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:18px 0 4px;">${g.comp.name} — ${g.results!.round.label}</p>
    <table width="100%" style="margin:4px 0;"><tbody>${fixtureRows(g.results!.fixtures, true)}</tbody></table>
    ${g.results!.top3.length ? `<p style="font-size:13px;color:#5a6b60;font-family:sans-serif;margin:6px 0 0;">
      Leading: ${g.results!.top3.map((u) => `${u.rank}. <strong style="color:#1a3a2a;">${u.name}</strong> ${u.pts} pts`).join(" &nbsp;·&nbsp; ")}
    </p>` : ""}`).join("");

  const upcomingBlock = withUpcoming.map((g) => `
    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:18px 0 4px;">${g.comp.name} — ${g.upcoming!.round.label}</p>
    <table width="100%" style="margin:4px 0;"><tbody>${fixtureRows(g.upcoming!.fixtures)}</tbody></table>`).join("");

  const totalUpcoming = withUpcoming.reduce((n, g) => n + g.upcoming!.fixtures.length, 0);

  return `
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 6px;">Your week</p>
    <h2 style="font-size:23px;color:#1a3a2a;margin:0 0 10px;font-family:Georgia,serif;">${withResults.length ? "Last week, and what is coming" : "What is coming this week"}</h2>

    <p style="font-size:15px;color:#5a6b60;font-family:sans-serif;line-height:1.6;margin:0 0 6px;">
      Hi ${first}, ${totalUpcoming} ${totalUpcoming === 1 ? "match" : "matches"} to call across
      ${withUpcoming.length} ${withUpcoming.length === 1 ? "competition" : "competitions"} this week.
    </p>

    ${withResults.length ? `${divider}
      <h3 style="font-size:17px;color:#1a3a2a;margin:18px 0 0;font-family:Georgia,serif;">How last week finished</h3>
      ${resultsBlock}` : ""}

    ${withUpcoming.length ? `${divider}
      <h3 style="font-size:17px;color:#1a3a2a;margin:18px 0 0;font-family:Georgia,serif;">This week</h3>
      ${upcomingBlock}` : ""}

    ${divider}

    <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.75;margin:14px 0 6px;">
      <strong>Predictions are better with people you know.</strong> Start a league,
      send the link to your group, and the season takes care of itself.
    </p>

    ${ctaButton("Make your predictions", SITE)}

    <p style="font-size:12px;color:#9fb0a4;font-family:sans-serif;text-align:center;margin:8px 0 0;">
      One email a week. superbrain.social
    </p>`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SEASON_EMAILS_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "pre-launch: season emails disabled" });
  }

  // Inspect what would be sent, and to how many, without sending it.
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const now = new Date();
  const db = adminDb();

  const { data: comps } = await db.from("competitions").select("id, name, slug, sport_code").eq("status", "active");
  if (!comps?.length) return NextResponse.json({ skipped: true, reason: "no active competitions" });

  const week = isoWeek(now);
  const alreadySent = (await getSetting(db, comps[0].id as string, "email_digest_sent")) as string | null;
  if (alreadySent === week && !dry) {
    return NextResponse.json({ skipped: true, reason: `digest already sent for ${week}` });
  }

  const gathered = (await Promise.all(
    (comps as Comp[]).map((c) => gather(db, c, now)),
  )).filter(Boolean) as Gathered[];
  if (!gathered.length) return NextResponse.json({ skipped: true, reason: "nothing to report" });

  // Timing. Normally the digest waits until the week's first kickoff is LEAD_HOURS
  // away. When nothing is scheduled for over a week — an international break —
  // results would otherwise never be wrapped up, so send those on their own.
  const kickoffs = gathered.filter((g) => g.upcoming).map((g) => new Date(g.upcoming!.firstKO).getTime());
  const hoursToFirst = kickoffs.length ? (Math.min(...kickoffs) - now.getTime()) / HOUR_MS : Infinity;
  const hasResults = gathered.some((g) => g.results);
  const quietWeek = hoursToFirst > QUIET_WEEK_DAYS * 24;
  const due = hoursToFirst <= LEAD_HOURS || (hasResults && quietWeek);

  const summary = {
    week, hours_to_first_kickoff: Number.isFinite(hoursToFirst) ? Math.round(hoursToFirst) : null,
    lead_hours: LEAD_HOURS, due,
    results_from: gathered.filter((g) => g.results).map((g) => `${g.comp.slug}:${g.results!.round.code}`),
    upcoming_in: gathered.filter((g) => g.upcoming).map((g) => `${g.comp.slug}:${g.upcoming!.round.code}(${g.upcoming!.fixtures.length})`),
  };

  if (!due && !dry) return NextResponse.json({ skipped: true, reason: "first kickoff is further out than the lead time", ...summary });

  const users = await loadUsers(db);
  if (!users.length) return NextResponse.json({ skipped: true, reason: "no subscribers", ...summary });

  const totalUpcoming = gathered.reduce((n, g) => n + (g.upcoming?.fixtures.length ?? 0), 0);
  const subject = summary.results_from.length
    ? `Last week's results, and ${totalUpcoming} matches to call`
    : `${totalUpcoming} matches to call this week`;

  if (dry) {
    return NextResponse.json({
      dry_run: true, wouldSendTo: users.length, subject, ...summary,
      preview_html: buildBody("Dylan", gathered, now).slice(0, 4000),
    });
  }

  const { sent, failed } = await sendToAll(users, subject, (f) => buildBody(f, gathered, now));

  // Mark on EVERY active competition, so deactivating one cannot resurrect the
  // week's digest, and per-competition results are not re-reported next week.
  await Promise.all([
    ...comps.map((c) => setSetting(db, c.id as string, "email_digest_sent", week)),
    ...gathered.filter((g) => g.results).map((g) => setSetting(db, g.comp.id, "email_summary_sent", g.results!.round.code)),
  ]);

  console.log(`[email-weekly] ${week} sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed, subject, ...summary });
}
