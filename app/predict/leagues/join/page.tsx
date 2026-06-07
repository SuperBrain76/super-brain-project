import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchLeagueOGByCode } from "@/lib/og";
import JoinContent from "./_join-content";

// www. is the canonical domain — superbrain.social 307-redirects to www.
// Crawlers (Facebook/LinkedIn/WhatsApp) do not follow 307s for og:image URLs.
const BASE_URL     = "https://www.superbrain.social";
// Static image served from /public/og/ — no edge rendering, guaranteed delivery.
const STATIC_IMAGE = `${BASE_URL}/og/world-cup-league.jpg`;
const STATIC_ALT   = "Join a World Cup 2026 Prediction League — SuperBrain";
const FALLBACK_TITLE = "Join a Prediction League — SuperBrain";
const FALLBACK_DESC  = "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.";

type Props = { searchParams: { code?: string } };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const code   = searchParams.code?.trim().toUpperCase() ?? "";
  const league = await fetchLeagueOGByCode(code);

  // ── Fallback: no code or league not found ─────────────────
  if (!league) {
    return {
      title:       FALLBACK_TITLE,
      description: FALLBACK_DESC,
      openGraph: {
        title:       FALLBACK_TITLE,
        description: FALLBACK_DESC,
        type:        "website",
        url:         code ? `${BASE_URL}/predict/leagues/join?code=${code}` : `${BASE_URL}/predict/leagues/join`,
        images:      [{ url: STATIC_IMAGE, width: 1200, height: 630, alt: STATIC_ALT }],
      },
      twitter: {
        card:        "summary_large_image",
        title:       FALLBACK_TITLE,
        description: FALLBACK_DESC,
        images:      [STATIC_IMAGE],
      },
    };
  }

  // ── Dynamic: league resolved ───────────────────────────────
  const { name, memberCount } = league;
  const title = `Join ${name} – World Cup 2026 Prediction League`;
  const desc  = memberCount > 1
    ? `Predict every World Cup 2026 match and compete with ${memberCount} others in ${name}. Free to play.`
    : `Predict every World Cup 2026 match and compete in ${name}. Free to play.`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type:        "website",
      url:         `${BASE_URL}/predict/leagues/join?code=${code}`,
      images:      [{ url: STATIC_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description: desc,
      images:      [STATIC_IMAGE],
    },
  };
}

const fallback = (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm animate-pulse" style={{ color: "#7a8f82" }}>Loading…</p>
  </div>
);

export default function LeagueJoinPage({ searchParams }: Props) {
  const code = searchParams.code?.trim().toUpperCase() ?? "";
  return (
    <Suspense fallback={fallback}>
      <JoinContent code={code} />
    </Suspense>
  );
}
