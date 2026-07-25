"use client";

/**
 * /admin/competitions/new — the Launch Competition wizard.
 *
 * ────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 * ────────────────────────────────────────────────────────────
 * Adding La Liga, Serie A or the Champions League should be an
 * ADMINISTRATIVE task, not a development one. This is the surface that
 * makes that true: pick a format, name it, set the scoring, paste the
 * fixtures, launch.
 *
 * ────────────────────────────────────────────────────────────
 * TWO DESIGN RULES
 * ────────────────────────────────────────────────────────────
 * 1. The SETTINGS STEP RENDERS ITSELF FROM THE DATABASE.
 *    It reads `competition_setting_defs` — key, type, label, description,
 *    group — and builds the form. Adding a setting is a row in that table;
 *    this file does not change. Hardcoding the field list here would have
 *    put the wizard permanently one migration behind the engine.
 *
 * 2. NOTHING GOES LIVE WITHOUT PASSING THE LAUNCH GATE.
 *    Creation leaves the competition invisible. `admin_launch_competition`
 *    then checks it is structurally complete — season, rounds, teams,
 *    fixtures, scoring, provider config — and reports EVERY problem before
 *    anything becomes visible to users.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  listTemplates, listSports, listSettingDefs,
  createCompetition, importFixtures, parseFixtureCsv,
  checkReadiness, launchCompetition,
  type CompetitionTemplate, type Sport, type SettingDef,
  type ScoringSpec, type ImportFixtureRow, type ImportResult,
  type CreateCompetitionResult, type ReadinessReport,
} from "@/lib/competitionAdmin";
import { slugifyCompetitionName, isValidCompetitionSlug, isReservedSlug } from "@/lib/competitionRoutes";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// ── Tokens (cockpit admin theme) ──────────────────────────────
const BG      = "#080b0f";
const SURFACE = "#0d1117";
const CARD    = "#111820";
const BORDER  = "#1e2a38";
const ACCENT  = "#00d4ff";
const GREEN   = "#00e676";
const AMBER   = "#ffab00";
const RED     = "#ff3d00";
const DIM     = "#a8b8cc";
const MUTED   = "#8899aa";
const TEXT    = "#e2e8f0";

type StepId = "format" | "identity" | "season" | "scoring" | "settings" | "review" | "fixtures" | "launch";

const STEPS: { id: StepId; label: string }[] = [
  { id: "format",   label: "Format" },
  { id: "identity", label: "Identity" },
  { id: "season",   label: "Season" },
  { id: "scoring",  label: "Scoring" },
  { id: "settings", label: "Settings" },
  { id: "review",   label: "Review" },
  { id: "fixtures", label: "Fixtures" },
  { id: "launch",   label: "Launch" },
];

export default function CompetitionWizard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<StepId>("format");

  const [templates, setTemplates] = useState<CompetitionTemplate[]>([]);
  const [sports,    setSports]    = useState<Sport[]>([]);
  const [defs,      setDefs]      = useState<SettingDef[]>([]);

  // ── Form state ──
  const [templateCode, setTemplateCode] = useState("");
  const [name,         setName]         = useState("");
  const [slug,         setSlug]         = useState("");
  const [slugTouched,  setSlugTouched]  = useState(false);
  const [sportCode,    setSportCode]    = useState("football");

  const [seasonLabel, setSeasonLabel] = useState("");
  const [seasonSlug,  setSeasonSlug]  = useState("");
  const [startsAt,    setStartsAt]    = useState("");
  const [endsAt,      setEndsAt]      = useState("");

  const [scoring, setScoring] = useState<ScoringSpec>({ exact: 5, gd: 3, result: 2, wrong: 0 });
  const [roundCount, setRoundCount] = useState<number>(0);

  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [iqMultiplier, setIqMultiplier] = useState(1);

  // ── Results ──
  const [created,   setCreated]   = useState<CreateCompetitionResult | null>(null);
  const [csv,       setCsv]       = useState("");
  const [parsed,    setParsed]    = useState<{ rows: ImportFixtureRow[]; errors: string[] } | null>(null);
  const [importRes, setImportRes] = useState<ImportResult | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [launched,  setLaunched]  = useState<{ url?: string } | null>(null);

  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    void Promise.all([listTemplates(), listSports(), listSettingDefs()])
      .then(([t, s, d]) => { setTemplates(t); setSports(s); setDefs(d); });
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.code === templateCode) ?? null,
    [templates, templateCode],
  );

  // Applying a template seeds scoring, rounds and settings — all still
  // editable in the later steps. The template is a starting point, never a
  // constraint.
  function applyTemplate(t: CompetitionTemplate) {
    setTemplateCode(t.code);
    setSportCode(t.sportCode);
    setScoring(t.scoring);
    setRoundCount(t.roundConfig.count ?? 0);
    setSettings({ ...t.settings });
  }

  // Slug follows the name until the admin edits it by hand.
  useEffect(() => {
    if (!slugTouched) setSlug(slugifyCompetitionName(name));
  }, [name, slugTouched]);

  const slugError = !slug
    ? null
    : isReservedSlug(slug)
      ? `"${slug}" is a reserved application route.`
      : !isValidCompetitionSlug(slug)
        ? "Use lowercase letters, numbers and single hyphens."
        : null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function go(next: StepId) { setErr(null); setStep(next); }

  // ── Create ──
  async function handleCreate() {
    setBusy(true); setErr(null);

    const { result, error } = await createCompetition({
      slug, name, sportCode,
      template: templateCode || undefined,
      season: {
        slug:  seasonSlug || `${slug}-season`,
        label: seasonLabel || "Season 1",
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt:   endsAt   ? new Date(endsAt).toISOString()   : undefined,
      },
      rounds:  roundCount > 0
        ? { kind: "matchweek", count: roundCount,
            label_pattern: `${(settings.round_label as string) ?? "Matchweek"} {n}`,
            short_pattern: "MW{n}" }
        : undefined,
      scoring,
      settings,
      economy: iqMultiplier !== 1
        ? { prediction_score: { multiplier: iqMultiplier } }
        : undefined,
    });

    setBusy(false);
    if (error) { setErr(error); return; }
    setCreated(result);
    go("fixtures");
  }

  // ── Fixtures ──
  async function handleParse() {
    setErr(null);
    setParsed(parseFixtureCsv(csv));
    setImportRes(null);
  }

  async function handleImport(commit: boolean) {
    if (!created || !parsed?.rows.length) return;
    setBusy(true); setErr(null);
    const { result, error } = await importFixtures(created.seasonId, parsed.rows, commit);
    setBusy(false);
    if (error) { setErr(error); return; }
    setImportRes(result);
  }

  // ── Launch ──
  async function handleCheck() {
    if (!created) return;
    setBusy(true); setErr(null);
    const { report, error } = await checkReadiness(created.competitionId);
    setBusy(false);
    if (error) { setErr(error); return; }
    setReadiness(report);
  }

  async function handleLaunch(force: boolean) {
    if (!created) return;
    setBusy(true); setErr(null);
    const res = await launchCompetition(created.competitionId, force);
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    if (res.launched) setLaunched({ url: res.url });
    else setReadiness({ ready: false, competition: slug, problems: res.problems, warnings: res.warnings });
  }

  if (loading || !user) {
    return <div style={{ background: BG, minHeight: "100vh" }} />;
  }

  // ── Shared bits ──
  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold mb-1.5" style={{ color: DIM }}>{children}</label>
  );

  const input = {
    width: "100%", background: SURFACE, border: `1px solid ${BORDER}`,
    borderRadius: 8, padding: "10px 12px", color: TEXT, fontSize: 14,
  } as const;

  const Btn = ({ onClick, children, kind = "primary", disabled = false }: {
    onClick: () => void; children: React.ReactNode;
    kind?: "primary" | "ghost" | "danger"; disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
      style={{
        background: kind === "primary" ? ACCENT : kind === "danger" ? RED : "transparent",
        color:      kind === "ghost" ? DIM : "#03151c",
        border:     kind === "ghost" ? `1px solid ${BORDER}` : "none",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Launch a competition</h1>
          <Link href="/admin/competitions" className="text-xs" style={{ color: MUTED }}>
            ← All competitions
          </Link>
        </div>
        <p className="text-xs mb-6" style={{ color: MUTED }}>
          Configuration only — no deployment required.
        </p>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <div
                className="px-2.5 py-1 rounded text-[11px] font-semibold"
                style={{
                  background: i === stepIndex ? ACCENT : i < stepIndex ? "#0f2a20" : SURFACE,
                  color:      i === stepIndex ? "#03151c" : i < stepIndex ? GREEN : MUTED,
                  border:     `1px solid ${i === stepIndex ? ACCENT : BORDER}`,
                }}
              >
                {i < stepIndex ? "✓ " : ""}{s.label}
              </div>
              {i < STEPS.length - 1 && <span style={{ color: BORDER }}>—</span>}
            </div>
          ))}
        </div>

        {err && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "#2a0f0a", border: `1px solid ${RED}`, color: "#ffb3a0" }}>
            {err}
          </div>
        )}

        <div className="rounded-xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>

          {/* ── FORMAT ── */}
          {step === "format" && (
            <>
              <h2 className="text-sm font-bold mb-1">Pick a format</h2>
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                Sets the stages, round structure and sensible defaults. Everything stays editable.
              </p>
              <div className="flex flex-col gap-2">
                {templates.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => applyTemplate(t)}
                    className="text-left p-3 rounded-lg transition-colors"
                    style={{
                      background: templateCode === t.code ? "#0a1f28" : SURFACE,
                      border: `1px solid ${templateCode === t.code ? ACCENT : BORDER}`,
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: templateCode === t.code ? ACCENT : TEXT }}>
                      {t.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>{t.description}</div>
                    <div className="text-[11px] mt-1.5" style={{ color: DIM }}>
                      {t.stages.length} stage{t.stages.length === 1 ? "" : "s"}
                      {t.roundConfig.count ? ` · ${t.roundConfig.count} rounds` : ""}
                      {t.stages.some((s) => s.is_knockout) ? " · knockout" : ""}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end mt-5">
                <Btn onClick={() => go("identity")} disabled={!templateCode}>Continue</Btn>
              </div>
            </>
          )}

          {/* ── IDENTITY ── */}
          {step === "identity" && (
            <>
              <h2 className="text-sm font-bold mb-4">Name and address</h2>

              <div className="mb-4">
                <Label>Competition name</Label>
                <input style={input} value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="Premier League" />
              </div>

              <div className="mb-4">
                <Label>URL slug</Label>
                <input
                  style={{ ...input, borderColor: slugError ? RED : BORDER }}
                  value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
                  placeholder="premier-league"
                />
                <p className="text-[11px] mt-1" style={{ color: slugError ? RED : MUTED }}>
                  {slugError ?? <>The competition will live at <span style={{ color: ACCENT }}>/{slug || "…"}</span></>}
                </p>
              </div>

              <div className="mb-4">
                <Label>Sport</Label>
                <select style={input} value={sportCode} onChange={(e) => setSportCode(e.target.value)}>
                  {sports.map((s) => (
                    <option key={s.code} value={s.code}>{s.icon} {s.name}</option>
                  ))}
                </select>
                {sportCode !== "football" && (
                  <p className="text-[11px] mt-1" style={{ color: AMBER }}>
                    Only football is implemented end to end. Predictions are home/away
                    scores; a non-football competition will be created but cannot yet be
                    predicted correctly.
                  </p>
                )}
              </div>

              <div className="flex justify-between mt-5">
                <Btn kind="ghost" onClick={() => go("format")}>Back</Btn>
                <Btn onClick={() => go("season")} disabled={!name || !slug || !!slugError}>Continue</Btn>
              </div>
            </>
          )}

          {/* ── SEASON ── */}
          {step === "season" && (
            <>
              <h2 className="text-sm font-bold mb-1">First season</h2>
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                A competition is permanent; a season is one instance of it. Private
                leagues attach to the competition, so they survive into next season.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label>Season label</Label>
                  <input style={input} value={seasonLabel} onChange={(e) => setSeasonLabel(e.target.value)} placeholder="2026/27" />
                </div>
                <div>
                  <Label>Season slug</Label>
                  <input style={input} value={seasonSlug} onChange={(e) => setSeasonSlug(e.target.value)} placeholder={`${slug}-2026-27`} />
                </div>
                <div>
                  <Label>Starts</Label>
                  <input type="date" style={input} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div>
                  <Label>Ends</Label>
                  <input type="date" style={input} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
              </div>

              <div className="mb-4">
                <Label>Number of rounds</Label>
                <input type="number" min={0} max={100} style={input}
                       value={roundCount} onChange={(e) => setRoundCount(parseInt(e.target.value, 10) || 0)} />
                <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                  {roundCount > 0
                    ? `${roundCount} rounds will be generated. Rounds drive matchweek leaderboards, challenge locking and notifications.`
                    : "0 = one round per stage, the shape a group-and-knockout tournament uses."}
                </p>
              </div>

              <div className="flex justify-between mt-5">
                <Btn kind="ghost" onClick={() => go("identity")}>Back</Btn>
                <Btn onClick={() => go("scoring")} disabled={!seasonLabel}>Continue</Btn>
              </div>
            </>
          )}

          {/* ── SCORING ── */}
          {step === "scoring" && (
            <>
              <h2 className="text-sm font-bold mb-1">Scoring and IQ</h2>
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                Points per prediction outcome, evaluated in this order.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {([
                  ["exact",  "Exact score",         "Predicted 2-1, actual 2-1"],
                  ["gd",     "Correct goal diff",   "Predicted 2-0, actual 3-1"],
                  ["result", "Correct result only", "Predicted 1-0, actual 2-1"],
                  ["wrong",  "Wrong",               "Anything else"],
                ] as const).map(([key, label, hint]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <input type="number" style={input} value={scoring[key]}
                           onChange={(e) => setScoring({ ...scoring, [key]: parseInt(e.target.value, 10) || 0 })} />
                    <p className="text-[11px] mt-1" style={{ color: MUTED }}>{hint}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <Label>IQ multiplier for this competition</Label>
                <input type="number" step={0.05} min={0} style={input}
                       value={iqMultiplier} onChange={(e) => setIqMultiplier(parseFloat(e.target.value) || 0)} />
                <p className="text-[11px] mt-1" style={{ color: iqMultiplier === 1 ? MUTED : AMBER }}>
                  {iqMultiplier === 1
                    ? "1.0 = the standard IQ award for a scored prediction."
                    : `Scored predictions mint ${Math.round(iqMultiplier * 100)}% of the standard IQ award.`}
                  {" "}A 380-fixture season mints roughly 3.7× a 104-fixture tournament at
                  the same rate — lower this to keep the economy balanced.
                </p>
              </div>

              <div className="flex justify-between mt-5">
                <Btn kind="ghost" onClick={() => go("season")}>Back</Btn>
                <Btn onClick={() => go("settings")}>Continue</Btn>
              </div>
            </>
          )}

          {/* ── SETTINGS (rendered from the database) ── */}
          {step === "settings" && (
            <>
              <h2 className="text-sm font-bold mb-1">Settings</h2>
              <p className="text-xs mb-4" style={{ color: MUTED }}>
                Generated from <code style={{ color: ACCENT }}>competition_setting_defs</code> —
                new settings appear here automatically.
              </p>

              {Array.from(new Set(defs.map((d) => d.groupName))).map((group) => (
                <div key={group} className="mb-5">
                  <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
                    {group}
                  </div>
                  <div className="flex flex-col gap-3">
                    {defs.filter((d) => d.groupName === group).map((d) => {
                      const current = settings[d.key] ?? d.defaultValue;
                      return (
                        <div key={d.key}>
                          {d.valueType === "boolean" ? (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={current === true}
                                onChange={(e) => setSettings({ ...settings, [d.key]: e.target.checked })}
                                className="mt-0.5"
                              />
                              <span>
                                <span className="text-xs font-semibold" style={{ color: DIM }}>{d.label}</span>
                                {d.description && (
                                  <span className="block text-[11px]" style={{ color: MUTED }}>{d.description}</span>
                                )}
                              </span>
                            </label>
                          ) : d.valueType === "number" ? (
                            <>
                              <Label>{d.label}</Label>
                              <input type="number" style={input}
                                     value={typeof current === "number" ? current : ""}
                                     onChange={(e) => setSettings({ ...settings, [d.key]: e.target.value === "" ? null : Number(e.target.value) })} />
                              {d.description && <p className="text-[11px] mt-1" style={{ color: MUTED }}>{d.description}</p>}
                            </>
                          ) : d.valueType === "string" ? (
                            <>
                              <Label>{d.label}</Label>
                              <input style={input}
                                     value={typeof current === "string" ? current : ""}
                                     onChange={(e) => setSettings({ ...settings, [d.key]: e.target.value })} />
                              {d.description && <p className="text-[11px] mt-1" style={{ color: MUTED }}>{d.description}</p>}
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex justify-between mt-5">
                <Btn kind="ghost" onClick={() => go("scoring")}>Back</Btn>
                <Btn onClick={() => go("review")}>Continue</Btn>
              </div>
            </>
          )}

          {/* ── REVIEW ── */}
          {step === "review" && (
            <>
              <h2 className="text-sm font-bold mb-4">Review</h2>
              <dl className="text-xs flex flex-col gap-2 mb-5">
                {[
                  ["Format",     template?.name ?? "—"],
                  ["Name",       name],
                  ["URL",        `/${slug}`],
                  ["Sport",      sportCode],
                  ["Season",     `${seasonLabel} (${seasonSlug || `${slug}-season`})`],
                  ["Rounds",     roundCount > 0 ? `${roundCount} generated` : "one per stage"],
                  ["Scoring",    `${scoring.exact} / ${scoring.gd} / ${scoring.result} / ${scoring.wrong}`],
                  ["IQ",         iqMultiplier === 1 ? "standard" : `${iqMultiplier}×`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <dt style={{ color: MUTED }}>{k}</dt>
                    <dd className="text-right font-semibold" style={{ color: TEXT }}>{v}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-[11px] mb-4" style={{ color: AMBER }}>
                Created invisible. Nothing is shown to users until it passes the launch checks.
              </p>

              <div className="flex justify-between">
                <Btn kind="ghost" onClick={() => go("settings")}>Back</Btn>
                <Btn onClick={handleCreate}>{busy ? "Creating…" : "Create competition"}</Btn>
              </div>
            </>
          )}

          {/* ── FIXTURES ── */}
          {step === "fixtures" && created && (
            <>
              <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "#0a2018", border: `1px solid ${GREEN}`, color: "#9fe8c4" }}>
                Created <strong>{created.competitionSlug}</strong> — {created.stagesCreated} stage(s),
                {" "}{created.roundsCreated} round(s). It lives at <code>{created.url}</code> and is not visible yet.
              </div>

              <h2 className="text-sm font-bold mb-1">Import fixtures</h2>
              <p className="text-xs mb-3" style={{ color: MUTED }}>
                CSV with a header row. Teams are created automatically from their codes.
              </p>

              <pre className="text-[11px] p-2.5 rounded mb-3 overflow-x-auto"
                   style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: DIM }}>
{`round,home,away,kicks_off_at,venue,provider_fixture_id
1,ARS,BUR,2026-08-15T14:00:00Z,Emirates Stadium,1035432
1,CHE,EVE,2026-08-15T14:00:00Z,Stamford Bridge,1035433`}
              </pre>

              <textarea
                style={{ ...input, minHeight: 160, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder="Paste fixture CSV here…"
              />

              <div className="flex gap-2 mt-3">
                <Btn kind="ghost" onClick={handleParse} disabled={!csv.trim()}>Check CSV</Btn>
                {parsed && parsed.rows.length > 0 && (
                  <>
                    <Btn kind="ghost" onClick={() => handleImport(false)}>Dry run</Btn>
                    <Btn onClick={() => handleImport(true)} disabled={!importRes?.dryRun}>
                      Import {parsed.rows.length}
                    </Btn>
                  </>
                )}
              </div>

              {parsed && (
                <div className="mt-3 text-xs">
                  <p style={{ color: parsed.rows.length ? GREEN : RED }}>
                    {parsed.rows.length} row(s) parsed
                  </p>
                  {parsed.errors.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5" style={{ color: AMBER }}>
                      {parsed.errors.slice(0, 10).map((e, i) => <li key={i}>· {e}</li>)}
                      {parsed.errors.length > 10 && <li>· …and {parsed.errors.length - 10} more</li>}
                    </ul>
                  )}
                </div>
              )}

              {importRes && (
                <div className="mt-3 p-3 rounded-lg text-xs"
                     style={{ background: SURFACE, border: `1px solid ${importRes.dryRun ? AMBER : GREEN}` }}>
                  <p style={{ color: importRes.dryRun ? AMBER : GREEN }}>
                    {importRes.dryRun ? "Dry run — nothing written." : "Imported."}
                    {" "}{importRes.fixturesCreated} fixture(s), {importRes.teamsCreated} team(s).
                  </p>
                  {importRes.errors.length > 0 && (
                    <ul className="mt-1" style={{ color: RED }}>
                      {importRes.errors.slice(0, 8).map((e, i) => <li key={i}>· row {e.index}: {e.error}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-5">
                <span />
                <Btn onClick={() => { void handleCheck(); go("launch"); }}>Continue to launch</Btn>
              </div>
            </>
          )}

          {/* ── LAUNCH ── */}
          {step === "launch" && created && (
            <>
              <h2 className="text-sm font-bold mb-3">Launch checks</h2>

              {!readiness && !launched && (
                <Btn kind="ghost" onClick={handleCheck}>{busy ? "Checking…" : "Run checks"}</Btn>
              )}

              {readiness && !launched && (
                <>
                  {readiness.problems.length === 0 ? (
                    <div className="p-3 rounded-lg text-xs mb-4" style={{ background: "#0a2018", border: `1px solid ${GREEN}`, color: "#9fe8c4" }}>
                      All checks passed. Ready to go live.
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg text-xs mb-4" style={{ background: "#2a1a00", border: `1px solid ${AMBER}` }}>
                      <p className="font-semibold mb-1" style={{ color: AMBER }}>Not ready:</p>
                      <ul className="flex flex-col gap-0.5" style={{ color: "#ffd280" }}>
                        {readiness.problems.map((p, i) => <li key={i}>· {p}</li>)}
                      </ul>
                    </div>
                  )}

                  {readiness.warnings.length > 0 && (
                    <div className="p-3 rounded-lg text-xs mb-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                      <p className="font-semibold mb-1" style={{ color: DIM }}>Worth knowing:</p>
                      <ul className="flex flex-col gap-0.5" style={{ color: MUTED }}>
                        {readiness.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Btn kind="ghost" onClick={handleCheck}>Re-check</Btn>
                    <Btn onClick={() => handleLaunch(false)} disabled={readiness.problems.length > 0}>
                      {busy ? "Launching…" : "Go live"}
                    </Btn>
                    {readiness.problems.length > 0 && (
                      <Btn kind="danger" onClick={() => {
                        if (confirm("Launch anyway? This competition will be visible to every user despite failing its checks.")) {
                          void handleLaunch(true);
                        }
                      }}>
                        Force launch
                      </Btn>
                    )}
                  </div>
                </>
              )}

              {launched && (
                <div className="p-4 rounded-lg text-center" style={{ background: "#0a2018", border: `1px solid ${GREEN}` }}>
                  <p className="text-sm font-bold mb-1" style={{ color: GREEN }}>Live</p>
                  <p className="text-xs mb-3" style={{ color: "#9fe8c4" }}>
                    {name} is now visible to users.
                  </p>
                  <Link href={launched.url ?? `/${slug}`}
                        className="inline-block px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: ACCENT, color: "#03151c" }}>
                    Open {launched.url ?? `/${slug}`}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
