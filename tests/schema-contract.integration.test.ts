/**
 * Enum values in TypeScript must be accepted by the database.
 *
 * On 8 Sep 2026 `automated` was added to ReplyClass, the poller and the webhook
 * were updated, 264 unit tests passed, and the code was deployed. Every
 * automated reply would then have failed to insert: venue_replies has a CHECK
 * constraint that still listed only the original five classes. The poller would
 * have swallowed the violation into its errors array and carried on, storing
 * nothing — a silent data loss of exactly the kind this project has spent a week
 * removing.
 *
 * Nothing in a pure-function suite can catch that: the classifier never touches
 * a database. This test does, by reading the constraint itself and checking that
 * every value the type can produce is permitted. It skips when there is no local
 * database URL, so it costs nothing in an environment that cannot run it.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import type { ReplyClass } from "@/lib/replyClassifier";

const URL_FILE = ".supabase-db-url.local";
const d = existsSync(URL_FILE) ? describe : describe.skip;

/**
 * Every member of ReplyClass, written out. The `satisfies` clause is the point:
 * add a class to the union without adding it here and this file stops compiling,
 * so the list cannot silently fall behind the type.
 */
const ALL_REPLY_CLASSES = [
  "positive_interested",
  "automated",
  "neutral",
  "negative",
  "negative_unsubscribe",
  "needs_review",
] as const satisfies readonly ReplyClass[];

d("schema contract: TypeScript enums vs database constraints", () => {
  let client: pg.Client;

  beforeAll(async () => {
    const conn = readFileSync(URL_FILE, "utf8").trim().replace(/^[A-Z_]+=/, "");
    client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
    await client.connect();
  });
  afterAll(async () => { if (client) await client.end(); });

  it("venue_replies.classification accepts every ReplyClass", async () => {
    const { rows } = await client.query(
      `select pg_get_constraintdef(oid) def from pg_constraint
        where conrelid = 'public.venue_replies'::regclass
          and conname = 'venue_replies_classification_chk'`);
    expect(rows.length, "the classification CHECK constraint is missing").toBe(1);

    const def: string = rows[0].def;
    const missing = ALL_REPLY_CLASSES.filter((c) => !def.includes(`'${c}'`));
    expect(
      missing,
      `these ReplyClass values would be rejected by the database: ${missing.join(", ")}. ` +
      `Add a migration before deploying — an insert that violates this constraint is ` +
      `caught and logged by the poller, not surfaced.`,
    ).toEqual([]);
  });

  it("the constraint permits nothing the type does not", async () => {
    // The reverse direction. A value allowed by the database but absent from the
    // union is dead data that no code path will ever read correctly.
    const { rows } = await client.query(
      `select pg_get_constraintdef(oid) def from pg_constraint
        where conrelid = 'public.venue_replies'::regclass
          and conname = 'venue_replies_classification_chk'`);
    const allowed = [...String(rows[0].def).matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
    const extra = allowed.filter((a) => !(ALL_REPLY_CLASSES as readonly string[]).includes(a));
    expect(extra, `the database allows classes the code cannot produce: ${extra.join(", ")}`).toEqual([]);
  });
});
