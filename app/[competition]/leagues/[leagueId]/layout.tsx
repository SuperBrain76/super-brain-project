import type { Metadata } from "next";
import { fetchLeagueOGById } from "@/lib/og";
import { competitionLabel } from "@/lib/ogTheme";

// www. is the canonical domain — superbrain.social 307-redirects to www., and
// crawlers don't follow 307s for og:image URLs, so all URLs are absolute + www.
const BASE_URL = "https://www.superbrain.social";

type Props = { params: { competition: string; leagueId: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const league = await fetchLeagueOGById(params.leagueId);
  const label  = competitionLabel(params.competition);
  const image  = `${BASE_URL}/${params.competition}/leagues/${params.leagueId}/opengraph-image`;
  const url    = `${BASE_URL}/${params.competition}/leagues/${params.leagueId}`;

  if (!league) {
    const t = "Prediction League — SuperBrain";
    const d = "Predict every match, compete with friends and top the table. Free to play.";
    return {
      title: t, description: d,
      openGraph: { type: "website", siteName: "SuperBrain", title: t, description: d, url, images: [{ url: image, width: 1200, height: 630, alt: t }] },
      twitter:   { card: "summary_large_image", title: t, description: d, images: [image] },
    };
  }

  const { name, memberCount } = league;
  const compPart = label ? ` ${label}` : "";
  const title = `${name} — Prediction League on SuperBrain`;
  const desc  = memberCount > 1
    ? `Predict every${compPart} match and compete with ${memberCount} others in ${name}. Free to play.`
    : `Predict every${compPart} match and compete in ${name}. Free to play.`;

  return {
    title, description: desc,
    openGraph: { type: "website", siteName: "SuperBrain", title, description: desc, url, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter:   { card: "summary_large_image", title, description: desc, images: [image] },
  };
}

export default function LeagueDetailLayout({ children }: Props) {
  return <>{children}</>;
}
