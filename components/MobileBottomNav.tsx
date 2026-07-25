"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCompetitionSlug, useIsCompetitionRoute } from "@/components/CompetitionProvider";
import { BRAND } from "@/lib/brand";

// Exact routes and prefixes that need full screen (no nav)
function isGameRoute(pathname: string): boolean {
  if (pathname === "/test") return true;
  const GAME_PREFIXES = [
    "/tests/reaction", "/tests/stroop", "/tests/tap-speed",
    "/tests/verbal-memory", "/tests/memory", "/tests/pressure",
    "/tests/focus", "/tests/career-profile", "/tests/matrix",
    "/battle/",
  ];
  return GAME_PREFIXES.some((p) => pathname.startsWith(p));
}

function IconTests({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconPredict({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 7l2 3-1.5 3H11.5L10 10l2-3z" />
      <path d="M10 10l-3 1M14 10l3 1M11.5 13l-1 3M12.5 13l1 3" />
    </svg>
  );
}
function IconBattle({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M2 2l20 20" />
    </svg>
  );
}
function IconLeaderboard({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <polyline points="18 20 18 10" /><polyline points="12 20 12 4" /><polyline points="6 20 6 14" />
    </svg>
  );
}
function IconYou({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

type Tab = { href: string; label: string; Icon: (p: { color: string }) => JSX.Element; match: string; accent: string };

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (isGameRoute(pathname)) return null;

  // Competition Engine V2: predictor routes are /premier-league, /la-liga,
  // /wc2026 — not a single /predict prefix.
  const isPredict = useIsCompetitionRoute();
  const compSlug  = useCompetitionSlug();
  // Falls back to /predict until the slug resolves; that route redirects.
  const compHref  = (sub = "") => (compSlug ? `/${compSlug}${sub}` : `/predict${sub}`);
  const youAccent = user ? BRAND.gold : BRAND.neutral; // gold = value (your IQ), only when signed in

  const predictorTabs: Tab[] = [
    { href: compHref(),             label: "Fixtures", Icon: IconPredict,     match: compHref(),             accent: BRAND.sports },
    { href: compHref("/leagues"),     label: "Leagues",  Icon: IconBattle,      match: compHref("/leagues"),     accent: BRAND.sports },
    { href: compHref("/leaderboard"), label: "Ranks",    Icon: IconLeaderboard, match: compHref("/leaderboard"), accent: BRAND.neutral },
    { href: user ? "/iq" : "/login", label: user ? "You" : "Sign in", Icon: IconYou, match: user ? "/iq" : "/login", accent: youAccent },
  ];

  const defaultTabs: Tab[] = [
    { href: "/tests",       label: "Tests",   Icon: IconTests,       match: "/tests",       accent: BRAND.tests },
    { href: compHref(),     label: "Sports",  Icon: IconPredict,     match: compHref(),     accent: BRAND.sports },
    { href: "/battle",      label: "Battle",  Icon: IconBattle,      match: "/battle",      accent: BRAND.battle },
    { href: "/leaderboard", label: "Ranks",   Icon: IconLeaderboard, match: "/leaderboard", accent: BRAND.neutral },
    { href: user ? "/iq" : "/login", label: user ? "You" : "Sign in", Icon: IconYou, match: user ? "/iq" : "/login", accent: youAccent },
  ];

  const tabs = isPredict ? predictorTabs : defaultTabs;

  return (
    <>
      <div className="h-16 md:hidden" />
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          background: BRAND.black,
          borderTop: `0.5px solid ${BRAND.hairline}`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tabs.map(({ href, label, Icon, match, accent }) => {
          // The hub tab must only light up ON the hub, not on every page
          // beneath it — otherwise all four tabs read as active.
          const active = (isPredict && match === compHref())
            ? pathname === compHref()
            : pathname.startsWith(match);
          const color = active ? accent : BRAND.dim;

          return (
            <Link
              key={href}
              href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-transform active:scale-95"
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: accent }}
                />
              )}
              <Icon color={color} />
              <span
                className="text-[10px] tracking-wide"
                style={{ color, fontWeight: active ? 600 : 500 }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
