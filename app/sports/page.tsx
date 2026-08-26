/**
 * /sports — the sports hub.
 *
 * "Sports" in the nav lands here: choose a competition to predict, rather than
 * being dropped into one. Football today (five leagues); built so more sports
 * slot in later.
 */

import LeagueChooser from "@/components/LeagueChooser";
import MatchdayEntry from "@/components/MatchdayEntry";
import { BRAND } from "@/lib/brand";

export default function SportsHubPage() {
  return (
    <div className="min-h-screen" style={{ background: BRAND.black, color: BRAND.ink }}>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="mb-8">
          <p className="text-xs tracking-[0.28em] uppercase mb-2" style={{ color: BRAND.dim }}>Sports</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold" style={{ color: BRAND.ink }}>Choose a competition</h1>
          <p className="text-sm mt-2" style={{ color: BRAND.muted }}>
            Pick a league and start predicting — one tap a match, free.
          </p>
        </div>

        {/* Football */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⚽</span>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Football</h2>
        </div>
        <LeagueChooser sport="football" />

        {/* Ice Hockey */}
        <div className="flex items-center gap-2 mb-3 mt-8">
          <span className="text-lg">🏒</span>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Ice Hockey</h2>
        </div>
        <LeagueChooser sport="ice_hockey" />

        {/* Rugby */}
        <div className="flex items-center gap-2 mb-3 mt-8">
          <span className="text-lg">🏉</span>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Rugby</h2>
        </div>
        <LeagueChooser sport="rugby" />

        {/* Motorsport */}
        <div className="flex items-center gap-2 mb-3 mt-8">
          <span className="text-lg">🏎️</span>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Motorsport</h2>
        </div>
        <LeagueChooser sport="motorsport" />

        {/* Matchday Challenge — the cross-league venue game; no home under any
            single competition, so it gets its own entry point here. */}
        <MatchdayEntry />

        {/* Room to grow */}
        <div className="mt-8 rounded-2xl p-5 text-center" style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
          <p className="text-sm font-semibold" style={{ color: BRAND.muted }}>More leagues and sports are on the way.</p>
          <p className="text-xs mt-1" style={{ color: BRAND.dim }}>Champions League and the NHL are next up.</p>
        </div>
      </div>
    </div>
  );
}
