# Gamers of Bangladesh (GOB) — Project Status

> Last updated: 2026-08-06

## 1. Project Overview

**Gamers of Bangladesh (GOB)** is a production-oriented platform for the
Bangladeshi gamer community. It brings unique features designed to make
gamers' lives easier — secure item trading with escrow, reputation tracking,
squad matchmaking, and tournaments.

**Live Supabase project:** `dearprguaymmvgqqqbjf` (ap-northeast-2, Postgres 17.6)

## 2. Tech Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Framework    | Next.js 16.2.10 (App Router), React 19.2.4              |
| Language     | TypeScript (strict, no `any`)                           |
| Styling      | Tailwind CSS v4                                         |
| Backend      | Supabase (auth, database, storage, realtime)            |
| Validation   | Zod v4 (server-side, every input)                       |
| Payments     | bKash / Nagad via swappable adapters (shared interface) |

## 3. Architecture & Established Patterns

- **Server Components by default**; Client Components only where
  interactivity or realtime is genuinely needed.
- **Server actions** (`src/lib/actions/*`) call Supabase directly — the
  project does NOT use internal `fetch()` to API routes.
- **Multi-step writes** go through a single Postgres RPC function, never
  sequential client calls (avoids race conditions).
- **Defense in depth:** every route/action re-checks ownership, role, and
  business-rule state server-side, even when RLS already restricts rows.
- **`SECURITY DEFINER` functions** always set `search_path = ''`.
- **Consistent result shape:** `{ success: true, data }` or
  `{ success: false, code, message }`.
- **Clean separation:** UI / business logic / database / auth / payments /
  validation stay in distinct layers.
- **Database-level state-transition guards** for critical status fields
  (escrow status, squad session status) via triggers/RPC validation.

## 4. Features Implemented

### 4.1 Escrow Trading
- `escrow_transactions` with status history
  (`transaction_status_history`)
- Buyer/seller flows, listing-based marketplace
- Dispute flow support
- DB-level state-transition protection

### 4.2 Reputation Passport
- `player_passport_view` — aggregated player reputation
- `player_game_stats` — per-game stats
- No-ghost score (`get_no_ghost_score`) — distinguishes "no track record"
  (NULL) from an actual 0% "always ghosts" score

### 4.3 Squad Finder
- Ranked matchmaking (`get_squad_matches`) from player preferences
  (`squad_preferences`)
- Session lifecycle:
  `requested → accepted / declined → cancelled → completed`
- Post-session feedback (`squad_session_feedback`) driving no-ghost score
- **Newly added:** initiator can **cancel** a pending request
- **Newly added:** participants can mark an accepted session **completed**
  (this unlocks feedback, closing the no-ghost-scores-never-populated gap)

### 4.4 Auth
- Server-side `handle_new_user()` trigger (atomic profile creation — removes
  the orphaned-auth-user failure mode)
- Canonical, version-controlled profiles RLS (3 policies: SELECT/INSERT/UPDATE)
- Deduplicated 5 drifted policies into the canonical set

### 4.5 Notifications (Realtime)
- `NotificationBell` client component with RLS-restricted Realtime channels:
  - Escrow trade status updates (buyer + seller channels)
  - **Newly added:** squad request INSERTs
    (`squad_sessions` where the current user is the recipient)

## 5. Recent Work

### 5.1 Squad Finder session lifecycle

Database (migrations applied to production):
1. `supabase/migrations/20260805201601_squad_finder.sql` — Squad Finder core:
   tables, RPCs (`get_squad_matches`, `request_squad_session`,
   `respond_to_squad_session`, `get_no_ghost_score`), feedback trigger, RLS.
2. `supabase/migrations/20260805210000_handle_new_user_and_profiles_rls.sql`
   — consolidated `handle_new_user()` + canonical profiles RLS.
3. `supabase/migrations/20260806010000_squad_session_cancel_complete.sql`
   - added `cancel_squad_session(p_session_id uuid)` — initiator-only,
     status must be `requested`
   - added `complete_squad_session(p_session_id uuid)` — either participant,
     status must be `accepted`
   - `GRANT EXECUTE ... TO authenticated` for both

Backend (`src/lib/actions/squadFinder.ts`):
- `cancelSquadSession(sessionId)` — Zod-validated, maps RPC errors to
  friendly codes (`NOT_FOUND`, `NOT_INITIATOR`, `ALREADY_RESPONDED`)
- `completeSquadSession(sessionId)` — Zod-validated, maps RPC errors to
  friendly codes (`NOT_FOUND`, `NOT_PARTICIPANT`, `INVALID_STATUS`)
- Both call `revalidatePath` on the affected routes

Validation (`src/lib/validation/squadFinder.ts`):
- `cancelSquadSessionSchema` — session_id must be a UUID
- `completeSquadSessionSchema` — session_id must be a UUID
- `requestSquadSessionSchema` — recipient_id UUID, game enum,
  `scheduled_at` ISO datetime optional/nullable

Frontend:
- **Cancel button** on outgoing requests
  (`src/app/squads/requests/SquadRequestsList.tsx`)
- **Scheduled-time input** on the request form
  (`src/app/squads/SquadMatchCard.tsx`) — `datetime-local` → UTC ISO string
  before sending
- **Complete button** on accepted sessions
  (`src/app/squads/[id]/SquadSessionDetail.tsx`) — wired to
  `completeSquadSession`
- **NotificationBell squad channel** (`src/components/NotificationBell.tsx`)
  — pushes "New squad request for {game}" notifications via Realtime

### 5.2 Supabase types regenerated
- `src/lib/supabase/types.ts` regenerated via the MCP server and confirmed
  written to disk. `request_squad_session` typed with
  `p_scheduled_at?: string` (optional), plus the new RPC signatures.

### 5.3 Security hardening (migrations applied to production)
1. `supabase/migrations/20260806020000_security_hardening_search_path_and_grants.sql`
   - Fixed mutable `search_path` on 12 functions (set to `search_path = ''`),
     eliminating all 12 `security_definer_view` advisor warnings.
   - Audited 7 `SECURITY DEFINER` functions exposed to `PUBLIC`; revoked
     `EXECUTE` from `PUBLIC` on the 6 that are only invoked internally
     (kept `handle_new_user` since it is trigger-only and safe).
2. `supabase/migrations/20260806030000_revoke_public_execute_security_definer.sql`
   - Explicit `REVOKE EXECUTE ... FROM PUBLIC` for the 6 functions, with
     `GRANT EXECUTE ... TO authenticated` where the app calls them directly.

### 5.4 Next.js 16 proxy convention
- Renamed `src/middleware.ts` → `src/proxy.ts` (Next 16 renamed the
  middleware convention to `proxy.ts` / `proxy()` export). Build now shows
  `ƒ Proxy (Middleware)` with no deprecation warning.

## 6. Verification Performed

- **RPC edge-case tests** with real data on the live DB (per
  .clinerules testing rules):
  - non-participant actions rejected
  - wrong-status transitions rejected
  - duplicate/cancelled/complete idempotency checked
- **`get_advisors(security)`** — after security hardening, the
  `security_definer_view` warnings dropped 12 → 0.
- **`npm run build`** — clean production build (Next.js 16.2.10 via Turbopack),
  TypeScript passes, 20 static pages generated. 1 deprecation warning fixed
  by the middleware → proxy rename.
- **Git** — repository initialized in `gob/`; migration + proxy-rename changes
  committed (`ab1b508`).
- **API log review** (`get_logs` for the `api` service):
  - Request flow is healthy: `get_squad_matches` / `squad_preferences`
    returning 200; `request_squad_session` returns expected outcomes
    (200 success, 400/409 for self-request/duplicate business rules).
  - One historical incident, unrelated to app code:
    `auth/v1/admin/users` returned **500** during a user-seeding call.

## 7. Known Issues / Blockers

1. **Leaked-password protection not enabled** — the auth setting
   "Leaked password protection" requires a paid plan (Pro+); free plan keeps
   the feature disabled. Not a code issue — a billing decision.
2. **3 high-severity npm vulnerabilities** — `npm audit` reports 3
   high-severity findings with **no safe fix available** (flags a "breaking"
   or impossible direct update). Requires package upgrades + full regression
   testing before being applied.
3. **No git filter for `.env`** — `.gitignore` exists in `gob/`. Confirm
   `.env.local` is ignored before any remote push.

## 8. Unfinished Work / Next Steps

- [ ] **Manual QA** at 320px and 375px widths + keyboard/ARIA pass on:
  - `/squads` (request form with scheduled-time input)
  - `/squads/requests` (cancel button)
  - `/squads/[id]` (complete button)
- [ ] **Live-data test** of cancel + complete buttons end-to-end
  (the RPCs are verified, but the buttons haven't been clicked through a
  browser against the live DB).
- [ ] **`/squads` crash repro** — if the user re-reports the "server crash":
  restart the dev server and reproduce. The code path
  (client → server action → RPC → revalidate) is complete and correctly
  typed per inspection and API logs.
- [ ] **npm audit remediation** — schedule upgrades for the 3 high-severity
  findings once a safe upgrade path exists.
- [ ] **Decide on leaked-password protection** — requires upgrading the
  Supabase plan (Pro+) if desired.
- [ ] Run the `pre-completion-checklist` skill for the final audit once the
  manual QA passes.