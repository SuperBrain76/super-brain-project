"use client";

/**
 * MatchdayEntry — the in-app way into a Matchday Challenge, for the Sports hub.
 *
 * A Matchday Challenge mixes matches from several leagues, so it never shows up
 * under any single competition. A regular in the bar without the QR to hand had
 * no route in. This gives two:
 *   1. Type the code from the poster/TV (works for anyone, signed in or not).
 *   2. Resume a challenge they already joined (signed-in only; needs the
 *      get_joined_challenges RPC — hidden if it isn't there yet).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";

interface Joined {
  code: string; name: string; prize: string | null;
  venue_name: string; venue_slug: string | null; accent: string;
  fixtures: number; participants: number; ends_at: string | null; status: "live" | "ended";
}

export default function MatchdayEntry() {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<Joined[]>([]);

  const loadMine = useCallback(async () => {
    if (!user) { setMine([]); return; }
    const { data, error } = await supabase.rpc("get_joined_challenges");
    if (error) { setMine([]); return; } // RPC not deployed yet → just hide the list
    setMine((data as Joined[]) ?? []);
  }, [user]);

  useEffect(() => { loadMine(); }, [loadMine]);

  const go = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("get_challenge", { p_code: c });
    setBusy(false);
    if (error) { setErr("Something went wrong — try again."); return; }
    if (!(data as { found?: boolean })?.found) { setErr("No challenge with that code. Check the poster or screen."); return; }
    router.push(`/c/${c}`);
  };

  const live = mine.filter((m) => m.status === "live");

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎯</span>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Matchday Challenge</h2>
      </div>

      <div className="rounded-2xl p-5" style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
        {/* Resume — challenges you're already in */}
        {live.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.dim }}>You&apos;re in</p>
            <div className="flex flex-col gap-2">
              {live.map((m) => (
                <a key={m.code} href={`/c/${m.code}`} className="flex items-center justify-between rounded-xl px-4 py-3 transition-transform active:scale-[0.98]"
                   style={{ background: BRAND.elevated, border: `0.5px solid ${BRAND.hairline}` }}>
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: BRAND.ink }}>{m.name}</div>
                    <div className="text-xs truncate" style={{ color: BRAND.muted }}>{m.venue_name} · {m.fixtures} matches · {m.participants} playing</div>
                  </div>
                  <span className="text-sm font-bold shrink-0 ml-3" style={{ color: m.accent || BRAND.gold }}>Open →</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>
          {live.length > 0 ? "Join another one" : "In a venue running one tonight?"}
        </p>
        <p className="text-xs mt-1 mb-3" style={{ color: BRAND.muted }}>
          A one-night game mixing matches from different leagues. Enter the code from the poster or TV — or scan the venue&apos;s QR.
        </p>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }}
            placeholder="ENTER CODE"
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold tracking-widest outline-none"
            style={{ background: BRAND.elevated, border: `0.5px solid ${BRAND.hairlineStrong}`, color: BRAND.ink }}
          />
          <button onClick={go} disabled={busy || !code.trim()} className="font-black px-5 py-2.5 rounded-full text-sm disabled:opacity-45 shrink-0"
            style={{ background: BRAND.gold, color: BRAND.goldInk }}>
            {busy ? "…" : "Join"}
          </button>
        </div>
        {err && <p className="text-xs mt-2" style={{ color: "#ff8a8a" }}>{err}</p>}
      </div>
    </div>
  );
}
