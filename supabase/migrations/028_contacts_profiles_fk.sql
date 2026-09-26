alter table public.contacts
drop constraint if exists contacts_contact_user_id_fkey;

alter table public.contacts
add constraint contacts_contact_user_id_fkey
foreign key (contact_user_id)
references public.profiles(id)
on delete cascade;
