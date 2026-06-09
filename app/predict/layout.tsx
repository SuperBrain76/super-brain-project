import type { Metadata } from "next";
import type { ReactNode } from "react";
import EmailVerificationBanner from "@/components/predictor/EmailVerificationBanner";

const PRED_TITLE = "SuperBrain World Cup 2026 Predictor";
const PRED_DESC  = "Predict every World Cup match, create private leagues, compete with friends and win the Custom Champion Watch.";
// Fully-qualified static JPEG — the only og:image for /predict.
// opengraph-image.tsx has been permanently DELETED from this directory.
// No dynamic OG route exists here; one og:image tag only.
const STATIC_OG  = "https://www.superbrain.social/og/world-cup-predictor.jpg";
const PRED_URL   = "https://www.superbrain.social/predict";

export const metadata: Metadata = {
  title:       PRED_TITLE,
  description: PRED_DESC,
  // Explicit metadataBase override so relative resolution never kicks in
  metadataBase: new URL("https://www.superbrain.social"),
  openGraph: {
    type:        "website",
    siteName:    "SuperBrain",
    title:       PRED_TITLE,
    description: PRED_DESC,
    url:         PRED_URL,
    images: [
      {
        url:    STATIC_OG,
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
    images:      [STATIC_OG],
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
