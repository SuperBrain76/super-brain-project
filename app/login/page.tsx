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

  const [mode, setMode]             = useState<Mode>("signin");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError]           = useState(
    searchParams.get("error") === "confirmation_failed"
      ? "Confirmation link expired. Please sign in or try again."
      : "",
  );
  const [success, setSuccess] = useState("");
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/profile");
  }, [user, loading, router]);

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
          // display_name is picked up by the DB trigger (handle_new_user)
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setBusy(false);
      if (err) { setError(err.message); return; }
      track.signupCompleted();
      setSuccess("Check your email and click the confirmation link to activate your account.");
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.push("/profile");
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setSuccess("");
    setDisplayName("");
    if (next === "signup") track.signupStarted();
  };

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
                  className="w-full"
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
                className="w-full"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-cockpit-dim text-xs tracking-widest uppercase">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full"
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && (
                <p className="text-cockpit-muted text-xs">Minimum 6 characters.</p>
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
