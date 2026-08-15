import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Layout for /predict/leagues/join
 *
 * The dynamic league-specific OG image is served by opengraph-image.tsx in
 * this same directory (which generates per-league images).
 * The metadata here provides the text-based tags; the image tag points to
 * the same opengraph-image route so crawlers get the full preview.
 */

const BASE_URL  = "https://www.superbrain.social";
const TITLE     = "Join My WC 2026 Prediction League — SuperBrain";
const DESC      = "I've created a private WC 2026 prediction league on SuperBrain. Join free, predict every match and compete with friends. The overall winner gets the Custom Champion Watch.";
const PAGE_URL  = `${BASE_URL}/predict/leagues/join`;
const OG_IMAGE  = `${BASE_URL}/predict/leagues/join/opengraph-image`;

export const metadata: Metadata = {
  title:       TITLE,
  description: DESC,
  openGraph: {
    type:        "website",
    siteName:    "SuperBrain",
    title:       TITLE,
    description: DESC,
    url:         PAGE_URL,
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        alt:    "Join a WC 2026 Prediction League — SuperBrain",
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       TITLE,
    description: DESC,
    images:      [OG_IMAGE],
  },
};

export default function JoinLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
