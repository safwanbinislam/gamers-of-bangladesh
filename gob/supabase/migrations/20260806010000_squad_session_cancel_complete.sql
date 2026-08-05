-- ============================================================================
-- Squad Finder — session lifecycle: cancel + complete
-- ============================================================================
-- UX gap fixes for the Squad Finder no-ghost feedback loop:
--   1. `request_squad_session` already accepts an optional scheduled_at, but
--      the UI never set one, and there was NO way to mark a session
--      'completed'. The feedback trigger only allows feedback for
--      'completed' sessions (or 'accepted' with a past scheduled_at), so the
--      no-ghost score could never be populated. `complete_squad_session`
--      closes that loop.
--   2. `squad_sessions.status` had a 'cancelled' value but no way to reach
--      it. `cancel_squad_session` lets the initiator retract a 'requested'
--      request.
--
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 14. cancel_squad_session(p_session_id) — initiator retracts a pending request
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_squad_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_session public.squad_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_session
    FROM public.squad_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Squad session % does not exist', p_session_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Only the initiator can retract their own outgoing request.
    IF v_session.initiator_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the initiator can cancel this squad request'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_session.status <> 'requested' THEN
        RAISE EXCEPTION 'This squad request has already been responded to (current status: %)',
            v_session.status USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.squad_sessions
    SET status = 'cancelled'::public.squad_session_status
    WHERE id = p_session_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. complete_squad_session(p_session_id) — either participant marks it done
-- ----------------------------------------------------------------------------
-- JUDGMENT CALL: only an 'accepted' session can be completed. This is what
-- unlocks feedback (the validate_squad_session_feedback trigger allows it for
-- 'completed'). Cancelling an accepted session (mutual bail-out) is out of
-- scope for v1 — the initiator can cancel while 'requested', and a completed
-- session is the shared terminal state.
CREATE OR REPLACE FUNCTION public.complete_squad_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_session public.squad_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_session
    FROM public.squad_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Squad session % does not exist', p_session_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Either participant can mark the session as completed (squad happened).
    IF v_session.initiator_id <> auth.uid()
       AND v_session.recipient_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only a participant can complete this squad session'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_session.status <> 'accepted' THEN
        RAISE EXCEPTION 'Only an accepted squad session can be completed (current status: %)',
            v_session.status USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.squad_sessions
    SET status = 'completed'::public.squad_session_status
    WHERE id = p_session_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 16. Grants (authenticated only — a session's own lifecycle)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.cancel_squad_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_squad_session(uuid) TO authenticated;