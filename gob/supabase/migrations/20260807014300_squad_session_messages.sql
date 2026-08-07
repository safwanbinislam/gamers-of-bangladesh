-- ============================================================================
-- Squad Finder — session chat (squad_session_messages)
-- ============================================================================
-- Minimal scoped chat so two matched players can coordinate once a squad
-- request is accepted. Follows the established project conventions:
--   * Table shape mirrors dispute_messages
--     (id/sender_id/message/created_at, FK to parent with ON DELETE CASCADE).
--   * RLS mirrors dispute_messages_select / dispute_messages_write exactly —
--     same EXISTS-join to the parent row, participants + public.is_admin().
--   * Eligibility validation lives in a BEFORE INSERT trigger, exactly like
--     validate_squad_session_feedback (cross-table checks belong in a
--     trigger, not a CHECK constraint).
--   * Realtime uses the same ALTER PUBLICATION pattern as squad_sessions.
-- Depends on: profiles, squad_sessions (both exist — referenced via FK,
-- not recreated).
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 17. squad_session_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_session_messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.squad_sessions(id) ON DELETE CASCADE,
    sender_id  uuid NOT NULL REFERENCES public.profiles(id),
    message    text NOT NULL
               CONSTRAINT squad_session_messages_message_length
               CHECK (char_length(message) <= 1000),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 18. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.squad_session_messages ENABLE ROW LEVEL SECURITY;

-- Readable/insertable/deletable only by the session's participants, or an
-- admin — same EXISTS-join pattern as dispute_messages.
DROP POLICY IF EXISTS squad_session_messages_select ON public.squad_session_messages;
CREATE POLICY squad_session_messages_select ON public.squad_session_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.squad_sessions s
            WHERE s.id = squad_session_messages.session_id
              AND (s.initiator_id = auth.uid() OR s.recipient_id = auth.uid() OR public.is_admin())
        )
    );
DROP POLICY IF EXISTS squad_session_messages_write ON public.squad_session_messages;
CREATE POLICY squad_session_messages_write ON public.squad_session_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.squad_sessions s
            WHERE s.id = squad_session_messages.session_id
              AND (s.initiator_id = auth.uid() OR s.recipient_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.squad_sessions s
            WHERE s.id = squad_session_messages.session_id
              AND (s.initiator_id = auth.uid() OR s.recipient_id = auth.uid() OR public.is_admin())
        )
    );

-- ----------------------------------------------------------------------------
-- 19. Message eligibility trigger (BEFORE INSERT)
-- ----------------------------------------------------------------------------
-- WHY A TRIGGER AND NOT A CHECK: eligibility requires joining to
-- squad_sessions (participant check + status check), which a Postgres CHECK
-- constraint cannot do. Same pattern as validate_squad_session_feedback.
CREATE OR REPLACE FUNCTION public.validate_squad_session_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_session public.squad_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_session
    FROM public.squad_sessions
    WHERE id = NEW.session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Squad session % does not exist', NEW.session_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Sender must be the authenticated caller (defense-in-depth; RLS also enforces).
    IF NEW.sender_id <> auth.uid() THEN
        RAISE EXCEPTION 'Messages can only be sent by the authenticated user'
            USING ERRCODE = 'P0001';
    END IF;

    -- Sender must be a participant of the session.
    IF NEW.sender_id <> v_session.initiator_id
       AND NEW.sender_id <> v_session.recipient_id THEN
        RAISE EXCEPTION 'Only a participant of the session can send a message'
            USING ERRCODE = 'P0001';
    END IF;

    -- Only accepted/completed sessions are chat-eligible: nothing to
    -- coordinate on 'requested', 'declined', or 'cancelled' sessions.
    IF v_session.status NOT IN ('accepted', 'completed') THEN
        RAISE EXCEPTION 'Chat is only available once a session is accepted (current status: %)',
            v_session.status USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_squad_session_messages_validate ON public.squad_session_messages;
CREATE TRIGGER trg_squad_session_messages_validate
    BEFORE INSERT ON public.squad_session_messages
    FOR EACH ROW EXECUTE FUNCTION public.validate_squad_session_message();

-- ----------------------------------------------------------------------------
-- 20. Realtime (same pattern as squad_sessions)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_session_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 21. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_squad_session_messages_session
    ON public.squad_session_messages (session_id);