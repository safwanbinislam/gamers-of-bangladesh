-- ============================================================================
-- Backfill: tournaments (tournaments, registrations, matches, prize payouts)
-- ============================================================================
-- WHY: these tables/functions/triggers existed on the live DB but were never
-- version-controlled. Depends on: profiles, enums (auth_profiles), is_admin()
-- (auth_profiles). Enums (tournament_format, tournament_status,
-- tournament_match_status, registration_payment_status, payout_status) are
-- created in 20260805200000_auth_profiles.sql.
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tournaments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournaments (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id          uuid NOT NULL REFERENCES public.profiles(id),
    game                  public.game_type NOT NULL,
    title                 text NOT NULL,
    rules                 text,
    format                public.tournament_format NOT NULL DEFAULT 'single_elimination',
    entry_fee_bdt         numeric NOT NULL DEFAULT 0
                          CONSTRAINT tournaments_entry_fee_bdt_check
                          CHECK (entry_fee_bdt >= 0),
    platform_fee_percent  numeric NOT NULL DEFAULT 10
                          CONSTRAINT tournaments_platform_fee_percent_check
                          CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
    max_participants      integer NOT NULL
                          CONSTRAINT tournaments_max_participants_check
                          CHECK (max_participants >= 2 AND max_participants <= 256),
    prize_split           jsonb NOT NULL DEFAULT '{"1st": 100}'::jsonb
                          CONSTRAINT prize_split_sums_to_100
                          CHECK (validate_prize_split(prize_split)),
    status                public.tournament_status NOT NULL DEFAULT 'draft',
    starts_at             timestamptz NOT NULL,
    registration_closes_at timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. tournament_registrations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_registrations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id        uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    player_id            uuid NOT NULL REFERENCES public.profiles(id),
    payment_method       public.payment_method_type NOT NULL,
    payment_reference_id text,
    payment_status       public.registration_payment_status NOT NULL DEFAULT 'pending',
    seed_position        integer,
    registered_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tournament_registrations_tournament_id_player_id_key UNIQUE (tournament_id, player_id)
);

-- ----------------------------------------------------------------------------
-- 3. tournament_matches
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round_number  integer NOT NULL,
    match_number  integer NOT NULL,
    player1_id    uuid REFERENCES public.profiles(id),
    player2_id    uuid REFERENCES public.profiles(id),
    winner_id     uuid REFERENCES public.profiles(id),
    is_bye        boolean NOT NULL DEFAULT false,
    status        public.tournament_match_status NOT NULL DEFAULT 'pending',
    reported_by   uuid REFERENCES public.profiles(id),
    reported_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tournament_matches_tournament_id_round_number_match_number_key UNIQUE (tournament_id, round_number, match_number)
);

-- ----------------------------------------------------------------------------
-- 4. tournament_prize_payouts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_prize_payouts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    player_id     uuid NOT NULL REFERENCES public.profiles(id),
    placement     integer NOT NULL
                  CONSTRAINT tournament_prize_payouts_placement_check
                  CHECK (placement >= 1),
    amount_bdt    numeric NOT NULL
                  CONSTRAINT tournament_prize_payouts_amount_bdt_check
                  CHECK (amount_bdt >= 0),
    payout_status public.payout_status NOT NULL DEFAULT 'pending',
    paid_at       timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Functions
-- ----------------------------------------------------------------------------
-- advance_winner_to_next_round(): SECURITY DEFINER, search_path pinned.
CREATE OR REPLACE FUNCTION public.advance_winner_to_next_round(
    p_tournament_id uuid,
    p_round_number integer,
    p_match_number integer,
    p_winner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next_round int := p_round_number + 1;
  v_next_match_number int := ceil(p_match_number::numeric / 2);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id AND round_number = v_next_round AND match_number = v_next_match_number
  ) THEN
    RETURN; -- no next round: this was the final match
  END IF;

  IF p_match_number % 2 = 1 THEN
    UPDATE public.tournament_matches
    SET player1_id = p_winner_id,
        status = CASE WHEN player2_id IS NOT NULL THEN 'ready'::public.tournament_match_status ELSE status END
    WHERE tournament_id = p_tournament_id AND round_number = v_next_round AND match_number = v_next_match_number;
  ELSE
    UPDATE public.tournament_matches
    SET player2_id = p_winner_id,
        status = CASE WHEN player1_id IS NOT NULL THEN 'ready'::public.tournament_match_status ELSE status END
    WHERE tournament_id = p_tournament_id AND round_number = v_next_round AND match_number = v_next_match_number;
  END IF;
END;
$function$;

-- generate_bracket(): SECURITY DEFINER, search_path pinned.
CREATE OR REPLACE FUNCTION public.generate_bracket(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_player_ids uuid[];
  v_player_count int;
  v_bracket_size int;
  v_num_byes int;
  v_matches_in_round int;
  v_match_num int;
  v_round int;
  i int;
BEGIN
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament % not found', p_tournament_id;
  END IF;

  IF v_tournament.status <> 'registration_closed' THEN
    RAISE EXCEPTION 'Tournament must be in registration_closed status to generate a bracket (current status: %)', v_tournament.status;
  END IF;

  IF v_tournament.organizer_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the tournament organizer or an admin can generate the bracket';
  END IF;

  -- Fetch paid registrations, randomly shuffled
  SELECT array_agg(player_id ORDER BY random())
  INTO v_player_ids
  FROM public.tournament_registrations
  WHERE tournament_id = p_tournament_id AND payment_status = 'paid';

  v_player_count := coalesce(array_length(v_player_ids, 1), 0);

  IF v_player_count < 2 THEN
    RAISE EXCEPTION 'At least 2 paid registrations are required to generate a bracket (found %)', v_player_count;
  END IF;

  -- Bracket size = next power of 2 >= player count
  v_bracket_size := 1;
  WHILE v_bracket_size < v_player_count LOOP
    v_bracket_size := v_bracket_size * 2;
  END LOOP;

  -- Assign seed positions (order = shuffled order)
  FOR i IN 1..v_player_count LOOP
    UPDATE public.tournament_registrations
    SET seed_position = i
    WHERE tournament_id = p_tournament_id AND player_id = v_player_ids[i];
  END LOOP;

  -- Number of byes = empty slots in the bracket. Each bye consumes exactly
  -- one real player (who advances automatically) and one match slot.
  -- The remaining players are paired two-per-match for real round 1 matches.
  -- byes + (player_count - byes)/2 == bracket_size/2 always holds because
  -- (player_count - byes) = 2*player_count - bracket_size, which is always
  -- even since bracket_size is a power of 2.
  v_num_byes := v_bracket_size - v_player_count;
  v_matches_in_round := v_bracket_size / 2;
  v_match_num := 0;

  -- Create the bye "matches" first — one dedicated real player each
  FOR i IN 1..v_num_byes LOOP
    v_match_num := v_match_num + 1;
    INSERT INTO public.tournament_matches (tournament_id, round_number, match_number, player1_id, player2_id, winner_id, is_bye, status)
    VALUES (p_tournament_id, 1, v_match_num, v_player_ids[i], NULL, v_player_ids[i], true, 'reported');
  END LOOP;

  -- Pair up the remaining players two-per-match for real matches
  i := v_num_byes + 1;
  WHILE i < v_player_count LOOP
    v_match_num := v_match_num + 1;
    INSERT INTO public.tournament_matches (tournament_id, round_number, match_number, player1_id, player2_id, status)
    VALUES (p_tournament_id, 1, v_match_num, v_player_ids[i], v_player_ids[i + 1], 'ready');
    i := i + 2;
  END LOOP;

  -- Sanity check: we should have created exactly bracket_size/2 round-1 matches
  IF v_match_num <> v_matches_in_round THEN
    RAISE EXCEPTION 'Internal bracket sizing error: created % round-1 matches, expected %', v_match_num, v_matches_in_round;
  END IF;

  -- Pre-create shell matches for all subsequent rounds
  v_matches_in_round := v_matches_in_round / 2;
  v_round := 2;
  WHILE v_matches_in_round >= 1 LOOP
    FOR i IN 1..v_matches_in_round LOOP
      INSERT INTO public.tournament_matches (tournament_id, round_number, match_number, status)
      VALUES (p_tournament_id, v_round, i, 'pending');
    END LOOP;
    v_matches_in_round := v_matches_in_round / 2;
    v_round := v_round + 1;
  END LOOP;

  -- Auto-advance round-1 bye winners into round 2 (shells now exist)
  FOR i IN 1..v_num_byes LOOP
    PERFORM public.advance_winner_to_next_round(p_tournament_id, 1, i, v_player_ids[i]);
  END LOOP;

  UPDATE public.tournaments SET status = 'bracket_generated' WHERE id = p_tournament_id;
END;
$function$;

-- report_match_result(): SECURITY DEFINER, search_path pinned.
CREATE OR REPLACE FUNCTION public.report_match_result(p_match_id uuid, p_winner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_next_round_exists boolean;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  IF v_tournament.organizer_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the tournament organizer or an admin can report match results';
  END IF;

  IF v_match.status = 'reported' THEN
    RAISE EXCEPTION 'Match has already been reported';
  END IF;

  IF v_match.player1_id IS NULL OR v_match.player2_id IS NULL THEN
    RAISE EXCEPTION 'Match is not ready — both players must be assigned before a result can be reported';
  END IF;

  IF p_winner_id <> v_match.player1_id AND p_winner_id <> v_match.player2_id THEN
    RAISE EXCEPTION 'Winner % is not a participant in this match', p_winner_id;
  END IF;

  UPDATE public.tournament_matches
  SET winner_id = p_winner_id,
      status = 'reported',
      reported_by = auth.uid(),
      reported_at = now()
  WHERE id = p_match_id;

  IF v_tournament.status = 'bracket_generated' THEN
    UPDATE public.tournaments SET status = 'in_progress' WHERE id = v_tournament.id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE tournament_id = v_match.tournament_id AND round_number = v_match.round_number + 1
  ) INTO v_next_round_exists;

  IF v_next_round_exists THEN
    PERFORM public.advance_winner_to_next_round(v_match.tournament_id, v_match.round_number, v_match.match_number, p_winner_id);
  ELSE
    UPDATE public.tournaments SET status = 'completed' WHERE id = v_match.tournament_id;
  END IF;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER trg_tournaments_updated_at
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tournament_matches_updated_at ON public.tournament_matches;
CREATE TRIGGER trg_tournament_matches_updated_at
    BEFORE UPDATE ON public.tournament_matches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.tournaments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_prize_payouts  ENABLE ROW LEVEL SECURITY;

-- tournaments: public read; organizer/admin write.
DROP POLICY IF EXISTS tournaments_select_all ON public.tournaments;
CREATE POLICY tournaments_select_all ON public.tournaments
    FOR SELECT USING (true);
DROP POLICY IF EXISTS tournaments_insert_organizer ON public.tournaments;
CREATE POLICY tournaments_insert_organizer ON public.tournaments
    FOR INSERT WITH CHECK (organizer_id = auth.uid());
DROP POLICY IF EXISTS tournaments_update_organizer_or_admin ON public.tournaments;
CREATE POLICY tournaments_update_organizer_or_admin ON public.tournaments
    FOR UPDATE USING (organizer_id = auth.uid() OR public.is_admin())
    WITH CHECK (organizer_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS tournaments_delete_organizer_or_admin ON public.tournaments;
CREATE POLICY tournaments_delete_organizer_or_admin ON public.tournaments
    FOR DELETE USING (organizer_id = auth.uid() OR public.is_admin());

-- tournament_registrations: public read; self insert; organizer/admin update/delete.
DROP POLICY IF EXISTS tournament_registrations_select_all ON public.tournament_registrations;
CREATE POLICY tournament_registrations_select_all ON public.tournament_registrations
    FOR SELECT USING (true);
DROP POLICY IF EXISTS tournament_registrations_insert_self ON public.tournament_registrations;
CREATE POLICY tournament_registrations_insert_self ON public.tournament_registrations
    FOR INSERT WITH CHECK (player_id = auth.uid());
DROP POLICY IF EXISTS tournament_registrations_update_organizer_or_admin ON public.tournament_registrations;
CREATE POLICY tournament_registrations_update_organizer_or_admin ON public.tournament_registrations
    FOR UPDATE USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_registrations.tournament_id AND t.organizer_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_registrations.tournament_id AND t.organizer_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS tournament_registrations_delete_organizer_or_admin ON public.tournament_registrations;
CREATE POLICY tournament_registrations_delete_organizer_or_admin ON public.tournament_registrations
    FOR DELETE USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_registrations.tournament_id AND t.organizer_id = auth.uid()
        )
    );

-- tournament_matches: public read; organizer/admin write.
DROP POLICY IF EXISTS tournament_matches_select_all ON public.tournament_matches;
CREATE POLICY tournament_matches_select_all ON public.tournament_matches
    FOR SELECT USING (true);
DROP POLICY IF EXISTS tournament_matches_write_organizer_or_admin ON public.tournament_matches;
CREATE POLICY tournament_matches_write_organizer_or_admin ON public.tournament_matches
    FOR ALL USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_matches.tournament_id AND t.organizer_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_matches.tournament_id AND t.organizer_id = auth.uid()
        )
    );

-- tournament_prize_payouts: public read; organizer/admin write.
DROP POLICY IF EXISTS tournament_prize_payouts_select_all ON public.tournament_prize_payouts;
CREATE POLICY tournament_prize_payouts_select_all ON public.tournament_prize_payouts
    FOR SELECT USING (true);
DROP POLICY IF EXISTS tournament_prize_payouts_write_organizer_or_admin ON public.tournament_prize_payouts;
CREATE POLICY tournament_prize_payouts_write_organizer_or_admin ON public.tournament_prize_payouts
    FOR ALL USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_prize_payouts.tournament_id AND t.organizer_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = tournament_prize_payouts.tournament_id AND t.organizer_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 8. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer ON public.tournaments (organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_game_status ON public.tournaments (game, status);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament ON public.tournament_registrations (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player ON public.tournament_registrations (player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON public.tournament_matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_prize_payouts_tournament ON public.tournament_prize_payouts (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_prize_payouts_player ON public.tournament_prize_payouts (player_id);