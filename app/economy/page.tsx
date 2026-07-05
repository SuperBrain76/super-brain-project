import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, MATERIAL } from "@/lib/brand";
import { PRESTIGE_TIERS } from "@/lib/prestige";

export const metadata: Metadata = {
  title: "The SuperBrain Economy — IQ, Levels & Rewards",
  description:
    "How IQ works on SuperBrain: earn it by playing, predicting, testing and contributing. Learn about levels, achievements, referrals, fair play and future rewards.",
};

const COMING = [
  { icon: "🎁", title: "Rewards Store", body: "Redeem IQ for rewards and perks from SuperBrain." },
  { icon: "💎", title: "Premium Features", body: "Unlock advanced tools, insights and customisation." },
  { icon: "🎟️", title: "Prize Entries", body: "Put your IQ toward entries for prize draws and giveaways." },
  { icon: "🔑", title: "Exclusive Events", body: "Get access to members-only tournaments and events." },
  { icon: "🛍️", title: "Marketplace", body: "Spend IQ on merch, boosts and collectibles." },
];

const EARN = [
  { icon: "🧠", title: "Brain tests", body: "Beat your personal bests across reaction, memory, focus and reasoning tests." },
  { icon: "⚽", title: "Predictions", body: "Call match results and tournament outcomes. Accuracy earns IQ." },
  { icon: "⚔️", title: "Battles", body: "Go head-to-head in real-time cognitive duels and climb the Elo ladder." },
  { icon: "🔥", title: "Daily streaks", body: "Check in each day. Longer streaks compound your daily reward." },
  { icon: "🎯", title: "Missions", body: "Complete rotating daily, weekly and milestone missions." },
  { icon: "🤝", title: "Referrals", body: "Invite friends — you earn as they get active and grow their own SuperBrain." },
  { icon: "🎖️", title: "Achievements", body: "Unlock badges for milestones and rare feats along the way." },
  { icon: "🪪", title: "Profile", body: "Complete your profile and set up your account for one-time bonuses." },
];

export default function EconomyPage() {
  return (
    <div className="min-h-screen" style={{ background: MATERIAL.vignette }}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 -top-16 pointer-events-none" style={{ width: 460, height: 300, background: MATERIAL.goldGlow }} />
        <div className="relative max-w-2xl mx-auto px-5 pt-16 pb-12 text-center">
          <span
            className="inline-block text-[11px] font-bold px-3 py-1 rounded-full tracking-[0.16em] mb-5"
            style={{ background: "rgba(232,193,90,0.12)", color: BRAND.gold, border: `0.5px solid ${MATERIAL.ringFaint}` }}
          >
            THE SUPERBRAIN ECONOMY
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.05] mb-4" style={{ color: BRAND.ink }}>
            Earn{" "}
            <span style={{ background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>IQ</span>
            {" "}every time<br />you use your brain.
          </h1>
          <p className="text-base sm:text-lg max-w-lg mx-auto leading-relaxed" style={{ color: BRAND.muted }}>
            IQ is SuperBrain&apos;s reward currency. Play, predict, test and contribute — and watch your
            SuperBrain grow.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-5 pb-24 space-y-16">

        {/* ── What is IQ ─────────────────────────────────────────────────── */}
        <Block eyebrow="The basics" title="What is IQ?">
          <p style={p}>
            IQ is the points you earn for everything you do on SuperBrain. Think of it as your score for
            building a sharper mind — the more you play, predict, test and contribute, the more IQ you hold.
          </p>
          <p style={p}>
            Your IQ powers your <strong style={strong}>level</strong>, your <strong style={strong}>rankings</strong>,
            and your standing in the community. It is earned, never bought.
          </p>
        </Block>

        {/* ── How you earn ───────────────────────────────────────────────── */}
        <Block eyebrow="Earning" title="Eight ways to earn IQ">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mt-2">
            {EARN.map((e) => (
              <div key={e.title} className="flex gap-3.5">
                <span className="text-2xl shrink-0 leading-none mt-0.5">{e.icon}</span>
                <div>
                  <p className="font-semibold text-[15px] mb-0.5" style={{ color: BRAND.ink }}>{e.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>{e.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Block>

        {/* ── Levels ─────────────────────────────────────────────────────── */}
        <Block eyebrow="Progression" title="Levels">
          <p style={p}>
            Every IQ you earn counts toward your <strong style={strong}>lifetime total</strong>, which raises your
            level. Higher levels carry a title and mark how far you&apos;ve come. Your level shows on your
            dashboard and your public profile — a signal of a mind that keeps showing up.
          </p>
        </Block>

        {/* ── Achievements ───────────────────────────────────────────────── */}
        <Block eyebrow="Milestones" title="Achievements">
          <p style={p}>
            Achievements are badges you unlock for milestones and rare feats — first predictions, streak
            landmarks, personal bests, network growth and more. They live on your profile as proof of what
            you&apos;ve accomplished.
          </p>
        </Block>

        {/* ── Referrals ──────────────────────────────────────────────────── */}
        <Block eyebrow="Network" title="Referrals & your network">
          <p style={p}>
            Share your invite code and invite friends. When the people you invite get active, you earn — and
            your network becomes part of your SuperBrain story. Build a circle of sharp minds and grow together.
          </p>
        </Block>

        {/* ── Fair play ──────────────────────────────────────────────────── */}
        <Block eyebrow="Integrity" title="Fair play">
          <p style={p}>
            IQ is meant to reward genuine effort. Automated play, fake accounts, self-referral and any attempt
            to game the system undermine everyone and can lead to adjusted balances or removal. Play honestly —
            it&apos;s more fun, and it&apos;s the only way that counts.
          </p>
        </Block>

        {/* ── Future rewards ─────────────────────────────────────────────── */}
        <Block eyebrow="What's ahead" title="Future rewards">
          <p style={p}>
            Today, IQ builds your level, rankings and status. As the SuperBrain community grows, IQ may unlock
            further rewards, perks and recognition. We&apos;ll always tell you clearly when something new arrives.
          </p>
        </Block>

        {/* ── What IQ unlocks now (prestige) ─────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: BRAND.dim }}>Status</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-[0.14em]"
              style={{ background: "rgba(53,197,111,0.12)", color: BRAND.sports, border: `0.5px solid rgba(53,197,111,0.35)` }}>
              LIVE NOW
            </span>
          </div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: BRAND.ink }}>What your IQ unlocks now</h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: BRAND.muted }}>
            IQ already earns you prestige. Cross each milestone and your profile levels up — visible to everyone.
            Pure status, no monetary value.
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: `0.5px solid ${BRAND.hairline}` }}>
            {PRESTIGE_TIERS.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3.5 px-4 py-3.5"
                style={{ borderTop: i === 0 ? "none" : `0.5px solid ${BRAND.hairline}` }}>
                <span className="text-xl w-7 text-center shrink-0">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px]" style={{ color: BRAND.ink }}>{t.name}</p>
                  <p className="text-xs" style={{ color: BRAND.muted }}>{t.reward}</p>
                </div>
                <span className="text-sm font-black shrink-0"
                  style={{ background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>
                  {t.threshold.toLocaleString()} IQ
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Coming soon ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: BRAND.dim }}>Coming soon</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-[0.14em]"
              style={{ background: "rgba(232,193,90,0.12)", color: BRAND.gold, border: `0.5px solid ${MATERIAL.ringFaint}` }}>
              PLANNED
            </span>
          </div>
          <h2 className="text-2xl font-extrabold mb-4" style={{ color: BRAND.ink }}>Where IQ is headed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mt-1">
            {COMING.map((c) => (
              <div key={c.title} className="flex gap-3.5">
                <span className="text-2xl shrink-0 leading-none mt-0.5" style={{ opacity: 0.9 }}>{c.icon}</span>
                <div>
                  <p className="font-semibold text-[15px] mb-0.5" style={{ color: BRAND.ink }}>{c.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-5" style={{ color: BRAND.dim }}>
            These are planned directions, not promises — we&apos;ll confirm details as each one arrives.
          </p>
        </section>

        {/* ── Legal / disclaimer ─────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${BRAND.hairline}` }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2.5" style={{ color: BRAND.dim }}>Important</p>
          <p className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>
            IQ is a points system inside SuperBrain used for progression, status and engagement. It is{" "}
            <strong style={strong}>not cash, shares, crypto, or a guaranteed financial reward</strong>, cannot be
            exchanged for money, and has no monetary value. SuperBrain may adjust how IQ is earned or used over
            time. Your use of SuperBrain is governed by our{" "}
            <Link href="/terms" className="underline" style={{ color: BRAND.ink }}>Terms of Use</Link> and{" "}
            <Link href="/privacy" className="underline" style={{ color: BRAND.ink }}>Privacy Policy</Link>.
          </p>
        </div>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <div className="text-center pt-2">
          <Link
            href="/iq"
            className="inline-block px-10 py-4 rounded-full text-sm font-bold transition-transform active:scale-[0.98]"
            style={{ background: BRAND.gold, color: BRAND.goldInk, boxShadow: MATERIAL.shadowGold }}
          >
            Open your dashboard →
          </Link>
          <p className="mt-4 text-xs" style={{ color: BRAND.dim }}>
            <Link href="/tests" className="hover:opacity-80" style={{ color: BRAND.muted }}>Take a test</Link>
            {"  ·  "}
            <Link href="/leaderboard" className="hover:opacity-80" style={{ color: BRAND.muted }}>See the rankings</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const p: React.CSSProperties = { color: BRAND.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 12 };
const strong: React.CSSProperties = { color: BRAND.ink, fontWeight: 600 };

function Block({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] mb-2" style={{ color: BRAND.dim }}>{eyebrow}</p>
      <h2 className="text-2xl font-extrabold mb-4" style={{ color: BRAND.ink }}>{title}</h2>
      {children}
    </section>
  );
}
