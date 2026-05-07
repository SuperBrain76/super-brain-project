import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Nav  from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "SuperBrain — Test Your Mind Under Pressure",
  description:
    "Fast, intense cognitive performance tests for focus, reaction speed, memory, and decision-making. Take the Fighter Pilot Cognitive Test, Reaction Speed Test, Pressure Decision Test, and more.",
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
        <AuthProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
