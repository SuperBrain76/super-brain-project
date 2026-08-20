import type { ReactNode } from "react";

/**
 * No metadata here: inherit the competition layout's per-competition
 * title/description/OG image. A static export here previously hardcoded a
 * World-Cup title and a broken /predict/opengraph-image path.
 */
export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
