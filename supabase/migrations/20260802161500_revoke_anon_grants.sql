-- Supabase grants the `anon` role table privileges in `public` by default.
-- RLS already blocks it (every policy is TO authenticated, so anon matches none),
-- but there's no reason for the grant to exist. Defense in depth.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
