"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [busy,    setBusy]    = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { setError("Supabase is not configured."); return; }
    setBusy(true);
    setError("");

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setBusy(false);
    if (err) { setError(err.message); return; }
    setSent(true);
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
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-cockpit-dim text-sm mt-1">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-7">
          {sent ? (
            <div className="text-center py-4 flex flex-col gap-4">
              {/* Envelope icon */}
              <div className="mx-auto w-12 h-12 rounded-full bg-cockpit-green bg-opacity-10 border border-cockpit-green border-opacity-30 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="1.5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Check your inbox</p>
                <p className="text-cockpit-dim text-sm leading-relaxed">
                  A reset link has been sent to <span className="text-cockpit-text font-mono">{email}</span>.
                  Click it to choose a new password.
                </p>
              </div>
              <p className="text-cockpit-muted text-xs">
                Didn&apos;t receive it? Check spam, or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-cockpit-accent hover:underline"
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-cockpit-dim text-xs tracking-widest uppercase">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
                />
              </div>

              {error && <p className="text-cockpit-red text-xs">{error}</p>}

              <button
                type="submit"
                disabled={busy || !isSupabaseConfigured}
                className="btn-primary w-full justify-center flex items-center gap-2 mt-1"
              >
                {busy ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-cockpit-muted text-sm mt-5">
          <Link href="/login" className="text-cockpit-accent hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
