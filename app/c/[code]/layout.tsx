import type { Metadata } from "next";
import { fetchChallengeOG } from "@/lib/og";

const BASE_URL = "https://www.superbrain.social";

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const c = await fetchChallengeOG(params.code);
  const image = `${BASE_URL}/c/${params.code}/opengraph-image`;
  const url   = `${BASE_URL}/c/${params.code}`;

  const title = c
    ? `${c.name}${c.venueName ? ` · ${c.venueName}` : ""} — Matchday Challenge`
    : "Matchday Challenge — SuperBrain";
  const desc = c
    ? `Predict ${c.fixtures} match${c.fixtures === 1 ? "" : "es"} across competitions${c.venueName ? ` at ${c.venueName}` : ""}. Free to play — scan, predict, top the leaderboard.`
    : "Predict a hand-picked set of matches across competitions. Free to play.";

  return {
    title, description: desc,
    openGraph: { type: "website", siteName: "SuperBrain", title, description: desc, url, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter:   { card: "summary_large_image", title, description: desc, images: [image] },
  };
}

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
