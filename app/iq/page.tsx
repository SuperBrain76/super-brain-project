"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getPartnerDashboard,
  dailyCheckin,
  type PartnerDashboard,
} from "@/lib/economy";
import { getMissions, claimMission, type Mission, type MissionsResult } from "@/lib/missions";
import { useAuth } from "@/components/AuthProvider";
import { getOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding";

// Palette (premium green + gold)
const INK = "#0f2419";
const GREEN = "#1a3a2a";
const GREEN2 = "#24513a";
const GOLD = "#c9a227";
const GOLD_SOFT = "#e7cf7a";
const MUTED = "#7a8f82";
const TEXT = "#12251b";
const BORDER = "#e3e9dd";
const BG = "#f6f4ee";
const CARD = "#ffffff";

function fmt(n: number): string {
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PartnerDashboardPage() {
  const { signOut } = useAuth();
  const [dash, setDash] = useState<PartnerDashboard | null | undefined>(undefined);
  const [missions, setMissions] = useState<MissionsResult | null>(null);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [onb, setOnb] = useState<OnboardingStatus | null>(null);

  const load = useCallback(async () => {
    setDash(await getPartnerDashboard());
    setOnb(await getOnboardingStatus());
  }, []);

  const loadMissions = useCallback(async () => {
    setMissions(await getMissions());
  }, []);

  useEffect(() => {
    load();
    loadMissions();
  }, [load, loadMissions]);

  const claimReward = useCallback(async (code: string) => {
    setClaimingMission(code);
    const r = await claimMission(code);
    if (r.claimed) {
      await Promise.all([load(), loadMissions()]);
    }
    setClaimingMission(null);
  }, [load, loadMissions]);

  const claim = useCallback(async () => {
    setClaiming(true);
    await dailyCheckin();
    await load();
    setClaiming(false);
  }, [load]);

  const share = useCallback(async () => {
    if (!dash || !dash.authenticated || !dash.referral.code) return;
    const code = dash.referral.code;
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    const text = `Join me on SuperBrain — use my partner code ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "SuperBrain", text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled share */
    }
  }, [dash]);

  // ── States ────────────────────────────────────────────────────────────────
  if (dash === undefined) {
    return (
      <Shell>
        <div className="animate-pulse space-y-4">
          <div className="h-44 rounded-3xl" style={{ background: "#e7ece4" }} />
          <div className="h-24 rounded-2xl" style={{ background: "#e7ece4" }} />
          <div className="h-40 rounded-2xl" style={{ background: "#e7ece4" }} />
        </div>
      </Shell>
    );
  }

  if (dash === null) {
    return (
      <Shell>
        <EmptyCard
          title="Economy not connected"
          body="The Partner Economy needs Supabase configured to load your dashboard."
        />
      </Shell>
    );
  }

  if (!dash.authenticated) {
    return (
      <Shell>
        <div
          className="rounded-3xl p-8 text-center"
          style={{ background: `linear-gradient(160deg, ${GREEN2}, ${INK})`, color: "#fff" }}
        >
          <p className="text-4xl mb-3">🧠</p>
          <h1 className="text-xl font-black mb-2">The SuperBrain Partner Economy</h1>
          <p className="text-sm mb-6" style={{ color: "#cdd8cf" }}>
            Earn, level up, and grow your network. Sign in to open your dashboard.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 rounded-full font-bold text-sm"
            style={{ background: GOLD, color: INK }}
          >
            Sign in to start
          </Link>
        </div>
      </Shell>
    );
  }

  const { currency, level, streak, dailyReward, referral, leaderboard, achievements } = dash;
  const sym = currency.symbol || "";

  const onbSteps = onb?.steps;
  const onbDone = onbSteps ? [onbSteps.avatar, onbSteps.profile, onbSteps.reward, onbSteps.test, onbSteps.prediction].filter(Boolean).length : 5;
  const showResume = !!onb?.authenticated && !onb.completedAt && onbDone < 5;

  return (
    <Shell>
      {/* Resume onboarding */}
      {showResume && (
        <Link href="/welcome" className="flex items-center gap-3 rounded-2xl p-3.5"
          style={{ background: "#fff6dc", border: `1px solid ${GOLD}` }}>
          <span className="text-xl">🚀</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "#8a6d12" }}>Finish setting up</p>
            <p className="text-[11px]" style={{ color: "#a8862a" }}>{onbDone}/5 done — earn more IQ</p>
          </div>
          <span className="text-sm font-black" style={{ color: "#8a6d12" }}>Resume ›</span>
        </Link>
      )}

      {/* ── Hero: balance + partner level ─────────────────────────────── */}
      <div
        className="rounded-3xl p-6 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${GREEN2} 0%, ${INK} 100%)`, color: "#fff" }}
      >
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent 70%)` }}
        />
        <div className="flex items-center justify-between mb-1 relative">
          <span className="text-xs uppercase tracking-widest" style={{ color: "#bfccc2" }}>
            {currency.name} Balance
          </span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: "rgba(255,255,255,0.12)", color: GOLD_SOFT }}
          >
            <span>{level.icon ?? "⭐"}</span>
            {level.name ?? "Partner"}
          </span>
        </div>
        <div className="flex items-end gap-2 relative">
          <span className="text-5xl font-black leading-none" style={{ color: GOLD_SOFT }}>
            {sym} {fmt(dash.balance)}
          </span>
        </div>

        {/* progress to next level */}
        <div className="mt-5 relative">
          <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: "#bfccc2" }}>
            <span>Lvl {level.level ?? 1} · {level.name ?? "Partner"}</span>
            <span>
              {level.nextName
                ? `${fmt(dash.lifetimeEarned)} / ${fmt(level.nextAt ?? 0)} → ${level.nextName}`
                : "Max level"}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(2, level.progressPct))}%`,
                background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Quick stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon="🔥" value={`${streak.current}`} label="streak" />
        <Stat icon="🤝" value={`${referral.active}`} label="active" />
        <Stat icon="🏆" value={leaderboard.rank ? `#${fmt(leaderboard.rank)}` : "—"} label="rank" />
        <Stat icon="🎖️" value={`${achievements.unlocked}/${achievements.total}`} label="badges" />
      </div>

      {/* ── Daily reward ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: CARD, border: `1px solid ${BORDER}` }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: dailyReward.available ? "#fff6dc" : "#eef1ea" }}
        >
          {dailyReward.available ? "🎁" : "✅"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: TEXT }}>
            {dailyReward.available ? "Daily reward ready" : "Reward claimed today"}
          </p>
          <p className="text-xs" style={{ color: MUTED }}>
            {dailyReward.available
              ? `Day ${dailyReward.streakDay} · +${fmt(dailyReward.total)} ${currency.code}`
              : `Come back tomorrow to grow your ${streak.current}-day streak`}
          </p>
        </div>
        {dailyReward.available && (
          <button
            onClick={claim}
            disabled={claiming}
            className="px-4 py-2 rounded-full text-sm font-bold shrink-0 disabled:opacity-60"
            style={{ background: GOLD, color: INK }}
          >
            {claiming ? "…" : `Claim +${fmt(dailyReward.total)}`}
          </button>
        )}
      </div>

      {/* ── Daily Missions ────────────────────────────────────────────── */}
      <MissionsSection data={missions} claimingCode={claimingMission} onClaim={claimReward} />

      {/* ── Next Actions ──────────────────────────────────────────────── */}
      {dash.nextActions.length > 0 && (
        <Section title="Next Actions" hint="Highest-value moves today">
          <div className="space-y-2">
            {dash.nextActions.map((a) => (
              <Link
                key={a.code}
                href={a.href}
                className="flex items-center gap-3 rounded-2xl p-3.5 transition-transform active:scale-[0.99]"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: BG }}
                >
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{a.title}</p>
                  <p className="text-xs truncate" style={{ color: MUTED }}>{a.subtitle}</p>
                </div>
                <span
                  className="text-sm font-black px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: "#fff6dc", color: "#8a6d12" }}
                >
                  +{fmt(a.iq)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ── Referral / network ────────────────────────────────────────── */}
      <Section title="Your Network" hint="Earn when partners get active">
        <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {referral.code ? (
            <div className="flex items-center gap-2 mb-4">
              <code
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono font-bold tracking-wider"
                style={{ background: BG, color: GREEN, border: `1px dashed ${BORDER}` }}
              >
                {referral.code}
              </code>
              <button
                onClick={share}
                className="px-4 py-2.5 rounded-xl text-sm font-bold shrink-0"
                style={{ background: GREEN, color: "#fff" }}
              >
                {copied ? "Copied ✓" : "Share"}
              </button>
            </div>
          ) : (
            <p className="text-xs mb-4" style={{ color: MUTED }}>Your partner code will appear once available.</p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <NetStat value={fmt(referral.total)} label="Referrals" />
            <NetStat value={fmt(referral.active)} label="Active" accent />
            <NetStat value={`${sym}${fmt(referral.earned)}`} label="Earned" />
          </div>
          {referral.pending > 0 && (
            <p className="text-[11px] text-center mt-3" style={{ color: MUTED }}>
              {referral.pending} invited — you earn when they become active
            </p>
          )}
          <Link href="/network" className="block text-center mt-3 text-xs font-bold" style={{ color: GREEN }}>
            View network dashboard →
          </Link>
        </div>
      </Section>

      {/* ── Achievements ──────────────────────────────────────────────── */}
      <Section title="Achievements" hint={`${achievements.unlocked} of ${achievements.total} unlocked`}>
        {achievements.recent.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {achievements.recent.map((a) => (
              <div
                key={a.code}
                className="rounded-2xl p-3 shrink-0 w-24 text-center"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className="text-[11px] font-bold leading-tight" style={{ color: TEXT }}>{a.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: MUTED }}>No badges yet — complete a Next Action to earn your first.</p>
        )}
      </Section>

      {/* ── Recent transactions ───────────────────────────────────────── */}
      <Section title="Recent Activity">
        {dash.recentTransactions.length > 0 ? (
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {dash.recentTransactions.map((t, i) => (
              <div
                key={`${t.created_at}-${i}`}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: TEXT }}>{t.label}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>{timeAgo(t.created_at)}</p>
                </div>
                <span
                  className="text-sm font-black shrink-0"
                  style={{ color: t.delta >= 0 ? "#2b7a4b" : "#b04a4a" }}
                >
                  {t.delta >= 0 ? "+" : ""}{fmt(t.delta)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: MUTED }}>No activity yet — claim your daily reward to begin.</p>
        )}
      </Section>

      {/* ── You hub: everything about your account in one place ────────── */}
      <Section title="More">
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <HubRow href="/network" icon="🌐" label="Network" hint="Your referral network" />
          <HubRow href="/results" icon="📊" label="Statistics" hint="Your test history & scores" />
          <HubRow href="/settings/public-profile" icon="🪪" label="Public profile" hint="Username, bio, privacy" />
          <HubRow href="/settings/profile" icon="⚙️" label="Account settings" hint="Name, country, avatar" />
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <span className="w-8 text-center text-lg">↩</span>
            <span className="flex-1 text-sm font-semibold" style={{ color: "#b04a4a" }}>Sign out</span>
          </button>
        </div>
      </Section>

      <div className="h-4" />
    </Shell>
  );
}

// ── Daily Missions ────────────────────────────────────────────────────────────
const CADENCE_LABEL: Record<string, string> = { daily: "Daily", weekly: "Weekly", event: "Milestone" };

function MissionsSection({
  data,
  claimingCode,
  onClaim,
}: {
  data: MissionsResult | null;
  claimingCode: string | null;
  onClaim: (code: string) => void;
}) {
  if (!data || !data.authenticated || data.missions.length === 0) return null;
  const sym = data.currency?.symbol ?? "";
  const claimable = data.missions.filter((m) => m.completed && !m.claimed).length;

  // Group by cadence, preserving server order (daily → weekly → event).
  const order: Mission["cadence"][] = ["daily", "weekly", "event"];
  const groups = order
    .map((c) => ({ cadence: c, items: data.missions.filter((m) => m.cadence === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-sm font-black" style={{ color: GREEN }}>Missions</h2>
        <span className="text-[11px]" style={{ color: claimable > 0 ? GOLD : MUTED }}>
          {claimable > 0 ? `${claimable} ready to claim` : "keep earning"}
        </span>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.cadence}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>
              {CADENCE_LABEL[g.cadence] ?? g.cadence}
            </p>
            <div className="space-y-2">
              {g.items.map((m) => {
                const pct = m.target > 0 ? Math.min(100, (m.progress / m.target) * 100) : 0;
                const isClaiming = claimingCode === m.code;
                return (
                  <div key={m.code} className="rounded-2xl p-3.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: BG }}>
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{m.title}</p>
                        <p className="text-[11px] truncate" style={{ color: MUTED }}>{m.description}</p>
                      </div>
                      {m.claimed ? (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={{ background: "#eef4ee", color: "#2b7a4b" }}>
                          Claimed ✓
                        </span>
                      ) : m.completed ? (
                        <button
                          onClick={() => onClaim(m.code)}
                          disabled={isClaiming}
                          className="text-xs font-black px-3 py-1.5 rounded-full shrink-0 disabled:opacity-60"
                          style={{ background: GOLD, color: INK }}
                        >
                          {isClaiming ? "…" : `Claim +${fmt(m.reward.amount)}`}
                        </button>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: "#fff6dc", color: "#8a6d12" }}>
                          +{fmt(m.reward.amount)} {sym}
                        </span>
                      )}
                    </div>
                    {!m.claimed && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: BG }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%`, background: m.completed ? "#2b7a4b" : `linear-gradient(90deg, ${GREEN2}, ${GOLD})` }} />
                        </div>
                        <span className="text-[10px] font-semibold shrink-0" style={{ color: MUTED }}>
                          {fmt(m.progress)}/{fmt(m.target)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HubRow({ href, icon, label, hint }: { href: string; icon: string; label: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
      <span className="w-8 text-center text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: TEXT }}>{label}</p>
        <p className="text-[11px]" style={{ color: MUTED }}>{hint}</p>
      </div>
      <span style={{ color: MUTED }}>›</span>
    </Link>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: BG }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <span className="text-base font-black" style={{ color: GREEN }}>Partner Dashboard</span>
          <Link href="/settings/public-profile" className="text-xs font-semibold" style={{ color: GOLD }}>
            Public profile ↗
          </Link>
        </div>
      </div>
      <div className="flex-1 px-4 py-5">
        <div className="max-w-md mx-auto space-y-5">{children}</div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="rounded-2xl py-3 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-lg leading-none mb-1">{icon}</div>
      <div className="text-sm font-black" style={{ color: TEXT }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}

function NetStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl py-2.5" style={{ background: BG }}>
      <div className="text-base font-black" style={{ color: accent ? GOLD : TEXT }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-sm font-black" style={{ color: GREEN }}>{title}</h2>
        {hint && <span className="text-[11px]" style={{ color: MUTED }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-bold mb-1" style={{ color: TEXT }}>{title}</p>
      <p className="text-xs" style={{ color: MUTED }}>{body}</p>
    </div>
  );
}
