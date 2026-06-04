"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile, saveProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { COUNTRIES } from "@/lib/countries";

// ── Option lists ──────────────────────────────────────────────

const CURRENT_YEAR   = new Date().getFullYear();
const MIN_AGE        = 8;
const MAX_BIRTH_YEAR = CURRENT_YEAR - MIN_AGE;   // youngest allowed
const MIN_BIRTH_YEAR = 1920;                       // oldest allowed
const BIRTH_YEARS    = Array.from(
  { length: MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1 },
  (_, i) => MAX_BIRTH_YEAR - i,
);

const GENDERS = [
  { value: "male",              label: "Male"              },
  { value: "female",            label: "Female"            },
  { value: "non_binary",        label: "Non-binary"        },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const INDUSTRIES = [
  "Technology", "Finance / Banking", "Healthcare / Medicine",
  "Education", "Student", "Military / Defense", "Government / Public sector",
  "Sports / Athletics", "Research / Science", "Creative / Media",
  "Law / Legal", "Engineering", "Sales / Marketing", "Other",
];

const AVATAR_COLORS = [
  "#00d4ff", "#00e676", "#ffab00", "#ff3d00",
  "#7c3aed", "#ec4899", "#f97316", "#64748b",
];

// ── Validation ────────────────────────────────────────────────

function validateDisplayName(name: string): string | null {
  const t = name.trim();
  if (!t)                                           return "Display name is required.";
  if (t.length < 2)                                 return "Minimum 2 characters.";
  if (t.length > 24)                                return "Maximum 24 characters.";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))        return "Display name cannot be an email address.";
  return null;
}

function validatePassword(pw: string, confirm: string): string | null {
  if (pw.length < 8)         return "Minimum 8 characters.";
  if (pw !== confirm)        return "Passwords do not match.";
  return null;
}

// ── UI helpers ────────────────────────────────────────────────

function Field({
  label, hint, error, children,
}: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-cockpit-dim text-xs tracking-widest uppercase font-mono">{label}</label>
      {children}
      {error   && <p className="text-red-400 text-xs mt-0.5">{error}</p>}
      {!error && hint && <p className="text-cockpit-muted text-xs">{hint}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-white font-semibold text-sm whitespace-nowrap">{children}</h2>
      <div className="flex-1 h-px bg-cockpit-border" />
    </div>
  );
}

// ── Searchable country select ─────────────────────────────────

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open,  setOpen]  = useState(false);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim() === "" || query === value
    ? COUNTRIES
    : COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const select = (name: string) => { onChange(name); setQuery(name); setOpen(false); };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search country…"
        className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-cockpit-card border border-cockpit-border rounded-sm max-h-48 overflow-y-auto shadow-xl">
          {filtered.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onMouseDown={() => select(c.name)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-cockpit-surface ${
                  value === c.name ? "text-cockpit-accent" : "text-cockpit-text"
                }`}
              >
                <span className="w-5 text-base shrink-0">
                  {c.code !== "XX"
                    ? String.fromCodePoint(...Array.from(c.code).map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
                    : "🌐"}
                </span>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function ProfileSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [country,     setCountry]     = useState("");
  const [birthYear,   setBirthYear]   = useState("");
  const [gender,      setGender]      = useState("");
  const [industry,    setIndustry]    = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  // Profile save state
  const [nameError,  setNameError]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saved,      setSaved]      = useState(false);

  // Password change state
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy,    setPwBusy]    = useState(false);
  const [pwError,   setPwError]   = useState<string | null>(null);
  const [pwDone,    setPwDone]    = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadMyProfile().then((p) => {
      if (!p) return;
      setDisplayName(p.displayName !== "Anonymous" ? p.displayName : "");
      if (p.country)     setCountry(p.country);
      if (p.birthYear)   setBirthYear(String(p.birthYear));
      if (p.gender)      setGender(p.gender);
      if (p.industry)    setIndustry(p.industry);
      if (p.avatarColor) setAvatarColor(p.avatarColor);
    });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? "?").toUpperCase();

  const handleSaveProfile = async () => {
    setSaved(false); setSaveError(null);
    const nameErr = validateDisplayName(displayName);
    setNameError(nameErr);
    if (nameErr) return;

    setSaving(true);
    const { error } = await saveProfile(user.id, {
      displayName:     displayName.trim(),
      country:         country   || null,
      birthYear:       birthYear ? Number(birthYear) : null,
      gender:          gender    || null,
      industry:        industry  || null,
      avatarColor,
      profileComplete: true,
    });
    setSaving(false);

    if (error) { setSaveError(error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null); setPwDone(false);

    const err = validatePassword(newPw, confirmPw);
    if (err) { setPwError(err); return; }

    setPwBusy(true);
    const { error: authErr } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);

    if (authErr) { setPwError(authErr.message); return; }
    setPwDone(true);
    setNewPw(""); setConfirmPw("");
    setTimeout(() => setPwDone(false), 4000);
  };

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs text-cockpit-muted font-mono">
          <Link href="/profile" className="hover:text-cockpit-dim transition-colors">Dashboard</Link>
          <span className="text-cockpit-border">/</span>
          <span className="text-cockpit-dim">Profile settings</span>
        </div>

        <h1 className="text-xl font-bold text-white mb-0.5">Profile settings</h1>
        <p className="text-cockpit-muted text-xs mb-7 leading-relaxed">
          Display name and country are visible on the leaderboard.
          Birth year, gender, and industry are <span className="text-cockpit-dim">never</span> shown publicly.
        </p>

        {/* ── Avatar & identity ────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 mb-4">
          <SectionHeading>Identity</SectionHeading>

          {/* Avatar preview */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-extrabold shrink-0 select-none"
              style={{ background: `${avatarColor}22`, border: `2px solid ${avatarColor}`, color: avatarColor }}
            >
              {initials}
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight mb-2">
                {displayName.trim() || <span className="text-cockpit-muted italic">No display name</span>}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    aria-label={`Pick colour ${c}`}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none shrink-0"
                    style={{
                      background:    c,
                      outline:       avatarColor === c ? `2px solid ${c}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Account email — read-only */}
          <div className="mb-5">
            <Field label="Account email" hint="To change your email, contact support.">
              <div className="w-full bg-cockpit-surface border border-cockpit-border rounded-sm px-4 py-2.5 text-sm text-cockpit-muted font-mono select-all">
                {user.email}
              </div>
            </Field>
          </div>

          {/* Display name */}
          <Field label="Display name" hint="Shown publicly on the leaderboard and challenge links." error={nameError}>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setNameError(null); }}
                maxLength={24}
                placeholder="Your public name"
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cockpit-border text-xs font-mono">
                {displayName.length}/24
              </span>
            </div>
          </Field>
        </div>

        {/* ── Public profile ───────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 mb-4">
          <SectionHeading>Public info</SectionHeading>
          <div className="flex flex-col gap-5">
            <Field label="Country" hint="Shown next to your name on the leaderboard.">
              <CountrySelect value={country} onChange={setCountry} />
            </Field>
          </div>
        </div>

        {/* ── Private info ─────────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 mb-4">
          <SectionHeading>Private info</SectionHeading>
          <p className="text-cockpit-muted text-xs -mt-2 mb-5 leading-relaxed">
            Never shown publicly. Used only for leaderboard filters and test improvement.
          </p>
          <div className="flex flex-col gap-5">

            <Field label="Year of birth">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
              >
                <option value="">— Select year —</option>
                {BIRTH_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>

            <Field label="Gender">
              <div className="grid grid-cols-2 gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGender(gender === g.value ? "" : g.value)}
                    className={`px-3 py-2.5 rounded-sm border text-sm text-left transition-all duration-150 ${
                      gender === g.value
                        ? "border-cockpit-accent text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                        : "border-cockpit-border text-cockpit-dim hover:border-cockpit-dim"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Industry / occupation">
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
              >
                <option value="">— Select industry —</option>
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="mb-4 px-4 py-3 rounded-sm border border-red-500 border-opacity-30 bg-red-500 bg-opacity-10">
            <p className="text-red-400 text-sm">{saveError}</p>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="text-green-400 text-sm flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
        </div>

        {/* ── Change password ───────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5">
          <SectionHeading>Change password</SectionHeading>
          <p className="text-cockpit-muted text-xs -mt-2 mb-5">
            Must be at least 8 characters. Leave blank to keep your current password.
          </p>

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <Field label="New password">
              <input
                type="password"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
              />
            </Field>

            <Field label="Confirm new password">
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwError(null); }}
                placeholder="Repeat new password"
                autoComplete="new-password"
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
              />
            </Field>

            {pwError && (
              <p className="text-red-400 text-xs">{pwError}</p>
            )}
            {pwDone && (
              <p className="text-green-400 text-xs flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Password updated successfully.
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={pwBusy || !newPw}
                className="btn-ghost"
              >
                {pwBusy ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-cockpit-muted text-xs text-center mt-6">
          <Link href="/profile" className="hover:text-cockpit-dim transition-colors">
            ← Back to dashboard
          </Link>
        </p>

      </div>
    </div>
  );
}
