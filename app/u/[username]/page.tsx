"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPublicProfile, getMyProfileSettings, type PublicProfile } from "@/lib/publicProfile";
import { BRAND, MATERIAL } from "@/lib/brand";
import { IqInfoButton } from "@/components/IqInfoSheet";
import { PrestigeAvatar } from "@/components/PrestigeAvatar";
import { currentTier } from "@/lib/prestige";
import { useAuth } from "@/components/AuthProvider";

const INK = "#0B0B0D";           // deep base for gradients
const GREEN = BRAND.sports;      // emerald accent (share, links)
const GREEN_INK = "#04140B";     // text on emerald
const GREEN2 = "#141418";        // dark elevated
const GOLD = BRAND.gold;
const GOLD_SOFT = BRAND.goldSoft;
const MUTED = BRAND.muted;
const TEXT = BRAND.ink;
const BORDER = BRAND.hairline;
const BG = BRAND.black;
const CARD = BRAND.surface;

const TEST_LABELS: Record<string, string> = {
  reaction: "Reaction", memory: "Memory", "verbal-memory": "Verbal Memory",
  stroop: "Stroop", focus: "Focus", "tap-speed": "Tap Speed",
  matrix: "Matrix", pressure: "Pressure",
};
function testLabel(k: string) {
  return TEST_LABELS[k] ?? k.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmt(n: number) { return n.toLocaleString(); }
function joinLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = String(params?.username ?? "");
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const [selfUsername, setSelfUsername] = useState<string | null>(null);

  useEffect(() => {
    (async () => setP(await getPublicProfile(username)))();
  }, [username]);

  useEffect(() => {
    if (!user) { setSelfUsername(null); return; }
    getMyProfileSettings().then((s) => setSelfUsername(s?.username ?? null));
  }, [user]);

  const isSelf = !!selfUsername && selfUsername.toLowerCase() === username.toLowerCase();

  const share = useCallback(async () => {
    if (!p || !p.username) return;
    const url = `${window.location.origin}/u/${p.username}`;
    const text = `Check out ${p.displayName ?? p.username} on SuperBrain`;
    try {
      if (navigator.share) await navigator.share({ title: "SuperBrain", text, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  }, [p]);

  if (p === undefined) {
    return <Shell><div className="animate-pulse space-y-4">
      <div className="h-40 rounded-3xl" style={{ background: BRAND.elevated }} />
      <div className="h-24 rounded-2xl" style={{ background: BRAND.elevated }} />
      <div className="h-40 rounded-2xl" style={{ background: BRAND.elevated }} />
    </div></Shell>;
  }
  if (p === null || !p.found) {
    return <Shell><Empty title="Profile not found" body={`No SuperBrain profile exists at /u/${username}.`} /></Shell>;
  }

  const name = p.displayName ?? p.username ?? "Member";
  const avatarColor = p.avatarColor ?? "#1a3a2a";
  const tier = currentTier(p.level?.lifetimeEarned ?? p.balance ?? 0);
  const tierLabel = tier ? tier.id[0].toUpperCase() + tier.id.slice(1) : "";

  // Private profile — minimal card only.
  if (!p.isPublic) {
    return (
      <Shell>
        <Banner url={p.bannerUrl} />
        <div className="px-1 -mt-10">
          <PrestigeAvatar name={name} url={p.avatarUrl} color={avatarColor} iq={p.level?.lifetimeEarned ?? p.balance ?? 0} />
          <h1 className="text-xl font-black mt-3" style={{ color: TEXT }}>{name}</h1>
          {p.username && <p className="text-sm" style={{ color: MUTED }}>@{p.username}</p>}
          <div className="mt-6 rounded-2xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-2xl mb-2">🔒</p>
            <p className="text-sm font-bold" style={{ color: TEXT }}>This profile is private</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>This member has chosen to keep their stats hidden.</p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Banner url={p.bannerUrl} />

      {/* ── Identity — the player card ────────────────────────────────── */}
      <div className="px-1 -mt-10">
        <div className="flex items-end justify-between">
          <PrestigeAvatar name={name} url={p.avatarUrl} color={avatarColor} iq={p.level?.lifetimeEarned ?? p.balance ?? 0} />
          <div className="flex items-center gap-2 mb-1">
            {isSelf && (
              <Link href="/settings/public-profile"
                className="px-3.5 py-2 rounded-full text-sm font-semibold transition-transform active:scale-95"
                style={{ color: MUTED, border: `0.5px solid ${BORDER}` }}>
                Edit
              </Link>
            )}
            <button onClick={share} className="px-4 py-2 rounded-full text-sm font-bold transition-transform active:scale-95"
              style={{ background: GREEN, color: GREEN_INK }}>
              {copied ? "Copied ✓" : "Share"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <h1 className="text-2xl font-black leading-tight" style={{ color: TEXT }}>{name}</h1>
          {tier && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
              style={{ background: "rgba(232,193,90,0.12)", color: GOLD, border: `0.5px solid ${MATERIAL.ringFaint}` }}>
              <span>{tier.emblem ?? tier.icon}</span>{tierLabel}
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5" style={{ color: MUTED }}>
          {p.username ? `@${p.username}` : ""}
          {p.country ? ` · ${p.country}` : ""}
          {p.joinDate ? ` · Joined ${joinLabel(p.joinDate)}` : ""}
        </p>
        {p.bio && <p className="text-sm mt-2" style={{ color: TEXT }}>{p.bio}</p>}
      </div>

      {/* ── IQ hero — the star of the profile ─────────────────────────── */}
      {p.balance !== null && p.currency && (
        <div className="relative flex items-center justify-center pt-3 pb-1">
          <div className="absolute" style={{ width: 300, height: 300, background: MATERIAL.goldGlow }} />
          <div className="relative flex items-center justify-center" style={{ width: 222, height: 222 }}>
            <div className="absolute rounded-full" style={{ inset: 0, border: `1px solid ${MATERIAL.ringFaint}` }} />
            <div className="absolute rounded-full" style={{ inset: 0, border: "1.5px solid transparent", borderTopColor: MATERIAL.ring, borderRightColor: MATERIAL.ring, transform: "rotate(-38deg)" }} />
            <div className="relative text-center">
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-[11px]" style={{ letterSpacing: "0.34em", color: MUTED }}>{(p.currency.name || "IQ").toUpperCase()}</p>
                <IqInfoButton size={22} />
              </div>
              <p style={{
                fontSize: 58, lineHeight: 1, marginTop: 6, fontWeight: 600, letterSpacing: "-0.03em",
                background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text",
                WebkitTextFillColor: "transparent", color: "transparent",
                filter: "drop-shadow(0 6px 14px rgba(232,193,90,0.28))", fontVariantNumeric: "tabular-nums",
              }}>{fmt(p.balance)}</p>
              {p.level && (
                <p className="text-[12px]" style={{ marginTop: 8, color: MUTED }}>
                  <span style={{ color: GOLD, fontWeight: 600 }}>{p.level.name ?? "Rookie"}</span> · Level {p.level.level ?? 1}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Level progress — a line of light */}
      {p.level && (
        <div className="px-2">
          <div className="relative" style={{ height: 1, background: BORDER }}>
            <div className="absolute left-0 top-0" style={{ height: 1, width: `${Math.min(100, Math.max(2, p.level.progressPct))}%`, background: MATERIAL.goldFill }} />
            <div className="absolute" style={{ left: `${Math.min(100, Math.max(2, p.level.progressPct))}%`, top: -2, width: 5, height: 5, borderRadius: "50%", background: GOLD_SOFT, boxShadow: MATERIAL.shadowGold, transform: "translateX(-50%)" }} />
          </div>
          <div className="flex justify-between mt-2 text-[11px]" style={{ color: MUTED }}>
            <span>{fmt(p.level.lifetimeEarned)} earned all-time</span>
            <span>{p.level.nextName ? `Next: ${p.level.nextName}` : "Max level"}</span>
          </div>
        </div>
      )}

      {/* ── Highlights — three headline numbers (no duplication) ──────── */}
      <div className="grid grid-cols-3 gap-2">
        <BigStat label="Global rank" value={p.leaderboard.contributionRank ? `#${fmt(p.leaderboard.contributionRank)}` : "—"} sub="by IQ" gold />
        <BigStat label="Badges" value={p.achievements ? `${p.achievements.unlocked}` : "—"} sub={p.achievements ? `of ${p.achievements.total}` : "unlocked"} />
        <BigStat label="Best test" value={p.tests?.avgPercentile != null ? `${p.tests.avgPercentile}th` : "—"} sub="avg pct" />
      </div>

      {/* Achievements */}
      {p.achievements && (
        <Section title="Achievements" hint={`${p.achievements.unlocked} of ${p.achievements.total}`}>
          {p.achievements.list.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {p.achievements.list.map((a) => (
                <div key={a.code} className="rounded-2xl p-2.5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }} title={a.description}>
                  <div className="text-2xl mb-0.5">{a.icon}</div>
                  <p className="text-[10px] font-bold leading-tight" style={{ color: TEXT }}>{a.name}</p>
                </div>
              ))}
            </div>
          ) : <Muted>No badges yet.</Muted>}
        </Section>
      )}

      {/* Prediction stats */}
      {p.predictions && (
        <Section title="Prediction Stats">
          <div className="grid grid-cols-4 gap-2">
            <MiniStat value={fmt(p.predictions.totalPoints)} label="Points" accent />
            <MiniStat value={fmt(p.predictions.predictions)} label="Made" />
            <MiniStat value={fmt(p.predictions.exactScores)} label="Exact" />
            <MiniStat value={p.predictions.rank ? `#${fmt(p.predictions.rank)}` : "—"} label="Rank" />
          </div>
        </Section>
      )}

      {/* Cognitive test stats */}
      {p.tests && p.tests.best.length > 0 && (
        <Section title="Cognitive Tests" hint={p.tests.avgPercentile !== null ? `avg ${p.tests.avgPercentile}th pct` : undefined}>
          <div className="rounded-2xl p-3 space-y-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {p.tests.best.map((t) => (
              <div key={t.test_name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold" style={{ color: TEXT }}>{testLabel(t.test_name)}</span>
                  <span style={{ color: MUTED }}>{t.score}/100 · {t.percentile}th</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, t.score))}%`, background: `linear-gradient(90deg, ${GREEN}, ${GOLD})` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Network */}
      {p.network && (
        <Section title="Network">
          <div className="grid grid-cols-2 gap-2">
            <MiniStat value={fmt(p.network.total)} label="Referrals" />
            <MiniStat value={fmt(p.network.active)} label="Active friends" accent />
          </div>
        </Section>
      )}

      {/* Referral CTA — invite others (or share your own code if it's you) */}
      {p.referral?.code && (
        <div className="rounded-2xl p-4 text-center relative overflow-hidden" style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}`, color: TEXT }}>
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none" style={{ background: MATERIAL.goldGlow }} />
          <p className="text-sm font-bold mb-1 relative">{isSelf ? "Invite friends to SuperBrain" : `Join ${name} on SuperBrain`}</p>
          <p className="text-xs mb-3 relative" style={{ color: MUTED }}>
            {isSelf ? "Your invite code" : "Use invite code"} <span style={{ color: GOLD }}>{p.referral.code}</span>
          </p>
          {isSelf ? (
            <button onClick={share} className="relative inline-block px-5 py-2.5 rounded-full text-sm font-bold transition-transform active:scale-95" style={{ background: GOLD, color: BRAND.goldInk }}>
              {copied ? "Copied ✓" : "Share your invite"}
            </button>
          ) : (
            <Link href={`/?ref=${encodeURIComponent(p.referral.code)}`} className="relative inline-block px-5 py-2.5 rounded-full text-sm font-bold transition-transform active:scale-95" style={{ background: GOLD, color: BRAND.goldInk }}>
              Get started
            </Link>
          )}
        </div>
      )}

      {/* Recent activity */}
      {p.activity && p.activity.length > 0 && (
        <Section title="Contribution history">
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {p.activity.map((a, i) => (
              <div key={`${a.created_at}-${i}`} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: TEXT }}>{a.label}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>{timeAgo(a.created_at)}</p>
                </div>
                <span className="text-sm font-black shrink-0" style={{ color: "#5FCF8B" }}>+{fmt(a.delta)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="h-4" />
    </Shell>
  );
}

// ── presentational helpers ────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: BG }}>
      <div className="flex-1 px-4 py-5">
        <div className="max-w-md mx-auto space-y-5">{children}</div>
      </div>
    </div>
  );
}
function Banner({ url }: { url: string | null | undefined }) {
  return (
    <div className="h-32 rounded-3xl relative overflow-hidden"
      style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }
        : { background: `linear-gradient(120deg, ${GREEN2}, ${INK} 60%, ${GOLD})` }} />
  );
}

function BigStat({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl p-4 text-center relative overflow-hidden" style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}` }}>
      {gold && <div className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none" style={{ width: 120, height: 70, background: MATERIAL.goldGlow }} />}
      <p className="text-[10px] uppercase tracking-[0.16em] mb-1.5 relative" style={{ color: MUTED }}>{label}</p>
      <p className="text-2xl font-black leading-none relative"
        style={gold
          ? { background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }
          : { color: TEXT }}>
        {value}
      </p>
      {sub && <p className="text-[10px] mt-1.5 truncate relative" style={{ color: MUTED }}>{sub}</p>}
    </div>
  );
}
function MiniStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl py-2.5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-base font-black" style={{ color: accent ? GOLD : TEXT }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-sm font-black" style={{ color: TEXT }}>{title}</h2>
        {hint && <span className="text-[11px]" style={{ color: MUTED }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs" style={{ color: MUTED }}>{children}</p>;
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl p-8 text-center mt-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-3xl mb-2">🔍</p>
      <p className="text-sm font-bold mb-1" style={{ color: TEXT }}>{title}</p>
      <p className="text-xs" style={{ color: MUTED }}>{body}</p>
      <Link href="/iq" className="inline-block mt-4 text-sm font-bold" style={{ color: GREEN }}>← Back to your dashboard</Link>
    </div>
  );
}
