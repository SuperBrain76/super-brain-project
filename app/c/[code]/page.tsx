"use client";

/**
 * /c/<code> — the customer view of a Matchday Challenge.
 *
 * Scan the QR → see ONLY the venue's hand-picked fixtures (across competitions)
 * → predict each (predictions are the same global rows used everywhere, so a
 * pick is consistent with any normal league) → watch the live leaderboard.
 * Each fixture locks at its own kickoff (the existing deadline trigger), so a
 * late arrival can still predict later games. Uniform scoring 3 / 1 / 0.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signInWithGoogle } from "@/lib/googleAuth";
import { upsertPrediction } from "@/lib/predictor";
import { supabase } from "@/lib/supabase";

interface Fixture {
  id: string; kicks_off_at: string; status: string; completed: boolean; locked: boolean;
  actual_home: number | null; actual_away: number | null;
  competition: string; home: string; home_code: string; home_flag: string | null;
  away: string; away_code: string; away_flag: string | null;
  my_home: number | null; my_away: number | null;
}
interface Row { user_id: string; display_name: string; avatar_url: string | null; points: number; picks: number }
interface Challenge {
  found: boolean; code: string; name: string; prize: string | null; ends_at: string | null;
  status: "live" | "ended"; is_owner: boolean; is_member: boolean; participants: number;
  venue: { name: string; slug: string; logo_url: string | null; primary: string; ink: string };
  fixtures: Fixture[]; leaderboard: Row[];
}

export default function ChallengePage() {
  const code = String(useParams<{ code: string }>().code || "").toUpperCase();
  const { user } = useAuth();
  const [d, setD] = useState<Challenge | null>(null);
  const [err, setErr] = useState("");
  const [picks, setPicks] = useState<Record<string, { h: string; a: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const joined = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_challenge", { p_code: code });
    if (error) { setErr(error.message); return; }
    const c = data as Challenge;
    if (!c?.found) { setErr("not-found"); return; }
    setD(c);
    // seed local pick inputs from the user's saved predictions (don't clobber edits)
    setPicks((prev) => {
      const next = { ...prev };
      for (const f of c.fixtures) {
        if (next[f.id]) continue;
        next[f.id] = { h: f.my_home != null ? String(f.my_home) : "", a: f.my_away != null ? String(f.my_away) : "" };
      }
      return next;
    });
  }, [code]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  // Auto-join as a participant once signed in (so the user shows on the board).
  useEffect(() => {
    if (!user || !d || d.is_member || joined.current) return;
    joined.current = true;
    supabase.rpc("join_challenge", { p_code: code }).then(() => load());
  }, [user, d, code, load]);

  const save = useCallback(async (f: Fixture) => {
    const p = picks[f.id];
    if (!p || p.h === "" || p.a === "") return;
    const h = Math.max(0, Math.min(20, parseInt(p.h, 10)));
    const a = Math.max(0, Math.min(20, parseInt(p.a, 10)));
    if (Number.isNaN(h) || Number.isNaN(a)) return;
    setSaving(f.id); setErr("");
    const res = await upsertPrediction(f.id, h, a);
    setSaving(null);
    if (res.error) { setErr(res.error); return; }
    load();
  }, [picks, load]);

  if (err === "not-found") return <Shell><H>Challenge not found</H><P>This link may have expired.</P></Shell>;
  if (!d) return <Shell><H>Loading…</H></Shell>;

  const ACC = d.venue.primary || "#E8C15A";
  const INK = d.venue.ink || "#0B0B0D";
  const openCount = d.fixtures.filter((f) => !f.locked).length;

  return (
    <div style={{ background: INK, color: "#fff", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          {d.venue.logo_url
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={d.venue.logo_url} alt="" style={{ maxHeight: 56, margin: "0 auto 10px", objectFit: "contain" }} />
            : <div style={{ fontWeight: 900, fontSize: 22, color: ACC }}>{d.venue.name.toUpperCase()}</div>}
          <div className="text-[11px] font-black tracking-[0.3em] uppercase" style={{ color: ACC }}>Matchday Challenge</div>
          <h1 className="text-2xl font-black mt-1">{d.name}</h1>
          <div className="text-xs mt-1" style={{ color: "#ffffff99" }}>
            {d.venue.name} · {d.participants} playing · {d.status === "ended" ? "Final" : `${openCount} still open`}
          </div>
          <div className="inline-flex items-center gap-2 mt-2 text-[11px]" style={{ color: "#ffffff88" }}>
            <span>Join code</span>
            <span className="font-black tracking-[0.15em] px-2 py-0.5 rounded" style={{ color: ACC, background: `${ACC}18`, border: `1px solid ${ACC}55` }}>{d.code}</span>
            <span className="hidden sm:inline">· superbrain.social/sports</span>
          </div>
          {d.prize && (
            <div className="inline-block mt-3 text-xs font-black px-4 py-2 rounded-full" style={{ background: `${ACC}22`, color: ACC, border: `1px solid ${ACC}66` }}>
              🏆 Prize: {d.prize}
            </div>
          )}
        </div>

        {/* Sign-in gate */}
        {!user && (
          <div className="rounded-2xl p-4 mb-5 text-center" style={{ background: "#ffffff0c", border: "1px solid #ffffff1a" }}>
            <p className="text-sm mb-3" style={{ color: "#ffffffcc" }}>Sign in to lock in your predictions.</p>
            <button onClick={() => signInWithGoogle(`/c/${code}`)} className="font-black px-6 py-3 rounded-full text-sm" style={{ background: ACC, color: "#12100E" }}>
              Continue with Google
            </button>
            <div className="mt-2"><a href={`/login?next=/c/${code}`} className="text-xs" style={{ color: ACC }}>or sign in with email</a></div>
          </div>
        )}

        {err && err !== "not-found" && <p className="text-sm mb-3" style={{ color: "#ff8a8a" }}>{err}</p>}

        {/* Fixtures */}
        <div className="flex flex-col gap-2.5 mb-8">
          {d.fixtures.map((f) => (
            <div key={f.id} className="rounded-xl p-3.5" style={{ background: "#ffffff0a", border: "1px solid #ffffff14" }}>
              <div className="flex items-center justify-between text-[10px] mb-2" style={{ color: "#ffffff77" }}>
                <span className="font-bold uppercase tracking-wider">{f.competition}</span>
                <span>{new Date(f.kicks_off_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-sm font-bold text-right">{f.home_flag ? `${f.home_flag} ` : ""}{f.home}</div>
                {f.locked ? (
                  <div className="px-3 font-black text-base" style={{ color: f.completed ? ACC : "#ffffff99" }}>
                    {f.completed ? `${f.actual_home}–${f.actual_away}` : "—"}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-1">
                    <ScoreInput value={picks[f.id]?.h ?? ""} onChange={(v) => setPicks((p) => ({ ...p, [f.id]: { ...(p[f.id] ?? { h: "", a: "" }), h: v } }))} onCommit={() => save(f)} accent={ACC} />
                    <span style={{ color: "#ffffff55" }}>:</span>
                    <ScoreInput value={picks[f.id]?.a ?? ""} onChange={(v) => setPicks((p) => ({ ...p, [f.id]: { ...(p[f.id] ?? { h: "", a: "" }), a: v } }))} onCommit={() => save(f)} accent={ACC} />
                  </div>
                )}
                <div className="flex-1 text-sm font-bold text-left">{f.away}{f.away_flag ? ` ${f.away_flag}` : ""}</div>
              </div>
              <div className="text-center text-[10px] mt-1.5" style={{ color: "#ffffff66" }}>
                {f.locked
                  ? (f.my_home != null ? `Your pick: ${f.my_home}–${f.my_away}${f.completed ? ` · ${challengePts(f)} pts` : ""}` : "Locked — no pick")
                  : (saving === f.id ? "Saving…" : (f.my_home != null ? "Saved — tap to change" : "Enter your score"))}
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="text-[11px] font-black tracking-widest uppercase mb-2" style={{ color: ACC }}>Leaderboard</div>
        <div className="flex flex-col gap-1.5">
          {d.leaderboard.length === 0 && <p className="text-sm" style={{ color: "#ffffff88" }}>Be the first to predict.</p>}
          {d.leaderboard.map((r, i) => (
            <div key={r.user_id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: r.user_id === user?.id ? `${ACC}18` : "#ffffff08", border: `1px solid ${r.user_id === user?.id ? ACC + "55" : "#ffffff12"}` }}>
              <div className="w-6 font-black text-sm" style={{ color: i === 0 ? ACC : "#ffffff88" }}>{i + 1}</div>
              <div className="flex-1 text-sm font-bold truncate">{r.display_name}</div>
              <div className="text-[11px]" style={{ color: "#ffffff77" }}>{r.picks} picks</div>
              <div className="font-black text-base w-10 text-right" style={{ color: ACC }}>{r.points}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-[11px]" style={{ color: "#ffffff55" }}>
          Exact score 3 pts · correct result 1 pt · Powered by SuperBrain
        </div>
      </div>
    </div>
  );
}

function ScoreInput({ value, onChange, onCommit, accent }: { value: string; onChange: (v: string) => void; onCommit: () => void; accent: string }) {
  return (
    <input inputMode="numeric" pattern="[0-9]*" value={value} maxLength={2}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
      onBlur={onCommit}
      className="w-9 h-10 text-center rounded-lg text-base font-black outline-none"
      style={{ background: "#ffffff12", border: `1px solid ${accent}55`, color: "#fff" }} />
  );
}

function challengePts(f: Fixture): number {
  if (!f.completed || f.my_home == null || f.my_away == null) return 0;
  if (f.my_home === f.actual_home && f.my_away === f.actual_away) return 3;
  const sp = Math.sign(f.my_home - f.my_away), sa = Math.sign((f.actual_home ?? 0) - (f.actual_away ?? 0));
  return sp === sa ? 1 : 0;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#0B0B0D", color: "#fff", minHeight: "100vh" }} className="flex items-center justify-center"><div className="text-center px-6">{children}</div></div>;
}
function H({ children }: { children: React.ReactNode }) { return <h1 className="text-2xl font-black">{children}</h1>; }
function P({ children }: { children: React.ReactNode }) { return <p className="text-sm mt-2" style={{ color: "#ffffff99" }}>{children}</p>; }
