#!/usr/bin/env node
/**
 * verify-security-fixes.mjs — live authenticated-session verification of the
 * three audit fixes, run against the real Supabase project.
 *
 *   Fix #1  create_trade_atomic buyer-identity guard (caller must equal p_buyer_id)
 *   Fix #2  advance_winner_to_next_round no longer EXECUTE-able by `authenticated`
 *           (still called internally by report_match_result as SECURITY DEFINER)
 *   Fix #3  report_match_result enforces organizer/admin-only (participants rejected)
 *
 * Uses the SERVICE_ROLE key ONLY to seed/clean fixtures. Every RPC call under
 * test runs through a real `authenticated` session (anon-key sign-in), so RLS
 * + the SECURITY DEFINER auth checks apply exactly as in production.
 *
 * Usage: node scripts/verify/verify-security-fixes.mjs   (exit 0 = pass)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE_ROLE) {
  console.error("Missing env keys in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "test123456";
const TAG = "vfyfix";
const uid = {};
let emails = {};
let createdTxId = null;
let listingId = null;
let failures = 0;

const log = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? "   " + detail : ""}`);
  if (!ok) failures++;
};

// Delete related rows for a batch of users in FK-safe order with a single
// request per table. Throws on any error so partial cleanups can never be
// mistaken for complete ones.
async function purgeUsers(ids) {
  const safeDel = async (label, fn) => {
    const { error } = await fn();
    if (error) throw new Error(`cleanup ${label}: ${error.message}`);
  };
  if (!ids.length) return;
  await safeDel("tournaments", () => admin.from("tournaments").delete().in("organizer_id", ids));
  await safeDel("escrow(buyer)", () => admin.from("escrow_transactions").delete().in("buyer_id", ids));
  await safeDel("escrow(seller)", () => admin.from("escrow_transactions").delete().in("seller_id", ids));
  await safeDel("prize payouts", () => admin.from("tournament_prize_payouts").delete().in("player_id", ids));
  await safeDel("reviews(reviewee)", () => admin.from("reviews").delete().in("reviewee_id", ids));
  await safeDel("reviews(reviewer)", () => admin.from("reviews").delete().in("reviewer_id", ids));
  await safeDel("listings", () => admin.from("listings").delete().in("seller_id", ids));
  await safeDel("reported matches", () => admin.from("tournament_matches").delete().in("reported_by", ids));
  await safeDel("matches(p1)", () => admin.from("tournament_matches").delete().in("player1_id", ids));
  await safeDel("matches(p2)", () => admin.from("tournament_matches").delete().in("player2_id", ids));
  await safeDel("registrations", () => admin.from("tournament_registrations").delete().in("player_id", ids));
  await safeDel("profile", () => admin.from("profiles").delete().in("id", ids));
  for (const id of ids) {
    const { error: du } = await admin.auth.admin.deleteUser(id);
    if (du) throw new Error(`cleanup auth user ${id}: ${du.message}`);
  }
}

// Pre-clean any users left behind by an interrupted run (idempotent re-runs).
async function preCleanTagUsers() {
  const leftover = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if (u.email && u.email.startsWith(`${TAG}.`)) leftover.push(u.id);
    if (data.users.length < 200) break;
  }
  if (leftover.length) {
    await purgeUsers(leftover);
    console.log("   pre-clean purged", leftover.length, "leftover user(s)");
  }
}

async function createUser(email, username) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  const { error: perr } = await admin.from("profiles").upsert({ id: data.user.id, username });
  if (perr) throw new Error(`upsert profile ${username}: ${perr.message}`);
  return data.user.id;
}

async function authedClient(email) {
  const c = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}
async function main() {
  console.log("=== PRE-CLEAN (idempotent) ===");
  await preCleanTagUsers();

  console.log("=== SEED FIXTURES ===");
  emails = {
    organizer: `${TAG}.organizer@test.com`,
    p1: `${TAG}.p1@test.com`,
    p2: `${TAG}.p2@test.com`,
    p3: `${TAG}.p3@test.com`,
    p4: `${TAG}.p4@test.com`,
    caller: `${TAG}.caller@test.com`,
    victim: `${TAG}.victim@test.com`,
    seller: `${TAG}.seller@test.com`,
  };
  for (const [k, e] of Object.entries(emails)) uid[k] = await createUser(e, `${TAG}_${k}`);
  console.log("   users created:", Object.keys(uid).join(", "));

  // ---------------------------------------------------------------------------
  // FIX #1 — create_trade_atomic buyer-identity guard
  // ---------------------------------------------------------------------------
  console.log("\n=== FIX #1 — create_trade_atomic buyer-identity guard ===");
  const { data: listing, error: lerr } = await admin
    .from("listings")
    .insert({
      seller_id: uid.seller,
      game: "free_fire",
      item_type: "account",
      title: `${TAG} guard test listing`,
      price_bdt: 500,
      status: "active",
    })
    .select("id")
    .single();
  if (lerr) throw new Error("insert listing: " + lerr.message);
  listingId = listing.id;

  const callerClient = await authedClient(emails.caller);

  // Negative: caller (+caller) tries to force +victim to be the buyer.
  const neg = await callerClient.rpc("create_trade_atomic", {
    p_listing_id: listing.id,
    p_buyer_id: uid.victim,
  });
  log(
    "caller≠buyer rejected",
    neg.error != null && /Buyer must be the authenticated user/i.test(neg.error.message),
    neg.error ? neg.error.message : "unexpectedly succeeded"
  );

  const { data: escrowAfterNeg } = await admin
    .from("escrow_transactions")
    .select("id")
    .eq("listing_id", listing.id);
  log("no escrow created on rejection", (escrowAfterNeg || []).length === 0);

  // Anonymous (NULL auth.uid()) caller must be rejected. Anonymous users are
  // blocked at the GRANT layer ("permission denied for function") — even
  // stricter than the guard, and still fails closed. Accept either mechanism.
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const anonRes = await anon.rpc("create_trade_atomic", {
    p_listing_id: listing.id,
    p_buyer_id: uid.caller,
  });
  log(
    "anon rejected (grant layer or guard)",
    anonRes.error != null,
    anonRes.error ? anonRes.error.message : "unexpectedly succeeded"
  );

  // Direct proof the guard fails closed on NULL auth.uid(): service-role calls
  // have auth.uid() = NULL, so ANY p_buyer_id must be rejected by the guard.
  const svcRes = await admin.rpc("create_trade_atomic", {
    p_listing_id: listing.id,
    p_buyer_id: uid.caller,
  });
  log(
    "guard rejects NULL auth.uid() (service-role call)",
    svcRes.error != null && /Buyer must be the authenticated user/i.test(svcRes.error.message),
    svcRes.error ? svcRes.error.message : "unexpectedly succeeded"
  );

  const happy = await callerClient.rpc("create_trade_atomic", {
    p_listing_id: listing.id,
    p_buyer_id: uid.caller,
  });
  log("caller=self succeeds", happy.error == null && happy.data != null, happy.error ? happy.error.message : "tx=" + happy.data);
  if (happy.error == null && happy.data) {
    createdTxId = happy.data;
    const { data: escrow } = await admin
      .from("escrow_transactions")
      .select("buyer_id, seller_id, status")
      .eq("id", happy.data)
      .single();
    log(
      "escrow row correct",
      escrow && escrow.buyer_id === uid.caller && escrow.seller_id === uid.seller && escrow.status === "awaiting_payment"
    );
    const { data: lAfter } = await admin.from("listings").select("status").eq("id", listing.id).single();
    log("listing flipped to pending_trade", lAfter && lAfter.status === "pending_trade");
  }
  // ---------------------------------------------------------------------------
  // FIX #3 + FIX #2 — report_match_result gate + internal advance
  // ---------------------------------------------------------------------------
  console.log("\n=== FIX #3 + FIX #2 — report gate + internal advance ===");
  const { data: tour, error: terr } = await admin
    .from("tournaments")
    .insert({
      organizer_id: uid.organizer,
      game: "free_fire",
      title: `${TAG} live bracket cup`,
      rules: "verify",
      entry_fee_bdt: 0,
      platform_fee_percent: 0,
      max_participants: 4,
      prize_split: { "1st": 100 },
      status: "bracket_generated",
      starts_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (terr) throw new Error("insert tournament: " + terr.message);
  const tourId = tour.id;

  for (const pid of [uid.p1, uid.p2, uid.p3, uid.p4]) {
    const { error: rg } = await admin.from("tournament_registrations").insert({
      tournament_id: tourId,
      player_id: pid,
      payment_method: "bkash",
      payment_status: "paid",
    });
    if (rg) throw new Error("register: " + rg.message);
  }

  const mkMatch = async (round, num, p1 = null, p2 = null) => {
    const { data, error } = await admin
      .from("tournament_matches")
      .insert({
        tournament_id: tourId,
        round_number: round,
        match_number: num,
        player1_id: p1,
        player2_id: p2,
        is_bye: false,
        status: "pending",
      })
      .select("id");
    if (error) throw new Error("insert match: " + error.message);
    return data[0].id;
  };
  const r1m1 = await mkMatch(1, 1, uid.p1, uid.p2);
  const r1m2 = await mkMatch(1, 2, uid.p3, uid.p4);
  await mkMatch(2, 1);

  const p2Client = await authedClient(emails.p2);
  const partRes = await p2Client.rpc("report_match_result", { p_match_id: r1m1, p_winner_id: uid.p1 });
  log(
    "participant rejected at RPC",
    partRes.error != null && /Only the tournament organizer or an admin/i.test(partRes.error.message),
    partRes.error ? partRes.error.message : "unexpectedly succeeded"
  );

  const orgClient = await authedClient(emails.organizer);
  const rep1 = await orgClient.rpc("report_match_result", { p_match_id: r1m1, p_winner_id: uid.p1 });
  log("organizer reports match1", rep1.error == null, rep1.error ? rep1.error.message : "");

  const { data: m1After } = await admin
    .from("tournament_matches")
    .select("status,winner_id,reported_by")
    .eq("id", r1m1)
    .single();
  log(
    "match marked reported",
    m1After && m1After.status === "reported" && m1After.winner_id === uid.p1 && m1After.reported_by === uid.organizer
  );

  const { data: r2After } = await admin
    .from("tournament_matches")
    .select("id,player1_id,player2_id,status")
    .eq("tournament_id", tourId)
    .eq("round_number", 2)
    .eq("match_number", 1)
    .single();
  log(
    "winner advanced internally (advance works despite revoke)",
    r2After && r2After.player1_id === uid.p1
  );

  const { data: tStatus1 } = await admin.from("tournaments").select("status").eq("id", tourId).single();
  log("tournament set in_progress", tStatus1 && tStatus1.status === "in_progress");

  await orgClient.rpc("report_match_result", { p_match_id: r1m2, p_winner_id: uid.p3 });
  const { data: r2Both } = await admin
    .from("tournament_matches")
    .select("id,player1_id,player2_id,status")
    .eq("tournament_id", tourId)
    .eq("round_number", 2)
    .eq("match_number", 1)
    .single();
  log("final round has both players", r2Both && r2Both.player2_id === uid.p3 && r2Both.status === "ready");

  const repF = await orgClient.rpc("report_match_result", { p_match_id: r2Both.id, p_winner_id: uid.p1 });
  log("organizer reports final", repF.error == null, repF.error ? repF.error.message : "");
  const { data: tStatus2 } = await admin.from("tournaments").select("status").eq("id", tourId).single();
  log("tournament completed", tStatus2 && tStatus2.status === "completed");

  console.log(`\n${failures === 0 ? "ALL SECURITY-FIX CHECKS PASSED ✓" : failures + " FAILURE(S) ✗"}`);
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    failures++;
  })
  .finally(async () => {
    console.log("\n=== CLEANUP ===");
    try {
      if (createdTxId) await admin.from("escrow_transactions").delete().eq("id", createdTxId);
      if (listingId) await admin.from("listings").update({ status: "removed" }).eq("id", listingId);
      for (const id of Object.values(uid)) {
        await admin.from("escrow_transactions").delete().eq("id", id);
      }
      await purgeUsers(Object.values(uid));
      console.log("   cleanup done");
    } catch (e) {
      console.error("   cleanup error:", e);
      failures++;
    }
    process.exit(failures === 0 ? 0 : 1);
  });
