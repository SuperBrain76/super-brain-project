/**
 * /predict/demo — Realistic WC 2026 league mockup.
 *
 * 100% static — no Supabase, no auth, no useEffect.
 * Halfway through the group stage: 20 of 64 matches played.
 * Shows exactly what a real league looks like mid-tournament.
 */

import Link from "next/link";

// ── Design tokens (matches rest of predictor) ─────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";
const NAVY   = "#0e1e35";

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────

const LEAGUE = {
  name:       "The Lads 🏆",
  code:       "A2E94FC1",
  matchday:   20,
  totalGames: 64,
  stage:      "Group Stage — Matchday 2 of 3",
};

// 8 players. YOU = rank 4 (Dylan). Owner = Jamie (rank 1).
const PLAYERS = [
  { rank: 1, name: "Jamie",   flag: "🇦🇺", match: 72, bonus: 15, total: 87, exact: 8,  you: false, owner: true  },
  { rank: 2, name: "Sarah",   flag: "🇬🇧", match: 64, bonus: 10, total: 74, exact: 6,  you: false, owner: false },
  { rank: 3, name: "Marcus",  flag: "🇧🇷", match: 58, bonus:  5, total: 63, exact: 5,  you: false, owner: false },
  { rank: 4, name: "Dylan",   flag: "🇺🇸", match: 47, bonus: 10, total: 57, exact: 4,  you: true,  owner: false },
  { rank: 5, name: "Priya",   flag: "🇮🇳", match: 42, bonus:  5, total: 47, exact: 3,  you: false, owner: false },
  { rank: 6, name: "Lars",    flag: "🇳🇴", match: 37, bonus:  0, total: 37, exact: 2,  you: false, owner: false },
  { rank: 7, name: "Kenji",   flag: "🇯🇵", match: 29, bonus:  5, total: 34, exact: 1,  you: false, owner: false },
  { rank: 8, name: "Amara",   flag: "🇸🇳", match: 24, bonus:  0, total: 24, exact: 0,  you: false, owner: false },
];

// 20 completed matches with MY predictions + points
// pts: 5=exact, 3=correct GD, 2=correct result, 0=wrong
const RESULTS: Array<{
  matchday: number;
  group:    string;
  home:     string; homeFl: string; homeScore: number;
  away:     string; awayFl: string; awayScore: number;
  myHome:   number; myAway: number; pts: number;
}> = [
  // ── Matchday 1 ────────────────────────────────────────────
  { matchday:1, group:"A", home:"USA",         homeFl:"🇺🇸", homeScore:1, away:"New Zealand",  awayFl:"🇳🇿", awayScore:0, myHome:2, myAway:0, pts:2 },
  { matchday:1, group:"A", home:"Brazil",      homeFl:"🇧🇷", homeScore:3, away:"Canada",       awayFl:"🇨🇦", awayScore:1, myHome:3, myAway:0, pts:2 },
  { matchday:1, group:"B", home:"England",     homeFl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", homeScore:2, away:"Morocco",      awayFl:"🇲🇦", awayScore:1, myHome:1, myAway:0, pts:3 },
  { matchday:1, group:"B", home:"Argentina",   homeFl:"🇦🇷", homeScore:1, away:"Japan",        awayFl:"🇯🇵", awayScore:1, myHome:2, myAway:0, pts:0 },
  { matchday:1, group:"C", home:"Spain",       homeFl:"🇪🇸", homeScore:3, away:"Saudi Arabia", awayFl:"🇸🇦", awayScore:0, myHome:2, myAway:0, pts:2 },
  { matchday:1, group:"C", home:"France",      homeFl:"🇫🇷", homeScore:2, away:"Mexico",       awayFl:"🇲🇽", awayScore:2, myHome:2, myAway:1, pts:0 },
  { matchday:1, group:"D", home:"Germany",     homeFl:"🇩🇪", homeScore:2, away:"Ghana",        awayFl:"🇬🇭", awayScore:0, myHome:2, myAway:0, pts:5 },
  { matchday:1, group:"D", home:"Portugal",    homeFl:"🇵🇹", homeScore:4, away:"Australia",    awayFl:"🇦🇺", awayScore:1, myHome:3, myAway:1, pts:2 },
  { matchday:1, group:"E", home:"Netherlands", homeFl:"🇳🇱", homeScore:2, away:"South Korea",  awayFl:"🇰🇷", awayScore:1, myHome:2, myAway:0, pts:2 },
  { matchday:1, group:"E", home:"Senegal",     homeFl:"🇸🇳", homeScore:1, away:"Ecuador",      awayFl:"🇪🇨", awayScore:0, myHome:1, myAway:0, pts:5 },
  // ── Matchday 2 ────────────────────────────────────────────
  { matchday:2, group:"A", home:"Brazil",      homeFl:"🇧🇷", homeScore:2, away:"New Zealand",  awayFl:"🇳🇿", awayScore:0, myHome:3, myAway:1, pts:3 },
  { matchday:2, group:"A", home:"USA",         homeFl:"🇺🇸", homeScore:1, away:"Canada",       awayFl:"🇨🇦", awayScore:1, myHome:0, myAway:0, pts:3 },
  { matchday:2, group:"B", home:"Argentina",   homeFl:"🇦🇷", homeScore:2, away:"Morocco",      awayFl:"🇲🇦", awayScore:1, myHome:2, myAway:0, pts:2 },
  { matchday:2, group:"B", home:"England",     homeFl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", homeScore:3, away:"Japan",        awayFl:"🇯🇵", awayScore:0, myHome:2, myAway:0, pts:2 },
  { matchday:2, group:"C", home:"France",      homeFl:"🇫🇷", homeScore:1, away:"Saudi Arabia", awayFl:"🇸🇦", awayScore:0, myHome:2, myAway:0, pts:2 },
  { matchday:2, group:"C", home:"Spain",       homeFl:"🇪🇸", homeScore:2, away:"Mexico",       awayFl:"🇲🇽", awayScore:1, myHome:2, myAway:1, pts:5 },
  { matchday:2, group:"D", home:"Portugal",    homeFl:"🇵🇹", homeScore:2, away:"Ghana",        awayFl:"🇬🇭", awayScore:0, myHome:2, myAway:0, pts:5 },
  { matchday:2, group:"D", home:"Germany",     homeFl:"🇩🇪", homeScore:1, away:"Australia",    awayFl:"🇦🇺", awayScore:1, myHome:2, myAway:1, pts:0 },
  { matchday:2, group:"E", home:"Netherlands", homeFl:"🇳🇱", homeScore:3, away:"Ecuador",      awayFl:"🇪🇨", awayScore:0, myHome:2, myAway:0, pts:2 },
  { matchday:2, group:"E", home:"South Korea", homeFl:"🇰🇷", homeScore:2, away:"Senegal",      awayFl:"🇸🇳", awayScore:1, myHome:1, myAway:0, pts:0 },
];

// Upcoming fixtures (Matchday 3)
const UPCOMING = [
  { kickoff:"Tue 24 Jun · 15:00", group:"A", home:"Brazil",    homeFl:"🇧🇷", away:"Canada",      awayFl:"🇨🇦" },
  { kickoff:"Tue 24 Jun · 15:00", group:"A", home:"USA",       homeFl:"🇺🇸", away:"New Zealand", awayFl:"🇳🇿" },
  { kickoff:"Tue 24 Jun · 19:00", group:"B", home:"Argentina", homeFl:"🇦🇷", away:"Japan",       awayFl:"🇯🇵" },
  { kickoff:"Tue 24 Jun · 19:00", group:"B", home:"England",   homeFl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", away:"Morocco",    awayFl:"🇲🇦" },
  { kickoff:"Wed 25 Jun · 15:00", group:"C", home:"Spain",     homeFl:"🇪🇸", away:"France",      awayFl:"🇫🇷" },
];

// My stats
const MY_STATS = {
  rank:       4,
  total:      57,
  matchPts:   47,
  bonusPts:   10,
  exact:       4,
  predicted:  20,
  available:  20,
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: GOLD, background: `${GOLD}18` }}>1</span>
  );
  if (rank === 2) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: "#8899aa", background: "#8899aa18" }}>2</span>
  );
  if (rank === 3) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: "#cd7c32", background: "#cd7c3218" }}>3</span>
  );
  return (
    <span className="w-7 h-7 flex items-center justify-center text-xs" style={{ color: MUTED }}>
      {rank}
    </span>
  );
}

function PtsBadge({ pts }: { pts: number }) {
  if (pts === 5) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
      style={{ color: GOLD, background: `${GOLD}18` }}>⚡ 5pts</span>
  );
  if (pts === 3) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
      style={{ color: GREEN, background: `${GREEN}12` }}>✓ 3pts</span>
  );
  if (pts === 2) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
      style={{ color: MUTED, background: "#f0f3ef" }}>~ 2pts</span>
  );
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
      style={{ color: "#b91c1c", background: "#fef2f2" }}>✗ 0pts</span>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function DemoPage() {
  const recent = [...RESULTS].reverse().slice(0, 5);

  return (
    <div className="flex-1 flex flex-col" style={{ background: BG }}>
      <div className="max-w-2xl mx-auto w-full px-4 pt-5 pb-16 flex flex-col gap-5">

        {/* ── Demo banner ──────────────────────────────────── */}
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs"
          style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}40`, color: "#92400e" }}>
          <span className="font-bold">👁 Demo league</span>
          <span className="opacity-70">— realistic data, halfway through the group stage</span>
          <Link href="/predict" className="ml-auto font-semibold hover:underline shrink-0" style={{ color: GOLD }}>
            Go live →
          </Link>
        </div>

        {/* ── League header ─────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {/* Green top bar */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ background: GREEN }}>
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-60 text-white">Private League</p>
              <h1 className="text-lg font-extrabold text-white leading-tight">{LEAGUE.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* WhatsApp share */}
              <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: "#25D366", color: "#fff" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share
              </button>
            </div>
          </div>

          {/* Invite code strip */}
          <div className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span className="text-xs" style={{ color: MUTED }}>Invite code</span>
            <code className="text-xs font-mono font-bold tracking-widest px-2.5 py-1 rounded-md"
              style={{ background: BG, color: TEXT1, border: `1px solid ${BORDER}` }}>
              {LEAGUE.code}
            </code>
            <button className="text-[10px] px-2.5 py-1 rounded-full font-semibold ml-1"
              style={{ border: `1px solid ${BORDER}`, color: TEXT2, background: BG }}>
              Copy link
            </button>
            <span className="ml-auto text-xs" style={{ color: MUTED }}>8 members</span>
          </div>

          {/* Progress strip */}
          <div className="px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
                  {LEAGUE.stage}
                </span>
                <span className="text-[10px] font-bold" style={{ color: TEXT2 }}>
                  {LEAGUE.matchday} / {LEAGUE.totalGames} matches played
                </span>
              </div>
              <div className="h-1.5 rounded-full w-full" style={{ background: BORDER }}>
                <div className="h-1.5 rounded-full" style={{
                  background: `linear-gradient(to right, ${GREEN}, #2d6a4f)`,
                  width: `${(LEAGUE.matchday / LEAGUE.totalGames) * 100}%`,
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── My stats ──────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {/* Header */}
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
              My Standing
            </span>
            <span className="text-[10px]" style={{ color: MUTED }}>20 of 20 predicted ✓</span>
          </div>

          <div className="px-4 py-3 flex items-center gap-4">
            {/* Rank */}
            <div className="flex flex-col items-center px-4 py-2 rounded-xl shrink-0"
              style={{ background: BG, border: `1px solid ${BORDER}` }}>
              <span className="text-2xl font-black number-display leading-none" style={{ color: TEXT1 }}>4th</span>
              <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: MUTED }}>Rank</span>
            </div>

            {/* Points breakdown */}
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center px-2 py-2 rounded-xl"
                style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}20` }}>
                <span className="text-xl font-black number-display leading-none" style={{ color: GREEN }}>{MY_STATS.total}</span>
                <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: MUTED }}>Total</span>
              </div>
              <div className="flex flex-col items-center px-2 py-2 rounded-xl"
                style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <span className="text-xl font-black number-display leading-none" style={{ color: TEXT1 }}>{MY_STATS.matchPts}</span>
                <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: MUTED }}>Match</span>
              </div>
              <div className="flex flex-col items-center px-2 py-2 rounded-xl"
                style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}>
                <span className="text-xl font-black number-display leading-none" style={{ color: GOLD }}>+{MY_STATS.bonusPts}</span>
                <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: MUTED }}>Bonus</span>
              </div>
            </div>
          </div>

          {/* Exact scores callout */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}>
              <span className="text-sm">⚡</span>
              <span className="text-xs font-semibold" style={{ color: "#92400e" }}>
                {MY_STATS.exact} exact scores — keep it up to overtake Marcus
              </span>
            </div>
          </div>
        </div>

        {/* ── Leaderboard ───────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>

          {/* Header */}
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
              Standings
            </span>
            <span className="text-[10px]" style={{ color: MUTED }}>after 20 matches</span>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="w-7 shrink-0" />
            <span className="flex-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Player</span>
            <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: MUTED }}>Match</span>
            <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: GOLD }}>Bonus</span>
            <span className="w-16 text-right text-[10px] uppercase tracking-widest font-semibold" style={{ color: GREEN }}>Total</span>
          </div>

          {/* Rows */}
          {PLAYERS.map((p, i) => {
            const isFirst = i === 0;
            const prev    = PLAYERS[i - 1];
            const gap     = prev ? prev.total - p.total : null;

            return (
              <div key={p.name}>
                {/* Gap annotation between positions */}
                {gap !== null && gap <= 7 && gap >= 1 && (
                  <div className="px-4 py-1 text-center"
                    style={{ background: gap <= 3 ? "#fef9e7" : BG, borderBottom: `1px solid ${BORDER}` }}>
                    <span className="text-[9px] font-semibold" style={{ color: gap <= 3 ? "#92400e" : MUTED }}>
                      {gap <= 3 ? `🔥 Only ${gap}pt gap` : `${gap}pts behind`}
                    </span>
                  </div>
                )}

                <div
                  className="flex items-center gap-2 px-3 py-3"
                  style={{
                    borderBottom: `1px solid ${BORDER}`,
                    background:   p.you ? "#eef3ec" : undefined,
                    borderLeft:   p.you ? `3px solid ${GREEN}` : "3px solid transparent",
                  }}
                >
                  <RankBadge rank={p.rank} />

                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm shrink-0">{p.flag}</span>
                    <span className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{p.name}</span>
                    {p.owner && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ color: GOLD, background: `${GOLD}15` }}>👑 CAPTAIN</span>
                    )}
                    {p.you && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}30` }}>YOU</span>
                    )}
                    {p.exact > 0 && (
                      <span className="text-[9px] tabular-nums" style={{ color: MUTED }}>⚡{p.exact}</span>
                    )}
                  </div>

                  <span className="w-12 text-right text-xs tabular-nums hidden sm:block" style={{ color: TEXT2 }}>
                    {p.match}
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums hidden sm:block"
                    style={{ color: p.bonus > 0 ? GOLD : MUTED }}>
                    {p.bonus > 0 ? `+${p.bonus}` : "—"}
                  </span>
                  <span className="w-16 text-right font-bold text-sm tabular-nums" style={{ color: GREEN }}>
                    {p.total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Recent results — MY predictions ───────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: TEXT1 }}>Recent Results — My Picks</h2>
            <span className="text-[10px]" style={{ color: MUTED }}>last 5 matches</span>
          </div>

          {recent.map((m, i) => {
            const exact  = m.pts === 5 || m.pts === 3;
            const pickBg = exact ? "#fdf9ee" : m.pts === 2 ? "#eef8f0" : "#fafafa";
            const pickBorder = exact ? "#e8d48a" : m.pts === 2 ? "#86c99a" : BORDER;
            const accent = exact ? GOLD : m.pts === 2 ? GREEN : MUTED;

            return (
              <div key={i} className="rounded-xl overflow-hidden"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}>

                {/* Match header */}
                <div className="flex items-center gap-1.5 px-3 py-1.5"
                  style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: MUTED }}>
                    Group {m.group} · Matchday {m.matchday}
                  </span>
                  <span className="text-[9px] ml-auto" style={{ color: MUTED }}>FT</span>
                </div>

                {/* Teams + result */}
                <div className="flex items-center gap-2 px-3 py-3">
                  {/* Home */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xl leading-none shrink-0">{m.homeFl}</span>
                    <span className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{m.home}</span>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-1 shrink-0 px-2">
                    <span className="text-xl font-black tabular-nums number-display" style={{ color: NAVY }}>{m.homeScore}</span>
                    <span className="font-bold" style={{ color: BORDER }}>–</span>
                    <span className="text-xl font-black tabular-nums number-display" style={{ color: NAVY }}>{m.awayScore}</span>
                  </div>

                  {/* Away */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-row-reverse">
                    <span className="text-xl leading-none shrink-0">{m.awayFl}</span>
                    <span className="text-sm font-semibold truncate text-right" style={{ color: TEXT1 }}>{m.away}</span>
                  </div>
                </div>

                {/* My pick strip */}
                <div className="flex items-center gap-2 px-3 py-2"
                  style={{ background: pickBg, borderTop: `2px solid ${pickBorder}` }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: accent }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: accent }}>
                    {m.pts === 5 ? "Exact Score" : "My Pick"}
                  </span>
                  <span className="text-base font-black tabular-nums leading-none" style={{ color: accent }}>
                    {m.myHome}–{m.myAway}
                  </span>
                  <PtsBadge pts={m.pts} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── All 20 matches summary table ─────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: MUTED }}>All Predictions</span>
            <span className="text-[10px]" style={{ color: MUTED }}>
              {MY_STATS.matchPts}pts from 20 matches — avg {(MY_STATS.matchPts / 20).toFixed(1)} per game
            </span>
          </div>

          {/* Totals bar */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            {[
              { label: "Exact ⚡", count: RESULTS.filter(r=>r.pts===5).length, color: GOLD   },
              { label: "Correct GD", count: RESULTS.filter(r=>r.pts===3).length, color: GREEN  },
              { label: "Correct result", count: RESULTS.filter(r=>r.pts===2).length, color: MUTED  },
              { label: "Wrong",   count: RESULTS.filter(r=>r.pts===0).length, color: "#b91c1c" },
            ].map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center px-1 py-1 rounded-lg"
                style={{ border: `1px solid ${BORDER}` }}>
                <span className="text-lg font-black number-display leading-none" style={{ color: s.color }}>{s.count}</span>
                <span className="text-[9px] text-center mt-0.5" style={{ color: MUTED }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* All matches list — compact */}
          {RESULTS.map((m, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: `1px solid ${BORDER}` }}>
              <span className="text-[9px] w-5 shrink-0 text-center font-bold"
                style={{ color: m.pts === 5 ? GOLD : m.pts === 3 ? GREEN : m.pts === 2 ? MUTED : "#b91c1c" }}>
                {m.pts === 5 ? "⚡" : m.pts === 3 ? "✓" : m.pts === 2 ? "~" : "✗"}
              </span>
              <span className="text-xs flex-1 truncate" style={{ color: TEXT2 }}>
                {m.homeFl} {m.home} <span style={{ color: NAVY, fontWeight: 700 }}>{m.homeScore}–{m.awayScore}</span> {m.away} {m.awayFl}
              </span>
              <span className="text-[10px] tabular-nums shrink-0" style={{ color: MUTED }}>
                my: {m.myHome}–{m.myAway}
              </span>
              <span className="text-[10px] font-bold tabular-nums w-8 text-right shrink-0"
                style={{ color: m.pts === 5 ? GOLD : m.pts >= 2 ? GREEN : MUTED }}>
                {m.pts > 0 ? `+${m.pts}` : "0"}
              </span>
            </div>
          ))}
        </div>

        {/* ── Upcoming fixtures ─────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: TEXT1 }}>Predict Next — Matchday 3</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}30` }}>
              5 to predict
            </span>
          </div>

          {UPCOMING.map((m, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5"
                style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: MUTED }}>
                  Group {m.group}
                </span>
                <span className="text-[9px] ml-auto font-semibold" style={{ color: "#d97706" }}>
                  ⏱ {m.kickoff}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-3">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-xl leading-none shrink-0">{m.homeFl}</span>
                  <span className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{m.home}</span>
                </div>
                <div className="flex items-center justify-center shrink-0 px-2">
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>vs</span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-row-reverse">
                  <span className="text-xl leading-none shrink-0">{m.awayFl}</span>
                  <span className="text-sm font-semibold truncate text-right" style={{ color: TEXT1 }}>{m.away}</span>
                </div>
              </div>
              {/* Predict CTA strip */}
              <div className="px-3 py-2 flex items-center gap-2"
                style={{ background: `${GREEN}08`, borderTop: `1px solid ${GREEN}20` }}>
                <span className="text-[10px]" style={{ color: MUTED }}>Not predicted yet</span>
                <Link href="/predict" className="ml-auto text-[10px] font-bold px-3 py-1 rounded-full"
                  style={{ background: GREEN, color: "#fff" }}>
                  Predict →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bonus questions callout ───────────────────────── */}
        <div className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}>
          <span className="text-2xl shrink-0">🏆</span>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: TEXT1 }}>Bonus questions — 90pts up for grabs</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT2 }}>
              You have 10 bonus points. Jamie has 15. Answer all 7 questions before the tournament starts to close the gap.
            </p>
            <Link href="/predict/bonus"
              className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: GOLD, color: "#fff" }}>
              View Bonus Questions →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
