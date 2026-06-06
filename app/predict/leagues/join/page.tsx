import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchLeagueOGByCode } from "@/lib/og";
import JoinContent from "./_join-content";

const BASE_URL = "https://www.superbrain.social";

type Props = { searchParams: { code?: string } };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const code   = searchParams.code?.trim().toUpperCase() ?? "";
  const league = await fetchLeagueOGByCode(code);

  if (!league) {
    return {
      title:       "Join a Prediction League — SuperBrain",
      description: "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.",
      openGraph: {
        title:       "Join a Prediction League — SuperBrain",
        description: "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.",
      },
      twitter: { card: "summary_large_image" },
    };
  }

  const { id, name, memberCount } = league;
  const title = `Join ${name} – World Cup 2026 Prediction League`;
  const desc  = memberCount > 1
    ? `Predict every World Cup 2026 match and compete with ${memberCount} others in ${name}. Free to play.`
    : `Predict every World Cup 2026 match and compete in ${name}. Free to play.`;

  // Reuse the league-detail OG image (fetches by ID, same design)
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
