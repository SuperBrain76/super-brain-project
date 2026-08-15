import Link from "next/link";
import { GrandPrizeRulesSection } from "@/components/GrandPrize";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Shared primitives ─────────────────────────────────────────

function Section({ id, title, children }: {
  id:       string;
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-6">
      <h2 className="font-bold text-base pb-2" style={{ color: TEXT1, borderBottom: `1px solid ${BORDER}` }}>
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
      className="rounded-xl p-4"
      style={{
        background:      CARD,
        border:          `1px solid ${BORDER}`,
        borderLeftColor: accent ?? BORDER,
        borderLeftWidth: accent ? 3 : 1,
      }}
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
    <div className="flex items-start gap-3 py-3 last:border-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div
        className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black"
        style={{ color: accentColor, background: `${accentColor}15` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: TEXT1 }}>{label}</span>
          <span
            className="text-xs font-black px-2 py-0.5 rounded-full"
            style={{ color: accentColor, background: `${accentColor}15` }}
          >
            {pts} {pts === 1 ? "pt" : "pts"}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>{example}</p>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="py-3 last:border-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: TEXT1 }}>{q}</p>
      <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>{a}</p>
    </div>
  );
}

// ── Table of contents ─────────────────────────────────────────

const TOC = [
  { href: "#scoring",    label: "Match Scoring" },
  { href: "#deadlines",  label: "Deadlines" },
  { href: "#leagues",    label: "Leagues & Tie-breakers" },
  { href: "#bonus",      label: "Bonus Questions" },
  { href: "#prize",      label: "Grand Prize" },
  { href: "#faq",        label: "FAQ" },
  { href: "#disclaimer", label: "Disclaimer" },
];

// ── Page ──────────────────────────────────────────────────────

export default function RulesPage(
  { params }: { params: { competition: string } },
) {
  // Server component: the competition comes from the route params
  // prop, not useParams — no client boundary needed for a static page.
  const competitionSlug = params.competition;

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-12 w-full flex flex-col gap-8">

        {/* ── Breadcrumb ───────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href={`/${competitionSlug}`} className="hover:underline" style={{ color: MUTED }}>Predictor</Link>
          <span>/</span>
          <span style={{ color: TEXT2, fontWeight: 600 }}>Rules &amp; Scoring</span>
        </div>

        {/* ── Header ───────────────────────────────────────── */}
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: MUTED }}>
            SuperBrain · Predictor
          </p>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: TEXT1 }}>Rules &amp; Scoring</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: TEXT2 }}>
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
              className="text-[10px] px-2.5 py-1.5 rounded-full transition-colors hover:underline"
              style={{ border: `1px solid ${BORDER}`, color: TEXT2, background: CARD }}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* ── 1. Scoring ───────────────────────────────────── */}
        <Section id="scoring" title="How Scoring Works">
          <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
            Each prediction is scored once the final result is entered. Points are awarded
            based on how accurately you predicted the scoreline.
          </p>

          <Card>
            <PointRow
              icon="⚡"
              pts={5}
              label="Exact score"
              example="You predicted 2–1 · Final result: 2–1"
              accentColor={GREEN}
            />
            <PointRow
              icon="✓"
              pts={3}
              label="Correct goal difference"
              example="You predicted 2–0 (+2 GD) · Final result: 3–1 (+2 GD)"
              accentColor="#0e1e35"
            />
            <PointRow
              icon="~"
              pts={2}
              label="Correct result only"
              example="You predicted 1–0 (home win) · Final result: 3–1 (home win)"
              accentColor={GOLD}
            />
            <PointRow
              icon="✗"
              pts={0}
              label="Wrong prediction"
              example="You predicted 2–1 (home win) · Final result: 1–1 (draw)"
              accentColor="#c0392b"
            />
          </Card>

          {/* Example table */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
              Examples — same final result (Brazil 2–1 England)
            </p>
            <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="grid grid-cols-3 px-4 py-2" style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Your prediction</span>
                <span className="text-[10px] uppercase tracking-widest text-center" style={{ color: MUTED }}>Result</span>
                <span className="text-[10px] uppercase tracking-widest text-right" style={{ color: MUTED }}>Points</span>
              </div>
              {[
                { pred: "2–1",  reason: "Exact score",                       pts: 5,  color: GREEN       },
                { pred: "3–2",  reason: "Correct GD (+1)",                   pts: 3,  color: "#0e1e35"   },
                { pred: "4–1",  reason: "Correct GD (+3)? No — GD is +1 vs +3", pts: 2, color: GOLD     },
                { pred: "1–0",  reason: "Home win — correct result",          pts: 2,  color: GOLD        },
                { pred: "1–1",  reason: "Draw — wrong result",                pts: 0,  color: "#c0392b"   },
                { pred: "0–2",  reason: "Away win — wrong result",            pts: 0,  color: "#c0392b"   },
              ].map((row) => (
                <div key={row.pred} className="grid grid-cols-3 px-4 py-2.5 items-center"
                  style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <span className="font-mono font-semibold text-sm" style={{ color: TEXT1 }}>{row.pred}</span>
                  <span className="text-xs text-center" style={{ color: MUTED }}>{row.reason}</span>
                  <span className="text-right font-black font-mono" style={{ color: row.color }}>
                    {row.pts} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Card accent={MUTED}>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>Note on extra time &amp; penalties</p>
            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
              Scoring is based on the <span className="font-semibold" style={{ color: TEXT1 }}>90-minute result only</span> (including
              injury time). Goals scored in extra time or determined by a penalty shootout are
              not counted when calculating your prediction score.
            </p>
          </Card>
        </Section>

        {/* ── 2. Deadlines ─────────────────────────────────── */}
        <Section id="deadlines" title="Prediction Deadlines">
          <Card accent="#c0392b">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">🔒</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: TEXT1 }}>Each match locks at kickoff — individually</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: TEXT2 }}>
                  You can submit or edit your prediction any time before a match kicks off.
                  The moment the match starts, your prediction is locked permanently.{" "}
                  <span className="font-medium" style={{ color: TEXT1 }}>The whole tournament does not lock at once</span> — each
                  game has its own independent deadline.
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
              <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <span className="text-lg shrink-0">{item.icon}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: TEXT1 }}>{item.title}</p>
                  <p className="text-sm mt-0.5 leading-relaxed" style={{ color: TEXT2 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 3. Leagues & Tie-breakers ────────────────────── */}
        <Section id="leagues" title="Leagues &amp; Tie-breakers">
          <div className="flex flex-col gap-3">
            <Card>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>League standings</p>
              <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
                Players are ranked by their total points across all scored predictions in the competition.
                Points accumulate as match results are entered throughout the tournament.
              </p>
            </Card>

            <Card>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>Points breakdown</p>
              <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
                Total Points = <span className="font-semibold" style={{ color: TEXT1 }}>Match Points</span> + <span className="font-semibold" style={{ color: GOLD }}>Bonus Points</span>.
                Both are shown separately on the leaderboard so you can always see where your score comes from.
              </p>
            </Card>

            <Card>
              <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: MUTED }}>
                Tie-breaker order
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { n: "1", label: "Most exact scores",             detail: "More ⚡ 5-point predictions" },
                  { n: "2", label: "Most correct goal differences",  detail: "More 3-point predictions (correct GD)" },
                  { n: "3", label: "Most correct results",           detail: "More 2-point predictions (correct outcome)" },
                  { n: "4", label: "Most bonus points",              detail: "Higher bonus question score" },
                  { n: "5", label: "Most predictions completed",     detail: "More fixtures predicted" },
                  { n: "6", label: "Prize shared",                   detail: "Or decided by a final tie-break question" },
                ].map((row) => (
                  <div key={row.n} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: `${GREEN}12`, color: GREEN }}
                    >
                      {row.n}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-semibold" style={{ color: TEXT1 }}>{row.label}</span>
                      <span className="text-xs ml-2" style={{ color: MUTED }}>{row.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>Private leagues</p>
              <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
                Leagues are private by default. Only people with your invite code or invite link can join.
                No public league directory exists — your league is only findable by people you share the code with.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── 4. Bonus Questions ───────────────────────────── */}
        <Section id="bonus" title="Bonus Questions">
          <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
            Seven tournament-wide questions worth up to <span className="font-semibold" style={{ color: TEXT1 }}>90 bonus points</span> on
            top of your match prediction score. Submit your answers at{" "}
            <Link href={`/${competitionSlug}/bonus`} className="hover:underline" style={{ color: GREEN }}>Bonus Questions</Link>.
          </p>

          {/* Scoring table */}
          <Card>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: MUTED }}>Points per question</p>
            <div className="flex flex-col">
              {[
                { icon: "🏆", label: "WC Winner",                   pts: 20 },
                { icon: "👟", label: "Golden Boot Winner",                  pts: 15 },
                { icon: "🥅", label: "Golden Glove Winner",                 pts: 15, note: "Best goalkeeper" },
                { icon: "🥈", label: "Runner Up",                           pts: 10 },
                { icon: "⚽", label: "Team Scoring Most Goals",             pts: 10 },
                { icon: "🛡️", label: "Team Conceding Fewest Goals",         pts: 10 },
                { icon: "⭐", label: "Surprise Team",                       pts: 10 },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <span className="text-xl shrink-0 w-8 text-center">{r.icon}</span>
                  <span className="flex-1 text-sm" style={{ color: TEXT2 }}>{r.label}</span>
                  <span className="font-black font-mono text-sm" style={{ color: GOLD }}>
                    {r.pts} pts
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Auto-lock */}
          <Card accent="#c0392b">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">🔒</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: TEXT1 }}>Auto-lock at tournament kickoff</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: TEXT2 }}>
                  All bonus predictions lock <span className="font-semibold" style={{ color: TEXT1 }}>automatically</span> the
                  moment the first match kicks off (June 11, 2026 · 19:00 UTC). This is enforced at the
                  database level — no submission or edit is possible after that time, regardless of
                  whether an admin has manually locked a question.
                </p>
                <p className="text-xs mt-2" style={{ color: MUTED }}>
                  Make all seven predictions before tournament kickoff.
                </p>
              </div>
            </div>
          </Card>

          {/* Surprise Team definition */}
          <Card>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
              Surprise Team — official definition
            </p>
            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
              The <span className="font-semibold" style={{ color: TEXT1 }}>highest finishing team</span> that was ranked
              outside the <span className="font-semibold" style={{ color: TEXT1 }}>Top 20</span> in the official
              Men&apos;s World Rankings <span className="font-semibold" style={{ color: TEXT1 }}>immediately before the tournament begins</span>.
            </p>
            <p className="text-xs mt-2" style={{ color: MUTED }}>
              Final position is determined by official tournament standings. In the event of a tie,
              the team with the lower pre-tournament world ranking is selected.
            </p>
          </Card>

          {/* Scoring */}
          <Card>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>How answers are scored</p>
            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
              Team questions require an exact team match. The Golden Boot question requires an exact
              player name match (case-insensitive). Points are awarded in full — there are no partial
              points for bonus questions. All scoring is automatic once the admin enters the correct answer.
            </p>
          </Card>
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
            <Faq
              q="How are ties broken on the leaderboard?"
              a="If two or more players have the same total points, the tie is broken in this order: (1) most exact scores, (2) most correct goal differences, (3) most correct results, (4) most bonus points, (5) most predictions completed. If still tied, the prize is shared or settled by a final tie-break question. Sign-up date is not used."
            />
          </Card>
        </Section>

        {/* ── 5b. Grand Prize ──────────────────────────────── */}
        <div id="prize">
          <GrandPrizeRulesSection />
        </div>

        {/* ── 6. Disclaimer ────────────────────────────────── */}
        <Section id="disclaimer" title="Disclaimer">
          <Card accent={MUTED}>
            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
              <span className="font-semibold" style={{ color: TEXT1 }}>All scoring is calculated automatically by the SuperBrain platform.</span>{" "}
              Point totals are determined entirely by the match results entered by platform administrators
              and the prediction you submitted before kickoff. No manual adjustments are made to individual
              user scores.
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: TEXT2 }}>
              SuperBrain Predictor is a free-to-play, points-based prediction game. The Grand Prize
              (Custom Champion Watch) is awarded to the overall global leaderboard winner at the conclusion
              of the 2026 WC. See the{" "}
              <Link href={`/${competitionSlug}/prize`} className="hover:underline" style={{ color: GREEN }}>
                Grand Prize page
              </Link>{" "}
              for full prize details.
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: TEXT2 }}>
              If you believe there is an error in a match result, please contact us via the{" "}
              <Link href="/contact" className="hover:underline" style={{ color: GREEN }}>
                Contact page
              </Link>
              . We will investigate and rescore if a genuine error is confirmed.
            </p>
          </Card>

          {/* Apple not-a-sponsor notice — required by App Store guideline 5.3.2 */}
          <Card>
            <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
              This contest is in no way sponsored, endorsed, administered by, or associated with Apple Inc. Any questions or comments regarding this contest should be directed to SuperBrain, not to Apple. Apple is not responsible for any prize fulfilment.
            </p>
          </Card>
        </Section>

        {/* ── Back ─────────────────────────────────────────── */}
        <Link
          href={`/${competitionSlug}`}
          className="text-xs text-center hover:underline"
          style={{ color: MUTED }}
        >
          ← Back to predictor
        </Link>
      </div>
    </div>
  );
}
