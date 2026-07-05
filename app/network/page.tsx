"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getNetworkDashboard,
  getNetworkLeaderboard,
  getMyReferrals,
  type NetworkDashboard,
  type NetworkLeaderboardEntry,
  type NetworkGrowthPoint,
  type ReferralInvitee,
} from "@/lib/network";
import { MATERIAL } from "@/lib/brand";

const INK = "#2A2205";     // text on gold
const GREEN = "#F5F5F2";   // primary ink (headings/text)
const GREEN2 = "#1F1F25";  // dark elevated (bars/gradients)
const GOLD = "#E8C15A";
const GOLD_SOFT = "#F0D98B";
const MUTED = "#8B8B93";
const TEXT = "#F5F5F2";
const BORDER = "rgba(255,255,255,0.08)";
const BG = "#17181D";      // inset
const CARD = "#111116";    // card

function fmt(n: number) { return n.toLocaleString(); }
function weekLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NetworkPage() {
  const [d, setD] = useState<NetworkDashboard | null | undefined>(undefined);
  const [lb, setLb] = useState<NetworkLeaderboardEntry[] | null>(null);
  const [invitees, setInvitees] = useState<ReferralInvitee[] | null>(null);

  useEffect(() => {
    (async () => {
      const [dash, board, refs] = await Promise.all([
        getNetworkDashboard(),
        getNetworkLeaderboard(),
        getMyReferrals(),
      ]);
      setD(dash);
      setLb(board);
      setInvitees(refs);
    })();
  }, []);

  if (d === undefined) {
    return <Shell><div className="animate-pulse space-y-4">
      <div className="h-40 rounded-3xl" style={{ background: "#17181D" }} />
      <div className="h-24 rounded-2xl" style={{ background: "#17181D" }} />
      <div className="h-48 rounded-2xl" style={{ background: "#17181D" }} />
    </div></Shell>;
  }
  if (d === null) {
    return <Shell><Empty title="Network not connected" body="Sign in with Supabase configured to see your network." /></Shell>;
  }
  if (!d.authenticated) {
    return <Shell><Empty title="Sign in to grow your network" body="Your referral network analytics live here." /></Shell>;
  }

  const sym = d.currency.symbol || "";
  const qualityBand = d.qualityScore >= 66 ? "Elite" : d.qualityScore >= 33 ? "Growing" : "Early";
  const qualityColor = d.qualityScore >= 66 ? "#E8C15A" : d.qualityScore >= 33 ? GOLD : "#b0772a";

  return (
    <Shell>
      {/* Hero: quality-first — sculpted */}
      <div className="rounded-3xl p-6 relative overflow-hidden"
        style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}`, color: TEXT }}>
        <div className="absolute -top-16 -right-16" style={{ width: 240, height: 240, background: MATERIAL.goldGlow }} />
        <p className="text-[11px] uppercase relative" style={{ letterSpacing: "0.28em", color: MUTED }}>Active network</p>
        <div className="flex items-end gap-3 relative">
          <span className="text-6xl leading-none" style={{
            fontWeight: 600, letterSpacing: "-0.03em", background: MATERIAL.goldFill,
            WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent",
            filter: "drop-shadow(0 6px 14px rgba(232,193,90,0.28))", fontVariantNumeric: "tabular-nums",
          }}>{fmt(d.activeMembers)}</span>
          <span className="text-sm mb-1.5" style={{ color: MUTED }}>of {fmt(d.totalSize)} referred</span>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs relative" style={{ color: MUTED }}>
          <span>⚡ {d.engagedRecent} active in {d.activeWindowDays}d</span>
          <span style={{ color: GOLD }}>{sym} {fmt(d.networkEarned)} earned</span>
        </div>
      </div>

      {/* Quality score — the north-star metric */}
      <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <p className="text-sm font-black" style={{ color: TEXT }}>Network Quality</p>
            <p className="text-[11px]" style={{ color: MUTED }}>Share of referrals who became active</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black" style={{ color: qualityColor }}>{d.qualityScore}%</span>
            <p className="text-[11px] font-bold" style={{ color: qualityColor }}>{qualityBand}</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: BG }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, d.qualityScore))}%`, background: `linear-gradient(90deg, ${GREEN2}, ${GOLD})` }} />
        </div>
        <p className="text-[11px] mt-2" style={{ color: MUTED }}>
          Quality beats quantity — you earn only when members get active. {d.pending > 0 ? `${d.pending} invited are not active yet.` : ""}
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon="🌐" value={fmt(d.totalSize)} label="total" />
        <Stat icon="⚡" value={fmt(d.activeMembers)} label="active" />
        <Stat icon="✅" value={`${d.conversionRate}%`} label="convert" />
        <Stat icon="🏆" value={d.rankings.sizeRank ? `#${fmt(d.rankings.sizeRank)}` : "—"} label="rank" />
      </div>

      {/* Who you invited */}
      {invitees && invitees.length > 0 && (
        <Section title="Who You Invited" hint={`${invitees.length}`}>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {invitees.map((v, i) => (
              <div key={`${v.name}-${i}`} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{ background: BG, color: GREEN }}>
                  {inits(v.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                    {v.name}{v.country ? <span className="ml-1.5 text-xs" style={{ color: MUTED }}>{v.country}</span> : null}
                  </p>
                  <p className="text-[11px]" style={{ color: MUTED }}>Joined {joinDate(v.joinedAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={v.status} />
                  <span className="text-[11px] font-bold" style={{ color: v.iqGenerated > 0 ? GOLD : MUTED }}>
                    {sym}{fmt(v.iqGenerated)} IQ
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-2" style={{ color: MUTED }}>
            You earn when an invitee becomes active. Elite = an active partner who's earned {sym}1,000+ IQ.
          </p>
        </Section>
      )}

      {invitees && invitees.length === 0 && (
        <Section title="Who You Invited">
          <div className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-2xl mb-1">📨</p>
            <p className="text-sm font-bold" style={{ color: TEXT }}>No invites yet</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Share your code to start building your network.</p>
          </div>
        </Section>
      )}

      {/* Growth chart */}
      {d.growth.length > 0 && (
        <Section title="Network Growth" hint={`last ${d.growth.length} weeks`}>
          <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <GrowthChart data={d.growth} />
            <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: MUTED }}>
              <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: GOLD }} /> new / week</span>
              <span className="flex items-center gap-1"><i className="inline-block w-3 h-0.5" style={{ background: MUTED }} /> cumulative</span>
            </div>
          </div>
        </Section>
      )}

      {/* Rankings */}
      <Section title="Your Global Rankings">
        <div className="grid grid-cols-2 gap-2">
          <RankCard label="By active members" rank={d.rankings.sizeRank} pool={d.rankings.referrerPool} />
          <RankCard label={`By network ${d.currency.code}`} rank={d.rankings.iqRank} pool={d.rankings.referrerPool} />
        </div>
      </Section>

      {/* Countries */}
      {d.countries.length > 0 && (
        <Section title="Countries Represented" hint={`${d.countries.length}`}>
          <div className="flex flex-wrap gap-2">
            {d.countries.map((c) => (
              <span key={c.country} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
                {c.country} <span style={{ color: MUTED }}>{c.count}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Top contributors */}
      {d.topContributors.length > 0 && (
        <Section title="Top Contributors" hint="who's earning most">
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {d.topContributors.map((c, i) => (
              <div key={`${c.display_name}-${i}`} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                <span className="w-6 text-sm font-black text-center" style={{ color: i < 3 ? GOLD : MUTED }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                    {c.display_name}
                    {c.country ? <span className="ml-1.5 text-xs" style={{ color: MUTED }}>{c.country}</span> : null}
                  </p>
                  <p className="text-[11px]" style={{ color: c.active ? "#E8C15A" : MUTED }}>
                    {c.active ? "● active" : "○ inactive"}{c.level_name ? ` · ${c.level_name}` : ""}
                  </p>
                </div>
                <span className="text-sm font-black shrink-0" style={{ color: GOLD }}>{sym}{fmt(c.earned)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Global network leaderboard */}
      {lb && lb.length > 0 && (
        <Section title="Top Networks" hint="quality-ranked">
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {lb.slice(0, 5).map((e, i) => (
              <div key={`${e.rank}-${e.displayName}`} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                <span className="w-6 text-sm font-black text-center" style={{ color: e.rank <= 3 ? GOLD : MUTED }}>{e.rank}</span>
                <span className="flex-1 text-sm font-medium truncate" style={{ color: TEXT }}>
                  {e.displayName}{e.country ? <span className="ml-1.5 text-xs" style={{ color: MUTED }}>{e.country}</span> : null}
                </span>
                <span className="text-xs shrink-0" style={{ color: MUTED }}>{e.activeMembers} active</span>
                <span className="text-sm font-bold shrink-0 w-16 text-right" style={{ color: GOLD }}>{sym}{fmt(e.networkIq)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Grow CTA */}
      <Link href="/settings/public-profile" className="block rounded-2xl p-4 text-center relative overflow-hidden"
        style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}`, color: TEXT }}>
        <div className="absolute left-1/2 -translate-x-1/2 -top-10" style={{ width: 200, height: 200, background: MATERIAL.goldGlow }} />
        <p className="text-sm font-bold relative">Grow your active network</p>
        <p className="text-xs mt-0.5 relative" style={{ color: MUTED }}>Share your profile & referral code →</p>
      </Link>

      <div className="h-4" />
    </Shell>
  );
}

// ── Growth chart (inline SVG: new/week bars + cumulative line) ────────────────
function GrowthChart({ data }: { data: NetworkGrowthPoint[] }) {
  const W = 320, H = 120, pad = 6;
  const maxNew = Math.max(1, ...data.map((p) => p.new));
  const maxCum = Math.max(1, ...data.map((p) => p.cumulative));
  const n = data.length;
  const bw = (W - pad * 2) / n;

  const linePts = data.map((p, i) => {
    const x = pad + i * bw + bw / 2;
    const y = H - pad - (p.cumulative / maxCum) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} width="100%" role="img" aria-label="Network growth chart">
      {data.map((p, i) => {
        const bh = (p.new / maxNew) * (H - pad * 2);
        const x = pad + i * bw + bw * 0.2;
        const y = H - pad - bh;
        return <rect key={i} x={x} y={y} width={bw * 0.6} height={Math.max(0, bh)} rx={2} fill={GOLD} opacity={0.55} />;
      })}
      <polyline points={linePts} fill="none" stroke={MUTED} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((p, i) => {
        const x = pad + i * bw + bw / 2;
        const y = H - pad - (p.cumulative / maxCum) * (H - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2.5} fill={MUTED} />;
      })}
      {data.map((p, i) => (
        (i === 0 || i === n - 1) ? (
          <text key={i} x={pad + i * bw + bw / 2} y={H + 12} fontSize={9} fill={MUTED}
            textAnchor={i === 0 ? "start" : "end"}>{weekLabel(p.week)}</text>
        ) : null
      ))}
    </svg>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function inits(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "SB";
}
function joinDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function StatusBadge({ status }: { status: ReferralInvitee["status"] }) {
  const map = {
    pending: { label: "Pending", bg: "rgba(255,255,255,0.05)", color: "#8B8B93" },
    active:  { label: "Active",  bg: "rgba(53,197,111,0.12)",  color: "#5FCF8B" },
    elite:   { label: "Elite",   bg: "rgba(232,193,90,0.14)",  color: "#E8C15A" },
  } as const;
  const s = map[status];
  return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: MATERIAL.vignette }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <Link href="/iq" className="text-sm font-medium" style={{ color: MUTED }}>← Dashboard</Link>
          <span className="text-base font-black" style={{ color: GREEN }}>Network</span>
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
function RankCard({ label, rank, pool }: { label: string; rank: number | null; pool: number }) {
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-2xl font-black" style={{ color: rank ? GOLD : MUTED }}>{rank ? `#${fmt(rank)}` : "—"}</div>
      <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{label}</div>
      {pool > 0 && <div className="text-[10px]" style={{ color: MUTED }}>of {fmt(pool)} partners</div>}
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
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl p-8 text-center mt-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-3xl mb-2">🌐</p>
      <p className="text-sm font-bold mb-1" style={{ color: TEXT }}>{title}</p>
      <p className="text-xs" style={{ color: MUTED }}>{body}</p>
      <Link href="/iq" className="inline-block mt-4 text-sm font-bold" style={{ color: GREEN }}>← Back to dashboard</Link>
    </div>
  );
}
