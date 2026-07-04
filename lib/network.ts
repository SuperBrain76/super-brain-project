import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================================
// Network Dashboard — client module. Sourced entirely from the referral engine
// + economy ledger via SECURITY DEFINER RPCs (migration 030). Quality-first.
// ============================================================================

export interface NetworkCountry { country: string; count: number }
export interface NetworkGrowthPoint { week: string; new: number; cumulative: number }
export interface NetworkContributor {
  display_name: string;
  country: string | null;
  active: boolean;
  earned: number;
  level_name: string | null;
}

export interface NetworkDashboard {
  authenticated: boolean;
  currency: { code: string; name: string; symbol: string };
  totalSize: number;
  activeMembers: number;
  pending: number;
  engagedRecent: number;
  activeWindowDays: number;
  conversionRate: number;
  networkEarned: number;
  qualityScore: number;
  countries: NetworkCountry[];
  growth: NetworkGrowthPoint[];
  topContributors: NetworkContributor[];
  rankings: { sizeRank: number | null; iqRank: number | null; referrerPool: number };
}

export async function getNetworkDashboard(currencyCode?: string): Promise<NetworkDashboard | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_network_dashboard", { p_currency: currencyCode ?? null });
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d.authenticated) return { authenticated: false } as NetworkDashboard;
  return {
    authenticated: true,
    currency: d.currency,
    totalSize: Number(d.total_size),
    activeMembers: Number(d.active_members),
    pending: Number(d.pending),
    engagedRecent: Number(d.engaged_recent),
    activeWindowDays: Number(d.active_window_days),
    conversionRate: Number(d.conversion_rate),
    networkEarned: Number(d.network_earned),
    qualityScore: Number(d.quality_score),
    countries: d.countries ?? [],
    growth: d.growth ?? [],
    topContributors: d.top_contributors ?? [],
    rankings: {
      sizeRank: d.rankings?.size_rank ?? null,
      iqRank: d.rankings?.iq_rank ?? null,
      referrerPool: Number(d.rankings?.referrer_pool ?? 0),
    },
  };
}

export interface NetworkLeaderboardEntry {
  rank: number;
  displayName: string;
  country: string | null;
  activeMembers: number;
  totalMembers: number;
  networkIq: number;
}

export interface ReferralInvitee {
  name: string;
  country: string | null;
  status: "pending" | "active" | "elite";
  joinedAt: string;
  qualifiedAt: string | null;
  iqGenerated: number;
}

/** The people the signed-in user invited, with status + IQ each generated. */
export async function getMyReferrals(): Promise<ReferralInvitee[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_my_referrals");
  if (error) return null;
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    name: r.referred_name ?? "Anonymous",
    country: r.country ?? null,
    status: (r.status ?? "pending") as ReferralInvitee["status"],
    joinedAt: r.joined_at,
    qualifiedAt: r.qualified_at ?? null,
    iqGenerated: Number(r.iq_generated ?? 0),
  }));
}

export async function getNetworkLeaderboard(currencyCode?: string): Promise<NetworkLeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_network_leaderboard", { p_currency: currencyCode ?? null });
  if (error) return null;
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    rank: Number(r.rank),
    displayName: r.display_name ?? "Anonymous",
    country: r.country ?? null,
    activeMembers: Number(r.active_members),
    totalMembers: Number(r.total_members),
    networkIq: Number(r.network_iq),
  }));
}
