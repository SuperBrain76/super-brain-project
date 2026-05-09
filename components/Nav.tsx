"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const NAV_LINKS = [
  { href: "/tests",       label: "Tests" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Nav() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();

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

        {/* Centre links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-2 rounded-sm text-sm tracking-wide transition-colors ${
                pathname.startsWith(l.href)
                  ? "text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                  : "text-cockpit-dim hover:text-cockpit-text"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Auth controls — always rendered, swapped once auth resolves */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                href="/profile"
                className="text-cockpit-dim hover:text-cockpit-text text-sm px-3 py-2 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/settings/profile"
                className="text-cockpit-muted hover:text-cockpit-dim text-sm px-3 py-2 transition-colors"
                title="Profile settings"
              >
                Settings
              </Link>
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
