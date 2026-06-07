"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";

export default function EmailVerificationBanner() {
  const { user, loading } = useAuth();

  const [isVerified,   setIsVerified]   = useState<boolean | null>(null);
  const [email,        setEmail]        = useState<string>("");
  const [dismissed,    setDismissed]    = useState(false);
  const [resendBusy,   setResendBusy]   = useState(false);
  const [resendDone,   setResendDone]   = useState(false);
  const [resendError,  setResendError]  = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      setIsVerified(!!u.email_confirmed_at);
    });
  }, [user]);

  const handleResend = async () => {
    if (!email || resendBusy) return;
    setResendBusy(true);
    setResendError("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResendBusy(false);
    if (error) { setResendError("Could not resend — try again shortly."); return; }
    setResendDone(true);
  };

  // Don't render: loading, no user, already verified, dismissed, or status unknown
  if (loading || !user || isVerified !== false || dismissed) return null;

  return (
    <div
      role="alert"
      style={{
        background: `${GOLD}10`,
        borderBottom: `1px solid ${GOLD}40`,
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="text-sm shrink-0">⚠️</span>
        <p className="text-sm flex-1" style={{ color: "#5c4a00" }}>
          <span className="font-semibold">Verify your email to qualify for prizes.</span>
          {" "}Check your inbox for a confirmation link.
        </p>

        <div className="flex items-center gap-3 shrink-0">
          {resendDone ? (
            <span className="text-xs font-semibold" style={{ color: GREEN }}>✓ Email sent</span>
          ) : resendError ? (
            <span className="text-xs" style={{ color: "#c0392b" }}>{resendError}</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendBusy}
              className="text-xs font-semibold hover:underline"
              style={{ color: GREEN }}
            >
              {resendBusy ? "Sending…" : "Resend email"}
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-xs hover:opacity-70 transition-opacity"
            style={{ color: MUTED }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
