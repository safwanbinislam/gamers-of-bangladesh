-- ============================================================================
-- Handle new user + profiles RLS — consolidated, version-controlled
-- ============================================================================
-- WHY: profile creation moved server-side so it happens atomically with the
-- auth user instead of a separate client call in signUp(). This removes the
-- orphaned-auth-user failure mode (auth user exists but no profile row) and
-- deduplicates the insert logic into one place.
--
-- This migration is the single source of truth for BOTH:
--   1. public.handle_new_user() + the on_auth_user_created trigger
--   2. The public.profiles RLS policies
--
-- The profiles RLS policies previously existed ONLY on the live database
-- (never version-controlled) and had drifted into 5 policies with 2 redundant
-- duplicates. This migration consolidates them into the canonical 3-policy set
-- (SELECT / INSERT / UPDATE) and drops the duplicates, so the repo is now the
-- authoritative definition.
--
-- SECURITY DEFINER with empty search_path, per project rules. The trigger
-- fires as the auth pipeline (not as the end user), so it must bypass RLS
-- while remaining fully schema-qualified.
--
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. handle_new_user() function + trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_username text;
BEGIN
    -- Preferred username from the signup form (raw_user_meta_data->>'username'),
    -- falling back to an id-derived handle when missing or blank. The fallback
    -- is derived from the user id, so it cannot collide with another user's
    -- fallback handle.
    v_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
    IF v_username IS NULL THEN
        v_username := 'player_' || replace(new.id::text, '-', '');
    END IF;

    -- ON CONFLICT (id) DO NOTHING keeps the trigger idempotent: it can never
    -- error if a profile row already exists (e.g. rows created before this
    -- trigger shipped, or by the signIn() fallback upsert).
    INSERT INTO public.profiles (id, username)
    VALUES (new.id, v_username)
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. profiles RLS — canonical, version-controlled
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop the redundant/duplicate policies that drifted onto the live DB so the
-- canonical set below is the only definition.
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_write_own ON public.profiles;

-- Publicly readable (usernames/avatars are shown across the platform).
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Profiles are publicly readable" ON public.profiles
    FOR SELECT USING (true);

-- Users can insert their own profile (used by the signIn() fallback upsert).
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile only.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);