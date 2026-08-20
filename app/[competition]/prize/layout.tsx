import type { ReactNode } from "react";

/**
 * No metadata here: inherit the competition layout's per-competition metadata.
 * The Champion Watch is a World-Cup-only promotion, so the prize route no
 * longer carries its own (World-Cup) title/description/OG image.
 */
export default function PrizeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
