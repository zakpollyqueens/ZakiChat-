-- Chat messages are restricted by authenticated membership policies; the anon role must not have table-level privileges.
revoke all on table public.messages from anon;
