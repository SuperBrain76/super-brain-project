import HomepageAnalytics from "@/components/HomepageAnalytics";
import PremierLeagueLanding from "@/components/home/PremierLeagueLanding";

/**
 * The landing page — the product's front door.
 *
 * Now a purpose-built Premier League landing (the live competition), not the
 * archived World Cup billboard. See components/home/PremierLeagueLanding.tsx.
 * It's evergreen and self-contained, so it always renders for an anonymous
 * visitor regardless of DB / auth state.
 */
export default function LandingPage() {
  return (
    <>
      <HomepageAnalytics />
      <PremierLeagueLanding />
    </>
  );
}
