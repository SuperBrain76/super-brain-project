"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { BRAND, MATERIAL } from "@/lib/brand";

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
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback?next=/reset-password`,
    });

    setBusy(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-16" style={{ background: MATERIAL.vignette }}>
      <div className="w-full max-w-sm">

        {/* Logo — monochrome */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: BRAND.elevated, border: `0.5px solid ${BRAND.hairlineStrong}` }}>
              <span className="font-black text-[11px] tracking-tighter" style={{ color: BRAND.ink }}>SB</span>
            </div>
            <span className="font-semibold tracking-[0.18em] text-sm" style={{ color: BRAND.ink }}>SUPERBRAIN</span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Reset password</h1>
          <p className="text-[#A0A0A8] text-sm mt-1.5">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <div className="rounded-2xl p-7" style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
          {sent ? (
            <div className="text-center py-4 flex flex-col gap-4">
              {/* Envelope icon */}
              <div className="mx-auto w-12 h-12 rounded-full bg-[#35C56F] bg-opacity-10 border border-[#35C56F] border-opacity-30 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND.sports} strokeWidth="1.5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Check your inbox</p>
                <p className="text-[#A0A0A8] text-sm leading-relaxed">
                  A reset link has been sent to <span className="text-[#F5F5F2] font-mono">{email}</span>.
                  Click it to choose a new password.
                </p>
              </div>
              <p className="text-[#6B6B73] text-xs">
                Didn&apos;t receive it? Check spam, or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-[#F5F5F2] hover:underline"
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#A0A0A8] text-xs tracking-widest uppercase">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-[#17181D] border border-white/[0.07] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
                />
              </div>

              {error && <p className="text-[#FF6A3D] text-xs">{error}</p>}

              <button
                type="submit"
                disabled={busy || !isSupabaseConfigured}
                className="w-full justify-center flex items-center gap-2 mt-1 py-3 rounded-full font-bold text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: BRAND.gold, color: BRAND.goldInk, boxShadow: MATERIAL.shadowGold }}
              >
                {busy ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[#6B6B73] text-sm mt-5">
          <Link href="/login" className="text-[#F5F5F2] hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
