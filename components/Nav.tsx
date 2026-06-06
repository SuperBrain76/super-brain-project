"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export default function Nav() {
  const { user, loading, signOut } = useAuth();
  const pathname   = usePathname();
  const isAdmin    = !!user && user.email === ADMIN_EMAIL;
  const isPredict  = pathname.startsWith("/predict");

  // On predictor pages the nav sits on a white background — swap colours accordingly
  const headerStyle = isPredict
    ? { background: "rgba(255,255,255,0.97)", borderBottom: "1px solid #dde3ec" }
    : undefined;

  const logoTextCls   = isPredict ? "text-slate-800 group-hover:text-green-700" : "text-white group-hover:text-cockpit-accent";
  const logoBgCls     = isPredict ? "bg-green-600" : "bg-cockpit-accent";
  const logoTextColor = isPredict ? "#fff" : "#080b0f";

  function navLinkCls(prefix: string) {
    const active = pathname.startsWith(prefix);
    if (prefix === "/predict") {
      // Predictor link always gets the football green treatment
      return active
        ? "px-3 py-1.5 rounded-full text-sm font-semibold transition-colors bg-green-600 text-white"
        : "px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border border-green-600 text-green-700 hover:bg-green-600 hover:text-white";
    }
    if (isPredict) {
      // On predictor pages, other links render in dark-on-white
      return active
        ? "px-3 py-2 rounded-sm text-sm font-medium transition-colors text-slate-900 bg-slate-100"
        : "px-3 py-2 rounded-sm text-sm font-medium transition-colors text-slate-500 hover:text-slate-800";
    }
    return active
      ? "px-3 py-2 rounded-sm text-sm tracking-wide transition-colors text-cockpit-accent bg-cockpit-accent bg-opacity-10"
      : "px-3 py-2 rounded-sm text-sm tracking-wide transition-colors text-cockpit-dim hover:text-cockpit-text";
  }

  const authLinkCls = isPredict
    ? "text-sm border border-slate-300 px-4 py-1.5 rounded-full text-slate-600 hover:border-green-600 hover:text-green-700 transition-colors"
    : "text-sm border border-cockpit-border px-4 py-1.5 rounded-sm text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors";

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-sm"
      style={headerStyle ?? { borderBottom: "1px solid var(--ps-border, #1e2a38)", background: "rgba(8,11,15,0.95)" }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className={`w-7 h-7 rounded-sm ${logoBgCls} flex items-center justify-center`}>
            <span className="font-black text-xs tracking-tighter" style={{ color: logoTextColor }}>SB</span>
          </div>
          <span className={`font-bold tracking-widest text-sm transition-colors ${logoTextCls}`}>
            SUPERBRAIN
          </span>
        </Link>

        {/* Centre nav */}
        <nav className="flex items-center gap-1">
          <Link href="/tests" className={navLinkCls("/tests")}>
            Brain Tests
          </Link>
          <Link href="/predict" className={navLinkCls("/predict")}>
            ⚽ Predictor
          </Link>
          <Link href="/battle" className={`hidden md:block ${navLinkCls("/battle")}`}>
            Battle
          </Link>
          <Link href="/leaderboard" className={`hidden md:block ${navLinkCls("/leaderboard")}`}>
            Global Rankings
          </Link>
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link
                href="/profile"
                className={`hidden md:block text-sm px-3 py-2 transition-colors ${isPredict ? "text-slate-500 hover:text-slate-800" : "text-cockpit-dim hover:text-cockpit-text"}`}
              >
                Dashboard
              </Link>
              <Link
                href="/settings/profile"
                className={`hidden md:block text-sm px-3 py-2 transition-colors ${isPredict ? "text-slate-400 hover:text-slate-600" : "text-cockpit-muted hover:text-cockpit-dim"}`}
                title="Profile settings"
              >
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`hidden md:block text-xs px-2.5 py-1.5 rounded-sm border transition-colors ${
                    pathname.startsWith("/admin")
                      ? "text-amber-600 border-amber-400/40 bg-amber-50"
                      : "text-amber-600/70 border-amber-400/30 hover:border-amber-500/60 hover:text-amber-600"
                  }`}
                >
                  Admin
                </Link>
              )}
              <button
                onClick={signOut}
                title="Sign out"
                className={`text-sm px-3 py-2 transition-colors ${isPredict ? "text-slate-400 hover:text-red-600" : "text-cockpit-muted hover:text-cockpit-red"}`}
              >
                <span className="hidden md:inline">Sign out</span>
                <svg className="md:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </>
          ) : (
            <Link href="/login" className={authLinkCls}>
              {loading ? "…" : "Login"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
