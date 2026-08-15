"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getOnboardingStatus, setOnboardingDone, type OnboardingStatus } from "@/lib/onboarding";
import { dailyCheckin, getMyReferralCode } from "@/lib/economy";
import { uploadProfileImage, updatePublicProfile } from "@/lib/publicProfile";
import { MATERIAL } from "@/lib/brand";

const INK = "#2A2205";     // text on gold
const GREEN = "#1F1F25";   // dark elevated fill (secondary buttons)
const GREEN2 = "#1F1F25";
const GOLD = "#E8C15A";
const GOLD_SOFT = "#F0D98B";
const MUTED = "#8B8B93";
const TEXT = "#F5F5F2";
const BORDER = "rgba(255,255,255,0.08)";
const BG = "#17181D";      // inset
const CARD = "#111116";    // card

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [st, setSt] = useState<OnboardingStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setSt(await getOnboardingStatus());
  }, []);

  useEffect(() => {
    if (!loading && !user) { router.replace("/login?next=/welcome"); return; }
    if (user) refresh();
  }, [user, loading, router, refresh]);

  const claimReward = useCallback(async () => {
    setBusy("reward");
    await dailyCheckin();
    await refresh();
    setBusy(null);
  }, [refresh]);

  const onAvatar = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("avatar");
    const r = await uploadProfileImage("avatar", file);
    if (r.url) { await updatePublicProfile({ avatarUrl: r.url }); }
    await refresh();
    setBusy(null);
  }, [refresh]);

  const share = useCallback(async () => {
    let code = st?.referralCode ?? null;
    if (!code) code = await getMyReferralCode();
    if (!code) return;
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    const text = `Join me on SuperBrain — use my code ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "SuperBrain", text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setShared(true); setTimeout(() => setShared(false), 1800); }
    } catch { /* cancelled */ }
  }, [st]);

  const finish = useCallback(async () => {
    await setOnboardingDone();
    router.push("/iq");
  }, [router]);

  if (loading || st === undefined) {
    return <Shell><div className="animate-pulse space-y-3">
      <div className="h-40 rounded-3xl" style={{ background: "#17181D" }} />
      <div className="h-16 rounded-2xl" style={{ background: "#17181D" }} />
      <div className="h-16 rounded-2xl" style={{ background: "#17181D" }} />
    </div></Shell>;
  }
  if (!st || !st.authenticated) {
    return <Shell><p className="text-sm" style={{ color: MUTED }}>Please sign in to get started.</p></Shell>;
  }

  const sym = st.currency?.symbol ?? "";
  const s = st.steps;
  const coreDone = [s.avatar, s.profile, s.reward, s.test, s.prediction].filter(Boolean).length;
  const pct = (coreDone / 5) * 100;

  return (
    <Shell>
      {/* Skip */}
      <div className="flex justify-end">
        <button onClick={finish} className="text-xs font-semibold" style={{ color: MUTED }}>Skip for now</button>
      </div>

      {/* Welcome + one-sentence IQ explanation — sculpted */}
      <div className="rounded-3xl p-6 relative overflow-hidden" style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}`, color: TEXT }}>
        <div className="absolute -top-16 -right-16" style={{ width: 240, height: 240, background: MATERIAL.goldGlow }} />
        <p className="text-3xl mb-1 relative">👋</p>
        <h1 className="text-2xl font-black mb-1 relative">Welcome to SuperBrain</h1>
        <p className="text-sm relative" style={{ color: MUTED }}>
          <span style={{ color: GOLD, fontWeight: 600 }}>IQ</span> is the reward you earn for everything you do here — play, predict, and climb the ranks.
        </p>
        <div className="mt-5 relative">
          <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: MUTED }}>
            <span>{coreDone} of 5 done</span>
            <span>{sym} {st.iqEarned.toLocaleString()} earned</span>
          </div>
          <div className="relative" style={{ height: 1, background: BORDER }}>
            <div className="absolute left-0 top-0" style={{ height: 1, width: `${Math.max(3, pct)}%`, background: MATERIAL.goldFill }} />
            <div className="absolute" style={{ left: `${Math.max(3, pct)}%`, top: -2, width: 5, height: 5, borderRadius: "50%", background: GOLD_SOFT, boxShadow: MATERIAL.shadowGold, transform: "translateX(-50%)" }} />
          </div>
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Earn your first IQ in 2 minutes</p>

      {/* Steps */}
      <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />

      <StepCard done={s.avatar} icon="📸" title="Add your photo" subtitle="Put a face to your name">
        {s.avatar
          ? <Done />
          : <ActionBtn onClick={() => fileRef.current?.click()} busy={busy === "avatar"}>{busy === "avatar" ? "…" : "Upload"}</ActionBtn>}
      </StepCard>

      <StepCard done={s.profile} icon="📝" title="Complete your profile" subtitle="Earn a one-time IQ bonus">
        {s.profile ? <Done /> : <LinkBtn href="/profile/complete">Complete</LinkBtn>}
      </StepCard>

      <StepCard done={s.reward} icon="🎁" title="Claim your first reward" subtitle="Instant IQ, on the house" highlight={!s.reward}>
        {s.reward
          ? <Done />
          : <ActionBtn onClick={claimReward} busy={busy === "reward"} gold>{busy === "reward" ? "…" : "Claim IQ"}</ActionBtn>}
      </StepCard>

      <StepCard done={s.test} icon="🧠" title="Take a brain test" subtitle="Beat your first score">
        {s.test ? <Done /> : <LinkBtn href="/tests">Start</LinkBtn>}
      </StepCard>

      <StepCard done={s.prediction} icon="⚽" title="Make a prediction" subtitle="Call a WC match">
        {s.prediction ? <Done /> : <LinkBtn href="/predict">Predict</LinkBtn>}
      </StepCard>

      <StepCard done={false} icon="📊" title="See your dashboard" subtitle="Your IQ, level and missions">
        <LinkBtn href="/iq">Open</LinkBtn>
      </StepCard>

      <StepCard done={false} icon="🤝" title="Share your invite" subtitle="Earn when friends get active">
        <ActionBtn onClick={share}>{shared ? "Copied ✓" : "Share"}</ActionBtn>
      </StepCard>

      <button onClick={finish} className="w-full py-3.5 rounded-full font-black text-sm" style={{ background: GOLD, color: INK }}>
        {coreDone >= 5 ? "You're all set — go to dashboard" : "Finish setup"}
      </button>
      <div className="h-4" />
    </Shell>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: MATERIAL.vignette }}>
      <div className="flex-1 px-4 py-5">
        <div className="max-w-md mx-auto space-y-3">{children}</div>
      </div>
    </div>
  );
}

function StepCard({ done, highlight, icon, title, subtitle, children }: {
  done: boolean; highlight?: boolean; icon: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{
      background: done ? "#15161A" : CARD,
      border: `1px solid ${highlight ? GOLD : BORDER}`,
      opacity: done ? 0.85 : 1,
    }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: BG }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: TEXT }}>{title}</p>
        <p className="text-[11px]" style={{ color: MUTED }}>{subtitle}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Done() {
  return <span className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: "#e7f3ea", color: "#2b7a4b" }}>Done ✓</span>;
}
function ActionBtn({ onClick, busy, gold, children }: { onClick: () => void; busy?: boolean; gold?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="text-xs font-black px-4 py-2 rounded-full disabled:opacity-60"
      style={{ background: gold ? GOLD : GREEN, color: gold ? INK : "#fff" }}>
      {children}
    </button>
  );
}
function LinkBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-black px-4 py-2 rounded-full inline-block" style={{ background: GREEN, color: "#fff" }}>
      {children}
    </Link>
  );
}
