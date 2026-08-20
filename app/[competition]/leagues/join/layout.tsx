import type { ReactNode } from "react";

/**
 * Layout for /[competition]/leagues/join.
 *
 * No metadata here on purpose: the page's generateMetadata (page.tsx) is the
 * single source of truth — it resolves the league from ?code= and points the
 * preview at the per-league OG image. A static export here would only shadow it
 * with stale text.
 */
export default function JoinLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
