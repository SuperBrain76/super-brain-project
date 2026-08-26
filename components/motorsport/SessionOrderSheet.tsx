"use client";

/**
 * SessionOrderSheet — the Grand Prix weekend prediction sheet (F1).
 *
 * The ordering counterpart of MatchweekSheet: one GP round = two session
 * cards (Qualifying, Race), each taking a TOP-5 board. The interaction is
 * five taps: tapping a driver chip fills the lowest empty slot; tapping a
 * filled slot clears it (and everything below stays put). Autosaves the
 * moment the fifth slot fills — same optimistic, per-session status model
 * as MatchweekSheet, and the same visual tokens (predict-shell light theme).
 *
 * Scoring reminder shown on the card: 5 exact positions → 5 pts,
 * 3–4 → 3, 1–2 → 2 (see lib/orderingModel.ts / migration 073).
 *
 * Sessions lock at their own start time (the DB deadline trigger treats a
 * session start exactly like a kickoff), so Sunday's race stays open after
 * Saturday's qualifying settles. Settled sessions show the official top 5
 * with the user's hits highlighted.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fixture, Team } from "@/lib/predictor";
import { upsertOrderingPrediction, setBanker } from "@/lib/predictor";
import { getEntrantResults, type EntrantResult } from "@/lib/motorsport";
import { orderingHits, pointsForHits, ORDERING_SLOTS } from "@/lib/orderingModel";
import { f1DriverByCode } from "@/lib/f1/drivers2026";
import { track } from "@/lib/analytics";
import { localZoneLabel } from "@/lib/localTime";

// ── Tokens (predict-shell light theme — same as MatchweekSheet) ──
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const CARD   = "#ffffff";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const OK     = "#1a7a4a";
const ERRC   = "#c0392b";

type RowStatus = "idle" | "saving" | "saved" | "error";

export type SaveOrdering = (fixtureId: string, order: string[]) => Promise<{ error: string | null }>;

export default function SessionOrderSheet({
  fixtures,
  entrants,
  roundLabel,
  onChanged,
  onSave = upsertOrderingPrediction,
  onSetBanker = setBanker,
  clock = Date.now,
  nextHref,
  nextLabel,
  prevHref,
  prevLabel,
}: {
  /** The round's session fixtures (qualifying + race), kickoff ascending. */
  fixtures:   Fixture[];
  /** The grid — this competition's teams rows (drivers). */
  entrants:   Team[];
  roundLabel: string;
  onChanged?: () => void;
  onSave?:    SaveOrdering;
  onSetBanker?: (fixtureId: string, isBanker: boolean) => Promise<{ error: string | null }>;
  clock?:     () => number;
  nextHref?:  string;
  nextLabel?: string;
  prevHref?:  string;
  prevLabel?: string;
}) {
  // Local optimistic boards, keyed by fixture id. A board is 0..5 team ids.
  const [boards, setBoards] = useState<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>();
    for (const f of fixtures) if (f.myOrdering) m.set(f.id, f.myOrdering.order);
    return m;
  });
  const [status, setStatus] = useState<Map<string, RowStatus>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [nowMs, setNowMs]   = useState(() => clock());
  const [banker, setBankerId] = useState<string | null>(
    () => fixtures.find((f) => f.myOrdering?.isBanker)?.id ?? null,
  );
  const [results, setResults] = useState<Map<string, EntrantResult[]>>(new Map());

  useEffect(() => {
    const t = setInterval(() => setNowMs(clock()), 30_000);
    return () => clearInterval(t);
  }, [clock]);

  // Merge server predictions if the parent reloads.
  useEffect(() => {
    setBoards((prev) => {
      const m = new Map(prev);
      for (const f of fixtures) {
        if (f.myOrdering && !m.has(f.id)) m.set(f.id, f.myOrdering.order);
      }
      return m;
    });
  }, [fixtures]);

  // Official classifications for settled sessions.
  useEffect(() => {
    const settled = fixtures.filter((f) => f.status === "completed").map((f) => f.id);
    if (settled.length === 0) return;
    let alive = true;
    void getEntrantResults(settled).then((m) => { if (alive) setResults(m); });
    return () => { alive = false; };
  }, [fixtures]);

  const teamById = useMemo(() => new Map(entrants.map((t) => [t.id, t])), [entrants]);

  const setRowStatus = useCallback((id: string, s: RowStatus) => {
    setStatus((prev) => new Map(prev).set(id, s));
  }, []);

  const save = useCallback(async (fixtureId: string, order: string[]) => {
    setRowStatus(fixtureId, "saving");
    const { error } = await onSave(fixtureId, order);
    if (error) {
      setRowStatus(fixtureId, "error");
      setErrors((prev) => new Map(prev).set(fixtureId, error));
      // Revert to the server board for this one session.
      const f = fixtures.find((x) => x.id === fixtureId);
      setBoards((prev) => {
        const m = new Map(prev);
        if (f?.myOrdering) m.set(fixtureId, f.myOrdering.order); else m.delete(fixtureId);
        return m;
      });
      return;
    }
    setErrors((prev) => { const m = new Map(prev); m.delete(fixtureId); return m; });
    setRowStatus(fixtureId, "saved");
    track.f1SessionPredicted(fixtureId);
    onChanged?.();
  }, [onSave, fixtures, onChanged, setRowStatus]);

  const isOpen = useCallback((f: Fixture) =>
    f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > nowMs, [nowMs]);

  // Tap a driver chip → fill the lowest empty slot; autosave on the fifth.
  const pickDriver = useCallback((f: Fixture, teamId: string) => {
    if (!isOpen(f)) return;
    setBoards((prev) => {
      const m = new Map(prev);
      const cur = [...(m.get(f.id) ?? [])];
      if (cur.includes(teamId) || cur.length >= ORDERING_SLOTS) return prev;
      cur.push(teamId);
      m.set(f.id, cur);
      if (cur.length === ORDERING_SLOTS) void save(f.id, cur);
      return m;
    });
  }, [isOpen, save]);

  // Tap a filled slot → remove that driver (positions below shift up).
  const clearSlot = useCallback((f: Fixture, index: number) => {
    if (!isOpen(f)) return;
    setBoards((prev) => {
      const m = new Map(prev);
      const cur = [...(m.get(f.id) ?? [])];
      if (index >= cur.length) return prev;
      cur.splice(index, 1);
      m.set(f.id, cur);
      return m;
    });
    setRowStatus(f.id, "idle");
  }, [isOpen, setRowStatus]);

  const onBanker = useCallback(async (f: Fixture) => {
    if (!isOpen(f)) return;
    const next = banker === f.id ? null : f.id;
    const prevBanker = banker;
    setBankerId(next);
    const { error } = await onSetBanker(f.id, next === f.id);
    if (error) setBankerId(prevBanker);
  }, [banker, isOpen, onSetBanker]);

  const zone = localZoneLabel();

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <header className="pt-6 pb-4">
        <h1 className="text-[22px] font-extrabold" style={{ color: TEXT1 }}>{roundLabel}</h1>
        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
          Pick the top five, in order — qualifying on Saturday, the race on Sunday.
          Predictions lock when each session starts{zone ? ` (times in ${zone})` : ""}.
        </p>
      </header>

      {fixtures.map((f) => {
        const board = boards.get(f.id) ?? [];
        const open = isOpen(f);
        const label = sessionLabelFromFixture(f);
        const st = status.get(f.id) ?? "idle";
        const err = errors.get(f.id);
        const official = results.get(f.id) ?? [];
        const officialTop5 = official.filter((r) => r.position <= ORDERING_SLOTS).map((r) => r.teamId);
        const settled = f.status === "completed" && officialTop5.length === ORDERING_SLOTS;
        const hits = settled && board.length === ORDERING_SLOTS ? orderingHits(board, officialTop5) : null;

        return (
          <section key={f.id} className="rounded-2xl mb-5 overflow-hidden border"
                   style={{ background: CARD, borderColor: BORDER }}>
            {/* Session header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <div>
                <div className="text-[15px] font-extrabold" style={{ color: TEXT1 }}>{label}</div>
                <div className="text-[11px]" style={{ color: MUTED }}>
                  {fmtKickoff(f.kicksOffAt)}{f.venue ? ` · ${f.venue.replace(/ — (Qualifying|Race)$/, "")}` : ""}
                </div>
              </div>
              {open && (
                <button onClick={() => void onBanker(f)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-full border"
                        style={banker === f.id
                          ? { color: "#fff", background: GOLD, borderColor: GOLD }
                          : { color: GOLD, borderColor: BORDER }}>
                  {banker === f.id ? "★ Banker ×2" : "☆ Banker"}
                </button>
              )}
              {!open && f.status !== "completed" && (
                <span className="text-[11px] font-bold" style={{ color: MUTED }}>Locked</span>
              )}
              {settled && f.myOrdering?.pointsAwarded != null && (
                <span className="text-[12px] font-extrabold" style={{ color: f.myOrdering.pointsAwarded > 0 ? OK : MUTED }}>
                  +{f.myOrdering.pointsAwarded} pts{f.myOrdering.isBanker ? " ★" : ""}
                </span>
              )}
            </div>

            {/* The five slots */}
            <div className="px-4 pb-3">
              {Array.from({ length: ORDERING_SLOTS }, (_, i) => {
                const teamId = board[i];
                const team = teamId ? teamById.get(teamId) : undefined;
                const reg = team ? f1DriverByCode(team.code) : undefined;
                const officialTeam = settled ? teamById.get(officialTop5[i]) : undefined;
                const hit = settled && teamId != null && teamId === officialTop5[i];

                return (
                  <button key={i}
                          onClick={() => teamId != null && clearSlot(f, i)}
                          disabled={!open || teamId == null}
                          className="w-full flex items-center gap-3 py-2 border-b last:border-b-0 text-left"
                          style={{ borderColor: "#eef2ea" }}>
                    <span className="w-7 text-[12px] font-extrabold" style={{ color: MUTED }}>P{i + 1}</span>
                    {team ? (
                      <>
                        <Monogram code={team.code} color={reg?.primary} />
                        <span className="flex-1 text-[14px] font-bold truncate"
                              style={{ color: settled ? (hit ? OK : TEXT2) : TEXT1 }}>
                          {team.name}
                          <span className="ml-1.5 text-[11px] font-semibold" style={{ color: MUTED }}>
                            {team.groupName ?? ""}
                          </span>
                        </span>
                        {settled ? (
                          <span className="text-[11px] font-bold" style={{ color: hit ? OK : MUTED }}>
                            {hit ? "✓ exact" : officialTeam ? `${officialTeam.code} was P${i + 1}` : ""}
                          </span>
                        ) : open ? (
                          <span className="text-[11px]" style={{ color: MUTED }}>tap to clear</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="flex-1 text-[13px]" style={{ color: settled ? TEXT2 : "#b9c6bc" }}>
                        {settled && officialTeam ? `${officialTeam.name} (official)` : open ? "Tap a driver below" : "—"}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Status line */}
              <div className="pt-2 text-[11px] font-semibold" style={{ color: st === "error" ? ERRC : st === "saved" ? OK : MUTED }}>
                {st === "saving" && "Saving…"}
                {st === "saved" && "Saved ✓"}
                {st === "error" && (err ?? "Could not save — try again.")}
                {st === "idle" && open && board.length > 0 && board.length < ORDERING_SLOTS &&
                  `${board.length}/${ORDERING_SLOTS} picked — ${ORDERING_SLOTS - board.length} to go`}
                {st === "idle" && open && board.length === 0 &&
                  "5 exact = 5 pts · 3–4 exact = 3 · 1–2 exact = 2"}
                {settled && hits != null &&
                  `${hits}/${ORDERING_SLOTS} exact positions → ${pointsForHits(hits)} pts${f.myOrdering?.isBanker ? " ×2 banker" : ""}`}
              </div>
            </div>

            {/* The grid of drivers */}
            {open && board.length < ORDERING_SLOTS && (
              <div className="px-3 pb-3.5 pt-1 flex flex-wrap gap-1.5 border-t" style={{ borderColor: "#eef2ea" }}>
                {entrants.map((t) => {
                  const picked = board.includes(t.id);
                  const reg = f1DriverByCode(t.code);
                  return (
                    <button key={t.id}
                            onClick={() => pickDriver(f, t.id)}
                            disabled={picked}
                            className="px-2.5 py-1.5 rounded-full text-[12px] font-bold border"
                            style={picked
                              ? { color: "#c3cec5", borderColor: "#eef2ea", background: "#fafcf8" }
                              : { color: "#fff", background: reg?.primary ?? TEXT2, borderColor: reg?.primary ?? TEXT2 }}>
                      {t.code}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Round navigation */}
      {(prevHref || nextHref) && (
        <nav className="flex justify-between pt-2">
          {prevHref ? (
            <Link href={prevHref} className="text-[12px] font-bold" style={{ color: TEXT2 }}>← {prevLabel ?? "Previous"}</Link>
          ) : <span />}
          {nextHref ? (
            <Link href={nextHref} className="text-[12px] font-bold" style={{ color: TEXT2 }}>{nextLabel ?? "Next"} →</Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────

function Monogram({ code, color }: { code: string; color?: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full text-[10px] font-extrabold"
          style={{ width: 26, height: 26, background: color ?? "#44584a", color: "#fff" }}>
      {code}
    </span>
  );
}

/** "Qualifying" / "Race" from the fixture's constructed provider identity or venue suffix. */
function sessionLabelFromFixture(f: Fixture): string {
  if (f.venue?.endsWith("Qualifying")) return "Qualifying — top 5 grid";
  if (f.venue?.endsWith("Race")) return "Race — top 5 finish";
  return "Session";
}

function fmtKickoff(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
