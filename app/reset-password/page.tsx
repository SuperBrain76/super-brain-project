"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { BRAND, MATERIAL } from "@/lib/brand";

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
    setTimeout(() => router.replace("/iq"), 3000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: MATERIAL.vignette }}>
        <p className="text-[#A0A0A8] text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Choose new password</h1>
          <p className="text-[#A0A0A8] text-sm mt-1.5">
            Pick a strong password for your account.
          </p>
        </div>

        <div className="rounded-2xl p-7" style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
          {done ? (
            <div className="text-center py-4 flex flex-col gap-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#35C56F] bg-opacity-10 border border-[#35C56F] border-opacity-30 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND.sports} strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Password updated!</p>
                <p className="text-[#A0A0A8] text-sm">Redirecting to your dashboard…</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#A0A0A8] text-xs tracking-widest uppercase">
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
                  className="w-full bg-[#17181D] border border-white/[0.07] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[#A0A0A8] text-xs tracking-widest uppercase">
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
                {busy ? "Saving…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
