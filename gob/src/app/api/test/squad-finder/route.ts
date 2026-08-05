import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getSquadMatches,
  upsertSquadPreferences,
  requestSquadSession,
  respondToSquadSession,
  getSquadSession,
} from "@/lib/actions/squadFinder";

/**
 * TEST HARNESS — TEMPORARY. Exercises the squad-finder server actions and
 * returns their raw result objects as JSON so a headless E2E script can assert
 * on the exact `code` each error path returns.
 *
 * POST body: { step: string, ...args }
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const body = await req.json().catch(() => ({}));
  const { step } = body;

  switch (step) {
    case "get_matches_no_pref": {
      const r = await getSquadMatches(body.game ?? "free_fire");
      return NextResponse.json(r);
    }
    case "upsert_invalid": {
      const r = await upsertSquadPreferences({ game: "bogus_game" });
      return NextResponse.json(r);
    }
    case "request_self": {
      const r = await requestSquadSession({
        recipient_id: body.recipient_id,
        game: body.game ?? "free_fire",
      });
      return NextResponse.json(r);
    }
    case "request_duplicate": {
      const r = await requestSquadSession({
        recipient_id: body.recipient_id,
        game: body.game ?? "free_fire",
      });
      return NextResponse.json(r);
    }
    case "respond_not_recipient": {
      const r = await respondToSquadSession(body.session_id, true);
      return NextResponse.json(r);
    }
    case "respond_already": {
      const r = await respondToSquadSession(body.session_id, true);
      return NextResponse.json(r);
    }
    case "get_session_not_found": {
      const r = await getSquadSession("00000000-0000-0000-0000-000000000000");
      return NextResponse.json(r);
    }
    default:
      return NextResponse.json({ success: false, code: "UNKNOWN_STEP", message: step });
  }
}