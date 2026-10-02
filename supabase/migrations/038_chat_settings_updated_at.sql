create or replace function public.set_chat_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_settings_updated_at
on public.conversation_user_settings;

create trigger chat_settings_updated_at
before update on public.conversation_user_settings
for each row
execute function public.set_chat_settings_updated_at();
