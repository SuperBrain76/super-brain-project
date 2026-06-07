"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { track } from "@/lib/analytics";

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

  const next = searchParams.get("next") ?? "";

  useEffect(() => {
    if (!loading && user) router.replace(next || "/predict");
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
          emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
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
    router.push(next || "/predict");
  };

  const resendVerification = async () => {
    if (!email || resendBusy) return;
    setResendBusy(true);
    await supabase.auth.resend({ type: "signup", email });
    setResendBusy(false);
    setResendDone(true);
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
        style={{ background: "#f0f3ef" }}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">

          {/* Icon */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#eef8f0", border: "1px solid #86c99a" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: "#0f1f17" }}>
              Check your email
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#2e4a37" }}>
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-semibold" style={{ color: "#0f1f17" }}>{email}</span>.
              Click it to activate your account.
            </p>
          </div>

          {/* Steps */}
          <div className="w-full rounded-xl p-5 text-left flex flex-col gap-3"
            style={{ background: "#ffffff", border: "1px solid #dde5d8" }}>
            {[
              "Open the email from SuperBrain",
              'Click “Confirm your email”',
              "You'll be signed in automatically",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black"
                  style={{ background: "#1a3a2a", color: "#ffffff" }}>
                  {i + 1}
                </span>
                <p className="text-sm" style={{ color: "#2e4a37" }}>{step}</p>
              </div>
            ))}
          </div>

          {/* Resend + sign in */}
          <div className="flex flex-col items-center gap-3">
            {resendDone ? (
              <p className="text-sm font-semibold" style={{ color: "#1a3a2a" }}>
                ✓ New link sent — check your inbox
              </p>
            ) : (
              <button
                onClick={resendVerification}
                disabled={resendBusy}
                className="text-sm font-semibold hover:underline"
                style={{ color: "#1a3a2a" }}
              >
                {resendBusy ? "Sending…" : "Resend verification email"}
              </button>
            )}
            <button
              onClick={() => { setAwaitingVerify(false); setMode("signin"); }}
              className="text-xs hover:underline"
              style={{ color: "#7a8f82" }}
            >
              Already verified? Sign in →
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-sm bg-cockpit-accent flex items-center justify-center">
              <span className="text-cockpit-bg font-black text-xs">SB</span>
            </div>
            <span className="font-bold tracking-widest text-sm text-white">SUPERBRAIN</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-cockpit-dim text-sm mt-1">
            {mode === "signin"
              ? "Sign in to save and share your results."
              : "Free forever. Save every result. Share your score."}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 px-4 py-3 border border-cockpit-amber border-opacity-40 rounded-sm bg-cockpit-amber bg-opacity-5">
            <p className="text-cockpit-amber text-xs leading-relaxed">
              <strong>Setup required.</strong> Copy{" "}
              <code className="font-mono">.env.local.example</code> →{" "}
              <code className="font-mono">.env.local</code> and add your Supabase credentials.
            </p>
          </div>
        )}

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Display name — signup only */}
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-cockpit-dim text-xs tracking-widest uppercase">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
                  placeholder="How you'll appear on the leaderboard"
                  maxLength={32}
                  autoComplete="nickname"
                />
                <p className="text-cockpit-muted text-xs">Shown publicly on the leaderboard.</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-cockpit-dim text-xs tracking-widest uppercase">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-cockpit-dim text-xs tracking-widest uppercase">Password</label>
                {mode === "signin" && (
                  <Link
                    href="/forgot-password"
                    className="text-cockpit-muted text-xs hover:text-cockpit-accent transition-colors"
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
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && (
                <p className="text-cockpit-muted text-xs">Minimum 8 characters.</p>
              )}
            </div>

            {error   && <p className="text-cockpit-red   text-xs leading-relaxed">{error}</p>}
            {success && <p className="text-cockpit-green text-xs leading-relaxed">{success}</p>}

            <button
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              className="btn-primary w-full justify-center flex items-center gap-2 mt-1"
            >
              {busy ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-cockpit-muted text-sm mt-5">
          {mode === "signin" ? (
            <>No account?{" "}
              <button onClick={() => switchMode("signup")} className="text-cockpit-accent hover:underline">
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => switchMode("signin")} className="text-cockpit-accent hover:underline">
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
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
