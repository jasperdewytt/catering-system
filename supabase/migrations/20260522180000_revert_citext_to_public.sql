-- The earlier move broke PostgREST: it specifically expects `public.citext`
-- when constructing INSERT/UPSERT statements for columns of citext type.
-- Move citext back to public. The security advisor 0014 finding will return
-- but that is acceptable — it's INFO-level guidance, not a vulnerability.
alter extension citext set schema public;
