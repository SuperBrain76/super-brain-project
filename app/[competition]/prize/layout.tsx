import type { Metadata } from "next";
import type { ReactNode } from "react";

const BASE_URL  = "https://www.superbrain.social";
const TITLE     = "Win the Custom Champion Watch — SuperBrain WC 2026";
const DESC      = "The overall SuperBrain WC Prediction 2026 champion wins a custom-built luxury watch assembled in Sweden with Swiss movement and personalized engraving. Free to enter.";
const PAGE_URL  = `${BASE_URL}/predict/prize`;
const OG_IMAGE  = `${BASE_URL}/predict/prize/opengraph-image`;

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
        alt:    "Custom Champion Watch — Grand Prize for SuperBrain WC Prediction 2026 Champion",
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

export default function PrizeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
