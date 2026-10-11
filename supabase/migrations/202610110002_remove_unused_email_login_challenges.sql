-- The email-login implementation uses Supabase Auth's single-use magic-link verifier.
-- Remove the unused provisional challenge table; it contains no application data.
drop table if exists public.email_login_challenges;
