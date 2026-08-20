import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Nav  from "@/components/Nav";
import ConditionalFooter  from "@/components/ConditionalFooter";
import PWAInstallBanner   from "@/components/PWAInstallBanner";
import MobileBottomNav    from "@/components/MobileBottomNav";
import PostHogProvider from "@/components/PostHogProvider";
import DailyHomeRedirect from "@/components/DailyHomeRedirect";
import OnboardingGate from "@/components/OnboardingGate";

const BASE_URL = "https://www.superbrain.social";
const TITLE    = "SuperBrain — Free Sports Prediction Leagues";
const DESC     = "Predict the Premier League, Champions League, La Liga, ice hockey and more. Start a free private league, compete with your mates and top the table. No app, no stakes — just bragging rights.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title:        TITLE,
  description:  DESC,
  manifest:     "/manifest.json",
  appleWebApp: {
    capable:          true,
    statusBarStyle:   "black-translucent",
    title:            "SuperBrain",
  },
  openGraph: {
    type:        "website",
    siteName:    "SuperBrain",
    title:       TITLE,
    description: DESC,
    url:         BASE_URL,
    images: [
      {
        url:    `${BASE_URL}/opengraph-image`,
        width:  1200,
        height: 630,
        alt:    TITLE,
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       TITLE,
    description: DESC,
    images:      [`${BASE_URL}/opengraph-image`],
  },
  icons: {
    icon:  [
      { url: "/favicon.svg",        type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32",  type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16",  type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0d1117" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cockpit-bg min-h-dvh antialiased flex flex-col">
        <PostHogProvider>
          <AuthProvider>
            <DailyHomeRedirect />
            <OnboardingGate />
            <Nav />
            <main className="flex-1 flex flex-col">{children}</main>
            <ConditionalFooter />
            <MobileBottomNav />
            <PWAInstallBanner />
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
