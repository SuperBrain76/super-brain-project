import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Nav  from "@/components/Nav";
import Footer from "@/components/Footer";
import PostHogProvider from "@/components/PostHogProvider";

const BASE_URL = "https://superbrain.social";
const TITLE    = "SuperBrain — Test Your Mind Under Pressure";
const DESC     = "Fast, intense cognitive tests for reaction speed, memory, and decision-making. Find out where you really stand — in under 3 minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title:        TITLE,
  description:  DESC,
  openGraph: {
    type:        "website",
    siteName:    "SuperBrain",
    title:       TITLE,
    description: DESC,
    url:         BASE_URL,
  },
  twitter: {
    card:        "summary_large_image",
    title:       TITLE,
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cockpit-bg min-h-screen antialiased flex flex-col">
        <PostHogProvider>
          <AuthProvider>
            <Nav />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
