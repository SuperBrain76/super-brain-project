import type { Metadata } from "next";
import VenuesLanding from "@/components/VenuesLanding";

const SITE  = "https://www.superbrain.social";
const TITLE = "SuperBrain for Venues — Your Bar's Own Prediction League";
const DESC  = "Give your regulars a reason to come back every matchweek. Your name, your logo, your colours — a free prediction league your customers scan and play on their phones. Live the same day.";
const IMAGE = `${SITE}/venues/opengraph-image`;

export const metadata: Metadata = {
  title:       TITLE,
  description: DESC,
  alternates:  { canonical: `${SITE}/venues` },
  openGraph: {
    type: "website", siteName: "SuperBrain", title: TITLE, description: DESC,
    url: `${SITE}/venues`, images: [{ url: IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [IMAGE] },
};

export default function VenuesPage() {
  return <VenuesLanding />;
}
