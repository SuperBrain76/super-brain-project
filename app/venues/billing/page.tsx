"use client";

/**
 * /venues/billing?v=<venue-id> — where the failed-payment email points.
 *
 * The venue id in the URL is NOT the credential. This page requires the signed
 * -in user to be the venue's owner; the API re-checks that server-side before
 * opening a Stripe portal session. A forwarded email therefore gets a sign-in
 * prompt, not someone else's card details.
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

const INK = "#12100E", AMBER = "#F5B301", CREAM = "#FBF5E9", MUTED = "#B7AC97";

function VenueBillingPageInner() {
  const venueId = useSearchParams().get("v");
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  async function openPortal() {
    if (!venueId) { setErr("Missing venue reference."); return; }
    setBusy(true); setErr("");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { setBusy(false); setErr("Please sign in again."); return; }

    try {
      const res = await fetch("/api/venues/portal", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "failed");
      window.location.href = json.url;
    } catch {
      setBusy(false);
      setErr("Could not open the billing portal. Reply to our email and we'll sort it out.");
    }
  }

  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-lg mx-auto px-5 py-16">
        <h1 className="text-3xl font-black mb-4">Update your payment method</h1>

        {loading ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : !user ? (
          <>
            <p className="mb-6" style={{ color: MUTED }}>
              Sign in with the email address on your subscription to manage billing.
            </p>
            <a href={`/login?next=${encodeURIComponent(`/venues/billing?v=${venueId ?? ""}`)}`}
               className="inline-block font-black px-6 py-3.5 rounded-full"
               style={{ background: AMBER, color: INK }}>Sign in</a>
          </>
        ) : (
          <>
            <p className="mb-6" style={{ color: MUTED }}>
              This opens Stripe&apos;s secure billing portal, where you can update your card
              and see every invoice. Your league stays live while you do.
            </p>
            <button onClick={openPortal} disabled={busy}
                    className="font-black px-6 py-3.5 rounded-full disabled:opacity-60"
                    style={{ background: AMBER, color: INK }}>
              {busy ? "Opening…" : "Open billing portal"}
            </button>
          </>
        )}

        {err && <p className="text-sm mt-5" style={{ color: "#FF6A6A" }}>{err}</p>}
      </div>
    </div>
  );
}

/**
 * useSearchParams() forces client-side bailout, which Next 14 requires to sit
 * behind a Suspense boundary — without it the production build fails at
 * prerender rather than at runtime.
 */
export default function VenueBillingPage() {
  return (
    <Suspense fallback={
      <div style={{ background: INK, color: MUTED, minHeight: "100vh" }}
           className="flex items-center justify-center">
        <p className="text-sm">Loading…</p>
      </div>
    }>
      <VenueBillingPageInner />
    </Suspense>
  );
}
