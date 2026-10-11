-- Pesapal API 3.0 payment confirmation. Only the service role may call this function.
create or replace function public.confirm_pesapal_upgrade(
  p_payment_id uuid,
  p_tracking_id text,
  p_amount numeric,
  p_currency text,
  p_payment_method text default null,
  p_confirmation_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.upgrade_payments%rowtype;
  upgrade_row public.user_upgrades%rowtype;
  normalized_currency text := upper(trim(coalesce(p_currency, '')));
begin
  if p_payment_id is null or coalesce(trim(p_tracking_id), '') = '' then
    raise exception 'Payment reference and Pesapal tracking ID are required.';
  end if;

  select * into payment_row
  from public.upgrade_payments
  where id = p_payment_id and provider = 'pesapal'
  for update;

  if not found then
    raise exception 'Pesapal payment request not found.';
  end if;

  if round(payment_row.amount, 2) <> round(coalesce(p_amount, 0), 2)
     or upper(payment_row.currency) <> normalized_currency then
    raise exception 'Verified Pesapal amount or currency does not match the order.';
  end if;

  if payment_row.status = 'paid' then
    if payment_row.provider_transaction_id = p_tracking_id then
      return jsonb_build_object('success', true, 'alreadyProcessed', true, 'paymentId', payment_row.id);
    end if;
    raise exception 'Payment request is already marked paid with a different transaction.';
  end if;

  if payment_row.status <> 'pending' then
    raise exception 'Payment request is not pending.';
  end if;

  insert into public.user_upgrades (
    user_id, plan, price_usd, currency, status, starts_at, expires_at, source
  ) values (
    payment_row.user_id,
    payment_row.plan,
    payment_row.amount,
    payment_row.currency,
    'active',
    now(),
    now() + interval '30 days',
    'pesapal:' || payment_row.id::text
  ) returning * into upgrade_row;

  update public.upgrade_payments
  set status = 'paid',
      provider_transaction_id = p_tracking_id,
      payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
      payment_reference = coalesce(nullif(trim(coalesce(p_confirmation_code, '')), ''), payment_row.payment_reference),
      paid_at = now(),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'pesapal_tracking_id', p_tracking_id,
        'pesapal_confirmation_code', p_confirmation_code,
        'verified_currency', normalized_currency
      )
  where id = payment_row.id;

  return jsonb_build_object('success', true, 'alreadyProcessed', false, 'paymentId', payment_row.id, 'upgradeId', upgrade_row.id);
end;
$$;

revoke all on function public.confirm_pesapal_upgrade(uuid, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.confirm_pesapal_upgrade(uuid, text, numeric, text, text, text) to service_role;
