import type { Database } from "@/lib/supabase/types";

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];

/**
 * Determines whether a tournament is currently accepting new registrations.
 *
 * IMPORTANT: this is an APPLICATION-LEVEL responsibility, not something the
 * database enforces on its own. The `tournaments` schema stores
 * `registration_closes_at` and `max_participants` as plain informational
 * columns — nothing in the database (no CHECK constraint, no trigger)
 * prevents an INSERT into `tournament_registrations` after the window has
 * closed or once the cap has been reached. Every write path that creates a
 * registration (currently just POST /api/tournaments/[id]/register) MUST
 * call this helper before inserting, and re-check it right before the
 * insert to minimize (though not eliminate — see race note below) the race
 * window between the check and the write.
 *
 * RACE CONDITION NOTE: because the cap is enforced here in application code
 * rather than via a DB-level constraint/trigger, two concurrent requests
 * could both pass this check right before the last slot fills, resulting in
 * `max_participants + 1` registrations. This is an accepted limitation of
 * the current schema for this task — a more robust fix would be a Postgres
 * trigger or a `SELECT ... FOR UPDATE` advisory lock on the tournament row
 * during registration, but that is schema-level work outside the scope of
 * "the schema already exists and has been tested" per the task brief.
 */
export function isRegistrationOpen(
  tournament: Pick<Tournament, "status" | "registration_closes_at" | "max_participants">,
  currentRegisteredCount: number
): boolean {
  if (tournament.status !== "registration_open") {
    return false;
  }

  if (tournament.registration_closes_at) {
    const closesAtMs = new Date(tournament.registration_closes_at).getTime();
    if (Number.isFinite(closesAtMs) && closesAtMs <= Date.now()) {
      return false;
    }
  }

  if (currentRegisteredCount >= tournament.max_participants) {
    return false;
  }

  return true;
}
