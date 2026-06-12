"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { nameToFlag } from "@/lib/countries";
import {
  getLeague,
  isLeagueMember,
  joinLeague,
  joinPublicLeague,
  getLeagueLeaderboard,
  getLeagueMemberCount,
  getLeagueMembers,
  getCompetition,
  getMyStats,
  renameLeague,
  setLeagueVisibility,
  deleteLeague,
  leaveLeague,
  type PredictionLeague,
  type LeaderboardRow,
  type LeagueMember,
  type MyStats,
} from "@/lib/predictor";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Helpers ───────────────────────────────────────────────────
const SITE = "https://www.superbrain.social";
function inviteUrl(code: string) { return `${SITE}/predict/leagues/join?code=${code}`; }
function whatsappUrl(league: PredictionLeague) {
  const msg = `Join my "${league.name}" World Cup Predictor league on SuperBrain!\n\nUse code: ${league.inviteCode}\nOr join here: ${inviteUrl(league.inviteCode)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
const WHATSAPP_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text, label = "Copy", onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    onCopied?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-[10px] px-2.5 py-1 rounded-full transition-all shrink-0 font-semibold"
      style={{
        color:       copied ? GREEN        : TEXT2,
        borderColor: copied ? `${GREEN}40` : BORDER,
        background:  copied ? `${GREEN}10` : BG,
        border:      `1px solid ${copied ? `${GREEN}40` : BORDER}`,
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

// ── Rank badge ────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: GOLD, background: `${GOLD}18` }}>1</span>
  );
  if (rank === 2) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: "#8899aa", background: "#8899aa15" }}>2</span>
  );
  if (rank === 3) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: "#cd7c32", background: "#cd7c3215" }}>3</span>
  );
  return (
    <span className="w-7 h-7 flex items-center justify-center text-xs" style={{ color: MUTED }}>
      {rank}
    </span>
  );
}

// ── Leaderboard table ─────────────────────────────────────────
function LeaderboardTable({ rows, currentUserId, ownerId }: {
  rows: LeaderboardRow[]; currentUserId: string | null; ownerId: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center px-4">
        <p className="text-sm" style={{ color: TEXT2 }}>Standings will appear after predictions are scored.</p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>Results are entered after each match.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
        <div className="w-7 shrink-0" />
        <span className="flex-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Player</span>
        <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: MUTED }}>Match</span>
        <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: GOLD }}>Bonus</span>
        <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold" style={{ color: GREEN }}>Total</span>
      </div>
      {rows.map((row) => {
        const isMe    = row.userId === currentUserId;
        const isOwner = row.userId === ownerId;
        return (
          <Link
            key={`${row.rank}-${row.displayName}`}
            href={`/predict/user/${row.userId}`}
            className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-[#f6f9f5]"
            style={{
              borderBottom: `1px solid ${BORDER}`,
              background:   isMe ? "#eef3ec" : undefined,
              borderLeft:   isMe ? `3px solid ${GREEN}` : "3px solid transparent",
              display:      "flex",
            }}
          >
            <RankBadge rank={row.rank} />
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              {row.country && nameToFlag(row.country) && (
                <span className="text-sm shrink-0">{nameToFlag(row.country)}</span>
              )}
              <span className="text-sm font-medium truncate" style={{ color: TEXT1 }}>{row.displayName}</span>
              {isOwner && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ color: GOLD, background: `${GOLD}15` }}>👑 CAPTAIN</span>
              )}
              {isMe && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}30` }}>YOU</span>
              )}
            </div>
            <span className="w-12 text-right text-xs tabular-nums hidden sm:block"
              style={{ color: row.matchPoints > 0 ? TEXT2 : MUTED }}>
              {row.matchPoints}
            </span>
            <span className="w-12 text-right text-xs tabular-nums hidden sm:block"
              style={{ color: row.bonusPoints > 0 ? GOLD : MUTED }}>
              {row.bonusPoints > 0 ? `+${row.bonusPoints}` : "—"}
            </span>
            <span className="w-12 text-right font-bold text-sm tabular-nums"
              style={{ color: row.totalPoints > 0 ? GREEN : MUTED }}>
              {row.totalPoints}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Members list ──────────────────────────────────────────────
function MembersList({ members, currentUserId }: { members: LeagueMember[]; currentUserId: string | null; }) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm" style={{ color: TEXT1 }}>Members</h2>
        <div className="p-6 text-center rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: TEXT2 }}>No members found.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold text-sm" style={{ color: TEXT1 }}>Members</h2>
      <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        {members.map((m, i) => {
          const isMe = m.userId === currentUserId;
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom: `1px solid ${BORDER}`,
                background:   isMe ? "#eef3ec" : undefined,
                borderLeft:   isMe ? `3px solid ${GREEN}` : "3px solid transparent",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: isMe ? `${GREEN}15` : BG, color: isMe ? GREEN : MUTED }}
              >
                {m.displayName[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                {m.country && nameToFlag(m.country) && (
                  <span className="text-sm shrink-0">{nameToFlag(m.country)}</span>
                )}
                <span className="text-sm font-medium truncate" style={{ color: TEXT1 }}>{m.displayName}</span>
                {m.isOwner && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ color: GOLD, background: `${GOLD}15` }}>👑 CAPTAIN</span>
                )}
                {isMe && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}30` }}>YOU</span>
                )}
              </div>
              {m.joinedAt && (
                <span className="text-[10px] shrink-0" style={{ color: MUTED }}>
                  {new Date(m.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              <span className="text-[10px] w-5 text-right shrink-0" style={{ color: MUTED }}>{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Leave League Modal ────────────────────────────────────────
function LeaveModal({ league, isOwner, memberCount, onConfirm, onCancel, leaving, leaveError }: {
  league: PredictionLeague; isOwner: boolean; memberCount: number;
  onConfirm: () => void; onCancel: () => void; leaving: boolean; leaveError: string | null;
}) {
  const ownerBlocked = isOwner && memberCount > 1;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,31,23,0.55)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: TEXT1 }}>Leave league</span>
          </div>
          <button onClick={onCancel} style={{ color: MUTED }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {ownerBlocked ? (
            <>
              <p className="text-sm font-semibold" style={{ color: TEXT1 }}>You&apos;re the captain</p>
              <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
                You cannot leave <span className="font-medium" style={{ color: TEXT1 }}>{league.name}</span> while other members are in it.
              </p>
              <div className="rounded-lg px-3 py-2.5 flex flex-col gap-1" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <p className="text-xs font-semibold" style={{ color: TEXT2 }}>To leave, first either:</p>
                <p className="text-xs" style={{ color: MUTED }}>· Transfer ownership to another member</p>
                <p className="text-xs" style={{ color: MUTED }}>· Delete the league from Owner Settings</p>
              </div>
              <button onClick={onCancel} className="self-stretch text-sm py-2.5 rounded-lg transition-colors"
                style={{ border: `1px solid ${BORDER}`, color: TEXT2, background: BG }}>
                Got it
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
                Are you sure you want to leave{" "}
                <span className="font-medium" style={{ color: TEXT1 }}>{league.name}</span>?
              </p>
              {(league.visibility === "public" || league.isFeatured) ? (
                <p className="text-xs" style={{ color: MUTED }}>This is a public league — you can rejoin at any time from Discover.</p>
              ) : (
                <p className="text-xs" style={{ color: MUTED }}>This is a private league. You&apos;ll need the invite link or code to rejoin.</p>
              )}
              {leaveError && <p className="text-xs text-red-600">{leaveError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onConfirm} disabled={leaving}
                  className="flex-1 text-sm py-2.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#c0392b" }}
                >
                  {leaving ? "Leaving…" : "Yes, leave"}
                </button>
                <button onClick={onCancel} disabled={leaving}
                  className="flex-1 text-sm py-2.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ border: `1px solid ${BORDER}`, color: TEXT2, background: BG }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Owner controls ────────────────────────────────────────────
function OwnerControls({ league, onRenamed, onVisibilityChanged, onDeleted }: {
  league: PredictionLeague; onRenamed: (n: string) => void;
  onVisibilityChanged: (v: "private" | "public") => void; onDeleted: () => void;
}) {
  const [open,       setOpen]       = useState(false);
  const [newName,    setNewName]    = useState(league.name);
  const [renaming,   setRenaming]   = useState(false);
  const [renameErr,  setRenameErr]  = useState<string | null>(null);
  const [renameOk,   setRenameOk]   = useState(false);
  const [toggling,   setToggling]   = useState(false);
  const [toggleErr,  setToggleErr]  = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [deleteErr,  setDeleteErr]  = useState<string | null>(null);

  const handleRename = async () => {
    if (newName.trim() === league.name) { setRenameErr(null); return; }
    setRenaming(true); setRenameErr(null); setRenameOk(false);
    const { error } = await renameLeague(league.id, newName);
    setRenaming(false);
    if (error) { setRenameErr(error); return; }
    setRenameOk(true);
    onRenamed(newName.trim());
    setTimeout(() => setRenameOk(false), 2500);
  };

  const handleToggleVisibility = async () => {
    const next = league.visibility === "private" ? "public" : "private";
    setToggling(true); setToggleErr(null);
    const { error } = await setLeagueVisibility(league.id, next);
    setToggling(false);
    if (error) { setToggleErr(error); return; }
    onVisibilityChanged(next);
  };

  const handleDelete = async () => {
    setDeleting(true); setDeleteErr(null);
    const { error } = await deleteLeague(league.id);
    setDeleting(false);
    if (error) { setDeleteErr(error); return; }
    onDeleted();
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ background: open ? CARD : BG }}
      >
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>Owner settings</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="flex flex-col" style={{ background: CARD, borderTop: `1px solid ${BORDER}` }}>

          {/* Rename */}
          <div className="px-4 py-4 flex flex-col gap-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <p className="text-xs font-semibold" style={{ color: TEXT2 }}>Rename league</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setRenameErr(null); setRenameOk(false); }}
                onKeyDown={(e) => e.key === "Enter" && !renaming && handleRename()}
                maxLength={40}
                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT1 }}
              />
              <button
                onClick={handleRename}
                disabled={renaming || !newName.trim() || newName.trim() === league.name}
                className="text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                style={{ border: `1px solid ${BORDER}`, color: TEXT2, background: BG }}
              >
                {renaming ? "Saving…" : "Save"}
              </button>
            </div>
            {renameErr && <p className="text-xs text-red-600">{renameErr}</p>}
            {renameOk  && <p className="text-xs font-semibold" style={{ color: GREEN }}>✓ Renamed</p>}
          </div>

          {/* Visibility toggle */}
          <div className="px-4 py-4 flex items-center justify-between gap-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: TEXT2 }}>Visibility</p>
              <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                {league.visibility === "private"
                  ? "Invite-only · not listed publicly"
                  : "Listed on Discover · anyone can join"}
              </p>
            </div>
            <button
              onClick={handleToggleVisibility}
              disabled={toggling || league.isFeatured}
              title={league.isFeatured ? "Featured leagues cannot be made private" : undefined}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
              style={{
                border:      `1px solid ${league.visibility === "private" ? BORDER : `${GREEN}40`}`,
                color:       league.visibility === "private" ? TEXT2 : GREEN,
                background:  league.visibility === "private" ? BG    : `${GREEN}10`,
              }}
            >
              {toggling ? "…" : league.visibility === "private" ? "🔒 Private" : "🌐 Public"}
            </button>
            {toggleErr && <p className="text-xs text-red-600">{toggleErr}</p>}
          </div>

          {/* Delete */}
          <div className="px-4 py-4 flex flex-col gap-2">
            <p className="text-xs font-semibold" style={{ color: TEXT2 }}>Delete league</p>
            <p className="text-[10px]" style={{ color: MUTED }}>Permanently removes the league and all member records. Cannot be undone.</p>
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="self-start text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: "1px solid #fca5a5", color: "#c0392b", background: "#fef2f2" }}
              >
                Delete league
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-red-600">Are you sure? This cannot be undone.</p>
                <button
                  onClick={handleDelete} disabled={deleting}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ border: "1px solid #fca5a5", color: "#c0392b", background: "#fef2f2" }}
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ border: `1px solid ${BORDER}`, color: TEXT2, background: BG }}
                >
                  Cancel
                </button>
                {deleteErr && <p className="text-xs text-red-600 w-full">{deleteErr}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function LeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewLeague = searchParams.get("new") === "1";
  const { user, loading: authLoading } = useAuth();

  const [league,      setLeague]      = useState<PredictionLeague | null>(null);
  const [rows,        setRows]        = useState<LeaderboardRow[]>([]);
  const [members,     setMembers]     = useState<LeagueMember[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [isMember,    setIsMember]    = useState<boolean | null>(null);
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const [joining,        setJoining]        = useState(false);
  const [joinError,      setJoinError]      = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving,        setLeaving]        = useState(false);
  const [leaveError,     setLeaveError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true); setError(null);
    const [lg, count] = await Promise.all([getLeague(leagueId), getLeagueMemberCount(leagueId)]);
    if (!lg) { setError("League not found. The link may be invalid."); setLoading(false); return; }
    setLeague(lg); setMemberCount(count);
    if (user) {
      const member = await isLeagueMember(leagueId, user.id);
      setIsMember(member);
      if (member) {
        const [leaderboard, memberList, compResult] = await Promise.all([
          getLeagueLeaderboard(leagueId),
          getLeagueMembers(leagueId),
          getCompetition("wc2026"),
        ]);
        setRows(leaderboard.map((r) => ({ ...r, isMe: r.userId === user.id })));
        setMembers(memberList.map((m) => ({ ...m, isOwner: m.userId === lg.createdBy })));
        if (compResult.competition) {
          const stats = await getMyStats(compResult.competition.id);
          setMyStats(stats);
        }
      }
    } else { setIsMember(false); }
    setLoading(false);
  }, [leagueId, user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const handleJoin = async () => {
    if (!league || !user) return;
    setJoining(true); setJoinError(null);
    const fn = (league.visibility === "public" || league.isFeatured) ? joinPublicLeague : joinLeague;
    const { error: err } = await fn(league.id);
    setJoining(false);
    if (err) { setJoinError(err); return; }
    track.leagueJoined(league.id);
    load();
  };

  const handleLeave = async () => {
    if (!league || !user) return;
    setLeaving(true); setLeaveError(null);
    const { error: err } = await leaveLeague(league.id);
    setLeaving(false);
    if (err) { setLeaveError(err); return; }
    router.replace("/predict/leagues");
  };

  // Loading
  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading…</p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/predict/leagues" className="text-sm hover:underline" style={{ color: GREEN }}>← Back to leagues</Link>
      </div>
    );
  }

  if (!league) return null;

  // Not signed in
  if (!user) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">
          <Breadcrumb leagueName={league.name} />
          <LeagueHeader league={league} memberCount={memberCount} />
          <div className="p-5 text-center flex flex-col gap-3 rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-semibold text-sm" style={{ color: TEXT1 }}>Sign in to view this league</p>
            <p className="text-sm" style={{ color: TEXT2 }}>League leaderboards are only visible to members.</p>
            <Link href="/login" className="py-2.5 rounded-lg font-bold text-sm w-full flex items-center justify-center"
              style={{ background: GREEN, color: "#fff" }}>
              Sign in →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not a member
  if (isMember === false) {
    const isOpen = league.visibility === "public" || league.isFeatured;
    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">
          <Breadcrumb leagueName={league.name} />
          <LeagueHeader league={league} memberCount={memberCount} />
          <div className="p-5 flex flex-col gap-4 rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: TEXT1 }}>You&apos;re not a member of this league</p>
              <p className="text-sm mt-1" style={{ color: TEXT2 }}>
                {isOpen ? "This is a public league — join instantly, no invite code needed."
                        : "Join to see the leaderboard and compete with the other members."}
              </p>
            </div>
            <button onClick={handleJoin} disabled={joining}
              className="py-2.5 rounded-lg font-bold text-sm w-full flex items-center justify-center"
              style={{ background: GREEN, color: "#fff" }}>
              {joining ? "Joining…" : `Join "${league.name}" →`}
            </button>
            {joinError && <p className="text-xs text-red-600">{joinError}</p>}
          </div>
          <Link href="/predict/leagues" className="text-xs text-center hover:underline" style={{ color: MUTED }}>
            ← Back to leagues
          </Link>
        </div>
      </div>
    );
  }

  // Member view
  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        <Breadcrumb leagueName={league.name} />
        <LeagueHeader league={league} memberCount={memberCount} />

        {/* Share / Invite */}
        {(league.visibility === "public" || league.isFeatured) ? (
          <div className="p-4 flex flex-col gap-3 rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Share league</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GREEN }} />
              <p className="text-sm" style={{ color: TEXT2 }}>
                {league.isFeatured ? "Featured league" : "Public league"} · Anyone can join without an invite code.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton text={`${SITE}/predict/leagues/${league.id}`} label="Copy league link" onCopied={() => track.inviteLinkCopied(league.id, "link")} />
              <a href={`https://wa.me/?text=${encodeURIComponent(`Join the "${league.name}" World Cup Predictor league on SuperBrain!\n\n${SITE}/predict/leagues/${league.id}`)}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => track.whatsappShareClicked(league.id)}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={{ color: "#25D366", border: "1px solid #25D36640", background: "#25D36610" }}>
                {WHATSAPP_ICON} WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3 rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Invite friends</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono font-bold text-base tracking-[0.25em]" style={{ color: GREEN }}>
                {league.inviteCode}
              </code>
              <CopyButton text={league.inviteCode}            label="Copy code" onCopied={() => track.inviteLinkCopied(league.id, "code")} />
              <CopyButton text={inviteUrl(league.inviteCode)} label="Copy link" onCopied={() => track.inviteLinkCopied(league.id, "link")} />
              <a href={whatsappUrl(league)} target="_blank" rel="noopener noreferrer"
                onClick={() => track.whatsappShareClicked(league.id)}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={{ color: "#25D366", border: "1px solid #25D36640", background: "#25D36610" }}>
                {WHATSAPP_ICON} WhatsApp
              </a>
            </div>
            <p className="text-[10px]" style={{ color: MUTED }}>
              Only people with this code or link can join — your league stays private.
            </p>
          </div>
        )}

        {/* Referral nudge — shown immediately after creating a new league */}
        {isNewLeague && (
          <div
            className="p-4 flex flex-col gap-3 rounded-xl"
            style={{ background: "#eef8f0", border: `1px solid #86c99a`, borderLeft: `3px solid ${GREEN}` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <p className="font-bold text-sm" style={{ color: GREEN }}>League created! Invite 3 friends to get started.</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#2e4a37" }}>
              Leagues are more fun with friends. Share your invite link or code now — they can join in seconds.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton text={inviteUrl(league.inviteCode)} label="📋 Copy link" onCopied={() => track.inviteLinkCopied(league.id, "link")} />
              <a
                href={whatsappUrl(league)}
                target="_blank" rel="noopener noreferrer"
                onClick={() => track.whatsappShareClicked(league.id)}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full"
                style={{ color: "#25D366", border: "1px solid #25D36640", background: "#25D36610" }}
              >
                {WHATSAPP_ICON} WhatsApp
              </a>
            </div>
            <p className="text-[10px]" style={{ color: "#7a8f82" }}>
              Code: <span className="font-mono font-bold tracking-widest" style={{ color: GREEN }}>{league.inviteCode}</span>
            </p>
          </div>
        )}

        {/* Progress strip */}
        {myStats && (
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl flex-wrap"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold shrink-0" style={{ color: MUTED }}>Your progress</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tabular-nums"
                style={{ color: myStats.predictions >= 104 ? GREEN : TEXT2 }}>
                {myStats.predictions}/104
              </span>
              <span className="text-[10px]" style={{ color: MUTED }}>match predictions</span>
            </div>
            {myStats.bonusTotal > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tabular-nums"
                  style={{ color: myStats.bonusAnswered >= myStats.bonusTotal ? GREEN : TEXT2 }}>
                  {myStats.bonusAnswered}/{myStats.bonusTotal}
                </span>
                <span className="text-[10px]" style={{ color: MUTED }}>bonus questions</span>
              </div>
            )}
          </div>
        )}

        {/* Standings */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm" style={{ color: TEXT1 }}>Standings</h2>
            <span className="text-xs" style={{ color: MUTED }}>Match + Bonus = Total</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <LeaderboardTable rows={rows} currentUserId={user?.id ?? null} ownerId={league.createdBy} />
          </div>
        </div>

        {/* Owner controls */}
        {user?.id === league.createdBy && (
          <OwnerControls
            league={league}
            onRenamed={(name) => setLeague((l) => l ? { ...l, name } : l)}
            onVisibilityChanged={(visibility) => setLeague((l) => l ? { ...l, visibility } : l)}
            onDeleted={() => router.replace("/predict/leagues")}
          />
        )}

        {/* Leave */}
        {isMember && user && (
          <button
            onClick={() => { setLeaveError(null); setShowLeaveModal(true); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid #fca5a5", color: "#c0392b", background: "#fef2f2" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Leave league
          </button>
        )}

        <Link href="/predict/leagues" className="text-xs text-center hover:underline" style={{ color: MUTED }}>
          ← Back to leagues
        </Link>
      </div>

      {showLeaveModal && league && (
        <LeaveModal
          league={league}
          isOwner={user?.id === league.createdBy}
          memberCount={memberCount ?? 0}
          onConfirm={handleLeave}
          onCancel={() => { setShowLeaveModal(false); setLeaveError(null); }}
          leaving={leaving}
          leaveError={leaveError}
        />
      )}
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────
function Breadcrumb({ leagueName }: { leagueName: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
      <Link href="/predict" className="hover:underline" style={{ color: MUTED }}>Predictor</Link>
      <span>/</span>
      <Link href="/predict/leagues" className="hover:underline" style={{ color: MUTED }}>Leagues</Link>
      <span>/</span>
      <span className="truncate max-w-[140px]" style={{ color: TEXT2, fontWeight: 600 }}>{leagueName}</span>
    </div>
  );
}

function LeagueHeader({ league, memberCount }: { league: PredictionLeague; memberCount: number | null; }) {
  const visibilityLabel = league.isFeatured ? "Featured" : league.visibility === "public" ? "Public" : "Private";
  const visibilityColor = league.isFeatured ? GOLD : league.visibility === "public" ? GREEN : MUTED;
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h1 className="text-xl font-extrabold leading-tight" style={{ color: TEXT1 }}>{league.name}</h1>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ color: visibilityColor, border: `1px solid ${visibilityColor}40`, background: `${visibilityColor}12` }}
        >
          {visibilityLabel.toUpperCase()}
        </span>
      </div>
      <p className="text-sm" style={{ color: TEXT2 }}>
        {memberCount === null ? "…" : `${memberCount} member${memberCount !== 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
