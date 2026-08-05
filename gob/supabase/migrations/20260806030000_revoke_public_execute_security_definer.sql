-- ============================================================================
-- Follow-up to 20260806020000_security_hardening_search_path_and_grants.sql
-- ============================================================================
-- WHY THIS EXISTS: after the first migration was applied, the security advisor
-- still flagged the 7 SECURITY DEFINER functions as callable by anon. The
-- root cause: those functions had an EXECUTE grant to PUBLIC (proacl shows
-- "=X/postgres"), and `anon` inherits EXECUTE through PUBLIC. A
-- `REVOKE ... FROM anon` does not remove a PUBLIC grant. This migration
-- revokes the PUBLIC grant itself.
--
-- After this migration the intended ACL for the 7 functions is:
--   * advance_winner_to_next_round : authenticated, service_role
--   * create_trade_atomic          : authenticated, service_role
--   * generate_bracket             : authenticated, service_role
--   * is_admin                     : authenticated, service_role
--   * report_match_result          : authenticated, service_role
--   * set_app_current_user_id      : authenticated, service_role
--   * handle_new_user              : service_role only (trigger-only; it is
--                                     fired by the on_auth_user_created
--                                     trigger and never called via RPC)
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.advance_winner_to_next_round(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_trade_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_bracket(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_match_result(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_app_current_user_id() FROM PUBLIC;