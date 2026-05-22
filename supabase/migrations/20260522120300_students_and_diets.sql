-- M4: Students, dietary-tag lookup, student-tag join, and warnings queue.

-- D-01 / E-01: surrogate UUID PK; (school_id, full_name) is SOFT unique
-- (warning at ingest, not a hard constraint) so legitimately same-named students
-- at the same school can coexist after operator confirmation.
-- D-06 / E-15: opted_out boolean on student (persistent), not per-session.
create table public.students (
    id              uuid        primary key default gen_random_uuid(),
    school_id       uuid        not null references public.schools(id) on delete restrict,
    full_name       text        not null,
    year_level      smallint    not null check (year_level in (9, 10, 11, 12)),
    subjects_raw    text,
    student_email   citext,
    parent_name     text,
    parent_email    citext,
    parent_mobile   text,
    dietary_raw     text,
    opted_out       boolean     not null default false,
    source_file     text,
    source_row      jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
-- Soft duplicate-detection index (NOT unique).
create index idx_students_school_name_lower on public.students (school_id, lower(full_name));
create index idx_students_student_email     on public.students (student_email) where student_email is not null;

create trigger trg_students_set_updated_at
    before update on public.students
    for each row execute function public.set_updated_at();

-- E-05: canonical dietary tag vocabulary. Lookup table beats ENUM
-- (no ALTER TYPE for new tags) and beats jsonb (FK integrity).
create table public.dietary_tags (
    code        text        primary key,
    kind        public.dietary_tag_kind not null,
    description text        not null,
    created_at  timestamptz not null default now()
);

-- Seed the 11 codes derived from the source value distribution.
insert into public.dietary_tags (code, kind, description) values
    ('halal',              'religious', 'Halal — inferred per-dish from absence of pork (E-19).'),
    ('vegetarian',         'preference', 'Vegetarian.'),
    ('nut_free',           'allergen',  'Nut allergy — must avoid nuts.'),
    ('gluten_free',        'allergen',  'Gluten intolerance / coeliac — must avoid gluten.'),
    ('dairy_free',         'allergen',  'Dairy intolerance — must avoid dairy.'),
    ('excludes_pork',      'preference', 'Does not eat pork.'),
    ('excludes_beef',      'preference', 'Does not eat beef.'),
    ('excludes_red_meat',  'preference', 'Does not eat red meat (beef, lamb, etc.).'),
    ('excludes_fish',      'preference', 'Does not eat fish.'),
    ('excludes_shellfish', 'allergen',  'Shellfish allergy or exclusion.'),
    ('excludes_seafood',   'preference', 'Does not eat seafood (fish + shellfish).');

create table public.student_dietary_tags (
    student_id  uuid        not null references public.students(id)     on delete cascade,
    tag_code    text        not null references public.dietary_tags(code) on delete restrict,
    created_at  timestamptz not null default now(),
    primary key (student_id, tag_code)
);
create index idx_student_dietary_tags_tag_code on public.student_dietary_tags (tag_code);

-- D-04 / E-12: unrecognised dietary text → operator review queue.
create table public.student_dietary_warnings (
    id                  uuid        primary key default gen_random_uuid(),
    student_id          uuid        not null references public.students(id) on delete cascade,
    raw_value           text        not null,
    status              text        not null default 'pending'
                        check (status in ('pending', 'resolved', 'dismissed')),
    resolved_tag_codes  text[],
    resolved_at         timestamptz,
    resolved_note       text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
-- Partial index: most rows will resolve; queue is the hot path.
create index idx_student_dietary_warnings_pending
    on public.student_dietary_warnings (created_at)
    where status = 'pending';
create index idx_student_dietary_warnings_student_id
    on public.student_dietary_warnings (student_id);

create trigger trg_student_dietary_warnings_set_updated_at
    before update on public.student_dietary_warnings
    for each row execute function public.set_updated_at();

alter table public.students                  enable row level security;
alter table public.dietary_tags              enable row level security;
alter table public.student_dietary_tags      enable row level security;
alter table public.student_dietary_warnings  enable row level security;

revoke all on public.students                 from anon, authenticated;
revoke all on public.dietary_tags             from anon, authenticated;
revoke all on public.student_dietary_tags     from anon, authenticated;
revoke all on public.student_dietary_warnings from anon, authenticated;
