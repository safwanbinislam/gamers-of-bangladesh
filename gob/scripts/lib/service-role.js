import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resolves the Supabase service-role key WITHOUT hardcoding it in source.
 *
 * Priority:
 *   1. process.env.SUPABASE_SERVICE_ROLE_KEY
 *   2. SUPABASE_SERVICE_ROLE_KEY=... in .env.local (repo root, gitignored)
 *
 * Throws a descriptive error if neither source provides it, so a missing
 * secret fails loudly instead of silently using a stale embedded value.
 */
export function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+?)\s*$/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local missing/unreadable — fall through to the error below.
  }
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY not found. Set it as an environment variable or add it to .env.local."
  );
}
