"use client";

import { track } from "@/lib/analytics";

const WA_URL = "https://whatsapp.com/channel/0029Vb8BD6q1iUxcrEhi4W2S";

const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";

// Official WhatsApp icon (simplified mark)
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.18 1.6 6L0 24l6.22-1.57A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.22-3.48-8.52z"
        fill="#25D366"
      />
      <path
        d="M17.47 14.38c-.28-.14-1.65-.81-1.9-.9-.26-.1-.44-.14-.63.14-.18.28-.72.9-.88 1.08-.16.18-.33.2-.61.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.66-1.55-1.94-.16-.28-.02-.43.12-.57.13-.12.28-.33.42-.49.14-.16.18-.28.28-.47.09-.18.05-.35-.02-.49-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48H8.6c-.18 0-.47.07-.72.35-.25.28-.95.93-.95 2.26s.97 2.62 1.11 2.8c.14.18 1.91 2.91 4.63 4.08.65.28 1.15.45 1.54.57.65.2 1.24.17 1.7.1.52-.08 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.26-.18-.54-.32z"
        fill="#fff"
      />
    </svg>
  );
}

// ── Benefit item ──────────────────────────────────────────────

function Benefit({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "#25D366" }} />
      <span className="text-xs" style={{ color: MUTED }}>{text}</span>
    </div>
  );
}

// ── Variants ──────────────────────────────────────────────────

/** Full card — used on homepage and league join page */
export function WhatsAppChannelCard({ className }: { className?: string }) {
  const handleClick = () => {
    track.whatsappChannelClicked("card");
    window.open(WA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`rounded-xl overflow-hidden ${className ?? ""}`}
      style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: "3px solid #25D366" }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
        >
          <WhatsAppIcon size={18} />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-bold leading-tight" style={{ color: "#0f1f17" }}>
              Stay in the loop
            </p>
            <span
              className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}
            >
              Free
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
            <Benefit text="Match reminders" />
            <Benefit text="Leaderboard updates" />
            <Benefit text="Prediction tips" />
            <Benefit text="Tournament news" />
          </div>

          <button
            type="button"
            onClick={handleClick}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98]"
            style={{
              background:  "#25D366",
              color:       "#fff",
              touchAction: "manipulation",
            }}
          >
            <WhatsAppIcon size={14} />
            Join WhatsApp Channel
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact inline banner — used after first prediction is saved */
export function WhatsAppFirstPredictionBanner({ onDismiss }: { onDismiss: () => void }) {
  const handleClick = () => {
    track.whatsappChannelClicked("first_prediction_banner");
    window.open(WA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#f0fdf4",
        border:     "1px solid #bbf7d0",
        borderLeft: "3px solid #25D366",
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#fff", border: "1px solid #bbf7d0" }}
        >
          <WhatsAppIcon size={16} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight" style={{ color: "#14532d" }}>
            First prediction saved! 🎉
          </p>
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#15803d" }}>
            Get match reminders &amp; tips on WhatsApp
          </p>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98]"
            style={{ background: "#25D366", color: "#fff", touchAction: "manipulation" }}
          >
            <WhatsAppIcon size={12} />
            Join
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-green-100"
            style={{ color: "#7a8f82" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Homepage hero variant — darker background context */
export function WhatsAppHeroCard({ className }: { className?: string }) {
  const handleClick = () => {
    track.whatsappChannelClicked("homepage_hero");
    window.open(WA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all active:scale-[0.99] ${className ?? ""}`}
      style={{
        background:  "rgba(37,211,102,0.07)",
        border:      "1px solid rgba(37,211,102,0.25)",
        touchAction: "manipulation",
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(37,211,102,0.15)" }}
      >
        <WhatsAppIcon size={16} />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white leading-tight">
          Join our WhatsApp Channel
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          Reminders · tips · leaderboard updates
        </p>
      </div>

      {/* Arrow */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
