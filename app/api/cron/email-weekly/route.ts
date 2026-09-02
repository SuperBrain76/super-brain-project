/**
 * GET /api/cron/email-weekly  — the per-league weekly email engine.
 *
 * Runs daily and, for every active league, decides whether to send:
 *   1. RAMP     — the week before a league starts, a few "get ready" nudges
 *                 (at 7, 3 and 1 days out) to drive sign-ups + invites.
 *   2. MATCHWEEK — one email per league per gameweek, ~2 days before that
 *                 round's first kickoff, listing ALL of the round's fixtures.
 *   3. SUMMARY  — once every match in a round is finished, a results +
 *                 leaderboard wrap — but only when enough players took part.
 *
 * State (which ramp days / rounds have been emailed) lives in
 * competition_settings so nothing is ever sent twice. Everything is gated
 * behind SEASON_EMAILS_ENABLED so it stays silent until launch day.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getResend, FROM, SITE, emailWrapper, ctaButton, divider } from "@/lib/email";

export const dynamic = "force-dynamic";

// Send the leaderboard wrap only when at least this many players predicted the
// round — avoids a thin, awkward leaderboard. Tunable via env.
const MIN_PLAYERS_FOR_LEADERBOARD = Number(process.env.MIN_PLAYERS_FOR_LEADERBOARD ?? "10");
const RAMP_DAYS = [7, 3, 1]; // days-before-launch nudges

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

// competition_settings helpers (value is jsonb).
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
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await resend.batch.send(chunk);
    if (!error) sent += data?.data?.length ?? chunk.length;
  }
  return sent;
}

function fixtureRows(fixtures: Fixture[], withScores = false) {
  return fixtures.map((f) => `
    <tr><td style="padding:9px 0;border-bottom:1px solid #e4ebe0;">
      <table width="100%"><tr>
        <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">${f.home}</td>
        <td style="font-size:12px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;">${withScores && f.hs != null ? `${f.hs}–${f.as}` : "vs"}</td>
        <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">${f.away}</td>
      </tr>
      ${withScores ? "" : `<tr><td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:2px;">${fmtDate(f.ko)} · ${fmtKO(f.ko)}</td></tr>`}
      </table>
    </td></tr>`).join("");
}

// ── Process one competition ──────────────────────────────────────
async function processCompetition(
  db: SupabaseClient,
  comp: { id: string; name: string; slug: string },
  users: Awaited<ReturnType<typeof loadUsers>>,
  now: Date,
  result: Record<string, unknown>,
) {
  const compUrl = `${SITE}/${comp.slug}`;

  // Current season fixtures + rounds
  const { data: season } = await db.from("seasons").select("id").eq("competition_id", comp.id).eq("is_current", true).maybeSingle();
  if (!season) return;

  const { data: roundsRaw } = await db.from("rounds").select("id, code, label, sort_order").eq("season_id", season.id).order("sort_order");
  const rounds: RoundInfo[] = (roundsRaw ?? []).map((r) => ({ id: r.id as string, code: r.code as string, label: r.label as string, sort: r.sort_order as number }));
  if (rounds.length === 0) return;

  const { data: fxRaw } = await db.from("fixtures")
    .select("id, round_id, home_team_id, away_team_id, kicks_off_at, status, home_score, away_score")
    .eq("season_id", season.id).order("kicks_off_at");
  if (!fxRaw || fxRaw.length === 0) return;

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
  const seasonStart = new Date(fixtures[0].ko);

  // ── 1. RAMP (pre-launch) ──
  if (now < seasonStart) {
    const daysUntil = Math.ceil((seasonStart.getTime() - now.getTime()) / DAY_MS);
    const rampSent = (await getSetting(db, comp.id, "email_ramp_sent")) as number[] | null ?? [];
    const marker = RAMP_DAYS.find((d) => daysUntil <= d && !rampSent.includes(d));
    if (marker) {
      const soon = daysUntil <= 1 ? "tomorrow" : `in ${daysUntil} days`;
      const sent = await sendToAll(users, `${comp.name} kicks off ${soon} — get your crew ready`, (first) => `
        <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 6px;">Almost kickoff</p>
        <h2 style="font-size:23px;color:#1a3a2a;margin:0 0 10px;font-family:Georgia,serif;">${comp.name} starts ${soon}</h2>
        <p style="font-size:15px;color:#5a6b60;font-family:sans-serif;line-height:1.6;margin:0 0 18px;">
          Hi ${first}, the new ${comp.name} season is nearly here. Now's the time to set up your league and pull your friends in — first predictions open ${fmtDate(seasonStart.toISOString())}.
        </p>
        ${divider}
        <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.75;margin:14px 0 6px;">
          <strong>Start a private league</strong> and invite your mates, your city, your club or the office.<br/>
          Every correct call builds your <strong>SuperBrain IQ</strong>.<br/>
          Big things planned for our league winners this season.
        </p>
        ${ctaButton(`Set up your league — free →`, compUrl)}`);
      await setSetting(db, comp.id, "email_ramp_sent", [...rampSent, marker]);
      result[comp.slug] = { type: "ramp", daysUntil, marker, sent };
    }
    return; // pre-launch → no matchweek/summary yet
  }

  // ── 2. MATCHWEEK (upcoming round, ~2 days before it opens) ──
  const upcoming = fixtures.find((f) => f.status === "scheduled" && new Date(f.ko) > now);
  if (upcoming) {
    const round = rounds.find((r) => r.id === upcoming.round_id);
    const roundFx = round ? byRound(round.id).filter((f) => f.status === "scheduled") : [];
    const opensInDays = Math.ceil((new Date(upcoming.ko).getTime() - now.getTime()) / DAY_MS);
    const lastMwSent = (await getSetting(db, comp.id, "email_matchweek_sent")) as string | null;
    if (round && opensInDays <= 2 && lastMwSent !== round.code) {
      const sent = await sendToAll(users, `${comp.name} — ${round.label}: get your predictions in`, (first) => `
        <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 6px;">${comp.name}</p>
        <h2 style="font-size:23px;color:#1a3a2a;margin:0 0 6px;font-family:Georgia,serif;">${round.label} is here</h2>
        <p style="font-size:14px;color:#5a6b60;font-family:sans-serif;margin:0 0 16px;">Hi ${first}, here's every match this gameweek. Lock your scores before kickoff.</p>
        ${divider}
        <table width="100%" style="margin:14px 0;"><tbody>${fixtureRows(roundFx)}</tbody></table>
        ${divider}
        ${ctaButton("Make your predictions →", compUrl)}
        <p style="font-size:12px;color:#9fb0a4;font-family:sans-serif;text-align:center;margin:6px 0 0;">One tap a match. Beat your mates.</p>`);
      await setSetting(db, comp.id, "email_matchweek_sent", round.code);
      result[comp.slug] = { ...(result[comp.slug] as object ?? {}), matchweek: { round: round.code, fixtures: roundFx.length, sent } };
    }
  }

  // ── 3. SUMMARY + LEADERBOARD (a fully-completed round we haven't wrapped) ──
  const lastSumSent = (await getSetting(db, comp.id, "email_summary_sent")) as string | null;
  const completedRounds = rounds
    .filter((r) => { const fx = byRound(r.id); return fx.length > 0 && fx.every((f) => f.status === "completed"); })
    .sort((a, b) => b.sort - a.sort);
  const toWrap = completedRounds.find((r) => r.code !== lastSumSent);
  if (toWrap) {
    const roundFx = byRound(toWrap.id);
    const fxIds = roundFx.map((f) => f.id);
    const { data: preds } = await db.from("predictions").select("user_id, points_awarded").in("fixture_id", fxIds).not("points_awarded", "is", null);
    const players = new Set((preds ?? []).map((p) => p.user_id));

    if (players.size >= MIN_PLAYERS_FOR_LEADERBOARD) {
      const { data: lb } = await anonDb().rpc("get_predictor_leaderboard", { p_competition_id: comp.id });
      const board = (lb ?? []) as Array<{ rank: number; user_id: string; display_name: string; total_points: number }>;
      const top10 = board.slice(0, 10);
      const boardRows = top10.map((u) => `
        <tr><td style="padding:7px 4px;font-size:13px;color:#7a8f82;width:30px;text-align:center;font-family:sans-serif;">${u.rank}.</td>
        <td style="padding:7px 4px;font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;">${u.display_name ?? "—"}</td>
        <td style="padding:7px 4px;font-size:14px;color:#b8972a;font-family:sans-serif;font-weight:700;text-align:right;">${u.total_points} pts</td></tr>`).join("");
      const rankMap = new Map(board.map((r) => [r.user_id, { rank: Number(r.rank), pts: Number(r.total_points) }]));

      const sent = await sendToAll(users, `${comp.name} — ${toWrap.label} results and table`, (first) => {
        return `
        <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 6px;">${comp.name}</p>
        <h2 style="font-size:23px;color:#1a3a2a;margin:0 0 6px;font-family:Georgia,serif;">${toWrap.label} — how it finished</h2>
        <p style="font-size:14px;color:#5a6b60;font-family:sans-serif;margin:0 0 16px;">Hi ${first}, the results are in. Here's the round and where the table stands.</p>
        ${divider}
        <table width="100%" style="margin:12px 0;"><tbody>${fixtureRows(roundFx, true)}</tbody></table>
        ${divider}
        <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 6px;">Top of the table</p>
        <table width="100%" style="margin:6px 0;"><tbody>${boardRows}</tbody></table>
        ${ctaButton("See the full table →", `${compUrl}/standings`)}`;
      });
      await setSetting(db, comp.id, "email_summary_sent", toWrap.code);
      void rankMap;
      result[comp.slug] = { ...(result[comp.slug] as object ?? {}), summary: { round: toWrap.code, players: players.size, sent } };
    } else {
      // Too few players — mark as handled so we don't re-check forever.
      await setSetting(db, comp.id, "email_summary_sent", toWrap.code);
      result[comp.slug] = { ...(result[comp.slug] as object ?? {}), summary: { round: toWrap.code, players: players.size, skipped: "too few players" } };
    }
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SEASON_EMAILS_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "pre-launch: season emails disabled" });
  }

  const db = adminDb();
  const now = new Date();

  const { data: comps } = await db.from("competitions").select("id, name, slug").eq("status", "active");
  if (!comps || comps.length === 0) return NextResponse.json({ skipped: true, reason: "no active competitions" });

  const users = await loadUsers(db);
  if (users.length === 0) return NextResponse.json({ skipped: true, reason: "no subscribers" });

  const result: Record<string, unknown> = {};
  for (const comp of comps) {
    try {
      await processCompetition(db, comp as { id: string; name: string; slug: string }, users, now, result);
    } catch (e) {
      console.error(`[email-weekly] ${(comp as { slug: string }).slug} error:`, e);
      result[(comp as { slug: string }).slug] = { error: String(e) };
    }
  }

  return NextResponse.json({ ok: true, subscribers: users.length, result });
}
