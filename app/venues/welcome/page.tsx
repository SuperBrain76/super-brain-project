"use client";

/**
 * /venues/welcome?session_id=cs_... — the post-payment setup wizard.
 *
 * Stripe drops the owner here the instant they pay; the webhook builds the
 * league a beat later, so this first POLLS until the venue is provisioned, then
 * runs a five-step first-run wizard:
 *
 *   1. Branding      — logo (required) + colours + socials  → their whole kit
 *   2. Competitions  — one subscription includes them all   → add more leagues
 *   3. Launch Pack   — every branded asset + the PDF        → print & post today
 *   4. Staff         — the team who'll run it               → optional
 *   5. Launch        — you're live                          → share & dashboard
 *
 * Identity is the checkout session id (see lib/venueSession) — the owner signs
 * in properly later via the magic link. Everything is saved step-by-step, so a
 * closed tab never loses work: reopening the welcome link resumes the wizard.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const INK = "#12100E", AMBER = "#F5B301", CREAM = "#FBF5E9", MUTED = "#B7AC97";
const PANEL = "#1B1712", LINE = "rgba(255,255,255,0.12)";

const STEPS = ["Branding", "Competitions", "Launch Pack", "Staff", "Launch"] as const;

interface Comp { slug: string; name: string; sport: string; hasLeague: boolean }
interface League { slug: string; competition: string; name: string; inviteCode: string }
interface Brand {
  slug: string; name: string; city: string | null; language: string;
  logoUrl: string | null; primary: string; ink: string; secondary: string | null;
  website: string | null; instagram: string | null; facebook: string | null;
  staffEmails: string[]; onboardingStep: string | null; onboardedAt: string | null;
}
interface State {
  ready: true; venue: Brand; leagues: League[]; competitions: Comp[];
  assetKinds: { kind: string; label: string; hint: string; printable: boolean }[];
  urls: { launchPack: string; dashboard: string; assetBase: string; poster: string };
}

// ── Root: poll until provisioned, then hand off to the wizard ────────────────

function Inner() {
  const sessionId = useSearchParams().get("session_id");
  const [state, setState] = useState<State | null>(null);
  const [slow, setSlow]   = useState(false);
  const [error, setError] = useState("");
  const tries = useRef(0);

  useEffect(() => {
    if (!sessionId) { setError("Missing checkout reference."); return; }
    let stop = false;
    const poll = async () => {
      if (stop) return;
      tries.current += 1;
      try {
        const res = await fetch(`/api/venues/onboarding/state?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) { const j = await res.json(); if (j.ready) { setState(j); return; } }
      } catch { /* transient — keep polling */ }
      if (tries.current >= 24) { setSlow(true); return; }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { stop = true; };
  }, [sessionId]);

  if (error) return <Shell><P>{error}</P></Shell>;
  if (slow && !state) return (
    <Shell>
      <H1>Payment received</H1>
      <P>Your league is still being set up — this usually takes a few seconds. We&apos;ve emailed you
         the link and your poster, so you can safely reopen this page in a moment to finish setup.</P>
    </Shell>
  );
  if (!state) return (
    <Shell>
      <H1>Setting up your league…</H1>
      <P>Payment received. Building your league and getting your branding kit ready.</P>
      <div className="mt-8 h-1 w-40 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div style={{ background: AMBER, height: "100%", width: "40%", animation: "wpulse 1.4s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes wpulse{0%{margin-left:-40%}100%{margin-left:100%}}`}</style>
    </Shell>
  );
  return <Wizard sessionId={sessionId!} initial={state} />;
}

// ── The wizard ───────────────────────────────────────────────────────────────

function Wizard({ sessionId, initial }: { sessionId: string; initial: State }) {
  const startAt = ({ branding: 0, competitions: 1, posters: 2, launchpack: 2, staff: 3, launch: 4 } as Record<string, number>)[
    (initial.venue.onboardingStep ?? "").toLowerCase().replace(/[^a-z]/g, "")
  ];
  const [step, setStep] = useState<number>(initial.venue.onboardedAt ? 4 : (startAt ?? 0));
  const [v, setV] = useState<Brand>(initial.venue);
  const [leagues, setLeagues] = useState<League[]>(initial.leagues);
  const [comps, setComps] = useState<Comp[]>(initial.competitions);
  const [busy, setBusy] = useState(false);

  const patch = useCallback((p: Partial<Brand>) => setV((x) => ({ ...x, ...p })), []);

  const post = useCallback(async (path: string, body: any) => {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, session_id: sessionId }) });
    return res.ok ? res.json() : Promise.reject(await res.json().catch(() => ({})));
  }, [sessionId]);

  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <Stepper step={step} onJump={(n) => n < step && go(n)} accent={v.primary} />

        <div className="mt-9">
          {step === 0 && <BrandingStep v={v} patch={patch} sessionId={sessionId} busy={busy} setBusy={setBusy}
            hasLeague={leagues.length > 0}
            onNext={async () => { setBusy(true);
              try { await post("/api/venues/onboarding/branding", {
                primary: v.primary, secondary: v.secondary || "",
                website: v.website || "", instagram: v.instagram || "", facebook: v.facebook || "", step: "competitions" });
                go(1); } finally { setBusy(false); } }} />}

          {step === 1 && <CompetitionsStep leagues={leagues} comps={comps}
            onAdd={async (slugs) => {
              try {
                const res = await post("/api/venues/onboarding/leagues", { competitionSlugs: slugs });
                // Refetch state; if it isn't ready yet, fall back to the
                // response so Continue can still enable.
                const sres = await fetch(`/api/venues/onboarding/state?session_id=${encodeURIComponent(sessionId)}`);
                const s = sres.ok ? await sres.json() : null;
                if (s?.ready && Array.isArray(s.leagues)) { setLeagues(s.leagues); setComps(s.competitions ?? comps); }
                else if (Array.isArray(res?.active) && res.active.length) {
                  setLeagues((prev) => prev.length ? prev : res.active.map((a: any) => ({ slug: a.slug, competition: a.slug, name: a.slug, inviteCode: a.inviteCode })));
                }
                return { ok: true as const };
              } catch (e: any) {
                return { ok: false as const, error: e?.error || e?.message || "Could not activate that competition. Please try again." };
              }
            }}
            onNext={() => { post("/api/venues/onboarding/branding", { step: "posters" }).catch(() => {}); go(2); }}
            onBack={() => go(0)} />}

          {step === 2 && <LaunchPackStep v={v} urls={initial.urls} assetKinds={initial.assetKinds}
            onNext={() => { post("/api/venues/onboarding/branding", { step: "staff" }).catch(() => {}); go(3); }}
            onBack={() => go(1)} />}

          {step === 3 && <StaffStep initial={v.staffEmails} busy={busy}
            onSave={async (emails) => { setBusy(true);
              try { await post("/api/venues/onboarding/staff", { emails }); patch({ staffEmails: emails }); }
              finally { setBusy(false); } }}
            onNext={async () => { await post("/api/venues/onboarding/complete", {}).catch(() => {}); go(4); }}
            onBack={() => go(2)} />}

          {step === 4 && <LaunchStep v={v} leagues={leagues} urls={initial.urls} />}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Branding ─────────────────────────────────────────────────────────

function BrandingStep({ v, patch, sessionId, busy, setBusy, hasLeague, onNext }: {
  v: Brand; patch: (p: Partial<Brand>) => void; sessionId: string;
  busy: boolean; setBusy: (b: boolean) => void; hasLeague: boolean; onNext: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setErr(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("session_id", sessionId); fd.append("file", file);
      const res = await fetch("/api/venues/onboarding/logo", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Upload failed."); return; }
      patch({ logoUrl: j.url });
    } catch { setErr("Upload failed — please try again."); }
    finally { setUploading(false); }
  };

  const canNext = !!v.logoUrl && /^#[0-9a-f]{6}$/i.test(v.primary);

  return (
    <div>
      <Kicker>Step 1 of 5</Kicker>
      <H1>Make it yours</H1>
      <P>Add your logo and colours. Everything you print and post — posters, table tents, the TV
         leaderboard and your social graphics — is generated in your brand from here.</P>

      <div className="grid sm:grid-cols-2 gap-8 mt-8">
        {/* Controls */}
        <div className="flex flex-col gap-6">
          <div>
            <Label>Your logo <span style={{ color: AMBER }}>*</span></Label>
            <div onClick={() => fileRef.current?.click()}
                 className="mt-2 rounded-xl grid place-items-center cursor-pointer text-center"
                 style={{ border: `1.5px dashed ${LINE}`, background: PANEL, minHeight: 118, padding: 16 }}>
              {v.logoUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={v.logoUrl} alt="logo" style={{ maxHeight: 84, maxWidth: "100%", objectFit: "contain" }} />
                : <div style={{ color: MUTED, fontSize: 13 }}>
                    {uploading ? "Uploading…" : <>Click to upload<br /><span style={{ fontSize: 11 }}>PNG, JPG, WEBP or SVG · max 8 MB</span></>}
                  </div>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                   className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {v.logoUrl && <button onClick={() => fileRef.current?.click()} className="text-xs mt-2" style={{ color: AMBER }}>Replace logo</button>}
            {err && <p className="text-xs mt-2" style={{ color: "#ff8a8a" }}>{err}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Primary colour" value={v.primary} onChange={(c) => patch({ primary: c })} />
            <ColorField label="Secondary" value={v.secondary || v.primary} onChange={(c) => patch({ secondary: c })} optional />
          </div>

          <div className="flex flex-col gap-3">
            <TextField label="Website" placeholder="https://…" value={v.website || ""} onChange={(s) => patch({ website: s })} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Instagram" placeholder="@yourbar" value={v.instagram || ""} onChange={(s) => patch({ instagram: s })} />
              <TextField label="Facebook" placeholder="page url" value={v.facebook || ""} onChange={(s) => patch({ facebook: s })} />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <Label>Live preview</Label>
          <div className="mt-2 rounded-2xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <PosterMock v={v} slug={v.slug} hasLeague={hasLeague} />
          </div>
        </div>
      </div>

      <NavRow>
        <div />
        <PrimaryBtn disabled={!canNext || busy} onClick={onNext}>
          {busy ? "Saving…" : "Save & continue →"}
        </PrimaryBtn>
      </NavRow>
      {!canNext && <p className="text-xs mt-3 text-right" style={{ color: MUTED }}>A logo is required to generate your kit.</p>}
    </div>
  );
}

/** A mock of the poster that updates instantly as branding changes. The QR is
 *  the REAL scannable code once a league exists; until then a spinner — never a
 *  fake QR pattern. */
function PosterMock({ v, slug, hasLeague }: { v: Brand; slug: string; hasLeague: boolean }) {
  return (
    <div style={{ background: v.ink, color: "#fff", aspectRatio: "210/297", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "8% 7%", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`@keyframes pmSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        {v.logoUrl
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={v.logoUrl} alt="" style={{ maxHeight: "14%", maxWidth: "70%", height: 42, objectFit: "contain" }} />
          : <div style={{ fontWeight: 900, fontSize: 22, color: v.primary }}>{v.name.toUpperCase()}</div>}
        {v.logoUrl && <div style={{ fontSize: 20, fontWeight: 900, marginTop: 10 }}>{v.name.toUpperCase()}</div>}
        <div style={{ fontSize: 9, letterSpacing: "0.34em", textTransform: "uppercase", color: v.primary, marginTop: 8 }}>Official prediction league</div>
      </div>

      {hasLeague ? (
        <div style={{ background: "#fff", padding: 8, borderRadius: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/venues/${slug}/qr.png?size=180`} alt="Join QR code" width={92} height={92} style={{ display: "block" }} />
        </div>
      ) : (
        <div style={{ width: 108, height: 108, borderRadius: 10, background: "#ffffff10", border: `1px solid ${LINE}`, display: "grid", placeItems: "center", textAlign: "center", padding: 8 }}>
          <div>
            <div style={{ width: 22, height: 22, margin: "0 auto 7px", borderRadius: 999, border: `2px solid ${v.primary}`, borderTopColor: "transparent", animation: "pmSpin 0.8s linear infinite" }} />
            <div style={{ fontSize: 9, color: MUTED, lineHeight: 1.3 }}>Generating<br />QR code…</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
        <div style={{ display: "inline-block", padding: "5px 16px", borderRadius: 999, background: v.primary, color: contrast(v.primary), fontWeight: 900, fontSize: 12 }}>Scan to join · Free</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: "#0B0B0D", border: "0.5px solid #E8C15A88", color: "#E8C15A", fontSize: 7, fontWeight: 900, display: "grid", placeItems: "center", fontFamily: "Georgia, serif" }}>SB</span>
          <span style={{ fontSize: 8, color: MUTED }}>Powered by SuperBrain</span>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Competitions ─────────────────────────────────────────────────────

function CompetitionsStep({ leagues, comps, onAdd, onNext, onBack }: {
  leagues: League[]; comps: Comp[];
  onAdd: (slugs: string[]) => Promise<{ ok: boolean; error?: string }>;
  onNext: () => void; onBack: () => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const available = comps.filter((c) => !c.hasLeague);
  const toggle = (slug: string) => setSel((s) => s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]);
  const canContinue = leagues.length > 0;

  const save = async () => {
    if (!sel.length || busy) return;
    setBusy(true); setErr("");
    const res = await onAdd(sel);
    setBusy(false);
    if (res.ok) setSel([]);            // keep the selection on failure so they can retry
    else setErr(res.error || "Couldn't save your competitions. Please try again.");
  };

  return (
    <div>
      <Kicker>Step 2 of 5</Kicker>
      <H1>Choose your competitions</H1>
      <P>Your subscription includes <b style={{ color: CREAM }}>every competition</b> — Premier League,
         Champions League, La Liga, the rest, plus ice hockey — and future ones automatically. Pick the
         ones you want to run. Each becomes its own branded league; add or remove any time, at no extra cost.</P>

      {leagues.length > 0 && (
        <div className="mt-7">
          <Label>Live now</Label>
          <div className="flex flex-col gap-2 mt-2">
            {leagues.map((l) => (
              <div key={l.slug} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                <div>
                  <div className="font-bold text-sm">{l.name || l.competition}</div>
                  <div className="text-xs" style={{ color: MUTED }}>{l.competition} · code {l.inviteCode}</div>
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: `${AMBER}22`, color: AMBER }}>LIVE</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="mt-7">
          <Label>{leagues.length ? "Add more — all included free" : "Choose your competitions — all included free"}</Label>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {available.map((c) => (
              <button key={c.slug} onClick={() => toggle(c.slug)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left"
                style={{ background: sel.includes(c.slug) ? `${AMBER}18` : PANEL, border: `1px solid ${sel.includes(c.slug) ? AMBER : LINE}` }}>
                <span className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-black"
                      style={{ background: sel.includes(c.slug) ? AMBER : "transparent", color: INK, border: `1px solid ${sel.includes(c.slug) ? AMBER : LINE}` }}>
                  {sel.includes(c.slug) ? "✓" : ""}
                </span>
                <span className="text-sm font-semibold">{c.name}</span>
              </button>
            ))}
          </div>
          <SecondaryBtn className="mt-3" disabled={!sel.length || busy} onClick={save}>
            {busy ? "Saving…" : `Save ${sel.length || ""} competition${sel.length === 1 ? "" : "s"}`}
          </SecondaryBtn>
          {err && <p className="text-xs mt-2" style={{ color: "#ff8a8a" }}>{err}</p>}
        </div>
      )}

      <NavRow>
        <BackBtn onClick={onBack} />
        <PrimaryBtn disabled={!canContinue} onClick={onNext}>Continue →</PrimaryBtn>
      </NavRow>
      {!canContinue && <p className="text-xs mt-3 text-right" style={{ color: MUTED }}>Choose at least one competition to build your Launch Pack.</p>}
    </div>
  );
}

// ── Step 3: Launch Pack ──────────────────────────────────────────────────────

function LaunchPackStep({ v, urls, assetKinds, onNext, onBack }: {
  v: Brand; urls: State["urls"]; assetKinds: State["assetKinds"];
  onNext: () => void; onBack: () => void;
}) {
  return (
    <div>
      <Kicker>Step 3 of 5</Kicker>
      <H1>Your Launch Pack is ready</H1>
      <P>Every one of these is generated in your branding, right now. Print the pack for the bar and
         post the graphics online — everything you need to fill your first matchweek.</P>

      <a href={urls.launchPack} target="_blank" rel="noopener noreferrer"
         className="block rounded-2xl p-6 mt-7" style={{ background: `linear-gradient(120deg, ${AMBER}, #E8A200)`, color: INK }}>
        <div className="text-[11px] font-black tracking-widest uppercase opacity-70">One-click, done-for-you</div>
        <div className="text-2xl font-black mt-1">Download the Venue Launch Pack (PDF) →</div>
        <div className="text-sm font-semibold opacity-80 mt-1">Cover, printable poster & table tents, plus every social graphic — open it and “Save as PDF”.</div>
      </a>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {assetKinds.map((a) => (
          <a key={a.kind} href={`${urls.assetBase}/${a.kind}`} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
            <div>
              <div className="font-bold text-sm">{a.label}</div>
              <div className="text-xs" style={{ color: MUTED }}>{a.hint}</div>
            </div>
            <span className="text-xs font-bold shrink-0" style={{ color: AMBER }}>{a.printable ? "Print →" : "Open →"}</span>
          </a>
        ))}
      </div>

      <NavRow>
        <BackBtn onClick={onBack} />
        <PrimaryBtn onClick={onNext}>Continue →</PrimaryBtn>
      </NavRow>
    </div>
  );
}

// ── Step 4: Staff ────────────────────────────────────────────────────────────

function StaffStep({ initial, busy, onSave, onNext, onBack }: {
  initial: string[]; busy: boolean;
  onSave: (emails: string[]) => void; onNext: () => void; onBack: () => void;
}) {
  const [rows, setRows] = useState<string[]>(initial.length ? [...initial, ""] : [""]);
  const set = (i: number, val: string) => setRows((r) => r.map((x, j) => j === i ? val : x));
  const emails = rows.map((r) => r.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  return (
    <div>
      <Kicker>Step 4 of 5 · optional</Kicker>
      <H1>Add your team</H1>
      <P>The managers and bar staff who&apos;ll shout about the league on matchday. We&apos;ll keep them in
         the loop — you can skip this and add them later.</P>

      <div className="flex flex-col gap-2 mt-7">
        {rows.map((val, i) => (
          <input key={i} type="email" value={val} placeholder="name@yourbar.com"
            onChange={(e) => set(i, e.target.value)}
            onBlur={() => { if (i === rows.length - 1 && val.trim()) setRows((r) => [...r, ""]); }}
            className="rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: PANEL, border: `1px solid ${LINE}`, color: CREAM }} />
        ))}
        <button onClick={() => setRows((r) => [...r, ""])} className="text-xs text-left" style={{ color: AMBER }}>+ add another</button>
      </div>

      <NavRow>
        <BackBtn onClick={onBack} />
        <div className="flex items-center gap-3">
          <button onClick={onNext} className="text-sm font-bold" style={{ color: MUTED }}>Skip</button>
          <PrimaryBtn disabled={busy} onClick={async () => { onSave(emails); onNext(); }}>
            {busy ? "Saving…" : "Save & finish →"}
          </PrimaryBtn>
        </div>
      </NavRow>
    </div>
  );
}

// ── Step 5: Launch ───────────────────────────────────────────────────────────

function LaunchStep({ v, leagues, urls }: { v: Brand; leagues: League[]; urls: State["urls"] }) {
  const [copied, setCopied] = useState(false);
  const first = leagues[0];
  const joinUrl = first ? `https://www.superbrain.social/${first.slug}/leagues/join?code=${first.inviteCode}` : "";
  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 rounded-full grid place-items-center text-3xl mb-5" style={{ background: `${AMBER}22`, color: AMBER }}>✓</div>
      <Kicker>You&apos;re live</Kicker>
      <H1>{v.name} is ready to play</H1>
      <P className="mx-auto">Print your poster, put one on every table, and post the announcement tonight.
         Your regulars can join in seconds — no app, no sign-up friction.</P>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <a href={urls.launchPack} target="_blank" rel="noopener noreferrer"
           className="font-black px-6 py-3.5 rounded-full" style={{ background: AMBER, color: INK }}>Open Launch Pack</a>
        <a href={urls.dashboard} className="font-bold px-6 py-3.5 rounded-full" style={{ border: `1px solid ${LINE}`, color: CREAM }}>Open your dashboard</a>
      </div>
      <div className="mt-4">
        <a href="/venues/challenges" className="text-sm font-bold" style={{ color: AMBER }}>
          New: run a one-day Matchday Challenge across competitions →
        </a>
      </div>

      {joinUrl && (
        <div className="max-w-md mx-auto mt-8 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
          <span className="text-xs truncate flex-1 text-left" style={{ color: MUTED }}>{joinUrl}</span>
          <button onClick={() => { navigator.clipboard?.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-xs font-black shrink-0" style={{ color: AMBER }}>{copied ? "Copied!" : "Copy join link"}</button>
        </div>
      )}

      <p className="text-xs mt-8" style={{ color: MUTED }}>
        Your 7-day trial has started — we&apos;ll email you before it converts. Any question, just reply to the welcome email.
      </p>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function Stepper({ step, onJump, accent }: { step: number; onJump: (n: number) => void; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <button onClick={() => onJump(i)} disabled={i > step}
            className="flex items-center gap-2 min-w-0" style={{ cursor: i < step ? "pointer" : "default" }}>
            <span className="w-7 h-7 rounded-full grid place-items-center text-xs font-black shrink-0"
              style={{ background: i <= step ? accent : PANEL, color: i <= step ? contrast(accent) : MUTED, border: `1px solid ${i <= step ? accent : LINE}` }}>
              {i < step ? "✓" : i + 1}
            </span>
            <span className="text-xs font-bold truncate hidden sm:block" style={{ color: i <= step ? CREAM : MUTED }}>{label}</span>
          </button>
          {i < STEPS.length - 1 && <span className="h-px flex-1" style={{ background: i < step ? accent : LINE }} />}
        </div>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange, optional }: { label: string; value: string; onChange: (c: string) => void; optional?: boolean }) {
  return (
    <div>
      <Label>{label}{optional && <span style={{ color: MUTED }}> ·opt</span>}</Label>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" style={{ appearance: "none" }} />
        <span className="text-xs font-mono" style={{ color: CREAM }}>{value}</span>
      </div>
    </div>
  );
}
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-sm outline-none"
        style={{ background: PANEL, border: `1px solid ${LINE}`, color: CREAM }} />
    </div>
  );
}

function NavRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between mt-10 pt-6" style={{ borderTop: `1px solid ${LINE}` }}>{children}</div>;
}
function BackBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-sm font-bold" style={{ color: MUTED }}>← Back</button>;
}
function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled}
    className="font-black px-6 py-3 rounded-full text-sm transition-opacity"
    style={{ background: AMBER, color: INK, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>;
}
function SecondaryBtn({ children, onClick, disabled, className }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return <button onClick={onClick} disabled={disabled} className={`font-bold px-5 py-2.5 rounded-full text-sm ${className ?? ""}`}
    style={{ border: `1px solid ${AMBER}`, color: AMBER, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{children}</div>;
}
function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.3em] mb-3" style={{ color: AMBER }}>{children}</p>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}><div className="max-w-2xl mx-auto px-5 py-16">{children}</div></div>;
}
function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-3">{children}</h1>;
}
function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[15px] max-w-xl ${className ?? ""}`} style={{ color: MUTED, lineHeight: 1.55 }}>{children}</p>;
}

/** Black/white text for contrast on a hex bg (mirrors lib/venueAssets.textOn). */
function contrast(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#12100E";
  const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.45 ? "#12100E" : "#FFFFFF";
}

export default function VenueWelcomePage() {
  return (
    <Suspense fallback={
      <div style={{ background: INK, color: MUTED, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm">Loading…</p>
      </div>
    }>
      <Inner />
    </Suspense>
  );
}
