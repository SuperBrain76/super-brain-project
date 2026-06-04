"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile, saveProfile } from "@/lib/profile";
import { COUNTRIES } from "@/lib/countries";

// ── Shared option lists (kept in sync with settings/profile/page.tsx) ──

const CURRENT_YEAR   = new Date().getFullYear();
const MIN_AGE        = 8;
const MAX_BIRTH_YEAR = CURRENT_YEAR - MIN_AGE;
const MIN_BIRTH_YEAR = 1920;
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

// ── Field wrapper ─────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-cockpit-dim text-xs tracking-widest uppercase font-mono">{label}</label>
      {children}
      {hint && <p className="text-cockpit-muted text-xs">{hint}</p>}
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

export default function ProfileCompletePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [country,   setCountry]   = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender,    setGender]    = useState("");
  const [industry,  setIndustry]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadMyProfile().then((p) => {
      if (!p) return;
      if (p.country)   setCountry(p.country);
      if (p.birthYear) setBirthYear(String(p.birthYear));
      if (p.gender)    setGender(p.gender);
      if (p.industry)  setIndustry(p.industry);
    });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  const submit = async (skip = false) => {
    setSaving(true);
    setError(null);

    const { error: err } = await saveProfile(user.id, {
      country:         skip ? null : country   || null,
      birthYear:       skip ? null : birthYear ? Number(birthYear) : null,
      gender:          skip ? null : gender    || null,
      industry:        skip ? null : industry  || null,
      profileComplete: true,
    });

    setSaving(false);
    if (err) { setError(err); return; }
    router.push("/profile");
  };

  return (
    <div className="min-h-screen hud-grid flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-sm bg-cockpit-accent flex items-center justify-center">
              <span className="text-cockpit-bg font-black text-xs">SB</span>
            </div>
            <span className="font-bold tracking-widest text-sm text-white">SUPERBRAIN</span>
          </Link>
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">
            Optional · 30 seconds
          </p>
          <h1 className="text-xl font-bold text-white mb-2">Complete your profile</h1>
          <p className="text-cockpit-dim text-sm leading-relaxed">
            Helps personalise leaderboard filters and improve the tests.
            None of this is required.
          </p>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-5">

          <Field label="Country">
            <CountrySelect value={country} onChange={setCountry} />
          </Field>

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

          {error && (
            <div className="px-3 py-2.5 rounded-sm border border-red-500 border-opacity-30 bg-red-500 bg-opacity-10">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => submit(false)}
              disabled={saving}
              className="btn-primary w-full justify-center flex items-center gap-2"
            >
              {saving ? "Saving…" : "Save & Continue →"}
            </button>
            <button
              onClick={() => submit(true)}
              disabled={saving}
              className="w-full py-2.5 text-sm text-cockpit-muted hover:text-cockpit-dim transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>

        <p className="text-center text-cockpit-muted text-xs mt-5 leading-relaxed">
          Birth year, gender, and industry are never shown publicly.
          Only your display name and country appear on the leaderboard.
        </p>
      </div>
    </div>
  );
}
