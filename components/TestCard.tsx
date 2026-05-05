import Link from "next/link";

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

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy:   "#00e676",
  Medium: "#ffab00",
  Hard:   "#ff6d00",
  Expert: "#ff3d00",
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
        className={`relative flex flex-col bg-cockpit-card border rounded-sm overflow-hidden transition-all duration-200 active:scale-[0.99] ${
          featured
            ? "border-cockpit-accent border-opacity-30 hover:border-opacity-70"
            : "border-cockpit-border hover:border-cockpit-accent hover:border-opacity-40"
        }`}
      >
        {/* Top accent line */}
        <div
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
        />

        <div className="flex flex-col flex-1 p-5 gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="text-white font-bold text-base leading-tight">{title}</h3>
                {featured && (
                  <span className="text-xs border border-cockpit-accent border-opacity-40 text-cockpit-accent px-2 py-0.5 rounded-sm tracking-widest font-mono">
                    POPULAR
                  </span>
                )}
              </div>
            </div>
            {/* Arrow */}
            <div
              className="shrink-0 mt-0.5 w-7 h-7 rounded-sm border flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ borderColor: `${color}40`, color }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <p className="text-cockpit-dim text-sm leading-relaxed flex-1">{description}</p>

          {/* Footer meta */}
          <div className="flex items-center gap-4 pt-2 border-t border-cockpit-border">
            {/* Duration */}
            <div className="flex items-center gap-1.5 text-cockpit-dim text-xs">
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
                    style={{ background: n <= dots ? color : "#1e2a38" }}
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
