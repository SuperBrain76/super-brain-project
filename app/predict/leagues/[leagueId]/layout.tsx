import type { Metadata } from "next";
import { fetchLeagueOGById } from "@/lib/og";

// www. is the canonical domain — superbrain.social 307-redirects to www.
// Crawlers (Facebook/LinkedIn/WhatsApp) do not follow 307s for og:image URLs.
const BASE_URL    = "https://www.superbrain.social";
// Static fallback — served directly from /public/og/, no edge rendering.
// Used for ALL league shares until the dynamic ImageResponse route is confirmed
// working end-to-end by Facebook Debugger.
const STATIC_IMAGE = `${BASE_URL}/og/world-cup-league.jpg`;
const STATIC_ALT   = "Join a World Cup 2026 Prediction League — SuperBrain";

type Props = { params: { leagueId: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const league = await fetchLeagueOGById(params.leagueId);

  if (!league) {
    return {
      title:       "Prediction League — SuperBrain",
      description: "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.",
      openGraph: {
        title:       "Prediction League — SuperBrain",
        description: "Predict every World Cup 2026 match, compete with friends and climb the leaderboard. Free to play.",
        images:      [{ url: STATIC_IMAGE, width: 1200, height: 630, alt: STATIC_ALT }],
      },
      twitter: {
        card:   "summary_large_image",
        images: [STATIC_IMAGE],
      },
    };
  }

  const { name, memberCount } = league;
  const title = `${name} – World Cup 2026 Prediction League`;
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
      url:         `${BASE_URL}/predict/leagues/${params.leagueId}`,
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

export default function LeagueDetailLayout({ children }: Props) {
  return <>{children}</>;
}
