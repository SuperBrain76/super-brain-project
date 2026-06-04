/**
 * League name validation and normalization.
 *
 * All validation happens here — import this module in both the client
 * (immediate feedback) and in lib/predictor.ts (server-side enforcement
 * before any DB insert).
 *
 * Rules enforced:
 *   1. Length: 2–40 characters (after trimming)
 *   2. No URLs (http://, https://, www., common TLDs)
 *   3. No email addresses
 *   4. No phone numbers (7+ digit sequences)
 *   5. No excessive special characters (max 5, or max 40% of length)
 *   6. Profanity / racial slur filter (case-insensitive, leetspeak-aware)
 *
 * Two names are stored:
 *   original_name   — exactly what the user typed (after whitespace trim/collapse)
 *   normalized_name — lowercase, diacritics removed, whitespace collapsed;
 *                     used for display consistency and future dedup checks
 */

// ── Result type ───────────────────────────────────────────────────────────────

export interface NameValidationResult {
  valid:          boolean;
  error?:         string;
  normalizedName?: string;   // only present when valid === true
}

// ── Blocked terms ─────────────────────────────────────────────────────────────
// Covers: racial/ethnic slurs, homophobic/transphobic slurs, ableist slurs,
// common profanity, and extremist identifiers.
// Check is performed against an aggressively-normalised version of the input
// (diacritics stripped, leetspeak substituted, non-alpha removed) so that
// variations like "f4gg0t", "sh!t", or "nîgger" are also caught.

const BLOCKED_TERMS: readonly string[] = [
  // ── Racial / ethnic slurs ─────────────────────────────────────────────────
  "nigger", "nigga", "nig", "negro", "coon", "spook", "spade", "darkie",
  "kike", "yid", "heeb", "hymie",
  "spic", "spick", "wetback", "beaner",
  "chink", "gook", "nip", "jap", "zipperhead", "slant", "slope",
  "raghead", "sandnigger", "cameljokey",
  "cracker", "honky",
  "wop", "dago", "guinea", "greaseball",
  "mick", "paddy",
  "polack",
  "gyp", "gypo",
  "redskin", "injun",
  "paki",
  "zipperhead",
  // ── Homophobic / transphobic ──────────────────────────────────────────────
  "faggot", "fagg", "fag",
  "dyke",
  "tranny",
  "shemale",
  // ── Ableist ──────────────────────────────────────────────────────────────
  "retard", "retarded",
  "spastic",
  // ── Sexual profanity ─────────────────────────────────────────────────────
  "fuck", "fucker", "fucked", "fuckhead",
  "shit", "bullshit",
  "cunt",
  "cock", "dickhead", "dick",
  "pussy",
  "whore", "slut",
  "bitch",
  "bastard",
  "motherfucker", "mofo",
  "asshole", "arsehole",
  "piss", "pissed",
  "wanker",
  "twat",
  // ── Extremist / violent ───────────────────────────────────────────────────
  "hitler",
  "nazi", "nazism",
  "kkk",
  "rape", "rapist",
  "pedophile", "paedophile", "pedo", "paedo", "nonce",
  "genocide",
  "terrorist",
];

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Storage normalization — used for the `normalized_name` column.
 * Preserves the spirit of the original name but makes it consistent:
 * lowercase, diacritics removed, internal whitespace collapsed.
 */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    // Decompose combined characters (é → e + combining accent)
    .normalize("NFD")
    // Strip combining diacritical marks (U+0300–U+036F)
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Aggressive normalization for profanity checking only — NOT for storage.
 * Applies leetspeak substitutions and strips all non-alpha characters so
 * that "sh!t", "5h1t", "ƒüçk" etc. are still matched.
 */
function normalizeForCheck(raw: string): string {
  return normalizeName(raw)
    // Common leetspeak digit/symbol substitutions
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/\+/g, "t")
    .replace(/!/g, "i")
    // Remove everything that isn't a plain letter
    .replace(/[^a-z]/g, "");
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateLeagueName(raw: string): NameValidationResult {
  const trimmed = raw.trim().replace(/\s+/g, " ");

  // ── 1. Length ───────────────────────────────────────────────────────────────
  if (trimmed.length < 2) {
    return { valid: false, error: "League name must be at least 2 characters." };
  }
  if (trimmed.length > 40) {
    return { valid: false, error: "League name must be 40 characters or fewer." };
  }

  // ── 2. No URLs ──────────────────────────────────────────────────────────────
  if (
    /https?:\/\//i.test(trimmed) ||
    /\bwww\./i.test(trimmed) ||
    // Bare domain patterns: word.tld or word.tld/path
    /\b\w{2,}\.(com|net|org|io|co|uk|app|gg|tv|me|info|site|club|online)\b/i.test(trimmed)
  ) {
    return { valid: false, error: "League names cannot contain URLs." };
  }

  // ── 3. No email addresses ───────────────────────────────────────────────────
  if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    return { valid: false, error: "League names cannot contain email addresses." };
  }

  // ── 4. No phone numbers ─────────────────────────────────────────────────────
  // Matches 7+ digit sequences optionally separated by spaces, dashes, or dots.
  if (/\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d/.test(trimmed)) {
    return { valid: false, error: "League names cannot contain phone numbers." };
  }

  // ── 5. Excessive special characters ────────────────────────────────────────
  // Strip alphanumeric, whitespace, and accented Latin characters — what remains
  // counts as "special". Block if > 5 special chars OR > 40% of total length.
  const specials = trimmed.replace(/[a-zA-Z0-9\sÀ-ɏ]/g, "");
  if (specials.length > 5 || specials.length / trimmed.length > 0.4) {
    return { valid: false, error: "League name contains too many special characters." };
  }

  // ── 6. Profanity / slur check ───────────────────────────────────────────────
  const checkStr = normalizeForCheck(trimmed);
  const hit = BLOCKED_TERMS.find((term) =>
    checkStr.includes(term.replace(/[^a-z]/g, "")),
  );
  if (hit) {
    return {
      valid: false,
      error: "League name contains disallowed words. Please choose a different name.",
    };
  }

  // ── All checks passed ───────────────────────────────────────────────────────
  return {
    valid: true,
    normalizedName: normalizeName(trimmed),
  };
}
