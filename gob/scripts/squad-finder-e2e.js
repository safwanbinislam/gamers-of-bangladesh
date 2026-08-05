import { spawn } from "node:child_process";
import { createServerClient } from "@supabase/ssr";

const URL = "https://dearprguaymmvgqqqbjf.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlYXJwcmd1YXltbXZncXFxYmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjY0NzMsImV4cCI6MjA5OTQ0MjQ3M30.yXY_vt6hoZxoA-B0G4I5p0WcFNqD6hqWto8OpUUysEQ";
const BASE = "http://localhost:3000";
const USER_A = "18bcc16e-09fb-4fd7-b279-7b2418aeea7e";
const USER_B = "ff6fe448-c7da-44c7-bb3c-93ac47a8bb8e";

/**
 * Signs in a real user and returns the Cookie header in the exact format the
 * app's `@supabase/ssr` server client writes (base64url-encoded full session
 * JSON prefixed with `base64-`, auto-chunked when large).
 *
 * Hand-building the legacy `[access_token, refresh_token, token_type,
 * expires_at]` array no longer works: current @supabase/ssr validates the
 * decoded value with JSON.parse, and the legacy array decodes to a non-object
 * string, so getSession() returns null and every action ends in AUTH_REQUIRED.
 */
async function getSessionCookie(email, password) {
  const store = new Map();
  const supabase = createServerClient(URL, ANON_KEY, {
    cookies: {
      getAll() {
        return [...store.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          if (value) store.set(name, value);
          else store.delete(name);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("signin " + email + ": " + error.message);

  // Confirm session materialized and the SIGNED_IN handler wrote the cookies.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("no session for " + email);

  const cookieHeader = [...store.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  if (!cookieHeader) throw new Error("no cookies produced for " + email);
  return cookieHeader;
}

async function postJson(url, cookie, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie || "" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

const assert = (c, l, d) => console.log((c ? "PASS" : "FAIL") + ": " + l + (d ? " — " + d : ""));

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status >= 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log("=== STARTING DEV SERVER ===");
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev"],
    { cwd: "d:\\Gamers of Bangladesh\\gob", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024" }, stdio: ["ignore", "pipe", "pipe"] }
  );
  server.stdout.on("data", (d) => process.stdout.write("[dev] " + d));
  server.stderr.on("data", (d) => process.stderr.write("[dev-err] " + d));

  const up = await waitForServer(`${BASE}/login`, 60000);
  if (!up) { console.error("FATAL: dev server did not become ready"); server.kill(); process.exit(1); }
  console.log("Dev server ready.");

  try {
    const cookieA = await getSessionCookie("squad.a@test.com", "test123456");
    const cookieB = await getSessionCookie("squad.b@test.com", "test123456");
    console.log("Cookies obtained. A len=" + cookieA.length + " B len=" + cookieB.length);

    const HARNESS = `${BASE}/api/test/squad-finder`;

    console.log("\n== 1 get_matches_no_pref (A, no prefs set) ==");
    let r = await postJson(HARNESS, cookieA, { step: "get_matches_no_pref", game: "free_fire" });
    console.log("OBSERVED:", JSON.stringify(r.body));
    assert(r.body.code === "PREFERENCES_NOT_SET", "code=PREFERENCES_NOT_SET", r.body.code);

    console.log("\n== 2 upsert_invalid (A, bogus game) ==");
    r = await postJson(HARNESS, cookieA, { step: "upsert_invalid" });
    console.log("OBSERVED:", JSON.stringify(r.body));
    assert(r.body.code === "VALIDATION_ERROR", "code=VALIDATION_ERROR", r.body.code);

    console.log("\n== 3 request_self (A requests A) ==");
    r = await postJson(HARNESS, cookieA, { step: "request_self", recipient_id: USER_A, game: "free_fire" });
    console.log("OBSERVED:", JSON.stringify(r.body));
    assert(r.body.code === "SELF_REQUEST", "code=SELF_REQUEST", r.body.code);

    console.log("\n== 4 request_duplicate (A->B twice) ==");
    r = await postJson(HARNESS, cookieA, { step: "request_duplicate", recipient_id: USER_B, game: "free_fire" });
    console.log("OBSERVED first:", JSON.stringify(r.body));
    assert(r.body.success === true, "first request succeeds", r.body.code);
    const sessionId = r.body.data?.session_id;
    r = await postJson(HARNESS, cookieA, { step: "request_duplicate", recipient_id: USER_B, game: "free_fire" });
    console.log("OBSERVED second:", JSON.stringify(r.body));
    assert(r.body.code === "DUPLICATE_REQUEST", "code=DUPLICATE_REQUEST", r.body.code);

    console.log("\n== 5 respond_not_recipient (A responds to own request) ==");
    r = await postJson(HARNESS, cookieA, { step: "respond_not_recipient", session_id: sessionId });
    console.log("OBSERVED:", JSON.stringify(r.body));
    assert(r.body.code === "NOT_RECIPIENT", "code=NOT_RECIPIENT", r.body.code);

    console.log("\n== 6 respond_already (B accepts twice) ==");
    r = await postJson(HARNESS, cookieB, { step: "respond_already", session_id: sessionId });
    console.log("OBSERVED first:", JSON.stringify(r.body));
    assert(r.body.success === true, "first accept succeeds", r.body.code);
    r = await postJson(HARNESS, cookieB, { step: "respond_already", session_id: sessionId });
    console.log("OBSERVED second:", JSON.stringify(r.body));
    assert(r.body.code === "ALREADY_RESPONDED", "code=ALREADY_RESPONDED", r.body.code);

    console.log("\n== 7 get_session_not_found (A, bogus uuid) ==");
    r = await postJson(HARNESS, cookieA, { step: "get_session_not_found" });
    console.log("OBSERVED:", JSON.stringify(r.body));
    assert(r.body.code === "NOT_FOUND", "code=NOT_FOUND", r.body.code);
  } finally {
    server.kill();
    console.log("\nDev server stopped.");
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });