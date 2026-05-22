-- M1: Extensions, shared trigger function, and enum types.
-- pgcrypto provides gen_random_uuid(); citext provides case-insensitive text.
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Shared trigger function. Sets NEW.updated_at = now() on every UPDATE.
-- Attached per-table by later migrations.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

comment on function public.set_updated_at() is
    'Trigger function: stamps NEW.updated_at = now(). Attach BEFORE UPDATE on every table with an updated_at column.';

-- Closed-set enum types. Adding a value is an ALTER TYPE in a future migration.
create type public.dietary_tag_kind as enum ('allergen', 'religious', 'preference');
create type public.contact_role     as enum ('primary', 'secondary', 'chef', 'manager');
create type public.cc_preference    as enum ('cc', 'do_not_cc', 'unspecified');
