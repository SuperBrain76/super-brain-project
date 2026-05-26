"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

// Exact routes and prefixes that need full screen (no nav)
function isGameRoute(pathname: string): boolean {
  // Fighter pilot test — exact match only (/test ≠ /tests)
  if (pathname === "/test") return true;
  // Individual test routes (not /tests listing page)
  const GAME_PREFIXES = [
    "/tests/reaction", "/tests/stroop", "/tests/tap-speed",
    "/tests/verbal-memory", "/tests/memory", "/tests/pressure",
    "/tests/focus", "/tests/career-profile", "/tests/matrix",
    "/battle/", // match rooms only — /battle hub keeps the nav
  ];
  return GAME_PREFIXES.some((p) => pathname.startsWith(p));
}

const INACTIVE = "#7a8fa6";
const ACTIVE   = "#00d4ff";

function IconTests({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function IconBattle({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
      <path d="M13 19l6-6"/>
      <path d="M2 2l20 20"/>
    </svg>
  );
}

function IconLeaderboard({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round">
      <polyline points="18 20 18 10"/>
      <polyline points="12 20 12 4"/>
      <polyline points="6 20 6 14"/>
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (isGameRoute(pathname)) return null;

  const tabs = [
    { href: "/tests",       label: "Tests",    Icon: IconTests,       match: "/tests" },
    { href: "/battle",      label: "Battle",   Icon: IconBattle,      match: "/battle" },
    { href: "/leaderboard", label: "Rankings", Icon: IconLeaderboard, match: "/leaderboard" },
    {
      href:  user ? "/profile" : "/login",
      label: user ? "Profile"  : "Sign In",
      Icon:  IconProfile,
      match: user ? "/profile"  : "/login",
    },
  ];

  return (
    <>
      {/* Push page content up so nothing hides behind the fixed bar */}
      <div className="h-16 md:hidden" />

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          background:    "#111827",
          borderTop:     "1px solid #2a3a4a",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tabs.map(({ href, label, Icon, match }) => {
          const active = pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 active:opacity-60 transition-opacity"
            >
              {/* Active top indicator */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: ACTIVE }}
                />
              )}
              <Icon active={active} />
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: active ? ACTIVE : INACTIVE }}
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
