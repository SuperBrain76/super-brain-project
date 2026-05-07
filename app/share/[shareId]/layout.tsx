import type { Metadata } from "next";
import { fetchOGData } from "@/lib/og";

type Props = { params: { shareId: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await fetchOGData(params.shareId);

  if (!d) {
    return {
      title:       "SuperBrain — Result",
      description: "Take a cognitive test and see where you stand.",
    };
  }

  const title = `${d.displayName} scored ${d.score}/100 on SuperBrain`;
  const desc  = `Can you beat ${d.score}/100 on the ${d.testName}? Challenge accepted.`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type:        "website",
      url:         `https://superbrain.social/share/${params.shareId}`,
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description: desc,
    },
  };
}

export default function ShareLayout({ children }: Props) {
  return <>{children}</>;
}
