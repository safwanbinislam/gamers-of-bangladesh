#!/usr/bin/env node
/**
 * verify.mjs — diffs the CREATE TABLE statements in the backfill migration
 * files against the live-DB snapshot (db-snapshot.json).
 *
 * Usage: node scripts/verify-migrations/verify.mjs
 *
 * It parses each migration file for CREATE TABLE IF NOT EXISTS public.<name>
 * blocks, extracts column-level info (name, type, nullability, default), then
 * compares against the snapshot. Any mismatch is printed; exit code is
 * non-zero if mismatches are found.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');
const SNAPSHOT_PATH = join(__dirname, 'db-snapshot.json');

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
const snapshotByTable = new Map(snapshot.map((t) => [t.table_name, t]));

// ---------------------------------------------------------------------------
// Parse all CREATE TABLE blocks in a file into structured objects.
// ---------------------------------------------------------------------------
function parseCreateTables(sql) {
  const result = [];
  const re = /CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  let match;
  while ((match = re.exec(sql)) !== null) {
    result.push({ tableName: match[1], body: match[2] });
  }
  return result;
}

function parseTableBody(body) {
  const columns = [];
  const constraints = [];

  // Split top-level lines (naive but fine for our controlled files).
  const lines = body.split('\n');
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('--')) continue;

    if (current === null) {
      current = line;
    } else {
      current += ' ' + line;
    }

    // If the accumulated text ends with a comma, it's a complete entry.
    if (current.endsWith(',')) {
      current = current.slice(0, -1).trim();
      classifyEntry(current, columns, constraints);
      current = null;
    }
  }
  // Handle the last entry without a trailing comma.
  if (current) {
    classifyEntry(current, columns, constraints);
  }

  return { columns, constraints };
}

function classifyEntry(entry, columns, constraints) {
  if (/^CONSTRAINT\s+\S+\s+(UNIQUE|CHECK|PRIMARY KEY|FOREIGN KEY)/i.test(entry)) {
    constraints.push(entry);
    return;
  }
  // Column: name type [NOT NULL] [DEFAULT ...] [REFERENCES ...] [CHECK ...]
  const m = entry.match(/^(\w+)\s+(.+)$/);
  if (!m) return;
  const name = m[1];
  const rest = m[2];

  let type = rest;
  let nullable = true;
  let def = null;

  // NOT NULL
  if (/NOT NULL/i.test(type)) {
    nullable = false;
    type = type.replace(/\s+NOT\s+NULL/i, '');
  }

  // PRIMARY KEY implies NOT NULL
  if (/PRIMARY KEY/i.test(type)) {
    nullable = false;
    type = type.replace(/\s+PRIMARY\s+KEY/i, '');
  }

  // DEFAULT — capture up to any trailing CONSTRAINT/CHECK clause.
  const defMatch = type.match(/DEFAULT\s+(.+?)(?=\s+CONSTRAINT\s+\S+\s+CHECK|\s+CHECK\s*\(|$)/i);
  if (defMatch) {
    def = defMatch[1].trim();
    type = type.replace(/\s+DEFAULT\s+.+$/i, '');
  }

  // Strip trailing REFERENCES / CHECK / CONSTRAINT / UNIQUE clauses for type extraction.
  type = type
    .replace(/\s+REFERENCES\s+.+$/i, '')
    .replace(/\s+CHECK\s*\(.+$/i, '')
    .replace(/\s+CONSTRAINT\s+.+$/i, '')
    .replace(/\s+UNIQUE\b/i, '')
    .trim();

  columns.push({ name, type, is_nullable: nullable ? 'YES' : 'NO', column_default: def });
}

// ---------------------------------------------------------------------------
// Normalize a type string to match information_schema.data_type.
// ---------------------------------------------------------------------------
function normalizeType(t) {
  const lower = t.toLowerCase();
  if (lower === 'uuid') return 'uuid';
  if (lower === 'text') return 'text';
  if (lower === 'numeric') return 'numeric';
  if (lower === 'integer' || lower === 'int') return 'integer';
  if (lower === 'boolean' || lower === 'bool') return 'boolean';
  if (lower === 'jsonb') return 'jsonb';
  if (lower === 'timestamptz' || lower === 'timestamp with time zone') return 'timestamp with time zone';
  if (lower === 'text[]') return 'ARRAY';
  if (lower.startsWith('public.')) return 'USER-DEFINED';
  return lower;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
let errors = 0;
let checked = 0;
const foundTables = new Set();

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

  for (const { tableName, body } of parseCreateTables(sql)) {
    foundTables.add(tableName);
    const snap = snapshotByTable.get(tableName);
    if (!snap) {
      console.log(`[SKIP] ${file}: table ${tableName} not in snapshot (new table, not backfill)`);
      continue;
    }

    checked++;
    const parsed = parseTableBody(body);
    const snapCols = new Map(snap.columns.map((c) => [c.column_name, c]));
    const fileCols = new Map(parsed.columns.map((c) => [c.name, c]));

    // Column presence
    for (const [name, sc] of snapCols) {
      if (!fileCols.has(name)) {
        console.log(`[MISSING] ${file} ${tableName}.${name} (in DB, not in migration)`);
        errors++;
      }
    }
    for (const [name, fc] of fileCols) {
      if (!snapCols.has(name)) {
        console.log(`[EXTRA] ${file} ${tableName}.${name} (in migration, not in DB)`);
        errors++;
      }
    }

    // Column attributes
    for (const [name, sc] of snapCols) {
      const fc = fileCols.get(name);
      if (!fc) continue;

      const fileType = normalizeType(fc.type);
      if (fileType !== sc.data_type) {
        console.log(`[TYPE] ${file} ${tableName}.${name}: migration=${fileType} db=${sc.data_type}`);
        errors++;
      }
      if (fc.is_nullable !== sc.is_nullable) {
        console.log(`[NULL] ${file} ${tableName}.${name}: migration=${fc.is_nullable} db=${sc.is_nullable}`);
        errors++;
      }
      // Default comparison (best-effort, ignore whitespace/case, strip enum casts)
      const normDef = (d) =>
        d == null ? null : d.replace(/\s+/g, ' ').toLowerCase().replace(/::\w+/g, '');
      if (normDef(fc.column_default) !== normDef(sc.column_default)) {
        console.log(`[DEFAULT] ${file} ${tableName}.${name}: migration=${fc.column_default} db=${sc.column_default}`);
        errors++;
      }
    }
  }
}

// Track tables in the snapshot that weren't found in any migration.
const snapTables = new Set(snapshot.map((t) => t.table_name));
for (const t of snapTables) {
  if (!foundTables.has(t)) {
    console.log(`[MISSING TABLE] ${t} is in the live DB snapshot but not in any migration`);
    errors++;
  }
}

console.log(`\nChecked ${checked} tables. ${errors === 0 ? 'ALL MATCH ✓' : errors + ' mismatch(es) found ✗'}`);
process.exit(errors === 0 ? 0 : 1);