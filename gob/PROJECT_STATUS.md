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

## 5. Recent Work (Squad Finder session lifecycle)

### 5.1 Database (migrations applied to production)
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

### 5.2 Backend (server actions)
`src/lib/actions/squadFinder.ts`:
- `cancelSquadSession(sessionId)` — Zod-validated, maps RPC errors to
  friendly codes (`NOT_FOUND`, `NOT_INITIATOR`, `ALREADY_RESPONDED`)
- `completeSquadSession(sessionId)` — Zod-validated, maps RPC errors to
  friendly codes (`NOT_FOUND`, `NOT_PARTICIPANT`, `INVALID_STATUS`)
- Both call `revalidatePath` on the affected routes

### 5.3 Validation
`src/lib/validation/squadFinder.ts`:
- `cancelSquadSessionSchema` — session_id must be a UUID
- `completeSquadSessionSchema` — session_id must be a UUID
- `requestSquadSessionSchema` — recipient_id UUID, game enum,
  `scheduled_at` ISO datetime optional/nullable

### 5.4 Frontend
- **Cancel button** on outgoing requests
  (`src/app/squads/requests/SquadRequestsList.tsx`)
- **Scheduled-time input** on the request form
  (`src/app/squads/SquadMatchCard.tsx`) — `datetime-local` → UTC ISO string
  before sending
- **Complete button** on accepted sessions
  (`src/app/squads/[id]/SquadSessionDetail.tsx`, lines 142–152)
  → button is present and wired to `completeSquadSession`
- **NotificationBell squad channel** (`src/components/NotificationBell.tsx`)
  — pushes "New squad request for {game}" notifications via Realtime

### 5.5 Supabase Types Regenerated
- `src/lib/supabase/types.ts` regenerated via the MCP server and confirmed
  written to disk. `request_squad_session` typed with
  `p_scheduled_at?: string` (optional), plus the new RPC signatures.

## 6. Verification Performed

- **RPC edge-case tests** with real data on the live DB (per
  .clinerules testing rules):
  - non-participant actions rejected
  - wrong-status transitions rejected
  - duplicate/cancelled/complete idempotency checked
- **`get_advisors(security)`** — no new findings after the schema changes.
- **API log review** (`get_logs` for the `api` service):
  - Request flow is healthy: `get_squad_matches` / `squad_preferences`
    returning 200; `request_squad_session` returns expected outcomes
    (200 success, 400/409 for self-request/duplicate business rules).
  - One historical incident, unrelated to app code:
    `auth/v1/admin/users` returned **500** during a user-seeding call.

## 7. Known Issues / Blockers

1. **Local tooling not installed** — `npx tsc` fails with "not the tsc
   command" because `node_modules` is missing inside `gob/`.
   → Run `npm install` in `gob/` before any type-check/build.
2. **No git repository** — neither the root nor `gob/` is under version
   control, so no commit history/diffing is available.

## 8. Unfinished Work / Next Steps

- [ ] `cd gob && npm install` — restore local tooling
- [ ] `npx tsc --noEmit` — type-check the whole app
- [ ] `npm run build` — production build sanity check
- [ ] Run the `pre-completion-checklist` skill for the final audit
- [ ] Manual QA at 320px and 375px widths + keyboard/ARIA pass on:
  - `/squads` (request form with scheduled-time input)
  - `/squads/requests` (cancel button)
  - `/squads/[id]` (complete button)
- [ ] If the user re-reports the "server crash" on `/squads`: after
  `npm install`, restart the dev server and reproduce; the code path itself
  (client → server action → RPC → revalidate) is complete and correctly
  typed per inspection and API logs.