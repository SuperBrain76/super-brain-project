// check-league-readiness.mjs — is a competition's REAL season in TheSportsDB yet?
//
// Some competitions (NHL regular season, UCL league phase) publish their real
// schedule late. Seeding early would mean placeholder/partial fixtures — the
// fabricated-data trap we moved to real feeds to avoid. This checks whether the
// full schedule is present against per-competition gates, so we only seed when
// the data is genuinely ready.
//
// Read-only. Usage: node scripts/check-league-readiness.mjs [slug ...]
// Exit code 0 always; prints READY / NOT-READY per competition (and JSON on the
// last line for machine callers).
import fs from "node:fs";

let KEY = process.env.THESPORTSDB_API_KEY || "123";
try {
  const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^THESPORTSDB_API_KEY=(.+)$/m);
  if (m) KEY = m[1].trim();
} catch { /* use env/default */ }

// Gates: what "the real season is loaded" looks like for each competition.
// TheSportsDB round conventions: 500 = pre-season, 400+ = qualifiers.
const TARGETS = {
  nhl: {
    name: "NHL", leagueId: 4380, season: "2026-2027",
    minEvents: 1000,   // full NHL regular season ~1312 games; preseason alone ~ tens
    minTeams: 30,
    needsMonthAtLeast: "2026-11",   // real season runs Oct–Apr; preseason ends Sept
    note: "regular season",
  },
  "champions-league": {
    name: "UEFA Champions League", leagueId: 4480, season: "2026-2027",
    minEvents: 144,    // 36-team league phase = 8 rounds × 18 = 144 games
    minTeams: 30,
    needsMonthAtLeast: "2026-09",
    excludeQualifiers: true,   // ignore round 400+ (qualifiers) when judging
    note: "league phase",
  },
};

async function fetchSchedule(leagueId, season) {
  const res = await fetch(`https://www.thesportsdb.com/api/v2/json/schedule/league/${leagueId}/${season}`, {
    headers: { "X-API-KEY": KEY },
  });
  if (!res.ok) throw new Error(`V2 schedule HTTP ${res.status}`);
  const j = await res.json();
  return (j.schedule || []).filter((e) => e.strHomeTeam && e.strAwayTeam);
}

function assess(t, events) {
  const considered = t.excludeQualifiers
    ? events.filter((e) => Number(e.intRound) < 400)   // drop qualifiers
    : events;
  const teams = new Set();
  let maxMonth = "";
  for (const e of considered) {
    teams.add(e.strHomeTeam); teams.add(e.strAwayTeam);
    const mo = (e.dateEvent || "").slice(0, 7);
    if (mo > maxMonth) maxMonth = mo;
  }
  const checks = {
    events: considered.length >= t.minEvents,
    teams:  teams.size >= t.minTeams,
    month:  maxMonth >= t.needsMonthAtLeast,
  };
  return {
    ready: checks.events && checks.teams && checks.month,
    counts: { events: considered.length, teams: teams.size, latestMonth: maxMonth || "—" },
    checks,
  };
}

const slugs = process.argv.slice(2).filter((s) => TARGETS[s]);
const toCheck = slugs.length ? slugs : Object.keys(TARGETS);
const report = {};

for (const slug of toCheck) {
  const t = TARGETS[slug];
  try {
    const events = await fetchSchedule(t.leagueId, t.season);
    const a = assess(t, events);
    report[slug] = a;
    const tag = a.ready ? "✅ READY" : "⏳ NOT-READY";
    console.log(`${tag}  ${t.name} ${t.note} — events ${a.counts.events}, teams ${a.counts.teams}, latest ${a.counts.latestMonth}`);
    if (!a.ready) {
      const missing = Object.entries(a.checks).filter(([, v]) => !v).map(([k]) => k);
      console.log(`         waiting on: ${missing.join(", ")}`);
    }
  } catch (e) {
    report[slug] = { ready: false, error: String(e) };
    console.log(`⚠️  ${t.name} — check failed: ${e}`);
  }
}

console.log("JSON " + JSON.stringify(report));
