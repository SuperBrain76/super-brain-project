import type { Metadata } from "next";
import { fetchOGData } from "@/lib/og";

type Props = { params: { shareId: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await fetchOGData(params.shareId);

  if (!d) {
    return {
      title:       "SuperBrain — Challenge",
      description: "Accept the challenge and see if you can beat the score.",
    };
  }

  const title = `${d.displayName} is challenging you — ${d.score}/100 on SuperBrain`;
  const desc  = `Think you can beat ${d.score}/100 on the ${d.testName}? Accept the challenge.`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type:        "website",
      url:         `https://superbrain.social/challenge/${params.shareId}`,
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description: desc,
    },
  };
}

export default function ChallengeLayout({ children }: Props) {
  return <>{children}</>;
}
