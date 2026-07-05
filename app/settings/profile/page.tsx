"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile, saveProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { COUNTRIES } from "@/lib/countries";
import { BRAND, MATERIAL } from "@/lib/brand";

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
      <label className="text-[#A0A0A8] text-xs tracking-widest uppercase font-mono">{label}</label>
      {children}
      {error   && <p className="text-red-400 text-xs mt-0.5">{error}</p>}
      {!error && hint && <p className="text-[#6B6B73] text-xs">{hint}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-white font-semibold text-sm whitespace-nowrap">{children}</h2>
      <div className="flex-1 h-px" style={{ background: BRAND.hairline }} />
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
        className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-[#141418] border border-[#23232B] rounded-sm max-h-48 overflow-y-auto shadow-xl">
          {filtered.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onMouseDown={() => select(c.name)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-[#17181D] ${
                  value === c.name ? "text-[#F5F5F2] font-semibold" : "text-[#F5F5F2]"
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

  // Account deletion state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy,    setDeleteBusy]    = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: MATERIAL.vignette }}>
        <p className="text-[#A0A0A8] text-sm animate-pulse">Loading…</p>
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

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleteBusy(true); setDeleteError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDeleteError("Not authenticated."); setDeleteBusy(false); return; }

    const res = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? "Failed to delete account.");
      setDeleteBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
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
    <div className="min-h-screen" style={{ background: MATERIAL.vignette }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 w-full">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs text-[#6B6B73] font-mono">
          <Link href="/iq" className="hover:text-[#A0A0A8] transition-colors">You</Link>
          <span className="text-[#3A3A42]">/</span>
          <span className="text-[#A0A0A8]">Profile settings</span>
        </div>

        <h1 className="text-xl font-bold text-white mb-0.5">Profile settings</h1>
        <p className="text-[#6B6B73] text-xs mb-7 leading-relaxed">
          Display name and country are visible on the leaderboard.
          Birth year, gender, and industry are <span className="text-[#A0A0A8]">never</span> shown publicly.
        </p>

        {/* ── Avatar & identity ────────────────────────────── */}
        <div className="bg-[#141418] border border-[#23232B] rounded-sm p-5 mb-4">
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
                {displayName.trim() || <span className="text-[#6B6B73] italic">No display name</span>}
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
              <div className="w-full bg-[#17181D] border border-[#23232B] rounded-sm px-4 py-2.5 text-sm text-[#6B6B73] font-mono select-all">
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
                className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73] pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3A42] text-xs font-mono">
                {displayName.length}/24
              </span>
            </div>
          </Field>
        </div>

        {/* ── Public profile ───────────────────────────────── */}
        <div className="bg-[#141418] border border-[#23232B] rounded-sm p-5 mb-4">
          <SectionHeading>Public info</SectionHeading>
          <div className="flex flex-col gap-5">
            <Field label="Country" hint="Shown next to your name on the leaderboard.">
              <CountrySelect value={country} onChange={setCountry} />
            </Field>
          </div>
        </div>

        {/* ── Private info ─────────────────────────────────── */}
        <div className="bg-[#141418] border border-[#23232B] rounded-sm p-5 mb-4">
          <SectionHeading>Private info</SectionHeading>
          <p className="text-[#6B6B73] text-xs -mt-2 mb-5 leading-relaxed">
            Never shown publicly. Used only for leaderboard filters and test improvement.
          </p>
          <div className="flex flex-col gap-5">

            <Field label="Year of birth">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
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
                        ? "border-white/25 text-[#F5F5F2] bg-white/5"
                        : "border-[#23232B] text-[#A0A0A8] hover:border-white/25"
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
                className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors"
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
            className="flex items-center gap-2 font-bold text-sm px-8 py-3 rounded-full transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ background: BRAND.ink, color: BRAND.black }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="text-sm flex items-center gap-1.5" style={{ color: BRAND.sports }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
        </div>

        {/* ── Change password ───────────────────────────────── */}
        <div className="bg-[#141418] border border-[#23232B] rounded-sm p-5">
          <SectionHeading>Change password</SectionHeading>
          <p className="text-[#6B6B73] text-xs -mt-2 mb-5">
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
                className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
              />
            </Field>

            <Field label="Confirm new password">
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwError(null); }}
                placeholder="Repeat new password"
                autoComplete="new-password"
                className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 transition-colors placeholder:text-[#6B6B73]"
              />
            </Field>

            {pwError && (
              <p className="text-red-400 text-xs">{pwError}</p>
            )}
            {pwDone && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: BRAND.sports }}>
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
                className="px-6 py-2 rounded-full border text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ borderColor: "#23232B", color: BRAND.muted }}
              >
                {pwBusy ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Danger Zone — account deletion ───────────── */}
        <div className="bg-[#141418] border border-red-500 border-opacity-30 rounded-sm p-5 mt-6">
          <SectionHeading>Danger Zone</SectionHeading>
          <p className="text-[#6B6B73] text-xs -mt-2 mb-5 leading-relaxed">
            Permanently deletes your account and all associated data — predictions, results, league memberships, and profile. This cannot be undone.
          </p>
          <div className="flex flex-col gap-3">
            <Field label='Type "DELETE" to confirm'>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                placeholder="DELETE"
                className="w-full bg-[#17181D] border border-[#23232B] text-[#F5F5F2] rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-[#6B6B73] font-mono"
              />
            </Field>
            {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}
            <div>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteBusy || deleteConfirm !== "DELETE"}
                className="px-4 py-2 rounded-sm border border-red-500 border-opacity-60 text-red-400 text-sm font-semibold transition-all hover:bg-red-500 hover:bg-opacity-10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleteBusy ? "Deleting account…" : "Delete my account permanently"}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[#6B6B73] text-xs text-center mt-6">
          <Link href="/iq" className="hover:text-[#A0A0A8] transition-colors">
            ← Back to You
          </Link>
        </p>

      </div>
    </div>
  );
}
