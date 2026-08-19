"use client";

/**
 * /admin/growth — the venue business in one screen.
 *
 * Everything comes from two SECURITY DEFINER RPCs (migration 062) that call
 * assert_admin() server-side, so the gate is the app_admins table rather than
 * an env-var email comparison — the venue tables are RLS-locked and no client
 * can reach them directly.
 *
 * Midnight Gold: gold marks VALUE ONLY (MRR, lifetime, paid). Funnel counts,
 * rates and health numbers stay in ink. Errors are the one exception — a red
 * strip that only exists when something is actually broken.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";

interface Dashboard {
  prospects: number; prospects_total_scraped: number; verified_emails: number;
  awaiting_enrichment: number;
  emails_sent_today: number; emails_sent_total: number;
  open_rate: number; reply_rate: number; bounce_rate: number;
  replies_total: number; suppressed: number;
  trials: number; active_subscriptions: number;
  mrr_cents: number; mrr_cents_paying: number;
  failed_payments_30d: number; past_due: number;
  provisioning_failures: number; system_errors_24h: number;
  churned: number; churn_rate: number;
  venue_leagues: number; players_in_venue_leagues: number; countries_live: number;
  top_countries: Array<{ country: string; prospects: number; verified: number; emailed: number; replied: number; paid: number }>;
  top_sequences: Array<{ campaign: string; language: string | null; country: string | null; step: number; sent: number; open_rate: number | null; reply_rate: number | null }>;
  generated_at: string;
}

interface EventRow {
  id: number; created_at: string; kind: string; label: string; category: string;
  severity: string; source: string; detail: Record<string, unknown>;
  venue_id: string | null; venue_name: string | null; country: string | null;
}

const eur = (cents: number) =>
  `€${(cents / 100).toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function GrowthDashboard() {
  const { user, loading } = useAuth();
  const [data, setData]     = useState<Dashboard | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const [dash, log] = await Promise.all([
      supabase.rpc("get_growth_dashboard"),
      supabase.rpc("get_event_log", { p_limit: 120, p_severity: filter, p_venue: null }),
    ]);
    setBusy(false);
    if (dash.error) {
      setError(
        dash.error.message.includes("Admin")
          ? "Admin privileges required — your account isn't in app_admins."
          : dash.error.message,
      );
      return;
    }
    setError("");
    setData(dash.data as Dashboard);
    setEvents((log.data as EventRow[]) ?? []);
  }, [filter]);

  useEffect(() => { if (!loading && user) load(); }, [loading, user, load]);

  // Refresh every 60s — this is a screen you leave open during a send.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user, load]);

  if (loading) return <Shell><p style={{ color: BRAND.muted }}>Loading…</p></Shell>;
  if (!user)   return <Shell><p style={{ color: BRAND.muted }}>Sign in to continue.</p></Shell>;
  if (error)   return <Shell><p style={{ color: "#FF6A6A" }}>{error}</p></Shell>;
  if (!data)   return <Shell><p style={{ color: BRAND.muted }}>Loading dashboard…</p></Shell>;

  const health = data.system_errors_24h + data.provisioning_failures;

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-8 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Growth</h1>
          <p className="text-xs mt-1" style={{ color: BRAND.dim }}>
            Venue business · updated {new Date(data.generated_at).toLocaleTimeString()}
            {busy ? " · refreshing" : ""}
          </p>
        </div>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded"
                style={{ color: BRAND.muted, border: `1px solid ${BRAND.hairline}` }}>
          Refresh
        </button>
      </div>

      {/* Health strip — only rendered when something is wrong */}
      {health > 0 && (
        <div className="mb-8 px-4 py-3 rounded"
             style={{ background: "rgba(255,106,106,0.08)", border: "1px solid rgba(255,106,106,0.3)" }}>
          <span style={{ color: "#FF6A6A", fontWeight: 700 }}>{health} problem{health === 1 ? "" : "s"} need attention</span>
          <span style={{ color: BRAND.muted }} className="text-sm">
            {" — "}{data.provisioning_failures} provisioning failure{data.provisioning_failures === 1 ? "" : "s"},{" "}
            {data.system_errors_24h} system error{data.system_errors_24h === 1 ? "" : "s"} in 24h
          </span>
        </div>
      )}

      {/* Revenue — the only gold on the page */}
      <Section title="Revenue">
        <Stat label="MRR"                  value={eur(data.mrr_cents)}         gold big />
        <Stat label="MRR from paying"      value={eur(data.mrr_cents_paying)}  gold />
        <Stat label="Active subscriptions" value={data.active_subscriptions}   gold />
        <Stat label="Trials running"       value={data.trials} />
        <Stat label="Past due"             value={data.past_due}     warn={data.past_due > 0} />
        <Stat label="Failed payments 30d"  value={data.failed_payments_30d} warn={data.failed_payments_30d > 0} />
        <Stat label="Churned"              value={data.churned} />
        <Stat label="Churn rate"           value={`${data.churn_rate}%`} />
      </Section>

      {/* Funnel */}
      <Section title="Funnel">
        <Stat label="Prospects"        value={data.prospects.toLocaleString()} big />
        <Stat label="Verified emails"  value={data.verified_emails.toLocaleString()} />
        <Stat label="Awaiting enrichment" value={data.awaiting_enrichment.toLocaleString()} />
        <Stat label="Emails sent today" value={data.emails_sent_today.toLocaleString()} big />
        <Stat label="Emails sent total" value={data.emails_sent_total.toLocaleString()} />
        <Stat label="Open rate"        value={`${data.open_rate}%`} />
        <Stat label="Reply rate"       value={`${data.reply_rate}%`} />
        <Stat label="Replies"          value={data.replies_total.toLocaleString()} />
        <Stat label="Bounce rate"      value={`${data.bounce_rate}%`} warn={data.bounce_rate > 3} />
        <Stat label="Suppressed"       value={data.suppressed.toLocaleString()} />
      </Section>

      {/* Product */}
      <Section title="Live product">
        <Stat label="Venue leagues"  value={data.venue_leagues} />
        <Stat label="Players"        value={data.players_in_venue_leagues.toLocaleString()} />
        <Stat label="Countries live" value={data.countries_live} />
      </Section>

      {/* Top countries */}
      <Panel title="Top countries">
        {data.top_countries.length === 0
          ? <Empty>No prospects yet — run the Places sweep.</Empty>
          : (
            <Table head={["Country", "Prospects", "Verified", "Emailed", "Replied", "Paid"]}>
              {data.top_countries.map((c) => (
                <tr key={c.country} style={{ borderTop: `1px solid ${BRAND.hairline}` }}>
                  <Td strong>{c.country}</Td>
                  <Td>{c.prospects.toLocaleString()}</Td>
                  <Td>{c.verified.toLocaleString()}</Td>
                  <Td>{c.emailed.toLocaleString()}</Td>
                  <Td>{c.replied.toLocaleString()}</Td>
                  <Td gold>{c.paid.toLocaleString()}</Td>
                </tr>
              ))}
            </Table>
          )}
      </Panel>

      {/* Top sequences */}
      <Panel title="Top performing sequences"
             note="Ranked by reply rate. Only sequences with 25+ sends appear — below that a rate is noise.">
        {data.top_sequences.length === 0
          ? <Empty>No sequence has 25 sends yet.</Empty>
          : (
            <Table head={["Campaign", "Lang", "Step", "Sent", "Open", "Reply"]}>
              {data.top_sequences.map((s, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${BRAND.hairline}` }}>
                  <Td strong>{s.campaign}</Td>
                  <Td>{s.language ?? "—"}</Td>
                  <Td>{s.step}</Td>
                  <Td>{s.sent.toLocaleString()}</Td>
                  <Td>{s.open_rate ?? 0}%</Td>
                  <Td strong>{s.reply_rate ?? 0}%</Td>
                </tr>
              ))}
            </Table>
          )}
      </Panel>

      {/* Event log */}
      <Panel title="Event log">
        <div className="flex gap-2 mb-3 flex-wrap">
          {[null, "error", "warn", "info"].map((s) => (
            <button key={s ?? "all"} onClick={() => setFilter(s)}
              className="text-xs px-2.5 py-1 rounded"
              style={{
                color: filter === s ? BRAND.ink : BRAND.dim,
                border: `1px solid ${filter === s ? BRAND.hairlineStrong : BRAND.hairline}`,
              }}>
              {s ?? "all"}
            </button>
          ))}
        </div>
        {events.length === 0
          ? <Empty>Nothing logged yet.</Empty>
          : (
            <div className="flex flex-col">
              {events.map((e) => (
                <div key={e.id} className="py-2 flex items-baseline gap-3 flex-wrap"
                     style={{ borderTop: `1px solid ${BRAND.hairline}` }}>
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: BRAND.dim }}>
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold"
                        style={{ color: e.severity === "error" ? "#FF6A6A"
                                      : e.severity === "warn" ? BRAND.gold : BRAND.ink }}>
                    {e.label}
                  </span>
                  {e.venue_name && (
                    <span className="text-xs" style={{ color: BRAND.muted }}>
                      {e.venue_name}{e.country ? ` · ${e.country}` : ""}
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: BRAND.dim }}>{e.source}</span>
                  {detailLine(e.detail) && (
                    <span className="text-[11px] truncate max-w-full" style={{ color: BRAND.dim }}>
                      {detailLine(e.detail)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
      </Panel>
    </Shell>
  );
}

/** One-line summary of an event's detail payload — keeps the feed scannable. */
function detailLine(detail: Record<string, unknown>): string {
  const keep = ["error", "reason", "fit_score", "campaign", "amount", "job", "step", "why"];
  const parts = keep
    .filter((k) => detail?.[k] !== undefined && detail[k] !== null)
    .map((k) => `${k}: ${String(detail[k]).slice(0, 80)}`);
  return parts.join(" · ");
}

// ── Presentation ──────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BRAND.black, minHeight: "100vh" }}>
      <div className="max-w-6xl mx-auto px-5 py-10">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <p className="text-[11px] uppercase tracking-[0.2em] mb-4" style={{ color: BRAND.dim }}>{title}</p>
      <div className="grid gap-x-8 gap-y-6"
           style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, gold, big, warn }: {
  label: string; value: string | number; gold?: boolean; big?: boolean; warn?: boolean;
}) {
  const color = warn ? "#FF6A6A" : gold ? BRAND.gold : BRAND.ink;
  return (
    <div>
      <div className="tabular-nums font-bold leading-none"
           style={{ color, fontSize: big ? 34 : 24 }}>{value}</div>
      <div className="text-[11px] mt-1.5" style={{ color: BRAND.dim }}>{label}</div>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <p className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: BRAND.dim }}>{title}</p>
      {note && <p className="text-[11px] mb-3" style={{ color: BRAND.dim, opacity: 0.7 }}>{note}</p>}
      <div className={note ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left text-[11px] font-normal pb-2 pr-4 whitespace-nowrap"
                  style={{ color: BRAND.dim }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, strong, gold }: { children: React.ReactNode; strong?: boolean; gold?: boolean }) {
  return (
    <td className="py-2 pr-4 tabular-nums whitespace-nowrap"
        style={{ color: gold ? BRAND.gold : strong ? BRAND.ink : BRAND.muted,
                 fontWeight: strong || gold ? 600 : 400 }}>
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm py-3" style={{ color: BRAND.dim }}>{children}</p>;
}
