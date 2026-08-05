import { createClient } from "@supabase/supabase-js";

const URL = "https://dearprguaymmvgqqqbjf.supabase.co";
const SERVICE_ROLE = "sb_secret_pk8cU8CkfsEux0w8RI0p8Q_7F0xiuYN";
const BASE = "http://localhost:3000";
const OWNER_ID = "5ad8859e-7eae-4374-9bf3-99cbb689126b";
const VIEWER_ID = "83427d80-8443-416d-89d3-fa4ca350b8fd";

function b64u(input) {
  return Buffer.from(input).toString("base64url");
}

async function getSessionCookie(email, password) {
  const supabase = createClient(URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const { access_token, refresh_token, token_type, expires_at } = data.session;
  return `sb-dearprguaymmvgqqqbjf-auth-token=${b64u(JSON.stringify([access_token, refresh_token, token_type, expires_at]))}`;
}

async function httpGet(url, cookie) {
  const res = await fetch(url, { headers: { Cookie: cookie || "", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" }, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), body: await res.text() };
}

function assert(c, l, d) { console.log((c ? "PASS" : "FAIL") + ": " + l + (d ? " — " + d : "")); }

async function main() {
  const ownerCookie = await getSessionCookie("passport.owner@test.com", "test123456");
  const viewerCookie = await getSessionCookie("passport.viewer@test.com", "test123456");
  console.log("== 1 PUBLIC /players/[owner] ==");
  const pub = await httpGet(`${BASE}/players/${OWNER_ID}`);
  assert(pub.status === 200, "status 200", String(pub.status));
  assert(pub.body.includes("passport_owner"), "username");
  assert(pub.body.includes("Member since"), "member since");
  assert(/[Vv]erified/.test(pub.body), "verified indicator");
  assert(pub.body.includes("Top Trader"), "Top Trader badge");
  assert(pub.body.includes("Tournament Champion"), "Tournament Champion badge");
  assert(pub.body.includes("Trading Reputation"), "trading card");
  assert(pub.body.includes("Tournament Record"), "tournament card");
  assert(pub.body.includes(">10<"), "total_trades=10");
  assert(pub.body.includes("5.0"), "reputation 5.0");
  assert(pub.body.includes("Self-Reported") && pub.body.includes("Not Verified"), "not-verified label");
  assert(pub.body.includes("No self-reported stats yet"), "empty stats state");
  assert(!pub.body.includes("Edit My Stats"), "no edit for anon");
  console.log("== 2 OWNER own passport ==");
  const own = await httpGet(`${BASE}/players/${OWNER_ID}`, ownerCookie);
  assert(own.body.includes("Edit My Stats"), "owner sees Edit My Stats");
  console.log("== 3 OWNER edit-stats ==");
  const edit = await httpGet(`${BASE}/players/${OWNER_ID}/edit-stats`, ownerCookie);
  assert(edit.status === 200, "edit-stats 200", String(edit.status));
  assert(edit.body.includes("Add game stats"), "add form present");
  console.log("== 4 VIEWER sees owner passport ==");
  const v = await httpGet(`${BASE}/players/${OWNER_ID}`, viewerCookie);
  assert(!v.body.includes("Edit My Stats"), "no edit for viewer");
  console.log("== 5 VIEWER direct to owner edit-stats ==");
  const r = await httpGet(`${BASE}/players/${OWNER_ID}/edit-stats`, viewerCookie);
  console.log("OBSERVED redirect status=" + r.status + " location=" + r.location);
  assert(r.status === 307 || r.status === 200, "redirect or canonical", `status=${r.status}`);
  if (r.status === 307 && r.location) assert(r.location.includes("/players/"), "redirect target is passport");
  if (r.status === 200) assert(!r.body.includes("Add game stats"), "non-owner no add form");
  console.log("== 6 nonexistent uuid ==");
  const nf = await httpGet(`${BASE}/players/00000000-0000-0000-0000-000000000000`);
  console.log("OBSERVED 404 status=" + nf.status);
  assert(nf.status === 404, "404", String(nf.status));
  console.log("== 7 mobile classes ==");
  assert(/grid-cols-1 sm:grid-cols-2/.test(pub.body), "responsive card grid");
  assert(/flex flex-wrap/.test(pub.body), "badges wrap");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
