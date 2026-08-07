-- ============================================================================
-- Backfill: reviews (moved out of marketplace migration to break circular FK)
-- ============================================================================
-- WHY: the reviews table has a FK to escrow_transactions. It was originally
-- bundled with marketplace (listings/player_game_stats), which created a
-- circular dependency: escrow -> listings (marketplace) and reviews -> escrow.
-- This file runs AFTER the escrow migration (20260805204000) to resolve it.
-- Depends on: profiles, escrow_transactions (escrow migration).
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
    reviewer_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating         integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment        text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reviews_transaction_id_reviewer_id_key UNIQUE (transaction_id, reviewer_id)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- reviews: public read all, insert self
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;
CREATE POLICY "Reviews are publicly readable" ON public.reviews
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own review" ON public.reviews;
CREATE POLICY "Users can insert their own review" ON public.reviews
    FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews (reviewee_id);