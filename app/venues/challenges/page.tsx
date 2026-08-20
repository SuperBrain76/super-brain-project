"use client";

/**
 * /venues/challenges — the venue owner's Matchday Challenge builder.
 *
 * Signed-in owner: pick a date → see fixtures across every active competition
 * that day → tick the ones to include → name it (+ optional prize) → create.
 * Out comes one challenge with a QR pointing at /c/<code>. Also lists the
 * owner's existing challenges so they can reprint a QR.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { signInWithGoogle } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";

const INK = "#0B0B0D", PANEL = "#141418", LINE = "rgba(255,255,255,0.10)";
const GOLD = "#E8C15A", CREAM = "#F5F5F2", MUTED = "#9A9AA3";
const SITE = "https://www.superbrain.social";

interface Fx { id: string; kicks_off_at: string; competition: string; home: string; home_flag: string | null; away: string; away_flag: string | null }
interface Mine { code: string; name: string; prize: string | null; fixtures: number; participants: number; created_at: string }

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function ChallengeBuilder() {
  const { user, loading } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [fixtures, setFixtures] = useState<Fx[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [prize, setPrize] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);

  const loadFixtures = useCallback(async (d: string) => {
    setErr("");
    const { data, error } = await supabase.rpc("get_fixtures_on_date", { p_date: d });
    if (error) { setErr(error.message.includes("auth") ? "" : error.message); setFixtures([]); return; }
    setFixtures((data as Fx[]) ?? []);
  }, []);

  const loadMine = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_challenges");
    if (data) setMine(data as Mine[]);
  }, []);

  useEffect(() => { if (user) { loadFixtures(date); loadMine(); } }, [user, date, loadFixtures, loadMine]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const create = async () => {
    if (!name.trim() || sel.size === 0) { setErr("Name it and pick at least one match."); return; }
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("create_venue_challenge", {
      p_name: name.trim(), p_prize: prize.trim() || null, p_fixture_ids: Array.from(sel),
    });
    setBusy(false);
    if (error) { setErr(error.message.includes("no venue") ? "This account doesn't own a venue. Sign in with the email you signed up with." : error.message); return; }
    setCreated({ code: (data as any).code });
    setName(""); setPrize(""); setSel(new Set());
    loadMine();
  };

  if (loading) return <Shell><p style={{ color: MUTED }}>Loading…</p></Shell>;

  if (!user) return (
    <Shell>
      <h1 className="text-2xl font-black mb-2">Matchday Challenge</h1>
      <p className="text-sm mb-5" style={{ color: MUTED }}>Sign in as the venue owner to build a challenge.</p>
      <button onClick={() => signInWithGoogle("/venues/challenges")} className="font-black px-6 py-3 rounded-full text-sm" style={{ background: GOLD, color: "#12100E" }}>Continue with Google</button>
      <div className="mt-2"><a href="/login?next=/venues/challenges" className="text-xs" style={{ color: GOLD }}>or sign in with email</a></div>
    </Shell>
  );

  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-black">Matchday Challenge</h1>
        <p className="text-sm mt-1 mb-6" style={{ color: MUTED }}>Pick fixtures across any competitions on one date. Customers scan one QR and predict just those matches.</p>

        {created && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}55` }}>
            <div className="text-sm font-black" style={{ color: GOLD }}>Challenge created 🎉</div>
            <div className="flex items-center gap-4 mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/challenges/${created.code}/qr.png?size=240`} alt="QR" width={110} height={110} style={{ background: "#fff", borderRadius: 10, padding: 6 }} />
              <div className="min-w-0">
                <div className="text-xs" style={{ color: MUTED }}>Print this QR / share the link:</div>
                <a href={`/c/${created.code}`} className="text-sm font-bold break-all" style={{ color: GOLD }}>{SITE}/c/{created.code}</a>
                <div className="mt-2 flex gap-2">
                  <a href={`/c/${created.code}`} target="_blank" rel="noopener noreferrer" className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: GOLD, color: "#12100E" }}>Open</a>
                  <button onClick={() => navigator.clipboard?.writeText(`${SITE}/c/${created.code}`)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${LINE}`, color: CREAM }}>Copy link</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Builder */}
        <div className="rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
          <Label>Date</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#ffffff08", border: `1px solid ${LINE}`, color: CREAM, colorScheme: "dark" }} />

          <div className="mt-4">
            <Label>{fixtures.length ? `Matches on this date (${sel.size} selected)` : "No fixtures on this date"}</Label>
            <div className="flex flex-col gap-2 mt-2 max-h-[46vh] overflow-auto">
              {fixtures.map((f) => (
                <button key={f.id} onClick={() => toggle(f.id)} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left"
                  style={{ background: sel.has(f.id) ? `${GOLD}18` : "#ffffff06", border: `1px solid ${sel.has(f.id) ? GOLD : LINE}` }}>
                  <span className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-black shrink-0" style={{ background: sel.has(f.id) ? GOLD : "transparent", color: INK, border: `1px solid ${sel.has(f.id) ? GOLD : LINE}` }}>{sel.has(f.id) ? "✓" : ""}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{f.home} v {f.away}</div>
                    <div className="text-[11px]" style={{ color: MUTED }}>{f.competition} · {new Date(f.kicks_off_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div><Label>Challenge name</Label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Super 6" className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#ffffff08", border: `1px solid ${LINE}`, color: CREAM }} /></div>
            <div><Label>Prize (optional)</Label><input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="A round of drinks for the winner" className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#ffffff08", border: `1px solid ${LINE}`, color: CREAM }} /></div>
          </div>

          {err && <p className="text-xs mt-3" style={{ color: "#ff8a8a" }}>{err}</p>}

          <button onClick={create} disabled={busy || !name.trim() || sel.size === 0} className="mt-4 font-black px-6 py-3 rounded-full text-sm w-full disabled:opacity-45" style={{ background: GOLD, color: "#12100E" }}>
            {busy ? "Creating…" : `Create challenge${sel.size ? ` (${sel.size} matches)` : ""}`}
          </button>
        </div>

        {/* Existing */}
        {mine.length > 0 && (
          <div className="mt-8">
            <Label>Your challenges</Label>
            <div className="flex flex-col gap-2 mt-2">
              {mine.map((c) => (
                <a key={c.code} href={`/c/${c.code}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                  <div><div className="font-bold text-sm">{c.name}</div><div className="text-xs" style={{ color: MUTED }}>{c.fixtures} matches · {c.participants} playing · code {c.code}</div></div>
                  <span className="text-xs font-bold" style={{ color: GOLD }}>Open →</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ background: INK, color: CREAM, minHeight: "100vh" }} className="flex items-center justify-center"><div className="text-center px-6">{children}</div></div>;
}
function Label({ children }: { children: React.ReactNode }) { return <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{children}</div>; }
