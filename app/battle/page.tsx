"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile } from "@/lib/profile";
import BattleHub from "@/components/battle/BattleHub";

export default function BattlePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [country,     setCountry]     = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadMyProfile().then((p) => {
      setDisplayName(p?.displayName ?? user.email?.split("@")[0] ?? "Player");
      setCountry(p?.country ?? null);
      setProfileReady(true);
    });
  }, [user]);

  if (loading || !user || !profileReady || displayName === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#6B6B73] animate-pulse text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <BattleHub
      userId={user.id}
      userName={displayName}
      country={country ?? undefined}
    />
  );
}
