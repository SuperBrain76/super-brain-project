"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadMyProfile, saveProfile } from "@/lib/profile";

// ── Static option lists ───────────────────────────────────────

const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile",
  "China", "Colombia", "Czech Republic", "Denmark", "Egypt", "Finland", "France",
  "Germany", "Greece", "Hungary", "India", "Indonesia", "Ireland", "Israel",
  "Italy", "Japan", "Malaysia", "Mexico", "Netherlands", "New Zealand", "Nigeria",
  "Norway", "Pakistan", "Philippines", "Poland", "Portugal", "Romania", "Russia",
  "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain", "Sweden",
  "Switzerland", "Thailand", "Turkey", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Vietnam", "Other",
];

const BIRTH_YEARS = Array.from({ length: 2009 - 1939 }, (_, i) => 2009 - i); // 2009 → 1940

const GENDERS = [
  { value: "male",             label: "Male" },
  { value: "female",           label: "Female" },
  { value: "non_binary",       label: "Non-binary" },
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
      <label className="text-cockpit-dim text-xs tracking-widest uppercase">{label}</label>
      {children}
      {hint && <p className="text-cockpit-muted text-xs">{hint}</p>}
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

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Pre-fill any values that were previously saved
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
    <div className="min-h-screen hud-grid flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm module-enter">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">
            Optional
          </p>
          <h1 className="text-2xl font-bold text-white mb-2">Complete your profile</h1>
          <p className="text-cockpit-dim text-sm leading-relaxed">
            Helps us personalise leaderboard filters and improve the tests.
            <br />
            <span className="text-cockpit-muted">None of this is required.</span>
          </p>
        </div>

        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-7 flex flex-col gap-5">

          {/* Country */}
          <Field label="Country">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-cockpit-card border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
            >
              <option value="">— Select country —</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Year of birth */}
          <Field label="Year of birth">
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="w-full bg-cockpit-card border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
            >
              <option value="">— Select year —</option>
              {BIRTH_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>

          {/* Gender */}
          <Field label="Gender">
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(gender === g.value ? "" : g.value)}
                  className={`px-3 py-2 rounded-sm border text-sm text-left transition-all duration-150 ${
                    gender === g.value
                      ? "border-cockpit-accent text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                      : "border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-dim"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Industry */}
          <Field label="Industry / occupation">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-cockpit-card border border-cockpit-border text-cockpit-dim rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent transition-colors"
            >
              <option value="">— Select industry —</option>
              {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </Field>

          {error && <p className="text-cockpit-red text-xs">{error}</p>}

          {/* Actions */}
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
          Personal data (birth year, gender, industry) is never shown publicly.
          Only your display name and country appear on the leaderboard.
        </p>
      </div>
    </div>
  );
}
