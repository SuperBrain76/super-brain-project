import type { Metadata } from "next";
import type { ReactNode } from "react";

const BASE_URL  = "https://www.superbrain.social";
const TITLE     = "Global Rankings — SuperBrain WC 2026 Predictor";
const DESC      = "See who's leading the SuperBrain WC 2026 Prediction leaderboard. The overall champion wins the Custom Champion Watch. Free to play — start predicting now.";
const PAGE_URL  = `${BASE_URL}/predict/leaderboard`;
const OG_IMAGE  = `${BASE_URL}/predict/opengraph-image`;   // reuse main predictor OG

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
        alt:    "SuperBrain WC 2026 Predictor — Global Rankings",
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

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
