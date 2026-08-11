# Gamers of Bangladesh (GOB) — Complete Work Log

> This document records the project work from the beginning up to now:
> the full codebase history, the security audit fixes, the secret
> hygiene cleanup, and the GitHub setup.
>
> Last updated: **2026-08-07** — covers everything through the GitHub push.

---

## 1. Project Snapshot

| Item             | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| **Project**      | Gamers of Bangladesh (GOB) — gaming community platform        |
| **Theme**        | Escrow trading, reputation passport, squad finder, tournaments |
| **Framework**    | Next.js 16.2.10 (App Router), React 19.2.4, TypeScript (strict) |
| **Styling**      | Tailwind CSS v4                                              |
| **Backend**      | Supabase — auth, database, storage, realtime                 |
| **Live Supabase**| `dearprguaymmvgqqqbjf` (region ap-northeast-2, Postgres 17.6) |
| **Payments**     | bKash / Nagad via swappable adapter interface                |
| **Git branch**   | `master`                                                     |
| **Repos (private)** | `safwanbinislam/gob` (origin) · `safwanbinislam/gamers-of-bangladesh` (backup) |
| **Latest commit**| `6c85e4f` — "Security fixes + secret hardening"              |

---

## 2. Project Timeline (Git History)

| Commit | Description |
| ------ | ----------- |
| `4ce4345` | Initial commit: GOB project state as of 2026-08-06 |
| `1296475` | Flattened nested create-next-app repo into a single history |
| `ab1b508` | Renamed `middleware.ts` → `proxy.ts` (Next 16 convention) |
| `fab0e0c` | Project status docs updated to reflect completed work |
| `4172de2` | Clarified `.env` gitignore status in `PROJECT_STATUS.md` |
| `8d0f731` | **Squads:** session chat backend (send/list `squad_session_messages`) |
| `e1d07fe` | **Squads:** session chat UI (`SquadSessionChat`) |
| `5aec712` | Backfilled core-schema migrations + migration verification script |
| `6c85e4f` | **Security fixes + secret hardening** (this session — see below) |

### Database Schema (migrations)

```
20260805200000_auth_profiles.sql
20260805201601_squad_finder.sql
20260805203000_marketplace_reputation.sql
20260805204000_escrow.sql
20260805204500_reviews.sql
20260805205000_tournaments.sql
20260805210000_handle_new_user_and_profiles_rls.sql
20260806010000_squad_session_cancel_complete.sql
20260806020000_security_hardening_search_path_and_grants.sql
20260806030000_revoke_public_execute_security_definer.sql
20260807014300_squad_session_messages.sql
20260807020000_create_trade_atomic_buyer_identity_check.sql   ← this session
20260807020100_revoke_authenticated_execute_advance_winner.sql ← this session
```

---

## 3. Security Audit & Fixes (2026-08-07)

A security audit of the Supabase backend raised three findings. All three were
fixed and **verified live against the real database** with real authenticated
sessions.

### 3.1 Fix #1 — Buyer-identity guard on `create_trade_atomic`

- **Problem:** The escrow-creation RPC accepted the buyer id as a plain
  parameter; a caller could create a trade as *someone else*.
- **Fix:** `supabase/migrations/20260807020000_create_trade_atomic_buyer_identity_check.sql`
  adds an explicit guard: the `buyer_id` must equal `auth.uid()`, otherwise the
  whole transaction is rejected and nothing is written.
- **Live verification:**
  - Caller ≠ buyer → **rejected**, no escrow row created.
  - Anonymous caller → rejected at the grant layer (`permission denied`).
  - Service-role call (NULL `auth.uid()`) → **rejected by the guard** (fails closed).
  - Caller = self → **succeeds**; escrow row correct; listing flipped to `pending_trade`.

### 3.2 Fix #2 — Remove redundant app call + revoke `advance_winner_to_next_round`

- **Problem:** The app made a *separate* client-side call to
  `advance_winner_to_next_round` after reporting a match — a redundant call that
  was also directly executable by any `authenticated` user.
- **Fix:** `supabase/migrations/20260807020100_revoke_authenticated_execute_advance_winner.sql`
  runs `REVOKE EXECUTE ... FROM authenticated` (kept `service_role`). The winner
  advancement now happens **internally** inside the `report_match_result` RPC
  (SECURITY DEFINER), so the app call was removed.
- **Live verification:** the Supabase security advisor no longer lists the
  function as executable by `authenticated`; the internal advance still works
  end-to-end (round 1 winner reaches round 2, tournament completes).

### 3.3 Fix #3 — Tighten `report_match_result` app gate (organizer/admin only)

- **Problem:** The app-layer helper let tournament **participants** self-report
  their own match results.
- **Fix:** `src/lib/tournaments/reportMatchResult.ts` now fetches
  `tournament.organizer_id` and requires `isOrganizer || isAdmin`. Docstrings in
  `src/lib/actions/tournaments.ts` updated to match.
- **Live verification:** a participant's RPC call is **rejected**
  (`Only the tournament organizer or an admin can report match results`), while
  the organizer can report round-1 matches, trigger the internal winner advance,
  and complete the tournament via the final round.

### 3.4 Live verification harness

A new harness exercises all fixes with **real authenticated sessions**:

```
scripts/verify/verify-security-fixes.mjs
```

Run with: `node scripts/verify/verify-security-fixes.mjs`

- Uses the **service-role key only to seed/clean fixtures**; every RPC under test
  runs through a real `authenticated` session so RLS behavior is genuine.
- **14/14 checks passed (exit 0)**, including negative cases (caller ≠ buyer,
  anonymous, NULL `auth.uid()`, participant self-report).
- Fully self-cleaning and idempotent (pre-clean pass + batched deletes).
  **Before:** an early run left phantom test users (a harness bug); after the fix,
  verified `0` leftovers in `auth.users`, tournaments, escrow, and listings.
- `npx tsc --noEmit` is clean.

---

## 4. Secret Hygiene (2026-08-07)

While preparing to push the project to GitHub, a **critical issue** was found:
three tracked scripts contained the **hardcoded Supabase service-role key**
(a credential with full, unrestricted database access):

- `scripts/seed`
- `scripts/passport-e2e.js`
- `scripts/passport-test.js`

### Fix applied

- Created a shared loader: **`scripts/lib/service-role.js`** — resolves
  `SUPABASE_SERVICE_ROLE_KEY` from the environment or `.env.local` (which is
  gitignored) and throws a descriptive error if missing.
- Patched all three scripts to use `getServiceRoleKey()`.
- **Verification:** zero occurrences of the key remain in tracked files; all
  four scripts pass `node --check`; the loader resolves the key correctly from
  `.env.local`.

> `.env.local` (with the bKash/Nagad secrets) was **already gitignored** before
> this session and is not present in the repository.

---

## 5. GitHub Setup & Push (2026-08-07)

The project was migrated from a purely local git repo to GitHub.

| Step | Detail |
| ---- | ------ |
| Existing state | No remotes configured; stale `/expired` credential for another account (`NoobDevp0`) in Windows Credential Manager |
| User token    | Fresh GitHub PAT (account **`safwanbinislam`** — Safwan Bin Islam) |
| Repo 1 (origin)  | **`safwanbinislam/gob`** — private |
| Repo 2 (backup)  | **`safwanbinislam/gamers-of-bangladesh`** — private |
| Remotes       | `origin` + `backup` both added to the local repo |
| Commit pushed | `6c85e4f` ("Security fixes + secret hardening", 9 files) |
| Verification  | `git ls-remote` on both remotes returns the **same SHA** as local HEAD (`6c85e4f`) |

### Obstacles solved during the setup

1. **Expired stored credential** — the old `gho_…` OAuth token (`NoobDevp0`)
   returned `401`. Deleted the stale entry and installed the new token with
   `git credential approve`; `git credential fill` then correctly returns the
   `safwanbinislam / ghp_…` pair.
2. **Tool timeouts on first push** — the first push exceeded the 30s command
   cap; re-ran the push as a detached process writing to a log, then verified
   both remotes received the same commit.
3. **No secrets in the pushed tree** — confirmed tracked files contain no `.env`
   files and no hardcoded keys before pushing.

### Update flow for the future

```
git add -A
git commit -m "your message"
git push origin master
git push backup master
```

---

## 6. Current State & Outstanding Items

**All clean:** working tree clean, two private GitHub repos up to date,
security fixes live and verified, `tsc` clean, no leftover test data.

| # | Item | Status |
| - | ---- | ------ |
| 1 | ⛔ **Rotate the GitHub token** shared in chat | **Pending (user action)** — GitHub Settings → Developer settings → Personal access tokens → delete `gob-push` |
| 2 | Decide what to do with the old `safwanbinislam/bd-game-hub` repo (possibly an old copy of this project) | Pending (user decision) |
| 3 | Enable "leaked password protection" in Supabase Auth settings (pre-existing advisory) | Pending (optional, low priority) |
| 4 | Optionally: wire `reportMatchResult.ts` itself into the harness once a TS runner exists | Nice-to-have, not a blocker |

---

## 7. Cheat Sheet — Commands Used

| Task | Command |
| ---- | ------- |
| Verify DB fixtures are clean | `select count(*) from auth.users where email like 'vfyfix.%';` |
| Run security harness | `node scripts/verify/verify-security-fixes.mjs` |
| Type-check the app | `npx tsc --noEmit` |
| Check remotes | `git remote -v` |
| Push code | `git push origin master` / `git push backup master` |
| List commits | `git --no-pager log --oneline` |