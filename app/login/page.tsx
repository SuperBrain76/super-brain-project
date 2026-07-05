"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { track } from "@/lib/analytics";
import { signInWithGoogle, signInWithApple } from "@/lib/googleAuth";
import { BRAND, MATERIAL } from "@/lib/brand";

// ── Google "G" logo (official multicolor) ─────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

type Mode = "signin" | "signup";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [mode, setMode]               = useState<Mode>("signin");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError]             = useState(
    searchParams.get("error") === "confirmation_failed"
      ? "Confirmation link expired. Please sign in or request a new link."
      : "",
  );
  const [success,         setSuccess]         = useState("");
  const [awaitingVerify,  setAwaitingVerify]  = useState(false);
  const [resendBusy,      setResendBusy]      = useState(false);
  const [resendDone,      setResendDone]      = useState(false);
  const [busy,            setBusy]            = useState(false);
  const [googleBusy,      setGoogleBusy]      = useState(false);
  const [appleBusy,       setAppleBusy]       = useState(false);

  const next = searchParams.get("next") ?? "";

  useEffect(() => {
    if (!loading && user) router.replace(next || "/iq");
  }, [user, loading, router, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add the required environment variables.");
      return;
    }
    setError(""); setSuccess(""); setBusy(true);

    if (mode === "signup") {
      const name = displayName.trim() || email.split("@")[0];
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        },
      });
      setBusy(false);
      if (err) { setError(err.message); return; }
      track.signupCompleted();
      setAwaitingVerify(true);
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.push(next || "/iq");
  };

  const resendVerification = async () => {
    if (!email || resendBusy) return;
    setResendBusy(true);
    // Pass emailRedirectTo so the resent link also points at /auth/callback,
    // not the Supabase default (which may point to a different URL).
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      },
    });
    setResendBusy(false);
    setResendDone(true);
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add the required environment variables.");
      return;
    }
    setError(""); setSuccess(""); setGoogleBusy(true);
    track.googleLoginClicked("login_page");
    const err = await signInWithGoogle(next || undefined);
    if (err) { setError(err); setGoogleBusy(false); }
  };

  const handleApple = async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add the required environment variables.");
      return;
    }
    setError(""); setSuccess(""); setAppleBusy(true);
    const err = await signInWithApple(next || undefined);
    if (err) { setError(err); setAppleBusy(false); }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setSuccess("");
    setDisplayName("");
    setAwaitingVerify(false);
    setResendDone(false);
    if (next === "signup") track.signupStarted();
  };

  // ── "Check your email" screen ────────────────────────────
  if (awaitingVerify) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 py-16"
        style={{ background: MATERIAL.vignette }}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">

          {/* Icon */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(53,197,111,0.10)", border: `0.5px solid rgba(53,197,111,0.4)` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BRAND.sports} strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: BRAND.ink }}>
              Check your email
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-semibold" style={{ color: BRAND.ink }}>{email}</span>.
              Click it to activate your account.
            </p>
          </div>

          {/* Steps */}
          <div className="w-full rounded-2xl p-5 text-left flex flex-col gap-3"
            style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
            {[
              "Open the email from SuperBrain",
              'Click "Confirm your email"',
              "You'll be signed in automatically",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black"
                  style={{ background: BRAND.sports, color: "#04140B" }}>
                  {i + 1}
                </span>
                <p className="text-sm" style={{ color: BRAND.muted }}>{step}</p>
              </div>
            ))}
          </div>

          {/* Spam notice */}
          <div className="w-full rounded-2xl px-4 py-3 flex items-start gap-3 text-left"
            style={{ background: "rgba(232,193,90,0.06)", border: `0.5px solid ${BRAND.hairlineStrong}` }}>
            <span className="text-base shrink-0 mt-0.5">📬</span>
            <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>
              <span className="font-semibold" style={{ color: BRAND.ink }}>Can&apos;t find the email?</span>{" "}
              Check your <span className="font-semibold">Spam</span>, <span className="font-semibold">Junk</span>, or <span className="font-semibold">Promotions</span> folder — it sometimes lands there.
            </p>
          </div>

          {/* Resend + sign in */}
          <div className="flex flex-col items-center gap-3">
            {resendDone ? (
              <p className="text-sm font-semibold" style={{ color: BRAND.sports }}>
                ✓ New link sent — check your inbox
              </p>
            ) : (
              <button
                onClick={resendVerification}
                disabled={resendBusy}
                className="text-sm font-semibold hover:underline"
                style={{ color: BRAND.sports }}
              >
                {resendBusy ? "Sending…" : "Resend verification email"}
              </button>
            )}
            <button
              onClick={() => { setAwaitingVerify(false); setMode("signin"); }}
              className="text-xs hover:underline"
              style={{ color: BRAND.dim }}
            >
              Already verified? Sign in →
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-16" style={{ background: MATERIAL.vignette }}>
      <div className="w-full max-w-sm">

        {/* Logo — monochrome; gold is reserved for value */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: BRAND.elevated, border: `0.5px solid ${BRAND.hairlineStrong}` }}>
              <span className="font-black text-[11px] tracking-tighter" style={{ color: BRAND.ink }}>SB</span>
            </div>
            <span className="font-semibold tracking-[0.18em] text-sm" style={{ color: BRAND.ink }}>SUPERBRAIN</span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-[#A0A0A8] text-sm mt-1.5">
            {mode === "signin"
              ? "Sign in to save and share your results."
              : "Free forever. Save every result. Share your score."}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 px-4 py-3 rounded-xl" style={{ border: `0.5px solid ${BRAND.hairlineStrong}`, background: "rgba(232,193,90,0.06)" }}>
            <p className="text-xs leading-relaxed" style={{ color: BRAND.gold }}>
              <strong>Setup required.</strong> Copy{" "}
              <code className="font-mono">.env.local.example</code> →{" "}
              <code className="font-mono">.env.local</code> and add your Supabase credentials.
            </p>
          </div>
        )}

        <div className="rounded-2xl p-7" style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>

          {/* ── Apple Sign In ────────────────────────────── */}
          <button
            type="button"
            onClick={handleApple}
            disabled={appleBusy || !isSupabaseConfigured}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-sm text-sm font-semibold transition-all mb-3"
            style={{
              background: "#000000",
              border:     "1px solid #000000",
              color:      "#ffffff",
              opacity:    appleBusy ? 0.7 : 1,
            }}
          >
            {appleBusy ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#444" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 814 1000" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 135.4-317.7 269-317.7 70.5 0 129.2 46.2 172.9 46.2 42.1 0 108.5-49.4 188.5-49.4 30.5 0 108.2 2.6 164 99.9zm-336.8-176.3c-31.5-38.1-86.8-66.4-141.5-66.4-8.9 0-17.9.6-26.8 1.9-5.4 0.8-8.9 4.5-8.9 9.6 0 4.5 3.2 9.6 7.7 12.2 34.7 20 78.2 52.6 104.9 88.1 21.5 28.8 36.5 63.3 36.5 99.4 0 10.3-8.3 18.6-18.6 18.6h-11.5c-8.9 0-16.7-6.4-18.3-15.1-11.5-63.3-59.5-122.5-108.2-153.7-4.5-3.2-7-8.3-7-13.5 0-8.9 7-16 16-16h11.5c47.1 0 92.9 18.6 128.3 52 35.4 33.4 56.9 79.2 56.9 127.4 0 9.6-7.7 17.3-17.3 17.3h-13.5c-9 0-16.7-7-17.3-16-3.8-57.5-47.1-109.4-101.5-132.1"/>
              </svg>
            )}
            {appleBusy ? "Redirecting to Apple…" : "Continue with Apple"}
          </button>

          {/* ── Google OAuth ─────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleBusy || !isSupabaseConfigured}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-sm text-sm font-semibold transition-all mb-5"
            style={{
              background:   "#ffffff",
              border:       "1px solid #dadce0",
              color:        "#3c4043",
              boxShadow:    "0 1px 2px rgba(0,0,0,0.08)",
              opacity:      googleBusy ? 0.7 : 1,
            }}
          >
            {googleBusy ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#dadce0" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            ) : (
              <GoogleLogo />
            )}
            {googleBusy ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          {/* ── OR divider ───────────────────────────────── */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[#6B6B73] text-xs tracking-widest uppercase">or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Display name — signup only */}
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[#A0A0A8] text-xs tracking-widest uppercase">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#17181D] border border-white/[0.07] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
                  placeholder="How you'll appear on the leaderboard"
                  maxLength={32}
                  autoComplete="nickname"
                />
                <p className="text-[#6B6B73] text-xs">Shown publicly on the leaderboard.</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[#A0A0A8] text-xs tracking-widest uppercase">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#17181D] border border-white/[0.07] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[#A0A0A8] text-xs tracking-widest uppercase">Password</label>
                {mode === "signin" && (
                  <Link
                    href="/forgot-password"
                    className="text-[#6B6B73] text-xs hover:text-[#F5F5F2] transition-colors"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-[#17181D] border border-white/[0.07] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && (
                <p className="text-[#6B6B73] text-xs">Minimum 8 characters.</p>
              )}
            </div>

            {error   && <p className="text-[#FF6A3D]   text-xs leading-relaxed">{error}</p>}
            {success && <p className="text-[#5FCF8B] text-xs leading-relaxed">{success}</p>}

            <button
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              className="w-full justify-center flex items-center gap-2 mt-1 py-3 rounded-full font-bold text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: BRAND.gold, color: BRAND.goldInk, boxShadow: MATERIAL.shadowGold }}
            >
              {busy ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-[#6B6B73] text-sm mt-5">
          {mode === "signin" ? (
            <>No account?{" "}
              <button onClick={() => switchMode("signup")} className="text-[#F5F5F2] hover:underline">
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => switchMode("signin")} className="text-[#F5F5F2] hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: MATERIAL.vignette }}>
        <p className="text-[#A0A0A8] text-sm animate-pulse">Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
