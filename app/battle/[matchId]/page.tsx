"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile } from "@/lib/profile";
import BattleRoom from "@/components/battle/BattleRoom";

export default function BattleMatchPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { matchId } = useParams<{ matchId: string }>();
  const [displayName,  setDisplayName]  = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadMyProfile().then((p) => {
      setDisplayName(p?.displayName ?? user.email?.split("@")[0] ?? "Player");
      setProfileReady(true);
    });
  }, [user]);

  if (loading || !user || !profileReady || displayName === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-muted animate-pulse text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <BattleRoom
      matchId={matchId}
      myId={user.id}
      myName={displayName}
    />
  );
}
