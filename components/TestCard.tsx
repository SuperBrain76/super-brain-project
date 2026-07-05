import Link from "next/link";
import { BRAND, MATERIAL } from "@/lib/brand";

interface TestCardProps {
  testId: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  modules?: string[];
  href: string;
  featured?: boolean;
}

// Difficulty is a signal, not decoration — a restrained ramp toward heat.
const DIFFICULTY_COLOR: Record<string, string> = {
  Easy:   "#35C56F",
  Medium: "#33D6D6",
  Hard:   "#FF6A3D",
  Expert: "#FF4D3D",
};

const DIFFICULTY_DOTS: Record<string, number> = {
  Easy: 1, Medium: 2, Hard: 3, Expert: 4,
};

export default function TestCard({
  title,
  description,
  duration,
  difficulty,
  href,
  featured,
}: TestCardProps) {
  const color = DIFFICULTY_COLOR[difficulty];
  const dots  = DIFFICULTY_DOTS[difficulty];

  return (
    <Link href={href} className="group block">
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.99]"
        style={{
          background: MATERIAL.raise,
          border: `0.5px solid ${featured ? BRAND.hairlineStrong : BRAND.hairline}`,
        }}
      >
        <div className="flex flex-col flex-1 p-5 gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="font-bold text-base leading-tight" style={{ color: BRAND.ink }}>{title}</h3>
                {featured && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full tracking-[0.18em] font-semibold"
                    style={{ color: BRAND.muted, border: `0.5px solid ${BRAND.hairlineStrong}` }}>
                    POPULAR
                  </span>
                )}
              </div>
            </div>
            {/* Arrow */}
            <div
              className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5"
              style={{ border: `0.5px solid ${BRAND.hairlineStrong}`, color: BRAND.muted }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <p className="text-sm leading-relaxed flex-1" style={{ color: BRAND.muted }}>{description}</p>

          {/* Footer meta */}
          <div className="flex items-center gap-4 pt-3" style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
            {/* Duration */}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: BRAND.dim }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {duration}
            </div>
            {/* Difficulty dots */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="w-1.5 h-3 rounded-sm"
                    style={{ background: n <= dots ? color : "rgba(255,255,255,0.08)" }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono" style={{ color }}>{difficulty}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
