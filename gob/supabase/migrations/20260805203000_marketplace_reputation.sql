-- ============================================================================
-- Backfill: marketplace (listings, player_game_stats)
-- ============================================================================
-- WHY: these tables existed on the live DB but were never version-controlled.
-- Depends on: profiles, game_type, item_type, listing_status (auth_profiles).
-- NOTE: the `reviews` table is NOT here. reviews has a FK to
-- escrow_transactions, so it lives in its own migration
-- (20260805204500_reviews.sql) that runs AFTER the escrow migration
-- (20260805204000). Keeping it here would create a circular dependency:
-- escrow -> listings (this file) and reviews -> escrow.
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. listings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game        public.game_type NOT NULL,
    item_type   public.item_type NOT NULL,
    title       text NOT NULL,
    description text,
    price_bdt   numeric NOT NULL CHECK (price_bdt > 0),
    screenshots text[],
    status      public.listing_status NOT NULL DEFAULT 'active',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. player_game_stats
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_game_stats (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game          public.game_type NOT NULL,
    in_game_name  text NOT NULL,
    rank_or_level text,
    stats         jsonb,
    is_verified   boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT player_game_stats_unique_player_game UNIQUE (player_id, game)
);

-- ----------------------------------------------------------------------------
-- 3. updated_at triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_listings_updated_at ON public.listings;
CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_player_game_stats_updated_at ON public.player_game_stats;
CREATE TRIGGER trg_player_game_stats_updated_at
    BEFORE UPDATE ON public.player_game_stats
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.listings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_game_stats  ENABLE ROW LEVEL SECURITY;

-- listings: public read; owner insert/update/delete.
DROP POLICY IF EXISTS listings_select_all ON public.listings;
CREATE POLICY listings_select_all ON public.listings
    FOR SELECT USING (true);
DROP POLICY IF EXISTS listings_insert_self ON public.listings;
CREATE POLICY listings_insert_self ON public.listings
    FOR INSERT WITH CHECK (seller_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS listings_update_self ON public.listings;
CREATE POLICY listings_update_self ON public.listings
    FOR UPDATE USING (seller_id = auth.uid() OR public.is_admin())
    WITH CHECK (seller_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS listings_delete_self ON public.listings;
CREATE POLICY listings_delete_self ON public.listings
    FOR DELETE USING (seller_id = auth.uid() OR public.is_admin());

-- player_game_stats: public read all, owner write
DROP POLICY IF EXISTS player_game_stats_select_all ON public.player_game_stats;
CREATE POLICY player_game_stats_select_all ON public.player_game_stats
    FOR SELECT USING (true);
DROP POLICY IF EXISTS player_game_stats_insert_self ON public.player_game_stats;
CREATE POLICY player_game_stats_insert_self ON public.player_game_stats
    FOR INSERT WITH CHECK (player_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS player_game_stats_update_self ON public.player_game_stats;
CREATE POLICY player_game_stats_update_self ON public.player_game_stats
    FOR UPDATE USING (player_id = auth.uid() OR public.is_admin())
    WITH CHECK (player_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS player_game_stats_delete_self ON public.player_game_stats;
CREATE POLICY player_game_stats_delete_self ON public.player_game_stats
    FOR DELETE USING (player_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_seller ON public.listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_game_status ON public.listings (game, status);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_player ON public.player_game_stats (player_id);