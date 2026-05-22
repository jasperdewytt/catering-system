-- M5: Many-to-many enrolment, per-caterer dishes, absences.

-- D-05 / E-14: students can attend multiple sessions.
-- The "same student in >1 session on same date" check is Python-side,
-- because legitimately same-named students at different schools are valid
-- (Riley Turner case: two different people).
create table public.session_enrolments (
    student_id  uuid        not null references public.students(id) on delete cascade,
    session_id  uuid        not null references public.sessions(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (student_id, session_id)
);
create index idx_session_enrolments_session_id on public.session_enrolments (session_id);

-- E-13 / E-19 / E-20: per-caterer dishes with declared flags + inferred halal.
-- Boolean columns (not a normalised dish_tags join) because the declared
-- flag set is tiny and closed (GF/DF/NF/VO); is_halal_inferred is metadata
-- about tagging rather than a tag.
create table public.dishes (
    id                      uuid        primary key default gen_random_uuid(),
    caterer_id              uuid        not null references public.caterers(id) on delete cascade,
    name                    text        not null,
    name_raw                text        not null,
    is_gluten_free          boolean     not null default false,
    is_dairy_free           boolean     not null default false,
    is_nut_free             boolean     not null default false,
    is_vegetarian_option    boolean     not null default false,
    is_halal_inferred       boolean     not null,
    halal_inference_note    text,
    -- E-13: explicit flag for "no claim made" so operator UI can surface
    -- the 8 untagged dishes without a NOT(...) expression on every query.
    has_no_declared_tags    boolean     not null default false,
    source_file             text,
    source_row              jsonb,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);
create unique index idx_dishes_caterer_name_lower on public.dishes (caterer_id, lower(name));
create index idx_dishes_caterer_id on public.dishes (caterer_id);

create trigger trg_dishes_set_updated_at
    before update on public.dishes
    for each row execute function public.set_updated_at();

-- E-22: one absence per student per session.
create table public.absences (
    id          uuid        primary key default gen_random_uuid(),
    student_id  uuid        not null references public.students(id) on delete cascade,
    session_id  uuid        not null references public.sessions(id) on delete cascade,
    note        text,
    source_file text,
    source_row  jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (student_id, session_id)
);
create index idx_absences_session_id on public.absences (session_id);
create index idx_absences_student_id on public.absences (student_id);

create trigger trg_absences_set_updated_at
    before update on public.absences
    for each row execute function public.set_updated_at();

alter table public.session_enrolments enable row level security;
alter table public.dishes             enable row level security;
alter table public.absences           enable row level security;

revoke all on public.session_enrolments from anon, authenticated;
revoke all on public.dishes             from anon, authenticated;
revoke all on public.absences           from anon, authenticated;
