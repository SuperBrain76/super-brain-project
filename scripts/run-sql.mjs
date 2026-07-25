#!/usr/bin/env node
/**
 * run-sql.mjs — apply a .sql file (or inline SQL) to the database.
 *
 * Connection string is read from, in order:
 *   1. env SUPABASE_DB_URL
 *   2. file .supabase-db-url.local  (gitignored — the only place the secret lives)
 *
 * The string never appears in the terminal output: the host is shown with the
 * password masked, nothing more.
 *
 * Usage:
 *   node scripts/run-sql.mjs --file supabase/migrations/051_competition_lifecycle.sql
 *   node scripts/run-sql.mjs --sql "select version from public.schema_migrations order by version;"
 *
 * Design notes:
 *   • psql meta-commands (\echo, \set) are handled locally — they never reach
 *     Postgres. \echo prints a section header; \set does simple :'var' substitution.
 *   • Files containing dollar-quoted blocks ($$ … $$, DO blocks, functions) are
 *     sent to the server as ONE simple query, exactly as loading a file does, so
 *     DO/PL-pgSQL blocks execute correctly and NOTICEs stream back.
 *   • Files without dollar-quoting (preflight, verify) are split on ; and each
 *     statement's rows are printed as a table.
 */

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

// ── Args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const filePath = arg("--file");
const inlineSql = arg("--sql");
if (!filePath && !inlineSql) {
  console.error("Usage: node scripts/run-sql.mjs --file <path.sql> | --sql \"<sql>\"");
  process.exit(2);
}

// ── Connection string ─────────────────────────────────────────
let connStr = process.env.SUPABASE_DB_URL || "";
if (!connStr && existsSync(".supabase-db-url.local")) {
  connStr = readFileSync(".supabase-db-url.local", "utf8").trim();
}
if (!connStr) {
  console.error(
    "No database connection string.\n" +
    "Put it in .supabase-db-url.local (gitignored) or set SUPABASE_DB_URL.",
  );
  process.exit(2);
}

function maskedHost(u) {
  try {
    const url = new URL(u);
    return `${url.username ? url.username + "@" : ""}${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch { return "(unparseable connection string)"; }
}

// ── Preprocess psql meta-commands ─────────────────────────────
function preprocess(sql) {
  const vars = {};
  const headers = [];
  const lines = sql.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("\\echo")) {
      const m = t.match(/\\echo\s+'([^']*)'/);
      if (m) headers.push(m[1]);
      continue;
    }
    if (t.startsWith("\\set")) {
      const m = t.match(/\\set\s+(\w+)\s+'([^']*)'/);
      if (m) vars[m[1]] = m[2];
      continue;
    }
    if (t.startsWith("\\")) continue; // any other meta-command: skip
    out.push(line);
  }
  let body = out.join("\n");
  for (const [k, v] of Object.entries(vars)) {
    body = body.split(`:'${k}'`).join(`'${v}'`);
  }
  return { body, headers };
}

// ── Dollar-quote aware: does this file contain $tag$ blocks? ──
function hasDollarQuote(sql) {
  return /\$[a-zA-Z_]*\$/.test(sql);
}

// Split top-level statements on ; while respecting dollar-quotes and quotes.
function splitStatements(sql) {
  const stmts = [];
  let cur = "";
  let i = 0;
  let dollarTag = null;
  let inSingle = false, inLine = false, inBlock = false;
  while (i < sql.length) {
    const c = sql[i], c2 = sql[i + 1];
    if (inLine) { if (c === "\n") inLine = false; cur += c; i++; continue; }
    if (inBlock) { if (c === "*" && c2 === "/") { inBlock = false; cur += "*/"; i += 2; continue; } cur += c; i++; continue; }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { cur += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      cur += c; i++; continue;
    }
    if (inSingle) { if (c === "'") inSingle = false; cur += c; i++; continue; }
    if (c === "-" && c2 === "-") { inLine = true; cur += c; i++; continue; }
    if (c === "/" && c2 === "*") { inBlock = true; cur += "/*"; i += 2; continue; }
    if (c === "'") { inSingle = true; cur += c; i++; continue; }
    const dm = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
    if (dm) { dollarTag = dm[0]; cur += dollarTag; i += dollarTag.length; continue; }
    if (c === ";") { stmts.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts.filter((s) => s.length);
}

// ── Run ───────────────────────────────────────────────────────
const rawSql = inlineSql ?? readFileSync(filePath, "utf8");
const { body, headers } = preprocess(rawSql);

const client = new pg.Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});

client.on("notice", (n) => {
  const msg = (n.message || "").trim();
  if (msg) console.log(`  · ${msg}`);
});

const label = filePath ? filePath.split("/").pop() : "inline SQL";

(async () => {
  console.log(`\n▶ ${label}`);
  console.log(`  db: ${maskedHost(connStr)}`);
  try {
    await client.connect();
  } catch (e) {
    console.error(`\n✖ Could not connect: ${e.message}`);
    console.error("  Check the connection string in .supabase-db-url.local.");
    process.exit(1);
  }

  try {
    if (hasDollarQuote(body)) {
      // Migration-style: send the whole file as one simple query so DO/PLpgSQL
      // blocks and their internal semicolons execute correctly.
      for (const h of headers) console.log(`\n== ${h}`);
      await client.query(body);
      console.log(`\n✔ ${label} applied.`);
    } else {
      // Query-style (preflight/verify): run each statement, print rows.
      const stmts = splitStatements(body);
      let hi = 0;
      for (const stmt of stmts) {
        if (headers[hi]) { console.log(`\n== ${headers[hi]}`); hi++; }
        const res = await client.query(stmt);
        if (res.rows && res.rows.length) console.table(res.rows);
        else if (Array.isArray(res)) res.forEach((r) => r.rows?.length && console.table(r.rows));
        else console.log("  (no rows)");
      }
      console.log(`\n✔ ${label} done.`);
    }
  } catch (e) {
    console.error(`\n✖ Error running ${label}:\n  ${e.message}`);
    if (e.hint)   console.error(`  hint: ${e.hint}`);
    if (e.detail) console.error(`  detail: ${e.detail}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
