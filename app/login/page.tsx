"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode]       = useState<Mode>("signin");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSub]  = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) router.replace("/profile");
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Please add the required environment variables.");
      return;
    }
    setError(""); setSuccess(""); setSub(true);

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) { setError(err.message); setSub(false); return; }
      setSuccess("Check your email to confirm your account.");
      setSub(false);
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setSub(false); return; }
    router.push("/profile");
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) { setError("Supabase not configured."); return; }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/profile` },
    });
    if (err) setError(err.message);
  };

  return (
    <div className="min-h-screen hud-grid flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Header */}
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
            {mode === "signin" ? "Sign in to see your saved results." : "Free forever. No credit card."}
          </p>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-8">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 border border-cockpit-amber border-opacity-40 rounded-sm bg-cockpit-amber bg-opacity-5">
              <p className="text-cockpit-amber text-xs leading-relaxed">
                <strong>Supabase not configured.</strong> Add{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your{" "}
                <code className="font-mono">.env.local</code> file.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-cockpit-dim text-xs tracking-widest uppercase block mb-1.5">Email</label>
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
            <div>
              <label className="text-cockpit-dim text-xs tracking-widest uppercase block mb-1.5">Password</label>
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
            </div>

            {error   && <p className="text-cockpit-red text-xs">{error}</p>}
            {success && <p className="text-cockpit-green text-xs">{success}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center flex items-center gap-2 mt-2">
              {submitting ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-cockpit-border" />
            <span className="text-cockpit-muted text-xs">or</span>
            <div className="flex-1 h-px bg-cockpit-border" />
          </div>

          <button
            onClick={handleGoogle}
            className="btn-ghost w-full flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Toggle */}
        <p className="text-center text-cockpit-muted text-sm mt-6">
          {mode === "signin" ? (
            <>No account? <button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }} className="text-cockpit-accent hover:underline">Sign up free</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }} className="text-cockpit-accent hover:underline">Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}
