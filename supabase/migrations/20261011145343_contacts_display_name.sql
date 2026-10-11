alter table public.contacts
  add column if not exists display_name text;

comment on column public.contacts.display_name is
  'Optional name chosen by the contact owner for this saved contact.';
