-- ============================================================================
-- Backfill: auth + profiles foundation (profiles table, enums, base functions)
-- ============================================================================
-- WHY THIS EXISTS: the live database has a `profiles` table, 11 enums, and
-- several base functions that were never version-controlled. The existing
-- migrations (squad_finder, handle_new_user, security hardening) all ASSUME
-- these exist but never create them, so a fresh `supabase db reset` would
-- fail. This migration backfills the foundation.
--
-- TIMESTAMP NOTE: this file is timestamped 20260805200000 so it runs BEFORE
-- the squad_finder migration (20260805201601) and the handle_new_user +
-- profiles RLS migration (20260805210000), both of which reference
-- public.profiles, public.game_type, public.is_admin() and
-- public.set_updated_at().
--
-- SCOPE: creates the profiles table, the 11 enums, and the 3 base functions
-- (is_admin, set_updated_at, validate_prize_split). It does NOT create the
-- profiles RLS policies — those are the single source of truth in
-- 20260805210000_handle_new_user_and_profiles_rls.sql. It does NOT create
-- handle_new_user() — that is also in 20260805210000.
--
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMs (created idempotently, matching the live DB exactly)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.game_type AS ENUM ('free_fire', 'pubg_mobile', 'mobile_legends', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.item_type AS ENUM ('account', 'skin', 'uc', 'diamonds', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.listing_status AS ENUM ('active', 'pending_trade', 'sold', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_type AS ENUM ('bkash', 'nagad');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM (
    'awaiting_payment', 'funds_held', 'item_delivered', 'buyer_confirmed',
    'released', 'disputed', 'refunded', 'cancelled', 'auto_released'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispute_status AS ENUM (
    'open', 'under_review', 'resolved_buyer', 'resolved_seller', 'resolved_split'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payout_status AS ENUM ('pending', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.registration_payment_status AS ENUM ('pending', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tournament_format AS ENUM ('single_elimination');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tournament_status AS ENUM (
    'draft', 'registration_open', 'registration_closed', 'bracket_generated',
    'in_progress', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tournament_match_status AS ENUM ('pending', 'ready', 'reported', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. profiles table
-- ----------------------------------------------------------------------------
-- RLS is enabled + policies created in 20260805210000 (single source of truth).
CREATE TABLE IF NOT EXISTS public.profiles (
    id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username         text NOT NULL UNIQUE,
    avatar_url       text,
    phone_verified   boolean NOT NULL DEFAULT false,
    reputation_score numeric NOT NULL DEFAULT 0,
    total_trades     integer NOT NULL DEFAULT 0,
    is_admin         boolean NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Base functions
-- ----------------------------------------------------------------------------
-- is_admin(): SECURITY DEFINER, search_path pinned to 'public' (matches live).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$function$;

-- set_updated_at(): shared BEFORE UPDATE trigger helper.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- validate_prize_split(): used by the tournaments.prize_split CHECK constraint.
CREATE OR REPLACE FUNCTION public.validate_prize_split(p_split jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(sum(value::numeric), 0) = 100
  FROM jsonb_each_text(p_split);
$function$;