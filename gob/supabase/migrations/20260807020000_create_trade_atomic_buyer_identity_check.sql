-- ============================================================================
-- create_trade_atomic: enforce buyer identity inside the RPC (defense in depth)
-- ============================================================================
-- WHY: create_trade_atomic carries an EXECUTE grant for `authenticated` because
-- the app's core create-trade path (src/lib/actions/trades.ts -> initiateTrade)
-- calls it with the caller's session. Previously the function trusted whatever
-- p_buyer_id it was given, so a malicious authenticated user could call
-- /rest/v1/rpc/create_trade_atomic directly with ANOTHER user's UUID and:
--   * create an escrow_transactions row on that user's behalf, and
--   * flip that user's listing to 'pending_trade' (griefing / DoS).
-- The app passes the session user id, but the RPC itself never verified
-- auth.uid() = p_buyer_id. Fix: reject any call where p_buyer_id is not the
-- authenticated caller.
--
-- Idempotent (CREATE OR REPLACE preserves existing EXECUTE grants).
-- ============================================================================

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
  -- Defense in depth: the caller must be the buyer they claim to be. This is
  -- checked inside the RPC (not only in application code) so direct REST
  -- callers cannot spoof another user's buyer_id. Uses IS DISTINCT FROM so a
  -- NULL auth.uid() (anon/background session) also fails closed.
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'Buyer must be the authenticated user'
      using errcode = 'P0001';
  end if;

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
