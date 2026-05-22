-- M3: Sessions (one per school per date) and exclusions (cancellation overrides).

create table public.sessions (
    id              uuid        primary key default gen_random_uuid(),
    school_id       uuid        not null references public.schools(id)  on delete restrict,
    caterer_id      uuid        not null references public.caterers(id) on delete restrict,
    session_date    date        not null,
    -- E-10: parsed time + raw original string for audit.
    start_time      time,
    end_time        time,
    dinner_time     time,
    start_time_raw  text,
    end_time_raw    text,
    dinner_time_raw text,
    manager_name    text,
    manager_mobile  text,
    -- D-03: no `day` column; derive from session_date on display.
    -- Stored on session (not derived from enrolment) so exclusion validation
    -- can run excluded ⊆ year_levels even for years with zero enrolled students.
    year_levels     smallint[]  not null
                    check (array_length(year_levels, 1) >= 1)
                    check (year_levels <@ array[9, 10, 11, 12]::smallint[]),
    -- E-16: building only; room is future capture.
    building        text,
    room            text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (school_id, session_date)
);
create index idx_sessions_session_date on public.sessions (session_date);
create index idx_sessions_caterer_id   on public.sessions (caterer_id);

create trigger trg_sessions_set_updated_at
    before update on public.sessions
    for each row execute function public.set_updated_at();

-- D-02 / E-03: partial year-level cancellation.
-- One exclusion row per session (composite via FK; sessions already
-- enforces (school_id, session_date) unique).
create table public.exclusions (
    id                      uuid        primary key default gen_random_uuid(),
    session_id              uuid        not null unique references public.sessions(id) on delete cascade,
    excluded_year_levels    smallint[]  not null
                            check (array_length(excluded_year_levels, 1) >= 1)
                            check (excluded_year_levels <@ array[9, 10, 11, 12]::smallint[]),
    reason                  text,
    source_file             text,
    source_row              jsonb,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create trigger trg_exclusions_set_updated_at
    before update on public.exclusions
    for each row execute function public.set_updated_at();

alter table public.sessions    enable row level security;
alter table public.exclusions  enable row level security;

revoke all on public.sessions   from anon, authenticated;
revoke all on public.exclusions from anon, authenticated;
