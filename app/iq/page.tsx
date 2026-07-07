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
import { MATERIAL } from "@/lib/brand";
import { IqInfoButton } from "@/components/IqInfoSheet";
import { PrestigeStatusLine, IqUnlocksLadder } from "@/components/IqUnlocks";
import { detectCelebrations, type CelebrationEvent } from "@/lib/celebrate";
import { CelebrationModal } from "@/components/CelebrationModal";

// Palette — "Midnight Gold", sculpted. Gold = earned value only.
const INK = "#2A2205";     // text on a gold fill
const GREEN = "#F5F5F2";   // primary ink (headings / text)
const GREEN2 = "#1F1F25";  // dark elevated fill (secondary controls)
const GOLD = "#E8C15A";
const GOLD_SOFT = "#F0D98B";
const MUTED = "#8B8B93";
const TEXT = "#F5F5F2";
const BORDER = "rgba(255,255,255,0.08)";
const BG = "#17181D";      // inset / small surfaces
const CARD = "#111116";    // card surface

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
  const [cels, setCels] = useState<CelebrationEvent[]>([]);

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

  // Detect and celebrate the moments worth celebrating (level-ups, new status
  // tiers, fresh achievements). Idempotent via localStorage snapshots.
  useEffect(() => {
    if (!dash || !dash.authenticated) return;
    const ev = detectCelebrations({
      level: dash.level.level,
      levelName: dash.level.name,
      levelIcon: dash.level.icon,
      lifetimeEarned: dash.lifetimeEarned,
      recentAchievements: dash.achievements.recent.map((a) => ({ code: a.code, name: a.name, icon: a.icon })),
    });
    if (ev.length) setCels(ev);
  }, [dash]);

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
    const text = `Join me on SuperBrain — use my invite code ${code}`;
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
          <div className="h-44 rounded-3xl" style={{ background: "#17181D" }} />
          <div className="h-24 rounded-2xl" style={{ background: "#17181D" }} />
          <div className="h-40 rounded-2xl" style={{ background: "#17181D" }} />
        </div>
      </Shell>
    );
  }

  if (dash === null) {
    return (
      <Shell>
        <EmptyCard
          title="Economy not connected"
          body="The SuperBrain Economy needs Supabase configured to load your dashboard."
        />
      </Shell>
    );
  }

  if (!dash.authenticated) {
    return (
      <Shell>
        <div
          className="rounded-3xl p-8 text-center relative overflow-hidden"
          style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}`, color: TEXT }}
        >
          <div className="absolute left-1/2 -translate-x-1/2 -top-10" style={{ width: 220, height: 220, background: MATERIAL.goldGlow }} />
          <p className="text-4xl mb-3 relative">🧠</p>
          <h1 className="text-xl font-black mb-2 relative">Your SuperBrain</h1>
          <p className="text-sm mb-6 relative" style={{ color: MUTED }}>
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

  const { currency, level, streak, referral, leaderboard, achievements } = dash;
  const sym = currency.symbol || "";
  const cont = resolveContinue(dash, missions);

  const onbSteps = onb?.steps;
  const onbDone = onbSteps ? [onbSteps.avatar, onbSteps.profile, onbSteps.reward, onbSteps.test, onbSteps.prediction].filter(Boolean).length : 5;
  const showResume = !!onb?.authenticated && !onb.completedAt && onbDone < 5;

  return (
    <Shell>
      {cels.length > 0 && (
        <CelebrationModal events={cels} referralCode={referral.code} onClose={() => setCels([])} />
      )}

      {/* Resume onboarding */}
      {showResume && (
        <Link href="/welcome" className="flex items-center gap-3 rounded-2xl p-3.5"
          style={{ background: "rgba(232,193,90,0.07)", border: `0.5px solid rgba(232,193,90,0.28)` }}>
          <span className="text-xl">🚀</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: GOLD }}>Finish setting up</p>
            <p className="text-[11px]" style={{ color: MUTED }}>{onbDone}/5 done — earn more IQ</p>
          </div>
          <span className="text-sm font-black" style={{ color: GOLD }}>Resume ›</span>
        </Link>
      )}

      {/* Headline — the promise, near the top */}
      <div className="text-center px-2 pt-1">
        <h1 className="text-lg font-black leading-snug" style={{ color: TEXT }}>Build your SuperBrain profile.</h1>
        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: MUTED }}>
          Every prediction, brain test, battle and contribution earns permanent <span style={{ color: GOLD, fontWeight: 700 }}>IQ</span>.
        </p>
      </div>

      {/* ── Hero: IQ, sculpted (boxless) — value framed by the icon's ring ── */}
      <div className="relative flex items-center justify-center pt-2 pb-1">
        <div className="absolute" style={{ width: 300, height: 300, background: MATERIAL.goldGlow }} />
        <div className="relative flex items-center justify-center" style={{ width: 236, height: 236 }}>
          <div className="absolute rounded-full" style={{ inset: 0, border: `1px solid ${MATERIAL.ringFaint}` }} />
          <div className="absolute rounded-full" style={{ inset: 0, border: "1.5px solid transparent", borderTopColor: MATERIAL.ring, borderRightColor: MATERIAL.ring, transform: "rotate(-38deg)" }} />
          <div className="relative text-center">
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-[11px]" style={{ letterSpacing: "0.34em", color: MUTED }}>{(currency.name || "IQ").toUpperCase()}</p>
              <IqInfoButton size={22} />
            </div>
            <p style={{
              fontSize: 64, lineHeight: 1, marginTop: 6, fontWeight: 600, letterSpacing: "-0.03em",
              background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text",
              WebkitTextFillColor: "transparent", color: "transparent",
              filter: "drop-shadow(0 6px 14px rgba(232,193,90,0.28))", fontVariantNumeric: "tabular-nums",
            }}>{fmt(dash.balance)}</p>
            <p className="text-[13px]" style={{ marginTop: 10, color: MUTED }}>
              <span style={{ color: GOLD, fontWeight: 600 }}>{level.name ?? "Rookie"}</span> · Level {level.level ?? 1}
            </p>
          </div>
        </div>
      </div>

      {/* progress — a drawn line of light, not a boxed bar */}
      <div className="px-2">
        <div className="relative" style={{ height: 1, background: BORDER }}>
          <div className="absolute left-0 top-0" style={{ height: 1, width: `${Math.min(100, Math.max(2, level.progressPct))}%`, background: MATERIAL.goldFill }} />
          <div className="absolute" style={{ left: `${Math.min(100, Math.max(2, level.progressPct))}%`, top: -2, width: 5, height: 5, borderRadius: "50%", background: GOLD_SOFT, boxShadow: MATERIAL.shadowGold, transform: "translateX(-50%)" }} />
        </div>
        <div className="flex justify-between mt-2 text-[11px]" style={{ color: MUTED }}>
          <span>{fmt(dash.lifetimeEarned)}</span>
          <span>{level.nextName ? `${fmt(Math.max(0, (level.nextAt ?? 0) - dash.lifetimeEarned))} to ${level.nextName}` : "Max level"}</span>
        </div>
      </div>

      {/* Prestige status — the "so what" of your IQ, in one line */}
      <PrestigeStatusLine iq={dash.lifetimeEarned} />

      {/* ── Continue — the one thing to do right now ──────────────────── */}
      <ContinueHero
        cont={cont}
        busy={claiming || claimingMission !== null}
        onClaimDaily={claim}
        onClaimMission={claimReward}
      />

      {/* ── Quick stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon="🔥" value={`${streak.current}`} label="streak" />
        <Stat icon="🤝" value={`${referral.active}`} label="active" />
        <Stat icon="🏆" value={leaderboard.rank ? `#${fmt(leaderboard.rank)}` : "—"} label="rank" />
        <Stat icon="🎖️" value={`${achievements.unlocked}/${achievements.total}`} label="badges" />
      </div>

      {/* ── Ways to earn — the menu beneath the one Continue action ────── */}
      <Section title="Earn more today" hint="Every play grows your IQ">
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <TodayRow first icon="⚽" label="Make predictions" sub="Call today's matches" href="/predict" />
          <TodayRow icon="🧠" label="Complete a brain test" sub="Beat a personal best" href="/tests" />
          <TodayRow icon="⚔️" label="Win a battle" sub="Climb the Elo ladder" href="/battle" />
          <TodayRow
            icon="🤝"
            label="Invite a friend"
            sub="Earn when they get active"
            action={
              <button onClick={share} className="text-xs font-bold shrink-0" style={{ color: GREEN }}>
                {copied ? "Copied ✓" : "Share ›"}
              </button>
            }
          />
        </div>
      </Section>

      {/* ── Unlocks: what your IQ earns you (prestige, no cash value) ──── */}
      <Section title="Unlocks" hint="What your IQ earns you">
        <IqUnlocksLadder iq={dash.lifetimeEarned} />
      </Section>

      {/* ── Daily Missions ────────────────────────────────────────────── */}
      <MissionsSection data={missions} claimingCode={claimingMission} onClaim={claimReward} />

      {/* ── Referral / network ────────────────────────────────────────── */}
      <Section title="Your Network" hint="Earn when friends get active">
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
                style={{ background: GREEN2, color: TEXT, border: `0.5px solid ${BORDER}` }}
              >
                {copied ? "Copied ✓" : "Share"}
              </button>
            </div>
          ) : (
            <p className="text-xs mb-4" style={{ color: MUTED }}>Your invite code will appear once available.</p>
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
        <Link href="/achievements" className="block text-center mt-3 text-xs font-bold" style={{ color: GOLD }}>
          {achievements.total - achievements.unlocked > 0
            ? `${fmt(achievements.total - achievements.unlocked)} more to unlock →`
            : "View all achievements →"}
        </Link>
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
                  style={{ color: t.delta >= 0 ? "#E8C15A" : "#b04a4a" }}
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
          <HubRow href="/achievements" icon="🎖️" label="Achievements" hint="Your badge collection" />
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
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={{ background: "rgba(232,193,90,0.12)", color: "#E8C15A" }}>
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
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%`, background: m.completed ? "#E8C15A" : `linear-gradient(90deg, ${GREEN2}, ${GOLD})` }} />
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

// ── Continue: the single "what to do right now", resolved from dashboard data ──
type ContinueAction = {
  icon: string; label: string; sub: string;
  action: { type: "claimDaily" } | { type: "claimMission"; code: string } | { type: "link"; href: string };
};

function resolveContinue(dash: PartnerDashboard, missions: MissionsResult | null): ContinueAction {
  const code = dash.currency.code || "IQ";
  if (dash.dailyReward.available) {
    const s = dash.streak.current;
    return s >= 2
      ? { icon: "🔥", label: "Keep your streak alive", sub: `${s}-day streak · claim +${fmt(dash.dailyReward.total)} ${code} before midnight`, action: { type: "claimDaily" } }
      : { icon: "🎁", label: "Claim your daily reward", sub: `+${fmt(dash.dailyReward.total)} ${code} is waiting`, action: { type: "claimDaily" } };
  }
  const m = missions?.missions.find((x) => x.completed && !x.claimed);
  if (m) return { icon: m.icon || "🎯", label: "Claim your mission reward", sub: m.title, action: { type: "claimMission", code: m.code } };
  const na = dash.nextActions?.[0];
  if (na) return { icon: na.icon || "▶️", label: na.title, sub: `${na.subtitle} · +${fmt(na.iq)} ${code}`, action: { type: "link", href: na.href } };
  return { icon: "🧠", label: "Take a brain test", sub: "Beat a personal best", action: { type: "link", href: "/tests" } };
}

function ContinueHero({ cont, busy, onClaimDaily, onClaimMission }: {
  cont: ContinueAction; busy: boolean; onClaimDaily: () => void; onClaimMission: (code: string) => void;
}) {
  const isLink = cont.action.type === "link";
  const body = (
    <div className="flex items-center gap-3.5 w-full">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
        style={{ background: "rgba(232,193,90,0.12)", border: `0.5px solid ${MATERIAL.ringFaint}` }}>{cont.icon}</div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>Continue</p>
        <p className="text-[15px] font-black leading-tight line-clamp-2" style={{ color: TEXT }}>{cont.label}</p>
        <p className="text-[11px] truncate" style={{ color: MUTED }}>{cont.sub}</p>
      </div>
      {isLink
        ? <span className="shrink-0 text-lg" style={{ color: GOLD }}>→</span>
        : <span className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black" style={{ background: GOLD, color: INK }}>{busy ? "…" : "Claim"}</span>}
    </div>
  );
  const style: React.CSSProperties = { background: MATERIAL.raise, border: "0.5px solid rgba(232,193,90,0.4)", boxShadow: MATERIAL.shadowGold };
  if (cont.action.type === "link") {
    return <Link href={cont.action.href} className="block w-full rounded-2xl p-3.5 transition-transform active:scale-[0.99]" style={style}>{body}</Link>;
  }
  const missionCode = cont.action.type === "claimMission" ? cont.action.code : null;
  return (
    <button onClick={() => (missionCode ? onClaimMission(missionCode) : onClaimDaily())} disabled={busy}
      className="block w-full rounded-2xl p-3.5 transition-transform active:scale-[0.99] disabled:opacity-70" style={style}>
      {body}
    </button>
  );
}

function TodayRow({ first, icon, label, sub, href, action, done }: {
  first?: boolean; icon: string; label: string; sub: string; href?: string; action?: React.ReactNode; done?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: first ? "none" : `1px solid ${BORDER}`, opacity: done && !action ? 0.72 : 1 }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: BG }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{label}</p>
        <p className="text-[11px] truncate" style={{ color: MUTED }}>{sub}</p>
      </div>
      {action ? action : (done
        ? <span className="text-sm font-black shrink-0" style={{ color: "#5FCF8B" }}>✓</span>
        : <span className="shrink-0" style={{ color: MUTED }}>›</span>)}
    </div>
  );
  if (href) return <Link href={href} className="block transition-transform active:scale-[0.99]">{inner}</Link>;
  return inner;
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
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: MATERIAL.vignette }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 backdrop-blur-md" style={{ background: "rgba(8,9,11,0.72)", borderBottom: `0.5px solid ${BORDER}` }}>
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <span className="text-base font-semibold tracking-wide" style={{ color: TEXT }}>My SuperBrain</span>
          <Link href="/settings/public-profile" className="text-xs font-semibold" style={{ color: MUTED }}>
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
