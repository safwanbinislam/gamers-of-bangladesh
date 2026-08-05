-- ============================================================================
-- Squad Finder — Supabase (Postgres) schema
-- ============================================================================
-- Players set matchmaking preferences once; the platform returns a ranked
-- list of the most compatible currently-active players on read, via a
-- compatibility scoring function. No swiping, no live queue, no voice/audio.
--
-- Assumptions (already verified in this project's schema):
--   * public.profiles exists (id uuid PK -> auth.users, username,
--     avatar_url, reputation_score, ...) — referenced via FK, not recreated
--   * public.game_type enum exists (free_fire | pubg_mobile |
--     mobile_legends | other) — reused
--   * public.is_admin() and public.set_updated_at() exist — reused
--
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. ENUMs
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.squad_session_status AS ENUM (
    'requested', 'accepted', 'declined', 'cancelled', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. squad_preferences — one row per player per game
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_preferences (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game                 public.game_type NOT NULL,
    rank_or_level        text,                                        -- self-reported, free text (e.g. 'Diamond', 'Heroic')
    preferred_squad_size int  NOT NULL DEFAULT 4 CHECK (preferred_squad_size BETWEEN 2 AND 10),
    playtime_days        text[] NOT NULL DEFAULT '{}',                -- e.g. {'friday','saturday','sunday'}
    playtime_start_hour  int  CHECK (playtime_start_hour BETWEEN 0 AND 23),  -- nullable = no set range
    playtime_end_hour    int  CHECK (playtime_end_hour   BETWEEN 0 AND 23),  -- nullable = no set range
    region               text,                                        -- free text, e.g. 'Dhaka', 'Chattogram'
    looking_for_note     text,
    is_active            boolean NOT NULL DEFAULT true,               -- pause being shown without deleting
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT squad_preferences_unique_player_game UNIQUE (player_id, game),
    CONSTRAINT squad_preferences_hours_sane CHECK (
        playtime_start_hour IS NULL OR playtime_end_hour IS NULL OR playtime_start_hour <= playtime_end_hour
    )
);

-- ----------------------------------------------------------------------------
-- 2. squad_sessions — one actual squad-up
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game         public.game_type NOT NULL,
    initiator_id uuid NOT NULL REFERENCES public.profiles(id),
    recipient_id uuid NOT NULL REFERENCES public.profiles(id),
    status       public.squad_session_status NOT NULL DEFAULT 'requested',
    scheduled_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT squad_sessions_no_self CHECK (initiator_id <> recipient_id)
);

-- ----------------------------------------------------------------------------
-- 3. squad_session_feedback — post-session "did this happen as planned" check-in
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_session_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES public.squad_sessions(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL REFERENCES public.profiles(id),   -- who is giving feedback
    subject_id  uuid NOT NULL REFERENCES public.profiles(id),   -- the OTHER participant
    showed_up   boolean NOT NULL,                               -- core "did this happen" signal
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT squad_session_feedback_one_per_reporter UNIQUE (session_id, reporter_id),
    CONSTRAINT squad_session_feedback_no_self CHECK (reporter_id <> subject_id)
);

-- ----------------------------------------------------------------------------
-- 4. updated_at triggers (reuse public.set_updated_at())
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_squad_preferences_updated_at ON public.squad_preferences;
CREATE TRIGGER trg_squad_preferences_updated_at
    BEFORE UPDATE ON public.squad_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_squad_sessions_updated_at ON public.squad_sessions;
CREATE TRIGGER trg_squad_sessions_updated_at
    BEFORE UPDATE ON public.squad_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.squad_preferences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_session_feedback ENABLE ROW LEVEL SECURITY;

-- 5a. squad_preferences
-- Readable by anyone (needed by the matching algorithm + viewing a player's
-- stated prefs before requesting to squad up).
DROP POLICY IF EXISTS squad_preferences_select_all ON public.squad_preferences;
CREATE POLICY squad_preferences_select_all ON public.squad_preferences
    FOR SELECT USING (true);

-- Insert / update / delete only by the row owner, or an admin.
DROP POLICY IF EXISTS squad_preferences_insert_self ON public.squad_preferences;
CREATE POLICY squad_preferences_insert_self ON public.squad_preferences
    FOR INSERT WITH CHECK (player_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS squad_preferences_update_self ON public.squad_preferences;
CREATE POLICY squad_preferences_update_self ON public.squad_preferences
    FOR UPDATE USING (player_id = auth.uid() OR public.is_admin())
    WITH CHECK (player_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS squad_preferences_delete_self ON public.squad_preferences;
CREATE POLICY squad_preferences_delete_self ON public.squad_preferences
    FOR DELETE USING (player_id = auth.uid() OR public.is_admin());

-- 5b. squad_sessions
-- Readable only by the two participants, or an admin.
DROP POLICY IF EXISTS squad_sessions_select_participants ON public.squad_sessions;
CREATE POLICY squad_sessions_select_participants ON public.squad_sessions
    FOR SELECT USING (
        initiator_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin()
    );

-- Insertable by any authenticated user as initiator_id (must equal auth.uid()).
DROP POLICY IF EXISTS squad_sessions_insert_self_initiator ON public.squad_sessions;
CREATE POLICY squad_sessions_insert_self_initiator ON public.squad_sessions
    FOR INSERT WITH CHECK (initiator_id = auth.uid());

-- Updatable only by initiator or recipient (accept/decline/cancel), or admin.
DROP POLICY IF EXISTS squad_sessions_update_participants ON public.squad_sessions;
CREATE POLICY squad_sessions_update_participants ON public.squad_sessions
    FOR UPDATE USING (
        initiator_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin()
    )
    WITH CHECK (
        initiator_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin()
    );

-- 5c. squad_session_feedback
-- Readable by anyone (aggregate no-ghost score is public & verifiable).
DROP POLICY IF EXISTS squad_session_feedback_select_all ON public.squad_session_feedback;
CREATE POLICY squad_session_feedback_select_all ON public.squad_session_feedback
    FOR SELECT USING (true);

-- Insertable only by the reporter themselves. The participant + session
-- eligibility checks live in a trigger (see #6) because they require joining
-- to squad_sessions, which a CHECK constraint cannot do.
DROP POLICY IF EXISTS squad_session_feedback_insert_self ON public.squad_session_feedback;
CREATE POLICY squad_session_feedback_insert_self ON public.squad_session_feedback
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. Feedback validation trigger
-- ----------------------------------------------------------------------------
-- WHY A TRIGGER AND NOT A CHECK: the eligibility rules are cross-table
-- ("reporter is a participant of the referenced session", "session is
-- completed, or accepted with a scheduled time in the past"). Postgres CHECK
-- constraints cannot reference other rows/tables, so this must be a trigger.
-- The "reporter_id = auth.uid()" half is already enforced by the RLS policy
-- above; the trigger adds the parts that need the session row.
CREATE OR REPLACE FUNCTION public.validate_squad_session_feedback()
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

    -- Reporter must be a participant of that session.
    IF NEW.reporter_id <> v_session.initiator_id
       AND NEW.reporter_id <> v_session.recipient_id THEN
        RAISE EXCEPTION 'Only a participant of the session can submit feedback'
            USING ERRCODE = 'P0001';
    END IF;

    -- Reporter must be the authenticated caller (defense-in-depth; RLS also enforces).
    IF NEW.reporter_id <> auth.uid() THEN
        RAISE EXCEPTION 'Feedback must be submitted about yourself'
            USING ERRCODE = 'P0001';
    END IF;

    -- subject_id must be the OTHER participant of the session.
    IF NEW.subject_id <> CASE
            WHEN NEW.reporter_id = v_session.initiator_id THEN v_session.recipient_id
            ELSE v_session.initiator_id
        END THEN
        RAISE EXCEPTION 'subject_id must be the other participant of the session'
            USING ERRCODE = 'P0001';
    END IF;

    -- Eligible only after: status='completed', OR status='accepted' AND the
    -- scheduled time has passed. (Accepted sessions with no scheduled_at are
    -- not feedback-eligible until marked completed — documented judgment call.)
    IF v_session.status <> 'completed'
       AND (v_session.status <> 'accepted'
            OR v_session.scheduled_at IS NULL
            OR v_session.scheduled_at >= now()) THEN
        RAISE EXCEPTION 'Feedback is only allowed for a completed session, or an accepted session whose scheduled time has passed'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_squad_session_feedback_validate ON public.squad_session_feedback;
CREATE TRIGGER trg_squad_session_feedback_validate
    BEFORE INSERT ON public.squad_session_feedback
    FOR EACH ROW EXECUTE FUNCTION public.validate_squad_session_feedback();

-- ----------------------------------------------------------------------------
-- 7. get_no_ghost_score(p_player_id) — numeric 0-100 or NULL when no feedback
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_no_ghost_score(p_player_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN s.total = 0 THEN NULL            -- no track record yet, not "0%"
        ELSE ROUND(100.0 * s.showed_up / s.total, 1)
    END
    FROM (
        SELECT
            count(*) FILTER (WHERE f.showed_up = true) AS showed_up,
            count(*)                                   AS total
        FROM public.squad_session_feedback f
        WHERE f.subject_id = p_player_id
    ) s;
$$;

-- ----------------------------------------------------------------------------
-- 8. get_squad_matches(p_player_id, p_game, p_limit) — ranked compatibility
-- ----------------------------------------------------------------------------
-- COMPATIBILITY WEIGHTING (documented judgment call; adjust in one place):
--   * Region exact match ............ 30 pts  (no region on either side = 0)
--   * Playtime day overlap .......... 30 pts  (shared/union of both day lists)
--   * Playtime hour-range overlap ... 25 pts  (overlap_hours / min(range), capped 25)
--   * Squad size similarity ......... 15 pts  (max(0, 15 * (1 - |dsize|/8)))
--   * Maximum total .................. 100 pts
-- Results order by compatibility DESC, then reputation_score DESC.
-- Excludes: players with an existing 'requested'/'accepted' session with the
-- caller for this game (either direction — "already talking to").
CREATE OR REPLACE FUNCTION public.get_squad_matches(
    p_player_id uuid,
    p_game      public.game_type,
    p_limit     int DEFAULT 20
)
RETURNS TABLE (
    player_id           uuid,
    username            text,
    avatar_url          text,
    reputation_score    numeric,
    rank_or_level       text,
    region              text,
    shared_days         text[],
    hours_overlap       int,
    compatibility_score numeric,
    no_ghost_score      numeric
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH me AS (
        -- The requesting player's own preferences for this game.
        SELECT region, playtime_days, playtime_start_hour, playtime_end_hour, preferred_squad_size
        FROM public.squad_preferences
        WHERE player_id = p_player_id AND game = p_game
    ),
    candidates AS (
        SELECT
            sp.player_id,
            sp.rank_or_level,
            sp.region,
            sp.preferred_squad_size,
            sp.playtime_days,
            sp.playtime_start_hour,
            sp.playtime_end_hour
        FROM public.squad_preferences sp
        WHERE sp.game = p_game
          AND sp.is_active = true
          AND sp.player_id <> p_player_id
          AND NOT EXISTS (
              SELECT 1 FROM public.squad_sessions s
              WHERE s.game = p_game
                AND s.status IN ('requested', 'accepted')
                AND ((s.initiator_id = p_player_id AND s.recipient_id = sp.player_id)
                  OR (s.initiator_id = sp.player_id AND s.recipient_id = p_player_id))
          )
    ),
    scored AS (
        SELECT
            c.player_id,
            c.rank_or_level,
            c.region,
            c.preferred_squad_size,
            c.playtime_days,
            c.playtime_start_hour,
            c.playtime_end_hour,
            -- Shared playtime days between the candidate and the caller.
            COALESCE(ARRAY(
                SELECT d FROM unnest(c.playtime_days) d WHERE d = ANY(me.playtime_days)
            ), '{}'::text[]) AS shared_days,
            COALESCE((SELECT count(*)::int
                      FROM unnest(c.playtime_days) d WHERE d = ANY(me.playtime_days)), 0) AS shared_count,
            COALESCE(cardinality(c.playtime_days), 0) + COALESCE(cardinality(me.playtime_days), 0)
                - COALESCE((SELECT count(*)::int
                            FROM unnest(c.playtime_days) d WHERE d = ANY(me.playtime_days)), 0) AS union_count,
            -- Overlap of [start, end] hour ranges, clamped to >= 0.
            GREATEST(0,
                LEAST(COALESCE(c.playtime_end_hour, -1), COALESCE(me.playtime_end_hour, -1))
              - GREATEST(COALESCE(c.playtime_start_hour, 24), COALESCE(me.playtime_start_hour, 24))
            )::int AS hours_overlap,
            -- Smaller of the two ranges (denominator for hour overlap).
            LEAST(COALESCE(me.playtime_end_hour, 0) - COALESCE(me.playtime_start_hour, 0),
                  COALESCE(c.playtime_end_hour, 0) - COALESCE(c.playtime_start_hour, 0)) AS min_duration
        FROM candidates c
        CROSS JOIN me
    ),
    final AS (
        SELECT
            sc.player_id,
            sc.rank_or_level,
            sc.region,
            sc.shared_days,
            sc.hours_overlap,
            ROUND((
                -- 30 pts: exact region match
                CASE WHEN me.region IS NOT NULL AND sc.region IS NOT NULL AND me.region = sc.region
                     THEN 30.0 ELSE 0.0 END
                -- 30 pts: day overlap (shared / union), proportional
              + CASE WHEN sc.union_count > 0
                     THEN 30.0 * sc.shared_count / sc.union_count ELSE 0.0 END
                -- 25 pts: hour-range overlap (overlap / min range), capped at 25
              + CASE WHEN sc.min_duration > 0 AND sc.hours_overlap > 0
                     THEN LEAST(25.0 * sc.hours_overlap / sc.min_duration, 25.0) ELSE 0.0 END
                -- 15 pts: squad size similarity
              + GREATEST(0.0, 15.0 * (1.0 - ABS(me.preferred_squad_size - sc.preferred_squad_size)::numeric / 8.0))
            ), 1) AS compatibility_score
        FROM scored sc
        CROSS JOIN me
    )
    SELECT
        f.player_id,
        p.username,
        p.avatar_url,
        p.reputation_score,
        f.rank_or_level,
        f.region,
        f.shared_days,
        f.hours_overlap,
        f.compatibility_score,
        public.get_no_ghost_score(f.player_id) AS no_ghost_score
    FROM final f
    JOIN public.profiles p ON p.id = f.player_id
    ORDER BY f.compatibility_score DESC, p.reputation_score DESC
    LIMIT COALESCE(p_limit, 20);
$$;

-- ----------------------------------------------------------------------------
-- 9. request_squad_session(recipient, game, scheduled_at) RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_squad_session(
    p_recipient_id uuid,
    p_game         public.game_type,
    p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_session_id uuid;
BEGIN
    IF p_recipient_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot request to squad up with yourself'
            USING ERRCODE = 'P0001';
    END IF;

    -- Anti-spam: no duplicate pending request between these two players for
    -- this game, checked in BOTH directions so a mutual ping is rejected.
    IF EXISTS (
        SELECT 1 FROM public.squad_sessions
        WHERE game = p_game
          AND status IN ('requested', 'accepted')
          AND ((initiator_id = auth.uid() AND recipient_id = p_recipient_id)
            OR (initiator_id = p_recipient_id AND recipient_id = auth.uid()))
    ) THEN
        RAISE EXCEPTION 'A pending squad request already exists between you and this player for this game'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.squad_sessions (game, initiator_id, recipient_id, status, scheduled_at)
    VALUES (p_game, auth.uid(), p_recipient_id, 'requested', p_scheduled_at)
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. respond_to_squad_session(session_id, accept) RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_squad_session(
    p_session_id uuid,
    p_accept     boolean
)
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

    IF v_session.recipient_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the recipient can respond to this squad request'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_session.status <> 'requested' THEN
        RAISE EXCEPTION 'This squad request has already been responded to (current status: %)',
            v_session.status USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.squad_sessions
    SET status = CASE WHEN p_accept THEN 'accepted'::public.squad_session_status
                      ELSE 'declined'::public.squad_session_status END
    WHERE id = p_session_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Realtime on squad_sessions (live incoming-request notification)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 12. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_squad_preferences_game_active
    ON public.squad_preferences (game, is_active);
CREATE INDEX IF NOT EXISTS idx_squad_sessions_initiator
    ON public.squad_sessions (initiator_id);
CREATE INDEX IF NOT EXISTS idx_squad_sessions_recipient
    ON public.squad_sessions (recipient_id);
CREATE INDEX IF NOT EXISTS idx_squad_session_feedback_subject
    ON public.squad_session_feedback (subject_id);

-- ----------------------------------------------------------------------------
-- 13. Function grants (explicit for the RPCs/reads used by the app)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_squad_matches(uuid, public.game_type, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_no_ghost_score(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_squad_session(uuid, public.game_type, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_squad_session(uuid, boolean) TO authenticated;

-- ============================================================================
-- APPLICATION-LAYER NOTES (read before writing front-end code)
-- ============================================================================
-- 1. INCOMING REQUEST NOTIFICATION: creating a row in squad_sessions does NOT
--    itself send a push/notification. The app should subscribe to Realtime on
--    squad_sessions with filter `recipient_id=eq.<current-user>` (the table is
--    already added to supabase_realtime above) and surface an in-app notice via
--    the existing NotificationBell / toast pattern — e.g. "X wants to squad up".
--
-- 2. FEEDBACK REMINDERS: there is NO automated reminder job in this schema.
--    After a scheduled_at passes (or a session becomes 'completed'), the app
--    should show a "leave feedback" prompt the next time either participant
--    views their session detail. A future pg_cron job (e.g. nightly) could
--    flip stale 'accepted' sessions to 'completed' and/or pre-insert reminder
--    rows — worth adding later if adoption warrants it, but left manual for v1.
--
-- 3. FEEDBACK ELIGIBILITY (important): feedback can only be submitted once
--    both parties can reasonably have played. The trigger permits it when
--    status = 'completed', OR status = 'accepted' AND scheduled_at is in the
--    past. Accepted sessions with no scheduled_at are NOT feedback-eligible
--    until an organizer/admin (or a future job) marks them 'completed' — this
--    is a deliberate judgment call to avoid feedback before a session happened.
--
-- 4. MATCHING REQUIREMENT: get_squad_matches() silently returns zero rows if
--    the requesting player has no squad_preferences row for p_game (the CROSS
--    JOIN on `me` yields nothing). The app should ensure (or prompt) the
--    requesting player to set an active preference for that game first.
--
-- 5. PREFERENCE EDITING: squad_preferences is keyed on (player_id, game), so
--    "set preferences" = upsert on that unique constraint (same pattern as
--    player_game_stats in the Reputation Passport feature). Store rank/region
--    as the player typed them; they are self-reported and unverified.
--
-- 6. NO-GHOST SCORE SEMANTICS: get_no_ghost_score() returns NULL when a player
--    has zero feedback rows (frontend must display "no track record yet" as
--    distinct from a 0% "always ghosts" score). It is a simple percentage
--    (showed_up / total), intentionally NOT weighted and NOT combined with
--    trade reputation_score — trade and squad reputations stay separate.
--
-- 7. PRIVACY: squad_sessions is visible ONLY to the two participants + admin.
--    squad_preferences and squad_session_feedback are public, mirroring how
--    trade reviews are public. Do not expose squad_sessions rows in any
--    aggregated/public listing without a participant check.
-- ============================================================================