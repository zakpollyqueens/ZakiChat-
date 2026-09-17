-- ZakiChat message attachment metadata

alter table public.messages
  add column if not exists attachment_path text;

alter table public.messages
  add column if not exists attachment_name text;

alter table public.messages
  add column if not exists attachment_mime_type text;

alter table public.messages
  add column if not exists attachment_size bigint;

create index if not exists messages_attachment_path_idx
on public.messages(attachment_path)
where attachment_path is not null;
