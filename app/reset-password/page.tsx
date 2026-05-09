"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [busy,      setBusy]      = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  // If not authenticated (e.g. user navigated here directly), send to forgot-password
  useEffect(() => {
    if (!loading && !user) router.replace("/forgot-password");
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (err) { setError(err.message); return; }
    setDone(true);

    // Redirect to dashboard after short delay
    setTimeout(() => router.replace("/profile"), 3000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
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
          <h1 className="text-2xl font-bold text-white">Choose new password</h1>
          <p className="text-cockpit-dim text-sm mt-1">
            Pick a strong password for your account.
          </p>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-7">
          {done ? (
            <div className="text-center py-4 flex flex-col gap-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-cockpit-green bg-opacity-10 border border-cockpit-green border-opacity-30 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Password updated!</p>
                <p className="text-cockpit-dim text-sm">Redirecting to your dashboard…</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-cockpit-dim text-xs tracking-widest uppercase">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-cockpit-dim text-xs tracking-widest uppercase">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
                />
              </div>

              {error && <p className="text-cockpit-red text-xs">{error}</p>}

              <button
                type="submit"
                disabled={busy || !isSupabaseConfigured}
                className="btn-primary w-full justify-center flex items-center gap-2 mt-1"
              >
                {busy ? "Saving…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
