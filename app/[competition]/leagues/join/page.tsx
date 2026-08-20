import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchLeagueOGByCode } from "@/lib/og";
import JoinContent from "./_join-content";

// www. is the canonical domain — superbrain.social 307-redirects to www.
// Crawlers (Facebook/LinkedIn/WhatsApp) do not follow 307s for og:image URLs,
// so every image URL below is absolute and already on www.
const BASE_URL = "https://www.superbrain.social";

// Slug to display label, mirroring opengraph-image.tsx. Static rather than a
// database lookup so metadata generation stays cheap.
const COMPETITION_LABELS: Record<string, string> = {
  "premier-league": "Premier League",
  "la-liga":        "LaLiga",
  "bundesliga":     "Bundesliga",
  "serie-a":        "Serie A",
  "ligue-1":        "Ligue 1",
  "allsvenskan":    "Allsvenskan",
  "shl":            "SHL",
};

function labelFor(slug?: string): string {
  if (!slug) return "";
  if (COMPETITION_LABELS[slug]) return COMPETITION_LABELS[slug];
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type Props = {
  params:       { competition: string };
  searchParams: { code?: string };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const code   = searchParams.code?.trim().toUpperCase() ?? "";
  const league = await fetchLeagueOGByCode(code);
  const slug   = params.competition;
  const label  = labelFor(slug);

  // The competition-aware card rendered by ./opengraph-image.tsx.
  const joinPath = code
    ? `${BASE_URL}/${slug}/leagues/join?code=${code}`
    : `${BASE_URL}/${slug}/leagues/join`;
  const IMAGE = `${BASE_URL}/${slug}/leagues/join/opengraph-image`;
  const IMAGE_ALT = label
    ? `Join a ${label} prediction league on SuperBrain`
    : "Join a prediction league on SuperBrain";

  const FALLBACK_TITLE = label
    ? `Join a ${label} Prediction League — SuperBrain`
    : "Join a Prediction League — SuperBrain";
  const FALLBACK_DESC = label
    ? `Predict every ${label} match, beat your mates and climb the table. Free to play.`
    : "Predict the matches, beat your mates and climb the table. Free to play.";

  // ── Fallback: no code or league not found ─────────────────
  if (!league) {
    return {
      title:       FALLBACK_TITLE,
      description: FALLBACK_DESC,
      openGraph: {
        title:       FALLBACK_TITLE,
        description: FALLBACK_DESC,
        type:        "website",
        url:         joinPath,
        images:      [{ url: IMAGE, width: 1200, height: 630, alt: IMAGE_ALT }],
      },
      twitter: {
        card:        "summary_large_image",
        title:       FALLBACK_TITLE,
        description: FALLBACK_DESC,
        images:      [IMAGE],
      },
    };
  }

  // ── Dynamic: league resolved ───────────────────────────────
  // The member count is the strongest signal in the preview: an invite that
  // shows a populated league converts better than one that shows a product.
  // Use the per-LEAGUE image so the preview carries the league/venue name.
  const { name, memberCount } = league;
  const compPart = label ? ` ${label}` : "";
  const title = `Join ${name} —${compPart} Prediction League`;
  const desc  = memberCount > 1
    ? `Predict every${compPart} match and compete with ${memberCount} others in ${name}. Free to play.`
    : `Predict every${compPart} match and compete in ${name}. Free to play.`;
  const LEAGUE_IMAGE = `${BASE_URL}/${slug}/leagues/${league.id}/opengraph-image`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type:        "website",
      url:         joinPath,
      images:      [{ url: LEAGUE_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description: desc,
      images:      [LEAGUE_IMAGE],
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
