-- Replace Pesapal-only confirmation with JJuma Pay confirmation for Molan Chat.
drop function if exists public.confirm_pesapal_upgrade(uuid, text, numeric, text, text, text);
create or replace function public.confirm_jjuma_upgrade(
  p_payment_id uuid,
  p_transaction_id text,
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
  if p_payment_id is null or coalesce(trim(p_transaction_id), '') = '' then
    raise exception 'Payment reference and JJuma transaction ID are required.';
  end if;
  select * into payment_row from public.upgrade_payments
    where id = p_payment_id and provider = 'jjuma' for update;
  if not found then raise exception 'JJuma payment request not found.'; end if;
  if round(payment_row.amount, 2) <> round(coalesce(p_amount, 0), 2)
     or upper(payment_row.currency) <> normalized_currency then
    raise exception 'Verified JJuma amount or currency does not match the order.';
  end if;
  if payment_row.status = 'paid' then
    if payment_row.provider_transaction_id = p_transaction_id then
      return jsonb_build_object('success', true, 'alreadyProcessed', true, 'paymentId', payment_row.id);
    end if;
    raise exception 'Payment request is already paid with a different transaction.';
  end if;
  if payment_row.status <> 'pending' then raise exception 'Payment request is not pending.'; end if;
  insert into public.user_upgrades(user_id, plan, price_usd, currency, status, starts_at, expires_at, source)
  values(payment_row.user_id, payment_row.plan,
    coalesce(nullif(payment_row.metadata->>'usd_amount','')::numeric, payment_row.amount),
    payment_row.currency, 'active', now(), now() + interval '30 days', 'jjuma:' || payment_row.id::text)
  returning * into upgrade_row;
  update public.upgrade_payments set status='paid', provider='jjuma',
    provider_transaction_id=p_transaction_id,
    payment_method=nullif(trim(coalesce(p_payment_method,'')),''),
    payment_reference=coalesce(nullif(trim(coalesce(p_confirmation_code,'')),''),payment_row.payment_reference),
    paid_at=now(), updated_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'jjuma_transaction_id',p_transaction_id,'jjuma_confirmation_code',p_confirmation_code,'verified_currency',normalized_currency)
  where id=payment_row.id;
  return jsonb_build_object('success',true,'alreadyProcessed',false,'paymentId',payment_row.id,'upgradeId',upgrade_row.id);
end;
$$;
revoke all on function public.confirm_jjuma_upgrade(uuid,text,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.confirm_jjuma_upgrade(uuid,text,numeric,text,text,text) to service_role;
