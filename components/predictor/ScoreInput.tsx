"use client";

interface ScoreInputProps {
  value:    number;
  onChange: (v: number) => void;
  label?:   string;      // team name shown above
  disabled?: boolean;
}

export default function ScoreInput({ value, onChange, label, disabled }: ScoreInputProps) {
  const dec = () => !disabled && onChange(Math.max(0, value - 1));
  const inc = () => !disabled && onChange(Math.min(20, value + 1));

  const btnBase =
    "w-12 h-12 rounded-sm border text-xl font-bold flex items-center justify-center transition-all duration-100 select-none shrink-0";
  const btnActive =
    "border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent active:scale-95";
  const btnDisabled =
    "border-cockpit-border text-cockpit-border cursor-not-allowed opacity-40";

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className="text-white text-sm font-semibold text-center leading-tight max-w-[90px] truncate">
          {label}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          disabled={disabled || value === 0}
          className={`${btnBase} ${disabled || value === 0 ? btnDisabled : btnActive}`}
          aria-label="Decrease score"
        >
          −
        </button>

        <div
          className="w-14 h-14 rounded-sm border border-cockpit-accent bg-cockpit-surface flex items-center justify-center"
          style={{ boxShadow: disabled ? "none" : "0 0 14px #00d4ff18" }}
        >
          <span className="text-3xl font-black number-display text-white tabular-nums">
            {value}
          </span>
        </div>

        <button
          type="button"
          onClick={inc}
          disabled={disabled || value === 20}
          className={`${btnBase} ${disabled || value === 20 ? btnDisabled : btnActive}`}
          aria-label="Increase score"
        >
          +
        </button>
      </div>
    </div>
  );
}
