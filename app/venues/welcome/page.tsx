"use client";

/**
 * /venues/welcome?session_id=cs_... — the first screen after paying.
 *
 * Stripe returns the browser here immediately, but the league is built by the
 * webhook, which is a separate delivery. So this page POLLS until provisioning
 * lands rather than asserting success and showing a broken link. If it is
 * still not ready after ~40s, it says so honestly and points at the welcome
 * email, which arrives either way.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const INK = "#12100E", AMBER = "#F5B301", CREAM = "#FBF5E9", MUTED = "#B7AC97";
const LINE = "rgba(255,255,255,0.12)";

interface Ready {
  ready: true; venue_name: string; venue_slug: string; league_name: string;
  invite_code: string; join_url: string; poster_url: string;
  dashboard_url: string; qr_url: string;
}

function VenueWelcomePageInner() {
  const sessionId = useSearchParams().get("session_id");
  const [data, setData]   = useState<Ready | null>(null);
  const [slow, setSlow]   = useState(false);
  const [error, setError] = useState("");
  const tries = useRef(0);

  useEffect(() => {
    if (!sessionId) { setError("Missing checkout reference."); return; }
    let stop = false;

    const poll = async () => {
      if (stop) return;
      tries.current += 1;
      try {
        const res  = await fetch(`/api/venues/session-status?session_id=${encodeURIComponent(sessionId)}`);
        const json = await res.json();
        if (json.ready) { setData(json as Ready); return; }
        if (res.status === 404) { setError("We couldn't find that checkout."); return; }
      } catch { /* keep polling — a transient network blip is not a failure */ }

      if (tries.current >= 20) { setSlow(true); return; }   // ~40s
      setTimeout(poll, 2000);
    };
    poll();
    return () => { stop = true; };
  }, [sessionId]);

  if (error) return <Shell><P>{error}</P></Shell>;

  if (slow && !data) {
    return (
      <Shell>
        <H1>Payment received</H1>
        <P>Your league is still being set up. This usually takes a few seconds — we&apos;ve emailed
           you the link and the table poster, so you can close this page safely.</P>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <H1>Setting up your league…</H1>
        <P>Payment received. Building your league, generating your QR code and poster.</P>
        <div className="mt-8 h-1 w-40 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div style={{ background: AMBER, height: "100%", width: "40%", animation: "pulse 1.4s ease-in-out infinite" }} />
        </div>
        <style>{`@keyframes pulse{0%{margin-left:-40%}100%{margin-left:100%}}`}</style>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-[11px] uppercase tracking-[0.3em] mb-3" style={{ color: AMBER }}>You&apos;re live</p>
      <H1>{data.league_name}</H1>
      <P>Your regulars can join tonight. Print the poster, put one on every table, and that&apos;s it —
         there is nothing else to set up.</P>

      <div className="flex items-center gap-5 my-9 flex-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr_url} alt="Join QR code" width={132} height={132}
             style={{ background: "#fff", padding: 8, borderRadius: 12 }} />
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: MUTED }}>Invite code</div>
          <div className="text-3xl font-black tracking-[0.15em]" style={{ color: AMBER }}>{data.invite_code}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a href={data.poster_url} className="font-black px-6 py-3.5 rounded-full text-center"
           style={{ background: AMBER, color: INK }}>Print the table poster</a>
        <a href={data.dashboard_url} className="font-bold px-6 py-3.5 rounded-full text-center"
           style={{ border: `1px solid ${LINE}`, color: CREAM }}>Open your league</a>
      </div>

      <p className="text-xs mt-8" style={{ color: MUTED }}>
        Your 7-day trial has started. We&apos;ll email you before it converts.
        Any question at all, just reply to the welcome email.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-5 py-16">{children}</div>
    </div>
  );
}
function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">{children}</h1>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-base max-w-xl" style={{ color: MUTED }}>{children}</p>;
}

/**
 * useSearchParams() forces client-side bailout, which Next 14 requires to sit
 * behind a Suspense boundary — without it the production build fails at
 * prerender rather than at runtime.
 */
export default function VenueWelcomePage() {
  return (
    <Suspense fallback={
      <div style={{ background: INK, color: MUTED, minHeight: "100vh" }}
           className="flex items-center justify-center">
        <p className="text-sm">Loading…</p>
      </div>
    }>
      <VenueWelcomePageInner />
    </Suspense>
  );
}
