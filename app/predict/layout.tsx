import type { Metadata } from "next";
import type { ReactNode } from "react";
import EmailVerificationBanner from "@/components/predictor/EmailVerificationBanner";

const BASE_URL   = "https://www.superbrain.social";
const PRED_TITLE = "SuperBrain World Cup 2026 Predictor";
const PRED_DESC  = "Predict every World Cup match, create private leagues, compete with friends and win the Custom Champion Watch.";
const PRED_URL   = `${BASE_URL}/predict`;
// Static JPG — universally readable by all crawlers (Facebook, Messenger, etc.)
const OG_IMAGE   = `${BASE_URL}/og/world-cup-predictor.jpg`;

export const metadata: Metadata = {
  title:       PRED_TITLE,
  description: PRED_DESC,
  openGraph: {
    type:        "website",
    siteName:    "SuperBrain",
    title:       PRED_TITLE,
    description: PRED_DESC,
    url:         PRED_URL,
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        type:   "image/jpeg",
        alt:    "SuperBrain World Cup 2026 Predictor — Predict every match. Compete for the Custom Champion Watch.",
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       PRED_TITLE,
    description: PRED_DESC,
    images:      [OG_IMAGE],
  },
};

/**
 * Predictor shell layout.
 * Wraps every /predict route in the light-mode `.predict-shell` class,
 * giving the Predictor section a visually distinct feel from Brain Tests.
 */
export default function PredictLayout({ children }: { children: ReactNode }) {
  return (
    <div className="predict-shell flex-1 flex flex-col min-h-full">
      <EmailVerificationBanner />
      {children}
    </div>
  );
}
