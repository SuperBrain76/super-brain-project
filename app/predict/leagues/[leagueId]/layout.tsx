import type { Metadata } from "next";
import { fetchLeagueOGById } from "@/lib/og";

const BASE_URL = "https://www.superbrain.social";

type Props = { params: { leagueId: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const league = await fetchLeagueOGById(params.leagueId);

  if (!league) {
    return {
      title:       "Prediction League — SuperBrain",
      description: "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.",
    };
  }

  const { name, memberCount } = league;
  const title = `${name} – World Cup 2026 Prediction League`;
  const desc  = memberCount > 1
    ? `Predict every World Cup 2026 match and compete with ${memberCount} others in ${name}. Free to play.`
    : `Predict every World Cup 2026 match and compete in ${name}. Free to play.`;

  const ogImageUrl = `${BASE_URL}/predict/leagues/${params.leagueId}/opengraph-image`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type:        "website",
      url:         `${BASE_URL}/predict/leagues/${params.leagueId}`,
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

export default function LeagueDetailLayout({ children }: Props) {
  return <>{children}</>;
}
