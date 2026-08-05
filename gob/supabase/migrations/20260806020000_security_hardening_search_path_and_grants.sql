-- ============================================================================
-- Security hardening — search_path + SECURITY DEFINER grants
-- ============================================================================
-- WHY: The security advisor flagged two classes of issues on the live DB:
--
--   1. function_search_path_mutable (12 functions): these functions have NO
--      search_path set, so they inherit the caller's mutable search_path.
--      For SECURITY DEFINER functions this is a privilege-escalation vector
--      (a malicious schema earlier in the path could shadow pg_catalog
--      objects). For all functions it makes behavior depend on the caller's
--      session, which is fragile. We pin search_path = '' on all 12 and rely
--      on fully schema-qualified references inside each body (already the
--      case for every one of these functions).
--
--   2. anon/authenticated can EXECUTE SECURITY DEFINER functions (7 unique
--      functions). All 7 are only ever invoked from server-side code (server
--      components, server actions, server libs, API routes) using the user's
--      JWT — never from client components, and never as the anon role. The
--      fix:
--        * REVOKE EXECUTE ... FROM anon on all 7 — anon must never call them.
--        * handle_new_user() is trigger-only (fired by on_auth_user_created);
--          it is never called via RPC, so revoke from authenticated too.
--        * The remaining 6 (advance_winner_to_next_round, create_trade_atomic,
--          generate_bracket, is_admin, report_match_result,
--          set_app_current_user_id) are legitimately invoked by the app with
--          the authenticated role, so authenticated EXECUTE is retained.
--
-- REPO <-> LIVE DRIFT NOTE: the on-disk squad_finder migration already
-- declared SET search_path = '' on get_no_ghost_score, get_squad_matches,
-- request_squad_session, respond_to_squad_session and
-- validate_squad_session_feedback, but the live DB shows proconfig = null for
-- them — the on-disk file was edited after it was applied and never re-applied.
-- This migration uses ALTER FUNCTION ... SET search_path = '' to converge the
-- live DB to the repo's intent without re-specifying any function bodies.
--
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Pin search_path = '' on the 12 flagged functions
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.auto_release_overdue_trades() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.log_escrow_status_change() SET search_path = '';
ALTER FUNCTION public.validate_escrow_transition() SET search_path = '';
ALTER FUNCTION public.validate_dispute_transition() SET search_path = '';
ALTER FUNCTION public.validate_listing_transition() SET search_path = '';
ALTER FUNCTION public.get_no_ghost_score(uuid) SET search_path = '';
ALTER FUNCTION public.set_app_current_user_id() SET search_path = '';
ALTER FUNCTION public.validate_squad_session_feedback() SET search_path = '';
ALTER FUNCTION public.get_squad_matches(uuid, public.game_type, integer) SET search_path = '';
ALTER FUNCTION public.request_squad_session(uuid, public.game_type, timestamp with time zone) SET search_path = '';
ALTER FUNCTION public.respond_to_squad_session(uuid, boolean) SET search_path = '';

-- ----------------------------------------------------------------------------
-- 2. Revoke PUBLIC EXECUTE from all 7 SECURITY DEFINER functions.
--    The live DB grants these to PUBLIC (proacl shows "=X/postgres"), and
--    anon inherits EXECUTE through PUBLIC — so revoking from anon alone is
--    not sufficient. Revoking from PUBLIC removes anon's access entirely.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.advance_winner_to_next_round(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_trade_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_bracket(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_match_result(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_app_current_user_id() FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 3. handle_new_user() is trigger-only — revoke from authenticated too
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ----------------------------------------------------------------------------
-- 4. Re-grant authenticated EXECUTE on the 6 the app legitimately calls
--    (defensive: ensures the revokes above never accidentally removed a grant
--    the app depends on, and makes the intended surface explicit).
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.advance_winner_to_next_round(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_trade_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_bracket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_match_result(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_current_user_id() TO authenticated;