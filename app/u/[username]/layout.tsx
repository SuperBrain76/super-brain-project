import type { Metadata } from "next";
import { fetchProfileOG } from "@/lib/og";

type Props = { params: { username: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await fetchProfileOG(params.username);

  if (!d) {
    return {
      title: "SuperBrain — Profile",
      description: "Discover members on the SuperBrain economy.",
    };
  }

  const title = `${d.displayName} (@${d.username}) — SuperBrain`;
  const parts: string[] = [];
  if (d.isPublic) {
    if (d.levelName) parts.push(`${d.levelName}`);
    if (d.balance != null && d.currencyCode) parts.push(`${d.balance.toLocaleString()} ${d.currencyCode}`);
    if (d.achievements != null) parts.push(`${d.achievements} badges`);
  }
  const desc = d.isPublic
    ? parts.join(" · ") || "See their stats on the SuperBrain economy."
    : "This SuperBrain profile is private.";

  const url = `https://www.superbrain.social/u/${d.username}`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, type: "profile", url },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export default function ProfileLayout({ children }: Props) {
  return <>{children}</>;
}
