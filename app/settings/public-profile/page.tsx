"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getMyProfileSettings,
  setUsername as apiSetUsername,
  updatePublicProfile,
  uploadProfileImage,
  type ProfileSettings,
} from "@/lib/publicProfile";
import { BRAND } from "@/lib/brand";

const GREEN = BRAND.sports;      // emerald — the "active / positive" accent
const GREEN_INK = "#04140B";     // text on emerald
const GOLD = BRAND.gold;         // value only → the Save action
const GOLD_INK = BRAND.goldInk;
const MUTED = BRAND.muted;
const TEXT = BRAND.ink;
const BORDER = BRAND.hairline;
const BG = BRAND.black;
const CARD = BRAND.surface;
const OK = "#5FCF8B";
const ERR = "#E5806B";

// Sections users can toggle. Labels are UI-only; keys match the privacy JSONB.
const PRIVACY_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "level", label: "Partner Level", hint: "Your tier and progress" },
  { key: "balance", label: "Currency Balance", hint: "Your balance & rank" },
  { key: "achievements", label: "Achievements", hint: "Badges you've unlocked" },
  { key: "predictions", label: "Prediction Stats", hint: "Points, accuracy, rank" },
  { key: "tests", label: "Cognitive Tests", hint: "Best scores & percentiles" },
  { key: "network", label: "Network", hint: "Referral counts" },
  { key: "referral", label: "Referral Link", hint: "Let visitors join via you" },
  { key: "activity", label: "Recent Activity", hint: "Your latest earnings" },
  { key: "country", label: "Country", hint: "Your country flag" },
];

export default function PublicProfileSettings() {
  const [s, setS] = useState<ProfileSettings | null | undefined>(undefined);
  const [username, setUsernameField] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [privacy, setPrivacy] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getMyProfileSettings();
      setS(data);
      if (data) {
        setUsernameField(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatarUrl ?? "");
        setBannerUrl(data.bannerUrl ?? "");
        setIsPublic(data.isPublic);
        setPrivacy(data.privacy ?? {});
      }
    })();
  }, []);

  const vis = (k: string) => privacy[k] !== false; // default visible

  async function save() {
    setSaving(true);
    setMsg(null);

    // Username first (only if changed) so its specific error surfaces clearly.
    if (username && username !== (s?.username ?? "")) {
      const r = await apiSetUsername(username);
      if (r.error) { setMsg({ ok: false, text: r.error }); setSaving(false); return; }
    }

    const r = await updatePublicProfile({ bio, avatarUrl, bannerUrl, isPublic, privacy });
    setSaving(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: "Profile saved." });
    const fresh = await getMyProfileSettings();
    if (fresh) setS(fresh);
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: BG }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/iq" className="text-sm font-medium" style={{ color: MUTED }}>← Dashboard</Link>
          <span className="text-sm font-black" style={{ color: TEXT }}>Public Profile</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-5">
        <div className="max-w-md mx-auto space-y-5">
          {s === undefined ? (
            <div className="animate-pulse space-y-3">
              <div className="h-24 rounded-2xl" style={{ background: BRAND.elevated }} />
              <div className="h-40 rounded-2xl" style={{ background: BRAND.elevated }} />
            </div>
          ) : s === null ? (
            <Card><p className="text-sm" style={{ color: MUTED }}>Sign in to manage your public profile.</p></Card>
          ) : (
            <>
              {/* Live URL */}
              {s.username && (
                <Card>
                  <p className="text-xs" style={{ color: MUTED }}>Your public profile</p>
                  <Link href={`/u/${s.username}`} className="text-sm font-bold" style={{ color: GREEN }}>
                    superbrain.social/u/{s.username} ↗
                  </Link>
                </Card>
              )}

              {/* Username */}
              <div>
                <Label>Username</Label>
                <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: CARD }}>
                  <span className="px-3 text-sm" style={{ color: MUTED }}>/u/</span>
                  <input
                    value={username}
                    onChange={(e) => setUsernameField(e.target.value.toLowerCase())}
                    placeholder="yourname"
                    maxLength={20}
                    className="flex-1 px-1 py-2.5 text-sm outline-none"
                    style={{ color: TEXT, background: "transparent" }}
                  />
                </div>
                <Hint>3–20 characters: letters, numbers, underscore.</Hint>
              </div>

              {/* Bio */}
              <div>
                <Label>Bio</Label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself…"
                  maxLength={300}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                  style={{ color: TEXT, background: CARD, border: `1px solid ${BORDER}` }}
                />
                <Hint>{bio.length}/300</Hint>
              </div>

              {/* Images — native upload */}
              <div>
                <Label>Photo</Label>
                <ImageField
                  kind="avatar"
                  url={avatarUrl}
                  displayName={s.displayName ?? "You"}
                  avatarColor={s.avatarColor ?? "#24513a"}
                  onUploaded={(url) => { setAvatarUrl(url); void updatePublicProfile({ avatarUrl: url }); }}
                  onRemove={() => { setAvatarUrl(""); void updatePublicProfile({ avatarUrl: "" }); }}
                />
              </div>
              <div>
                <Label>Banner</Label>
                <ImageField
                  kind="banner"
                  url={bannerUrl}
                  displayName={s.displayName ?? "You"}
                  avatarColor={s.avatarColor ?? "#24513a"}
                  onUploaded={(url) => { setBannerUrl(url); void updatePublicProfile({ bannerUrl: url }); }}
                  onRemove={() => { setBannerUrl(""); void updatePublicProfile({ bannerUrl: "" }); }}
                />
              </div>

              {/* Master visibility */}
              <Card>
                <Toggle
                  label="Public profile"
                  hint="Turn off to hide everything except your name"
                  checked={isPublic}
                  onChange={setIsPublic}
                />
              </Card>

              {/* Privacy per section */}
              <div>
                <Label>What visitors can see</Label>
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: CARD, opacity: isPublic ? 1 : 0.5 }}>
                  {PRIVACY_SECTIONS.map((sec, i) => (
                    <div key={sec.key} className="px-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                      <Toggle
                        label={sec.label}
                        hint={sec.hint}
                        checked={vis(sec.key)}
                        disabled={!isPublic}
                        onChange={(v) => setPrivacy((p) => ({ ...p, [sec.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {msg && (
                <p className="text-sm text-center font-medium" style={{ color: msg.ok ? OK : ERR }}>
                  {msg.text}
                </p>
              )}

              <button
                onClick={save}
                disabled={saving}
                className="w-full py-3 rounded-full font-bold text-sm disabled:opacity-60"
                style={{ background: GOLD, color: GOLD_INK }}
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-bold mb-1.5" style={{ color: TEXT }}>{children}</p>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] mt-1" style={{ color: MUTED }}>{children}</p>;
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "SB";
}

function ImageField({
  kind, url, displayName, avatarColor, onUploaded, onRemove,
}: {
  kind: "avatar" | "banner";
  url: string;
  displayName: string;
  avatarColor: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    const r = await uploadProfileImage(kind, file);
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    if (r.url) onUploaded(r.url);
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      <div className="flex items-center gap-3">
        {kind === "avatar" ? (
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-lg font-black shrink-0"
            style={{ background: url ? "transparent" : avatarColor, color: "#fff", border: `1px solid ${BORDER}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url ? <img src={url} alt="avatar" className="w-full h-full object-cover" /> : initials(displayName)}
          </div>
        ) : (
          <div className="flex-1 h-16 rounded-xl overflow-hidden"
            style={url
              ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${BORDER}` }
              : { background: `linear-gradient(120deg, ${GREEN}, #0B0B0D 60%, ${GOLD})`, border: `1px solid ${BORDER}` }} />
        )}

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-60"
            style={{ background: GREEN, color: GREEN_INK }}
          >
            {busy ? "Uploading…" : url ? "Change" : "Upload image"}
          </button>
          {url && (
            <button type="button" onClick={onRemove} className="text-xs font-semibold" style={{ color: ERR }}>
              Remove
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-[11px] mt-1.5" style={{ color: ERR }}>{err}</p>}
      <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>
        {kind === "avatar" ? "Square works best. JPG, PNG or WebP." : "Wide image works best (about 3:1)."}
      </p>
    </div>
  );
}
function Toggle({ label, hint, checked, onChange, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: TEXT }}>{label}</p>
        {hint && <p className="text-[11px]" style={{ color: MUTED }}>{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50"
        style={{ background: checked ? GREEN : "rgba(255,255,255,0.14)" }}
      >
        <span
          className="block w-5 h-5 rounded-full transition-transform"
          style={{ background: "#fff", transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
