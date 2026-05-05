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
