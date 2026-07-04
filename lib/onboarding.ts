import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================================
// Onboarding — step completion is derived server-side from real data.
// ============================================================================

export interface OnboardingStatus {
  authenticated: boolean;
  completedAt: string | null;
  currency: { code: string; symbol: string } | null;
  iqEarned: number;
  username: string | null;
  referralCode: string | null;
  steps: {
    avatar: boolean;
    profile: boolean;
    reward: boolean;
    test: boolean;
    prediction: boolean;
  };
}

export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_onboarding_status");
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d.authenticated) return { authenticated: false } as OnboardingStatus;
  return {
    authenticated: true,
    completedAt: d.completed_at ?? null,
    currency: d.currency ?? null,
    iqEarned: Number(d.iq_earned ?? 0),
    username: d.username ?? null,
    referralCode: d.referral_code ?? null,
    steps: {
      avatar: !!d.steps?.avatar,
      profile: !!d.steps?.profile,
      reward: !!d.steps?.reward,
      test: !!d.steps?.test,
      prediction: !!d.steps?.prediction,
    },
  };
}

/** Mark onboarding finished or skipped. */
export async function setOnboardingDone(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.rpc("set_onboarding_done");
}
