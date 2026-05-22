-- M2: Schools, school name aliases, caterers, weekly minimums, and contacts.

create table public.schools (
    id              uuid        primary key default gen_random_uuid(),
    canonical_name  text        not null unique,
    short_code      text        not null unique,
    region          text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_schools_canonical_name_lower on public.schools (lower(canonical_name));

create trigger trg_schools_set_updated_at
    before update on public.schools
    for each row execute function public.set_updated_at();

-- E-21: school name punctuation drift ("Moreton Bay Boys'" vs "Moreton Bay Boys").
create table public.school_aliases (
    id          uuid        primary key default gen_random_uuid(),
    school_id   uuid        not null references public.schools(id) on delete cascade,
    alias       citext      not null unique,
    source      text,
    created_at  timestamptz not null default now()
);
create index idx_school_aliases_school_id on public.school_aliases (school_id);

create table public.caterers (
    id                      uuid        primary key default gen_random_uuid(),
    name                    text        not null unique,
    region                  text,
    -- Cents to avoid float drift. GST stance declared per-caterer (E-08).
    per_item_price_cents    integer     not null check (per_item_price_cents >= 0),
    gst_inclusive           boolean     not null,
    gst_rate_bps            integer     not null default 1000 check (gst_rate_bps >= 0),
    -- E-18: delivery scope wording varies; make it explicit.
    delivery_fee_cents      integer     not null default 0 check (delivery_fee_cents >= 0),
    delivery_scope          text        not null check (delivery_scope in ('per_trip', 'per_school_per_trip', 'none')),
    delivery_notes          text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create trigger trg_caterers_set_updated_at
    before update on public.caterers
    for each row execute function public.set_updated_at();

-- D-07 / E-17: normalise the 3-wide source layout.
create table public.caterer_weekly_minimums (
    caterer_id          uuid        not null references public.caterers(id) on delete cascade,
    menu_item_count     smallint    not null check (menu_item_count between 1 and 20),
    minimum_meals       integer     not null check (minimum_meals >= 0),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    primary key (caterer_id, menu_item_count)
);

create trigger trg_caterer_weekly_minimums_set_updated_at
    before update on public.caterer_weekly_minimums
    for each row execute function public.set_updated_at();

-- E-09: pseudonyms and verification flag.
create table public.caterer_contacts (
    id              uuid            primary key default gen_random_uuid(),
    caterer_id      uuid            not null references public.caterers(id) on delete cascade,
    role            public.contact_role not null,
    display_name    text            not null,
    email           citext,
    cc_preference   public.cc_preference not null default 'unspecified',
    role_note       text,
    is_verified     boolean         not null default false,
    source_file     text,
    source_row      jsonb,
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now()
);
create index idx_caterer_contacts_caterer_id on public.caterer_contacts (caterer_id);

create trigger trg_caterer_contacts_set_updated_at
    before update on public.caterer_contacts
    for each row execute function public.set_updated_at();

-- RLS: enable on every table, no policies (deny-all to anon/authenticated).
-- Service-role bypasses RLS for the ingestion pipeline.
alter table public.schools                  enable row level security;
alter table public.school_aliases           enable row level security;
alter table public.caterers                 enable row level security;
alter table public.caterer_weekly_minimums  enable row level security;
alter table public.caterer_contacts         enable row level security;

-- Belt-and-braces: also revoke from anon/authenticated until policies exist.
revoke all on public.schools                 from anon, authenticated;
revoke all on public.school_aliases          from anon, authenticated;
revoke all on public.caterers                from anon, authenticated;
revoke all on public.caterer_weekly_minimums from anon, authenticated;
revoke all on public.caterer_contacts        from anon, authenticated;
