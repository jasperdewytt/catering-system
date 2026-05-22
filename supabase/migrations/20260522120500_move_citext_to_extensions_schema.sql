-- Security advisor 0014: extensions should not live in the public schema.
-- Move citext to a dedicated `extensions` schema. Existing column types continue
-- to work (Postgres tracks types by OID), and future migrations should reference
-- citext as `extensions.citext` or rely on search_path.

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;
alter extension citext set schema extensions;

-- Make `extensions` available without qualification in future SQL (Supabase
-- convention). Belt-and-braces — set on the database and on each role.
alter database postgres set search_path to "$user", public, extensions;
