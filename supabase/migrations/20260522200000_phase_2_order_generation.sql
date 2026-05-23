-- M8: Phase 2 order generation, dish ingredient review, and allocation output.

-- D-08: deterministic dietary matching needs operator-reviewable ingredient flags.
alter table public.dishes
    add column contains_beef boolean not null default false,
    add column contains_pork boolean not null default false,
    add column contains_red_meat boolean not null default false,
    add column contains_fish boolean not null default false,
    add column contains_shellfish boolean not null default false,
    add column ingredient_notes text,
    add column ingredient_flags_source text not null default 'unreviewed'
        check (ingredient_flags_source in ('unreviewed', 'keyword_inferred', 'operator_reviewed')),
    add column tags_reviewed_at timestamptz,
    add column tags_reviewed_by text,
    add column tags_review_reason text,
    add constraint dishes_operator_review_requires_audit check (
        ingredient_flags_source <> 'operator_reviewed'
        or (
            tags_reviewed_at is not null
            and tags_reviewed_by is not null
            and tags_review_reason is not null
        )
    );

-- Stable non-expression key for Supabase upsert. The existing lower(name)
-- unique index still protects case-insensitive duplicates.
alter table public.dishes
    add constraint dishes_caterer_id_name_key unique (caterer_id, name);

update public.dishes
set
    contains_beef =
        lower(name) similar to '%(beef|bolognese|meatball)%',
    contains_pork =
        lower(name) similar to '%(pork|bacon|ham|prosciutto|pancetta|salami|chorizo)%',
    contains_red_meat =
        lower(name) similar to '%(beef|bolognese|meatball|lamb)%',
    contains_fish =
        lower(name) similar to '%(fish|salmon|tuna|cod)%',
    contains_shellfish =
        lower(name) similar to '%(shrimp|prawn|crab|lobster)%',
    ingredient_flags_source = 'keyword_inferred';

create table public.menu_offers (
    id                  uuid        primary key default gen_random_uuid(),
    service_week_start  date        not null,
    dish_id             uuid        not null references public.dishes(id) on delete restrict,
    selected_by         text,
    selected_at         timestamptz not null default now(),
    notes               text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (service_week_start, dish_id)
);
create index idx_menu_offers_week on public.menu_offers (service_week_start);
create index idx_menu_offers_dish_id on public.menu_offers (dish_id);

create trigger trg_menu_offers_set_updated_at
    before update on public.menu_offers
    for each row execute function public.set_updated_at();

create table public.order_runs (
    id                  uuid        primary key default gen_random_uuid(),
    service_week_start  date        not null,
    service_week_end    date        not null check (service_week_end >= service_week_start),
    status              text        not null check (
        status in ('blocked', 'generated', 'approved', 'superseded')
    ),
    algorithm_version   text        not null default 'deterministic-v1',
    generated_by        text,
    generated_at        timestamptz not null default now(),
    input_snapshot      jsonb       not null default '{}'::jsonb,
    issue_count         integer     not null default 0 check (issue_count >= 0),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index idx_order_runs_week on public.order_runs (service_week_start);
create index idx_order_runs_status on public.order_runs (status);

create trigger trg_order_runs_set_updated_at
    before update on public.order_runs
    for each row execute function public.set_updated_at();

create table public.order_allocations (
    id                  uuid        primary key default gen_random_uuid(),
    order_run_id        uuid        not null references public.order_runs(id) on delete cascade,
    session_id          uuid        not null references public.sessions(id) on delete restrict,
    student_id          uuid        not null references public.students(id) on delete restrict,
    dish_id             uuid        references public.dishes(id) on delete restrict,
    status              text        not null check (
        status in (
            'allocated',
            'skipped_opted_out',
            'skipped_absent',
            'skipped_year_excluded',
            'blocked_pending_dietary_warning',
            'blocked_no_menu_offer',
            'blocked_no_safe_dish'
        )
    ),
    reason_codes        text[]      not null default '{}'::text[],
    dietary_tag_codes   text[]      not null default '{}'::text[],
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (order_run_id, student_id, session_id),
    check (
        (status = 'allocated' and dish_id is not null)
        or (status <> 'allocated' and dish_id is null)
    )
);
create index idx_order_allocations_run on public.order_allocations (order_run_id);
create index idx_order_allocations_session on public.order_allocations (session_id);
create index idx_order_allocations_student on public.order_allocations (student_id);
create index idx_order_allocations_dish on public.order_allocations (dish_id) where dish_id is not null;

create trigger trg_order_allocations_set_updated_at
    before update on public.order_allocations
    for each row execute function public.set_updated_at();

create table public.order_lines (
    id                  uuid        primary key default gen_random_uuid(),
    order_run_id        uuid        not null references public.order_runs(id) on delete cascade,
    session_id          uuid        not null references public.sessions(id) on delete restrict,
    dish_id             uuid        not null references public.dishes(id) on delete restrict,
    quantity            integer     not null check (quantity > 0),
    unit_price_cents    integer     not null check (unit_price_cents >= 0),
    gst_inclusive       boolean     not null,
    line_total_cents    integer     not null check (line_total_cents >= 0),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (order_run_id, session_id, dish_id)
);
create index idx_order_lines_run on public.order_lines (order_run_id);
create index idx_order_lines_session on public.order_lines (session_id);
create index idx_order_lines_dish on public.order_lines (dish_id);

create trigger trg_order_lines_set_updated_at
    before update on public.order_lines
    for each row execute function public.set_updated_at();

create table public.order_allocation_issues (
    id                  uuid        primary key default gen_random_uuid(),
    order_run_id        uuid        not null references public.order_runs(id) on delete cascade,
    session_id          uuid        references public.sessions(id) on delete restrict,
    student_id          uuid        references public.students(id) on delete restrict,
    dish_id             uuid        references public.dishes(id) on delete restrict,
    severity            text        not null check (severity in ('warning', 'error')),
    code                text        not null,
    message             text        not null,
    details             jsonb       not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);
create index idx_order_allocation_issues_run on public.order_allocation_issues (order_run_id);
create index idx_order_allocation_issues_severity on public.order_allocation_issues (severity);
create index idx_order_allocation_issues_code on public.order_allocation_issues (code);

alter table public.menu_offers             enable row level security;
alter table public.order_runs              enable row level security;
alter table public.order_allocations       enable row level security;
alter table public.order_lines             enable row level security;
alter table public.order_allocation_issues enable row level security;

revoke all on public.menu_offers             from anon, authenticated;
revoke all on public.order_runs              from anon, authenticated;
revoke all on public.order_allocations       from anon, authenticated;
revoke all on public.order_lines             from anon, authenticated;
revoke all on public.order_allocation_issues from anon, authenticated;
