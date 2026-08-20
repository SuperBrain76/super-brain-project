import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import CompetitionShell from "@/components/CompetitionShell";
import { createClient } from "@supabase/supabase-js";
import { isValidCompetitionSlug } from "@/lib/competitionRoutes";

/**
 * Competition segment layout.
 *
 * `/[competition]` is a TOP-LEVEL dynamic segment: /premier-league,
 * /la-liga, /wc2026. Next.js matches static routes first, so /tests,
 * /battle, /admin and the rest are unaffected — this only receives paths
 * nothing else claimed. CompetitionShell 404s anything that is not a real,
 * visible competition.
 *
 * Metadata is generated per competition so a shared link previews with the
 * right name. It is fetched server-side with the anon key, reading only
 * public columns.
 */

const SITE = "https://www.superbrain.social";

// The competition-existence check must read the database live on every request.
// Without this, Next's Data Cache can capture a negative result — e.g. a slug
// crawled or prefetched moments BEFORE its rows are seeded caches as "absent"
// and then 404s forever, even after the competition exists. force-dynamic +
// no-store keep this segment honest: a newly-seeded league is reachable at once.
export const dynamic     = "force-dynamic";
export const revalidate  = 0;
export const fetchCache  = "force-no-store";

type CompetitionRow = { name: string; slug: string; sport_code: string };

/**
 * Three outcomes, deliberately distinguished:
 *
 *   { kind: "found" }    — a real competition
 *   { kind: "absent" }   — queried successfully, no such competition → 404
 *   { kind: "unknown" }  — could not query (no env, network error) → render
 *                          and let the client decide
 *
 * Collapsing "absent" and "unknown" into null would make a Supabase outage
 * 404 every competition on the platform, which is far worse than briefly
 * serving 200 for a bad URL.
 */
async function fetchCompetition(
  slug: string,
): Promise<{ kind: "found"; row: CompetitionRow } | { kind: "absent" } | { kind: "unknown" }> {
  if (!isValidCompetitionSlug(slug)) return { kind: "absent" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return { kind: "unknown" };

  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db
      .from("competitions")
      .select("name, slug, sport_code")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return { kind: "unknown" };
    return data ? { kind: "found", row: data as CompetitionRow } : { kind: "absent" };
  } catch {
    return { kind: "unknown" };
  }
}

export async function generateMetadata(
  { params }: { params: { competition: string } },
): Promise<Metadata> {
  const found = await fetchCompetition(params.competition);
  const comp  = found.kind === "found" ? found.row : null;

  const name  = comp?.name ?? "Predictor";
  const title = `${name} Predictor — SuperBrain`;
  const desc  = `Predict every ${name} match, create private leagues and compete with friends on SuperBrain.`;
  const url   = `${SITE}/${params.competition}`;

  // Per-competition OG image (app/[competition]/opengraph-image.tsx) — the
  // right competition name, in the current brand. Absolute URL because
  // crawlers don't follow the 307 from superbrain.social → www.
  const ogImage = `${SITE}/${params.competition}/opengraph-image`;

  return {
    title,
    description: desc,
    metadataBase: new URL(SITE),
    openGraph: {
      type:        "website",
      siteName:    "SuperBrain",
      title,
      description: desc,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description: desc,
      images:      [ogImage],
    },
  };
}

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params:   { competition: string };
}) {
  // Server-side 404 for a slug that is definitively not a competition.
  //
  // Without this the shell still renders a not-found UI, but the HTTP status
  // is 200 — so crawlers index every typo'd URL as a real page. `absent` is
  // only returned when the database answered and had no such row; an outage
  // yields `unknown` and falls through to the client.
  const found = await fetchCompetition(params.competition);
  if (found.kind === "absent") notFound();

  return (
    <CompetitionShell slug={params.competition}>
      {children}
    </CompetitionShell>
  );
}
