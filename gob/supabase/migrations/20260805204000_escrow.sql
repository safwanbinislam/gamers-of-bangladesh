-- ============================================================================
-- Backfill: escrow + disputes (escrow_transactions, status history, disputes)
-- ============================================================================
-- WHY: these tables/functions/triggers existed on the live DB but were never
-- version-controlled. Depends on: profiles, enums (auth_profiles), listings
-- (marketplace_reputation — reviews FK references escrow_transactions, so
-- escrow must run AFTER marketplace_reputation).
-- Idempotent: safe to run top-to-bottom multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. escrow_transactions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id           uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
    buyer_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    seller_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount_bdt           numeric NOT NULL CHECK (amount_bdt > 0),
    platform_fee_bdt     numeric NOT NULL DEFAULT 0,
    payment_method       public.payment_method_type,
    payment_reference_id text,
    status               public.escrow_status NOT NULL DEFAULT 'awaiting_payment',
    funded_at            timestamptz,
    delivered_at         timestamptz,
    confirmed_at         timestamptz,
    released_at          timestamptz,
    auto_release_deadline timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. transaction_status_history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_status_history (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
    old_status     text,
    new_status     text NOT NULL,
    changed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    note           text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. disputes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
    raised_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason         text NOT NULL,
    status         public.dispute_status NOT NULL DEFAULT 'open',
    admin_notes    text,
    resolved_at    timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. dispute_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id     uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message        text NOT NULL,
    attachment_url text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Functions
-- ----------------------------------------------------------------------------
-- log_escrow_status_change(): AFTER UPDATE trigger helper.
CREATE OR REPLACE FUNCTION public.log_escrow_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
declare
  v_changed_by uuid;
begin
  if new.status is distinct from old.status then
    begin
      v_changed_by := nullif(current_setting('app.current_user_id', true), '')::uuid;
    exception when others then
      v_changed_by := null;
    end;

    insert into public.transaction_status_history (transaction_id, old_status, new_status, changed_by)
    values (new.id, old.status::text, new.status::text, v_changed_by);
  end if;
  return new;
end;
$function$;

-- validate_escrow_transition(): BEFORE UPDATE state machine.
CREATE OR REPLACE FUNCTION public.validate_escrow_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'awaiting_payment' AND NEW.status = 'funds_held' THEN
    IF auth.uid() <> OLD.buyer_id THEN
      RAISE EXCEPTION 'Only the buyer can confirm payment' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.payment_reference_id IS NULL THEN
      RAISE EXCEPTION 'Cannot mark funds_held without a payment_reference_id' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'funds_held' AND NEW.status = 'item_delivered' THEN
    IF auth.uid() <> OLD.seller_id THEN
      RAISE EXCEPTION 'Only the seller can mark item as delivered' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'item_delivered' AND NEW.status IN ('buyer_confirmed', 'released') THEN
    IF auth.uid() <> OLD.buyer_id THEN
      RAISE EXCEPTION 'Only the buyer can confirm receipt' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'buyer_confirmed' AND NEW.status = 'released' THEN
    IF auth.uid() <> OLD.buyer_id AND auth.uid() <> OLD.seller_id THEN
      RAISE EXCEPTION 'Not authorized to release funds on this trade' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('awaiting_payment', 'funds_held', 'item_delivered', 'buyer_confirmed')
     AND NEW.status = 'disputed' THEN
    IF auth.uid() <> OLD.buyer_id AND auth.uid() <> OLD.seller_id THEN
      RAISE EXCEPTION 'Not authorized to dispute this trade' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'awaiting_payment' AND NEW.status = 'cancelled' THEN
    IF auth.uid() <> OLD.buyer_id AND auth.uid() <> OLD.seller_id THEN
      RAISE EXCEPTION 'Not authorized to cancel this trade' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition from % to % by user %',
    OLD.status, NEW.status, auth.uid()
    USING ERRCODE = 'P0001';
END;
$function$;

-- validate_dispute_transition(): BEFORE UPDATE on disputes.
CREATE OR REPLACE FUNCTION public.validate_dispute_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('resolved_buyer', 'resolved_seller', 'resolved_split') THEN
    RAISE EXCEPTION 'Only an admin can resolve a dispute' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- validate_listing_transition(): BEFORE UPDATE on listings.
CREATE OR REPLACE FUNCTION public.validate_listing_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending_trade' THEN
    RAISE EXCEPTION 'Cannot modify a listing while a trade is pending' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- auto_release_overdue_trades(): cron-style job for 48h timeout.
CREATE OR REPLACE FUNCTION public.auto_release_overdue_trades()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
declare
  r record;
begin
  for r in
    select id from public.escrow_transactions
    where status = 'item_delivered'
      and auto_release_deadline is not null
      and auto_release_deadline < now()
  loop
    begin
      update public.escrow_transactions
      set status = 'auto_released',
          released_at = now()
      where id = r.id;

      insert into public.transaction_status_history (
        transaction_id, old_status, new_status, changed_by, note
      ) values (
        r.id, 'item_delivered', 'auto_released', null, 'Auto-released after 48h timeout'
      );
    exception when others then
      raise warning 'auto_release_overdue_trades: failed on transaction %: %', r.id, sqlerrm;
    end;
  end loop;
end;
$function$;

-- set_app_current_user_id(): sets app.current_user_id for history logging.
CREATE OR REPLACE FUNCTION public.set_app_current_user_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM set_config('app.current_user_id', auth.uid()::text, true);
END;
$function$;

-- create_trade_atomic(): single RPC for listing -> escrow creation.
CREATE OR REPLACE FUNCTION public.create_trade_atomic(p_listing_id uuid, p_buyer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_listing public.listings%rowtype;
  v_transaction_id uuid;
begin
  select * into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing % does not exist', p_listing_id
      using errcode = 'P0002';
  end if;

  if v_listing.status <> 'active' then
    raise exception 'Listing % is not available for trade (current status: %)',
      p_listing_id, v_listing.status
      using errcode = 'P0001';
  end if;

  if v_listing.seller_id = p_buyer_id then
    raise exception 'Buyer cannot trade their own listing'
      using errcode = 'P0001';
  end if;

  insert into public.escrow_transactions (
    listing_id, buyer_id, seller_id, amount_bdt, status
  ) values (
    p_listing_id, p_buyer_id, v_listing.seller_id, v_listing.price_bdt, 'awaiting_payment'
  )
  returning id into v_transaction_id;

  update public.listings
  set status = 'pending_trade'
  where id = p_listing_id;

  return v_transaction_id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_escrow_updated_at ON public.escrow_transactions;
CREATE TRIGGER trg_escrow_updated_at
    BEFORE UPDATE ON public.escrow_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_validate_escrow_transition ON public.escrow_transactions;
CREATE TRIGGER trg_validate_escrow_transition
    BEFORE UPDATE ON public.escrow_transactions
    FOR EACH ROW EXECUTE FUNCTION public.validate_escrow_transition();

DROP TRIGGER IF EXISTS trg_escrow_status_history ON public.escrow_transactions;
CREATE TRIGGER trg_escrow_status_history
    AFTER UPDATE ON public.escrow_transactions
    FOR EACH ROW EXECUTE FUNCTION public.log_escrow_status_change();

DROP TRIGGER IF EXISTS trg_validate_dispute_transition ON public.disputes;
CREATE TRIGGER trg_validate_dispute_transition
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION public.validate_dispute_transition();

DROP TRIGGER IF EXISTS trg_validate_listing_transition ON public.listings;
CREATE TRIGGER trg_validate_listing_transition
    BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.validate_listing_transition();

-- ----------------------------------------------------------------------------
-- 7. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.escrow_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages         ENABLE ROW LEVEL SECURITY;

-- escrow_transactions: participants + admin only.
DROP POLICY IF EXISTS escrow_select ON public.escrow_transactions;
CREATE POLICY escrow_select ON public.escrow_transactions
    FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS escrow_write ON public.escrow_transactions;
CREATE POLICY escrow_write ON public.escrow_transactions
    FOR ALL USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin())
    WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());

-- transaction_status_history: participants + admin read; admin insert.
DROP POLICY IF EXISTS tx_history_select ON public.transaction_status_history;
CREATE POLICY tx_history_select ON public.transaction_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.escrow_transactions t
            WHERE t.id = transaction_status_history.transaction_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    );
DROP POLICY IF EXISTS tx_history_admin_write ON public.transaction_status_history;
CREATE POLICY tx_history_admin_write ON public.transaction_status_history
    FOR INSERT WITH CHECK (public.is_admin());

-- disputes: participants + admin.
DROP POLICY IF EXISTS disputes_select ON public.disputes;
CREATE POLICY disputes_select ON public.disputes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.escrow_transactions t
            WHERE t.id = disputes.transaction_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    );
DROP POLICY IF EXISTS disputes_write ON public.disputes;
CREATE POLICY disputes_write ON public.disputes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.escrow_transactions t
            WHERE t.id = disputes.transaction_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.escrow_transactions t
            WHERE t.id = disputes.transaction_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    );

-- dispute_messages: participants of the dispute's transaction.
DROP POLICY IF EXISTS dispute_messages_select ON public.dispute_messages;
CREATE POLICY dispute_messages_select ON public.dispute_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.disputes d
            JOIN public.escrow_transactions t ON t.id = d.transaction_id
            WHERE d.id = dispute_messages.dispute_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    );
DROP POLICY IF EXISTS dispute_messages_write ON public.dispute_messages;
CREATE POLICY dispute_messages_write ON public.dispute_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.disputes d
            JOIN public.escrow_transactions t ON t.id = d.transaction_id
            WHERE d.id = dispute_messages.dispute_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.disputes d
            JOIN public.escrow_transactions t ON t.id = d.transaction_id
            WHERE d.id = dispute_messages.dispute_id
              AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_admin())
        )
    );

-- ----------------------------------------------------------------------------
-- 8. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer ON public.escrow_transactions (buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_seller ON public.escrow_transactions (seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_listing ON public.escrow_transactions (listing_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON public.escrow_transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_history_transaction ON public.transaction_status_history (transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_transaction ON public.disputes (transaction_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON public.dispute_messages (dispute_id);