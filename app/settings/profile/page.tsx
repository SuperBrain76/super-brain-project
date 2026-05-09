"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile, saveProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { COUNTRIES } from "@/lib/countries";

// ── Birth years ───────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE      = 8;
const MAX_BIRTH_YEAR = CURRENT_YEAR - MIN_AGE;
const MIN_BIRTH_YEAR = 1930;
const BIRTH_YEARS = Array.from(
  { length: MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1 },
  (_, i) => MAX_BIRTH_YEAR - i,
);

const GENDERS = [
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "non_binary",        label: "Non-binary" },
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

// ── Display name validation ───────────────────────────────────
function validateDisplayName(name: string): string | null {
  const t = name.trim();
  if (!t)         return "Display name is required.";
  if (t.length < 2)  return "Minimum 2 characters.";
  if (t.length > 24) return "Maximum 24 characters.";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Display name cannot be an email address.";
  return null;
}

// ── Field wrapper ─────────────────────────────────────────────
function Field({
  label, hint, error, children,
}: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-cockpit-dim text-xs tracking-widest uppercase font-mono">{label}</label>
      {children}
      {error  && <p className="text-cockpit-red  text-xs">{error}</p>}
      {!error && hint && <p className="text-cockpit-muted text-xs">{hint}</p>}
    </div>
  );
}

// ── Searchable country select ─────────────────────────────────
function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open,  setOpen]  = useState(false);

  // Sync query display when value changes externally (e.g. on load)
  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim() === "" || query === value
    ? COUNTRIES
    : COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );

  const select = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

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
        <ul className="absolute z-50 mt-1 w-full bg-cockpit-card border border-cockpit-border rounded-sm max-h-52 overflow-y-auto shadow-lg">
          {filtered.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onMouseDown={() => select(c.name)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-cockpit-surface transition-colors ${
                  value === c.name ? "text-cockpit-accent" : "text-cockpit-text"
                }`}
              >
                <span className="w-5 text-base leading-none">
                  {c.code !== "XX"
                    ? String.fromCodePoint(
                        ...Array.from(c.code).map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
                      )
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

  const [displayName, setDisplayName] = useState("");
  const [country,     setCountry]     = useState("");
  const [birthYear,   setBirthYear]   = useState("");
  const [gender,      setGender]      = useState("");
  const [industry,    setIndustry]    = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const [nameError,  setNameError]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saved,      setSaved]      = useState(false);

  // Change password
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [pwBusy,     setPwBusy]     = useState(false);
  const [pwError,    setPwError]    = useState<string | null>(null);
  const [pwDone,     setPwDone]     = useState(false);

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
    if (newPw.length < 8) { setPwError("Minimum 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }

    setPwBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);

    if (err) { setPwError(err.message); return; }
    setPwDone(true);
    setNewPw(""); setConfirmPw("");
  };

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-xl mx-auto px-5 py-14">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-xs text-cockpit-muted font-mono">
          <Link href="/profile" className="hover:text-cockpit-dim transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-cockpit-dim">Profile settings</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Profile settings</h1>
        <p className="text-cockpit-dim text-sm mb-8">
          Display name and country are visible on the leaderboard.
          Birth year, gender, and industry are never shown publicly.
        </p>

        {/* ── Avatar ───────────────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 mb-5 flex items-center gap-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-extrabold shrink-0 select-none"
            style={{ background: `${avatarColor}22`, border: `2px solid ${avatarColor}`, color: avatarColor }}
          >
            {initials}
          </div>
          <div>
            <p className="text-white font-semibold mb-2 leading-tight">
              {displayName.trim() || <span className="text-cockpit-muted italic">No display name</span>}
            </p>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  aria-label={`Avatar colour ${c}`}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{ background: c, outline: avatarColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Profile form ─────────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-6 mb-5">

          <Field label="Display name" hint="Shown publicly on the leaderboard and challenge links." error={nameError}>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setNameError(null); }}
                maxLength={24}
                placeholder="Your public name"
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cockpit-muted text-xs font-mono">
                {displayName.length}/24
              </span>
            </div>
          </Field>

          <Field label="Country" hint="Shown next to your name on the leaderboard.">
            <CountrySelect value={country} onChange={setCountry} />
          </Field>

          {/* Private fields */}
          <div className="border-t border-cockpit-border pt-2">
            <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-4">
              Private — never shown publicly
            </p>
            <div className="flex flex-col gap-5">

              <Field label="Year of birth">
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full bg-cockpit-surface border border-cockpit-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
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
                          : "border-cockpit-border text-cockpit-dim hover:border-cockpit-accent"
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
                  className="w-full bg-cockpit-surface border border-cockpit-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
                >
                  <option value="">— Select industry —</option>
                  {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {saveError && (
            <p className="text-cockpit-red text-sm bg-cockpit-red bg-opacity-10 border border-cockpit-red border-opacity-30 rounded-sm px-4 py-3">
              {saveError}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && (
              <span className="text-cockpit-green text-sm flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved!
              </span>
            )}
          </div>
        </div>

        {/* ── Change password ───────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6">
          <h2 className="text-white font-semibold mb-1">Change password</h2>
          <p className="text-cockpit-muted text-xs mb-5">
            Leave blank if you don&apos;t want to change your password.
          </p>

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <Field label="New password">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
              />
            </Field>

            <Field label="Confirm new password">
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                minLength={8}
                placeholder="Repeat new password"
                autoComplete="new-password"
                className="w-full bg-cockpit-surface border border-cockpit-border text-cockpit-text rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors placeholder:text-cockpit-muted"
              />
            </Field>

            {pwError && <p className="text-cockpit-red text-xs">{pwError}</p>}
            {pwDone  && <p className="text-cockpit-green text-xs">✓ Password updated successfully.</p>}

            <button
              type="submit"
              disabled={pwBusy || !newPw}
              className="btn-ghost self-start"
            >
              {pwBusy ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>

        <p className="text-cockpit-muted text-xs mt-5 text-center">
          <Link href="/profile" className="hover:text-cockpit-dim transition-colors">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
