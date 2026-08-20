"use client";

/**
 * /venues/admin — the venue owner's backoffice hub.
 *
 * One home for everything an owner needs after signup: their live page,
 * the Matchday Challenge builder, the Launch Pack, and billing. Reached from
 * the "My Venue" link in the top nav (shown only to owners) so nobody has to
 * remember a direct URL. The venue is resolved by the owner-reads-own-venue
 * RLS policy — no id in the URL, no way to see someone else's venue.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { signInWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";

const INK = "#0B0B0D", PANEL = "#141418", LINE = "rgba(255,255,255,0.10)";
const GOLD = "#E8C15A", CREAM = "#F5F5F2", MUTED = "#9A9AA3";
const SITE = "https://www.superbrain.social";

interface Venue {
  id: string; slug: string | null; name: string;
  logo_url: string | null; colour_primary: string | null;
  status: string; onboarded_at: string | null;
}

export default function VenueAdminHub() {
  const { user, loading } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { if (!loading) setChecked(true); return; }
    supabase
      .from("venues")
      .select("id, slug, name, logo_url, colour_primary, status, onboarded_at")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setVenue((data as Venue) ?? null); setChecked(true); });
  }, [user, loading]);

  if (loading || (user && !checked)) return <Shell><p style={{ color: MUTED }}>Loading…</p></Shell>;

  if (!user) return (
    <Shell>
      <h1 className="text-2xl font-black mb-2">Venue backoffice</h1>
      <p className="text-sm mb-5" style={{ color: MUTED }}>Sign in with the email you signed up with to manage your venue.</p>
      <button onClick={() => signInWithGoogle("/venues/admin")} className="font-black px-6 py-3 rounded-full text-sm" style={{ background: GOLD, color: "#12100E" }}>Continue with Google</button>
      <div className="mt-2"><a href="/login?next=/venues/admin" className="text-xs" style={{ color: GOLD }}>or sign in with email</a></div>
    </Shell>
  );

  if (!venue) return (
    <Shell>
      <h1 className="text-2xl font-black mb-2">No venue on this account</h1>
      <p className="text-sm mb-5" style={{ color: MUTED }}>This login doesn&apos;t own a venue yet. If you just signed up, use the email address you paid with. Otherwise, see how it works.</p>
      <a href="/venues" className="font-black px-6 py-3 rounded-full text-sm inline-block" style={{ background: GOLD, color: "#12100E" }}>How SuperBrain for venues works</a>
    </Shell>
  );

  const accent = venue.colour_primary || GOLD;
  const publicUrl = venue.slug ? `${SITE}/v/${venue.slug}` : null;

  const cards: { href: string; title: string; desc: string; external?: boolean }[] = [
    { href: venue.slug ? `/v/${venue.slug}` : "/venues/admin", title: "Your live page", desc: "Your public venue page and player stats", external: true },
    { href: "/venues/challenges", title: "Matchday Challenge", desc: "Run a one-day prediction game across competitions" },
    { href: venue.slug ? `/venues/${venue.slug}/launch-pack` : "/venues/admin", title: "Launch Pack", desc: "Posters, table tent, TV leaderboard, socials" },
    { href: `/venues/billing?v=${venue.id}`, title: "Billing", desc: "Manage your subscription and payment method" },
  ];

  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-1">
          {venue.logo_url
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={venue.logo_url} alt="" style={{ height: 44, maxWidth: 120, objectFit: "contain" }} />
            : <div className="w-11 h-11 rounded-xl grid place-items-center font-black text-lg" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>{venue.name.slice(0, 1).toUpperCase()}</div>}
          <div>
            <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: accent }}>Venue backoffice</div>
            <h1 className="text-2xl font-black leading-tight">{venue.name}</h1>
          </div>
        </div>
        <p className="text-sm mt-2 mb-6" style={{ color: MUTED }}>Everything for your venue in one place.</p>

        {/* Share your page */}
        {publicUrl && (
          <div className="rounded-2xl p-4 mb-6 flex items-center justify-between gap-3" style={{ background: `${accent}12`, border: `1px solid ${accent}44` }}>
            <div className="min-w-0">
              <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: accent }}>Your page</div>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold break-all" style={{ color: CREAM }}>{publicUrl}</a>
            </div>
            <button
              onClick={() => { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs font-black px-3.5 py-2 rounded-full shrink-0" style={{ background: accent, color: "#12100E" }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {/* Tools */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((c) => (
            <a key={c.title} href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="rounded-2xl p-5 block transition-transform active:scale-[0.98]"
              style={{ background: PANEL, border: `1px solid ${LINE}` }}>
              <div className="flex items-center justify-between">
                <div className="font-black text-base">{c.title}</div>
                <span className="text-lg" style={{ color: accent }}>→</span>
              </div>
              <div className="text-xs mt-1.5" style={{ color: MUTED }}>{c.desc}</div>
            </a>
          ))}
        </div>

        <div className="mt-8 text-center text-[11px]" style={{ color: "#ffffff55" }}>
          Need a hand? Reply to any SuperBrain email and we&apos;ll help. · Powered by SuperBrain
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ background: INK, color: CREAM, minHeight: "100vh" }} className="flex items-center justify-center"><div className="text-center px-6">{children}</div></div>;
}
