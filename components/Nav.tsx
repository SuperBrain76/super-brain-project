"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export default function Nav() {
  const { user, loading, signOut } = useAuth();
  const pathname  = usePathname();
  const isAdmin   = !!user && user.email === ADMIN_EMAIL;

  return (
    <header className="sticky top-0 z-50 border-b border-cockpit-border bg-cockpit-bg bg-opacity-95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-sm bg-cockpit-accent flex items-center justify-center">
            <span className="text-cockpit-bg font-black text-xs tracking-tighter">SB</span>
          </div>
          <span className="font-bold tracking-widest text-sm text-white group-hover:text-cockpit-accent transition-colors">
            SUPERBRAIN
          </span>
        </Link>

        {/* Centre links — Tests always visible, Leaderboard md+ only */}
        <nav className="flex items-center gap-1">
          <Link
            href="/tests"
            className={`px-3 py-2 rounded-sm text-sm tracking-wide transition-colors ${
              pathname.startsWith("/tests")
                ? "text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                : "text-cockpit-dim hover:text-cockpit-text"
            }`}
          >
            Tests
          </Link>
          <Link
            href="/battle"
            className={`px-3 py-2 rounded-sm text-sm tracking-wide transition-colors ${
              pathname.startsWith("/battle")
                ? "text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                : "text-cockpit-dim hover:text-cockpit-text"
            }`}
          >
            Battle
          </Link>
          <Link
            href="/leaderboard"
            className={`hidden md:block px-3 py-2 rounded-sm text-sm tracking-wide transition-colors ${
              pathname.startsWith("/leaderboard")
                ? "text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                : "text-cockpit-dim hover:text-cockpit-text"
            }`}
          >
            Leaderboard
          </Link>
        </nav>

        {/* Auth controls */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden md:block text-cockpit-dim hover:text-cockpit-text text-sm px-3 py-2 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/settings/profile"
                className="hidden md:block text-cockpit-muted hover:text-cockpit-dim text-sm px-3 py-2 transition-colors"
                title="Profile settings"
              >
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`hidden md:block text-xs px-2.5 py-1.5 rounded-sm border transition-colors ${
                    pathname.startsWith("/admin")
                      ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
                      : "text-amber-500/70 border-amber-500/20 hover:border-amber-500/50 hover:text-amber-400"
                  }`}
                >
                  Admin
                </Link>
              )}
              <button
                onClick={signOut}
                className="text-cockpit-muted hover:text-cockpit-red text-sm px-3 py-2 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm border border-cockpit-border px-4 py-1.5 rounded-sm text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors"
            >
              {loading ? "…" : "Login"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
