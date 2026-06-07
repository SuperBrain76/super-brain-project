import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchLeagueOGByCode } from "@/lib/og";
import JoinContent from "./_join-content";

const BASE_URL        = "https://superbrain.social";
const FALLBACK_IMAGE  = `${BASE_URL}/predict/leagues/join/opengraph-image`;
const FALLBACK_ALT    = "Join a World Cup 2026 Prediction League — SuperBrain";
const FALLBACK_DESC   = "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.";
const FALLBACK_TITLE  = "Join a Prediction League — SuperBrain";

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
        images:      [{ url: FALLBACK_IMAGE, width: 1200, height: 630, alt: FALLBACK_ALT }],
      },
      twitter: {
        card:        "summary_large_image",
        title:       FALLBACK_TITLE,
        description: FALLBACK_DESC,
        images:      [FALLBACK_IMAGE],
      },
    };
  }

  // ── Dynamic: league resolved ───────────────────────────────
  const { id, name, memberCount } = league;
  const title = `Join ${name} – World Cup 2026 Prediction League`;
  const desc  = memberCount > 1
    ? `Predict every World Cup 2026 match and compete with ${memberCount} others in ${name}. Free to play.`
    : `Predict every World Cup 2026 match and compete in ${name}. Free to play.`;

  // Use the league-detail dynamic OG image (renders the league name)
  const ogImageUrl = `${BASE_URL}/predict/leagues/${id}/opengraph-image`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type:        "website",
      url:         `${BASE_URL}/predict/leagues/join?code=${code}`,
      images:      [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description: desc,
      images:      [ogImageUrl],
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
