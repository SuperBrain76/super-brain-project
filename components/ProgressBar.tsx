"use client";

interface ProgressBarProps {
  current: number;   // 0-based module index
  total: number;
}

const MODULES = ["Reaction", "Visual Memory", "Spatial", "Multitask", "Mental Math"];

export default function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1">
        {MODULES.slice(0, total).map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex-1 flex flex-col gap-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  done
                    ? "bg-cockpit-green"
                    : active
                    ? "bg-cockpit-accent"
                    : "bg-cockpit-border"
                }`}
              />
              <span
                className={`text-xs text-center hidden lg:block transition-colors duration-300 ${
                  done
                    ? "text-cockpit-green"
                    : active
                    ? "text-cockpit-accent"
                    : "text-cockpit-muted"
                }`}
                style={{ fontSize: "10px", letterSpacing: "0.08em" }}
              >
                {label.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
