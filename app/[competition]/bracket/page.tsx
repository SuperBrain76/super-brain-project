/**
 * /[competition]/bracket — Knockout path reference view.
 *
 * Shows all Round of 32 qualification paths + later-round structure.
 * 100% static — no auth, no Supabase. Display only.
 */

import Link from "next/link";
import { R32_BRACKET } from "@/lib/knockoutSeeds";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Seed pill ────────────────────────────────────────────────

function Pill({ label }: { label: string }) {
  const isGroup = !label.startsWith("W") && !label.startsWith("L");
  return (
    <span
      className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-sm leading-none tracking-wide"
      style={
        isGroup
          ? { color: "#7a5e14", background: "#fdf3d7", border: "1px solid #e8d48a" }
          : { color: "#5a6e60", background: "#eef3ec", border: "1px solid #c4d4c8" }
      }
    >
      {label}
    </span>
  );
}

// ── Match row ────────────────────────────────────────────────

function MatchRow({ fixtureNumber, home, away }: { fixtureNumber: number; home: string; away: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      {/* Match number */}
      <span
        className="text-[10px] font-bold w-8 shrink-0 text-center"
        style={{ color: MUTED }}
      >
        M{fixtureNumber}
      </span>

      {/* Home */}
      <div className="flex-1 flex justify-end">
        <Pill label={home} />
      </div>

      {/* vs */}
      <span className="text-[11px] font-semibold shrink-0" style={{ color: MUTED }}>vs</span>

      {/* Away */}
      <div className="flex-1">
        <Pill label={away} />
      </div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────

function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
        {title}
      </h2>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{sub}</p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function BracketPage(
  { params }: { params: { competition: string } },
) {
  // Server component: the competition comes from the route params
  // prop, not useParams — no client boundary needed for a static page.
  const competitionSlug = params.competition;

  // Split R32 into two halves for visual grouping
  const half1 = R32_BRACKET.slice(0, 8);  // M73–M80
  const half2 = R32_BRACKET.slice(8, 16); // M81–M88

  return (
    <div className="flex-1" style={{ background: BG }}>
      <div className="max-w-lg mx-auto px-4 pt-5 pb-16 flex flex-col gap-5">

        {/* Back */}
        <div className="flex items-center gap-2">
          <Link
            href={`/${competitionSlug}`}
            className="text-xs flex items-center gap-1 hover:underline"
            style={{ color: MUTED }}
          >
            ← Fixtures
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-black tracking-tight" style={{ color: TEXT1 }}>
            Knockout Path
          </h1>
          <p className="text-sm mt-1" style={{ color: TEXT2 }}>
            Qualification paths for each knockout fixture. Teams are confirmed once the group stage ends.
          </p>
        </div>

        {/* Key */}
        <div
          className="flex flex-wrap gap-3 p-3 rounded-lg"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-2">
            <Pill label="1E" />
            <span className="text-[11px]" style={{ color: TEXT2 }}>Group winner (e.g. Group E)</span>
          </div>
          <div className="flex items-center gap-2">
            <Pill label="2A" />
            <span className="text-[11px]" style={{ color: TEXT2 }}>Runner-up (e.g. Group A)</span>
          </div>
          <div className="flex items-center gap-2">
            <Pill label="3ABCD" />
            <span className="text-[11px]" style={{ color: TEXT2 }}>Best 3rd from groups A/B/C/D</span>
          </div>
          <div className="flex items-center gap-2">
            <Pill label="W73" />
            <span className="text-[11px]" style={{ color: TEXT2 }}>Winner of Match 73</span>
          </div>
        </div>

        {/* R32 — half 1 */}
        <Section
          title="Round of 32 · Bracket A"
          sub="Matches 73–80 · Winners advance to R16 matches 89–92"
        />
        <div className="flex flex-col gap-2">
          {half1.map((m) => (
            <MatchRow key={m.fixtureNumber} {...m} />
          ))}
        </div>

        {/* R32 — half 2 */}
        <Section
          title="Round of 32 · Bracket B"
          sub="Matches 81–88 · Winners advance to R16 matches 93–96"
        />
        <div className="flex flex-col gap-2">
          {half2.map((m) => (
            <MatchRow key={m.fixtureNumber} {...m} />
          ))}
        </div>

        {/* R16 */}
        <Section
          title="Round of 16"
          sub="Winners of R32 pairs meet here (matches 89–96)"
        />
        <div className="flex flex-col gap-2">
          {[
            { fixtureNumber: 89,  home: "W73", away: "W74" },
            { fixtureNumber: 90,  home: "W75", away: "W76" },
            { fixtureNumber: 91,  home: "W77", away: "W78" },
            { fixtureNumber: 92,  home: "W79", away: "W80" },
            { fixtureNumber: 93,  home: "W81", away: "W82" },
            { fixtureNumber: 94,  home: "W83", away: "W84" },
            { fixtureNumber: 95,  home: "W85", away: "W86" },
            { fixtureNumber: 96,  home: "W87", away: "W88" },
          ].map((m) => (
            <MatchRow key={m.fixtureNumber} {...m} />
          ))}
        </div>

        {/* QF */}
        <Section title="Quarterfinals" sub="Matches 97–100" />
        <div className="flex flex-col gap-2">
          {[
            { fixtureNumber: 97,  home: "W89", away: "W90" },
            { fixtureNumber: 98,  home: "W91", away: "W92" },
            { fixtureNumber: 99,  home: "W93", away: "W94" },
            { fixtureNumber: 100, home: "W95", away: "W96" },
          ].map((m) => (
            <MatchRow key={m.fixtureNumber} {...m} />
          ))}
        </div>

        {/* SF */}
        <Section title="Semi-finals" sub="Matches 101–102" />
        <div className="flex flex-col gap-2">
          {[
            { fixtureNumber: 101, home: "W97",  away: "W98"  },
            { fixtureNumber: 102, home: "W99",  away: "W100" },
          ].map((m) => (
            <MatchRow key={m.fixtureNumber} {...m} />
          ))}
        </div>

        {/* 3rd + Final */}
        <Section title="Third Place & Final" />
        <div className="flex flex-col gap-2">
          {[
            { fixtureNumber: 103, home: "L101", away: "L102" },
            { fixtureNumber: 104, home: "W101", away: "W102" },
          ].map((m) => (
            <MatchRow key={m.fixtureNumber} {...m} />
          ))}
        </div>

        {/* CTA */}
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: GREEN, color: "#fff" }}
        >
          <div>
            <p className="text-sm font-bold">Predict the knockouts</p>
            <p className="text-xs opacity-70 mt-0.5">Predictions open once group stage ends</p>
          </div>
          <Link
            href={`/${competitionSlug}`}
            className="text-xs font-bold px-4 py-2 rounded-lg shrink-0"
            style={{ background: GOLD, color: "#0f1f17" }}
          >
            All fixtures →
          </Link>
        </div>

      </div>
    </div>
  );
}
