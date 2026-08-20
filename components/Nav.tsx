"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCompetitionNav, useIsCompetitionRoute } from "@/components/CompetitionProvider";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export default function Nav() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  // Venue owners get a way into their backoffice from any page. The venues
  // "owner reads own venue" RLS policy makes this a cheap, safe client read.
  const [ownsVenue, setOwnsVenue] = useState(false);
  useEffect(() => {
    if (!user) { setOwnsVenue(false); return; }
    supabase.from("venues").select("id").eq("owner_user_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => setOwnsVenue(!!data));
  }, [user]);

  // Competition Engine V2: the predictor no longer lives under a single
  // /predict prefix — it is /premier-league, /la-liga, /wc2026. Section
  // detection and link building both go through the competition hooks.
  const isPredict = useIsCompetitionRoute();
  const { slug: compSlug, name: compName } = useCompetitionNav();

  // While the slug resolves, fall back to /predict — it redirects to the
  // same destination, so a link is never dead.
  const compHref = (sub = "") => (compSlug ? `/${compSlug}${sub}` : `/predict${sub}`);

  function NavLink({ href, label, accent, className = "" }: { href: string; label: string; accent: string; className?: string }) {
    const hubHref = compHref();
    const active = href === hubHref ? pathname === hubHref : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`px-3 py-2 text-sm transition-colors ${className}`}
        style={{ color: active ? accent : BRAND.muted, fontWeight: active ? 600 : 500 }}
      >
        {label}
      </Link>
    );
  }

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{ background: "rgba(11,11,13,0.92)", borderBottom: `0.5px solid ${BRAND.hairline}` }}
    >
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Logo — monochrome; gold is reserved for value, not the wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: BRAND.elevated, border: `0.5px solid ${BRAND.hairlineStrong}` }}
          >
            <span className="font-black text-[11px] tracking-tighter" style={{ color: BRAND.ink }}>SB</span>
          </div>
          <span className="font-semibold text-sm tracking-[0.18em]" style={{ color: BRAND.ink }}>SUPERBRAIN</span>
        </Link>

        {/* Centre nav — desktop only; mobile uses the bottom bar (less noise) */}
        <nav className="hidden md:flex items-center gap-0.5">
          {isPredict ? (
            <>
              <NavLink href={compHref()} label={compName} accent={BRAND.sports} />
              <NavLink href={compHref("/leagues")} label="My Leagues" accent={BRAND.sports} className="hidden sm:block" />
              <NavLink href={compHref("/leaderboard")} label="Rankings" accent={BRAND.neutral} className="hidden md:block" />
            </>
          ) : (
            <>
              <NavLink href="/tests" label="Brain Tests" accent={BRAND.tests} />
              <NavLink href="/sports" label="Sports" accent={BRAND.sports} />
              <NavLink href="/battle" label="Battle" accent={BRAND.battle} className="hidden md:block" />
              <NavLink href="/leaderboard" label="Rankings" accent={BRAND.neutral} className="hidden md:block" />
            </>
          )}
        </nav>

        {/* Right — account */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <NavLink href="/iq" label="You" accent={BRAND.ink} className="hidden md:block" />
              <Link
                href="/settings/profile"
                className="hidden md:block text-sm px-3 py-2 transition-colors"
                style={{ color: BRAND.dim }}
              >
                Settings
              </Link>
              {ownsVenue && (
                <Link
                  href="/venues/admin"
                  className="text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
                  style={{ color: BRAND.gold, border: `0.5px solid ${BRAND.hairlineStrong}` }}
                >
                  Venue Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden md:block text-xs px-2.5 py-1.5 rounded-md transition-colors"
                  style={{ color: BRAND.gold, border: `0.5px solid ${BRAND.hairlineStrong}` }}
                >
                  Admin
                </Link>
              )}
              <button
                onClick={signOut}
                title="Sign out"
                className="text-sm px-3 py-2 transition-colors"
                style={{ color: BRAND.dim }}
              >
                <span className="hidden md:inline">Sign out</span>
                <svg className="md:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-bold px-4 py-1.5 rounded-full transition-transform active:scale-95 whitespace-nowrap"
              style={{ background: BRAND.gold, color: BRAND.goldInk }}
            >
              {loading ? "…" : "Sign in"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
