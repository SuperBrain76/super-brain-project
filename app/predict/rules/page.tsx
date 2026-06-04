import Link from "next/link";

// ── Static rules page — no client-side data needed ────────────

// ── Shared primitives ─────────────────────────────────────────

function Section({ id, title, children }: {
  id:       string;
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-6">
      <h2 className="text-white font-bold text-base border-b border-cockpit-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children, accent }: {
  children: React.ReactNode;
  accent?:  string;
}) {
  return (
    <div
      className="bg-cockpit-card border border-cockpit-border rounded-sm p-4"
      style={accent ? { borderLeftColor: accent, borderLeftWidth: 2 } : undefined}
    >
      {children}
    </div>
  );
}

function PointRow({
  icon, pts, label, example, accentColor,
}: {
  icon:        string;
  pts:         number;
  label:       string;
  example:     string;
  accentColor: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-cockpit-border last:border-0">
      <div
        className="shrink-0 w-10 h-10 rounded-sm flex items-center justify-center text-lg font-black number-display"
        style={{ color: accentColor, background: `${accentColor}15` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-semibold text-sm">{label}</span>
          <span
            className="text-xs font-black font-mono px-2 py-0.5 rounded-sm"
            style={{ color: accentColor, background: `${accentColor}18` }}
          >
            {pts} {pts === 1 ? "pt" : "pts"}
          </span>
        </div>
        <p className="text-cockpit-muted text-xs mt-0.5 font-mono">{example}</p>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-cockpit-border last:border-0">
      <p className="text-white text-sm font-semibold mb-1">{q}</p>
      <p className="text-cockpit-dim text-sm leading-relaxed">{a}</p>
    </div>
  );
}

// ── Table of contents ─────────────────────────────────────────

const TOC = [
  { href: "#scoring",     label: "Scoring" },
  { href: "#deadlines",   label: "Deadlines" },
  { href: "#leagues",     label: "Leagues & Tie-breakers" },
  { href: "#bonus",       label: "Bonus Questions" },
  { href: "#faq",         label: "FAQ" },
  { href: "#disclaimer",  label: "Disclaimer" },
];

// ── Page ──────────────────────────────────────────────────────

export default function RulesPage() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-12 w-full flex flex-col gap-8">

        {/* ── Breadcrumb ───────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono">
          <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
          <span>/</span>
          <span className="text-cockpit-dim">Rules &amp; Scoring</span>
        </div>

        {/* ── Header ───────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-cockpit-muted mb-1">
            SuperBrain · Predictor
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">Rules &amp; Scoring</h1>
          <p className="text-cockpit-dim text-sm mt-2 leading-relaxed">
            Everything you need to know about how predictions are scored, when deadlines apply,
            and how league standings work.
          </p>
        </div>

        {/* ── Table of contents ────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {TOC.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[10px] font-mono px-2.5 py-1.5 rounded-sm border border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-cockpit-accent transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* ── 1. Scoring ───────────────────────────────────── */}
        <Section id="scoring" title="How Scoring Works">
          <p className="text-cockpit-dim text-sm leading-relaxed">
            Each prediction is scored once the final result is entered. Points are awarded
            based on how accurately you predicted the scoreline.
          </p>

          <Card>
            <PointRow
              icon="⚡"
              pts={5}
              label="Exact score"
              example="You predicted 2–1 · Final result: 2–1"
              accentColor="#00e676"
            />
            <PointRow
              icon="✓"
              pts={3}
              label="Correct goal difference"
              example="You predicted 2–0 (+2 GD) · Final result: 3–1 (+2 GD)"
              accentColor="#00d4ff"
            />
            <PointRow
              icon="~"
              pts={2}
              label="Correct result only"
              example="You predicted 1–0 (home win) · Final result: 3–1 (home win)"
              accentColor="#ffab00"
            />
            <PointRow
              icon="✗"
              pts={0}
              label="Wrong prediction"
              example="You predicted 2–1 (home win) · Final result: 1–1 (draw)"
              accentColor="#ff4040"
            />
          </Card>

          {/* Example table */}
          <div className="flex flex-col gap-2">
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">
              Examples — same final result (Brazil 2–1 England)
            </p>
            <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
              <div className="grid grid-cols-3 px-4 py-2 border-b border-cockpit-border bg-cockpit-surface">
                <span className="text-[10px] text-cockpit-muted font-mono uppercase tracking-widest">Your prediction</span>
                <span className="text-[10px] text-cockpit-muted font-mono uppercase tracking-widest text-center">Result</span>
                <span className="text-[10px] text-cockpit-muted font-mono uppercase tracking-widest text-right">Points</span>
              </div>
              {[
                { pred: "2–1",  reason: "Exact score",          pts: 5,  color: "#00e676" },
                { pred: "3–2",  reason: "Correct GD (+1)",      pts: 3,  color: "#00d4ff" },
                { pred: "4–1",  reason: "Correct GD (+3)? No — GD is +1 vs +3", pts: 2, color: "#ffab00", note: true },
                { pred: "1–0",  reason: "Home win — correct result", pts: 2, color: "#ffab00" },
                { pred: "1–1",  reason: "Draw — wrong result",  pts: 0,  color: "#ff4040" },
                { pred: "0–2",  reason: "Away win — wrong result", pts: 0, color: "#ff4040" },
              ].map((row) => (
                <div key={row.pred} className="grid grid-cols-3 px-4 py-2.5 border-b border-cockpit-border last:border-0 items-center">
                  <span className="text-white font-mono font-semibold text-sm">{row.pred}</span>
                  <span className="text-cockpit-muted text-xs text-center">{row.reason}</span>
                  <span
                    className="text-right font-black font-mono"
                    style={{ color: row.color }}
                  >
                    {row.pts} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Card accent="#1e2a38">
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-2">Note on extra time &amp; penalties</p>
            <p className="text-cockpit-dim text-sm leading-relaxed">
              Scoring is based on the <span className="text-white font-semibold">90-minute result only</span> (including
              injury time). Goals scored in extra time or determined by a penalty shootout are
              not counted when calculating your prediction score.
            </p>
          </Card>
        </Section>

        {/* ── 2. Deadlines ─────────────────────────────────── */}
        <Section id="deadlines" title="Prediction Deadlines">
          <Card accent="#ff3d00">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">🔒</span>
              <div>
                <p className="text-white font-semibold text-sm">Predictions lock at kickoff</p>
                <p className="text-cockpit-dim text-sm mt-1 leading-relaxed">
                  You can submit or edit your prediction any time before a match kicks off.
                  The moment the match starts, your prediction is locked permanently.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            {[
              {
                icon: "✏️",
                title: "Editing predictions",
                body: "You can change your predicted score as many times as you like before kickoff. Only your most recent submission counts.",
              },
              {
                icon: "🔒",
                title: "No exceptions after kickoff",
                body: "The deadline is enforced at the database level — it cannot be overridden by anyone, including platform administrators.",
              },
              {
                icon: "📅",
                title: "Postponed matches",
                body: "If a match is postponed, the prediction window remains open until a new kickoff time is set. Existing predictions are preserved.",
              },
              {
                icon: "⏱️",
                title: "Check the countdown",
                body: "Fixture cards show a live countdown when a match is within 24 hours. Watch for the amber \"Closes Xh\" badge.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 bg-cockpit-card border border-cockpit-border rounded-sm p-4">
                <span className="text-lg shrink-0">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-cockpit-dim text-sm mt-0.5 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 3. Leagues & Tie-breakers ────────────────────── */}
        <Section id="leagues" title="Leagues &amp; Tie-breakers">
          <div className="flex flex-col gap-3">
            <Card>
              <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-2">League standings</p>
              <p className="text-cockpit-dim text-sm leading-relaxed">
                Players are ranked by their total points across all scored predictions in the competition.
                Points accumulate as match results are entered throughout the tournament.
              </p>
            </Card>

            <Card>
              <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-3">
                Tie-breaker order
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { n: "1", label: "Total points",          detail: "Higher total points wins" },
                  { n: "2", label: "Most exact scores",     detail: "More ⚡ 5-point predictions" },
                  { n: "3", label: "Most predictions made", detail: "More fixtures predicted" },
                  { n: "4", label: "Earliest join date",    detail: "Earlier sign-up to the league" },
                ].map((row) => (
                  <div key={row.n} className="flex items-center gap-3 py-2 border-b border-cockpit-border last:border-0">
                    <span
                      className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: "#1e2a38", color: "#a8b8cc" }}
                    >
                      {row.n}
                    </span>
                    <div className="flex-1">
                      <span className="text-white text-sm font-semibold">{row.label}</span>
                      <span className="text-cockpit-muted text-xs ml-2">{row.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest mb-2">Private leagues</p>
              <p className="text-cockpit-dim text-sm leading-relaxed">
                Leagues are private by default. Only people with your invite code or invite link can join.
                No public league directory exists — your league is only findable by people you share the code with.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── 4. Bonus Questions ───────────────────────────── */}
        <Section id="bonus" title="Bonus Questions">
          <div
            className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex items-start gap-4"
            style={{ borderColor: "#ffab0040" }}
          >
            <span className="text-2xl shrink-0">🚧</span>
            <div>
              <p className="text-white font-semibold text-sm">Coming soon</p>
              <p className="text-cockpit-dim text-sm mt-1 leading-relaxed">
                Bonus questions — such as tournament winner, top scorer, and golden glove — will be
                introduced later in the competition. Scoring rules will be published here before they go live.
              </p>
              <p className="text-cockpit-muted text-xs mt-2 font-mono">
                No bonus questions are active yet. No action required.
              </p>
            </div>
          </div>
        </Section>

        {/* ── 5. FAQ ───────────────────────────────────────── */}
        <Section id="faq" title="Frequently Asked Questions">
          <Card>
            <Faq
              q="When are points awarded?"
              a="Points are calculated automatically the moment an admin enters the final result for a match. There is no manual step required from you."
            />
            <Faq
              q="Can I see other people's predictions before a match kicks off?"
              a="No. Predictions are private until a match is completed. This prevents copying and keeps competition fair."
            />
            <Faq
              q="What if I forget to predict a match?"
              a="Unpredicted matches score 0 points. There is no penalty beyond the missed opportunity."
            />
            <Faq
              q="What if a result was entered incorrectly?"
              a="Admins can correct a result and trigger a rescore. All predictions for that match will be recalculated automatically."
            />
            <Faq
              q="Are away goals or aggregate scores used?"
              a="No. Each match is scored individually based on its 90-minute result. Aggregate or two-leg tie rules do not apply."
            />
            <Faq
              q="Can I join more than one private league?"
              a="Yes. You can join as many leagues as you like and track your standing in each one independently."
            />
            <Faq
              q="What happens to my league if I created it and want to leave?"
              a={
                <>
                  As the league owner, you cannot leave while you are the only member.
                  If other members have joined, you can leave freely — ownership tracking
                  remains for future admin tools.
                </>
              }
            />
            <Faq
              q="Is there a limit on how many people can join a league?"
              a="No hard limit is currently enforced. A configurable cap may be introduced in future."
            />
          </Card>
        </Section>

        {/* ── 6. Disclaimer ────────────────────────────────── */}
        <Section id="disclaimer" title="Disclaimer">
          <Card accent="#64748b">
            <p className="text-cockpit-dim text-sm leading-relaxed">
              <span className="text-white font-semibold">All scoring is calculated automatically by the SuperBrain platform.</span>{" "}
              Point totals are determined entirely by the match results entered by platform administrators
              and the prediction you submitted before kickoff. No manual adjustments are made to individual
              user scores.
            </p>
            <p className="text-cockpit-dim text-sm leading-relaxed mt-3">
              SuperBrain Predictor is a free-to-play, points-based prediction game. No money, prizes,
              or items of value are offered or implied. Results are for entertainment purposes only.
            </p>
            <p className="text-cockpit-dim text-sm leading-relaxed mt-3">
              If you believe there is an error in a match result, please contact us via the{" "}
              <Link href="/contact" className="text-cockpit-accent hover:underline">
                Contact page
              </Link>
              . We will investigate and rescore if a genuine error is confirmed.
            </p>
          </Card>
        </Section>

        {/* ── Back ─────────────────────────────────────────── */}
        <Link
          href="/predict"
          className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors font-mono"
        >
          ← Back to predictor
        </Link>
      </div>
    </div>
  );
}
