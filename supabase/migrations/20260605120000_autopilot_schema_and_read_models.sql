-- Final Stage 2: autopilot, meal-fit, feedback, reply intake, AI provenance,
-- and browser-safe operator read models.

create table public.autopilot_runs (
    id                          uuid        primary key default gen_random_uuid(),
    service_week_start           date        not null,
    idempotency_key              text        not null unique check (length(btrim(idempotency_key)) > 0),
    status                      text        not null check (
        status in ('running', 'resuming', 'completed', 'blocked', 'human_review_required', 'failed')
    ),
    trigger_source              text        not null check (
        trigger_source in ('scheduled', 'manual_demo', 'retry')
    ),
    started_at                  timestamptz not null default now(),
    completed_at                timestamptz,
    summary                     text,
    generated_order_run_id       uuid        references public.order_runs(id) on delete set null,
    exception_count             integer     not null default 0 check (exception_count >= 0),
    emails_prepared_count        integer     not null default 0 check (emails_prepared_count >= 0),
    emails_sent_count            integer     not null default 0 check (emails_sent_count >= 0),
    ai_interpretation_count      integer     not null default 0 check (ai_interpretation_count >= 0),
    metadata                    jsonb       not null default '{}'::jsonb,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now(),
    check (
        completed_at is null
        or status in ('completed', 'blocked', 'human_review_required', 'failed')
    )
);
create index idx_autopilot_runs_week on public.autopilot_runs (service_week_start);
create index idx_autopilot_runs_status on public.autopilot_runs (status);
create index idx_autopilot_runs_started_at on public.autopilot_runs (started_at desc);

create trigger trg_autopilot_runs_set_updated_at
    before update on public.autopilot_runs
    for each row execute function public.set_updated_at();

create table public.autopilot_exceptions (
    id                  uuid        primary key default gen_random_uuid(),
    autopilot_run_id    uuid        references public.autopilot_runs(id) on delete cascade,
    service_week_start  date        not null,
    severity            text        not null check (severity in ('review', 'blocked', 'critical')),
    category            text        not null check (
        category in ('dietary', 'meal_fit', 'caterer_reply', 'quality', 'email', 'validation', 'unknown')
    ),
    title               text        not null check (length(btrim(title)) > 0),
    detail              text        not null check (length(btrim(detail)) > 0),
    recommended_action  text,
    status              text        not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
    ai_confidence       numeric(5,4) check (ai_confidence is null or ai_confidence between 0 and 1),
    student_id          uuid        references public.students(id) on delete set null,
    session_id          uuid        references public.sessions(id) on delete set null,
    caterer_id          uuid        references public.caterers(id) on delete set null,
    order_run_id        uuid        references public.order_runs(id) on delete set null,
    dish_variant_id     uuid        references public.dish_variants(id) on delete set null,
    metadata            jsonb       not null default '{}'::jsonb,
    created_at          timestamptz not null default now(),
    resolved_at         timestamptz,
    resolved_by         uuid        references public.operators(id) on delete set null,
    resolved_note       text,
    updated_at          timestamptz not null default now(),
    check (
        (status = 'open' and resolved_at is null)
        or (status <> 'open' and resolved_at is not null)
    )
);
create index idx_autopilot_exceptions_run on public.autopilot_exceptions (autopilot_run_id);
create index idx_autopilot_exceptions_week_status on public.autopilot_exceptions (service_week_start, status);
create index idx_autopilot_exceptions_category on public.autopilot_exceptions (category);
create index idx_autopilot_exceptions_caterer on public.autopilot_exceptions (caterer_id) where caterer_id is not null;
create index idx_autopilot_exceptions_student on public.autopilot_exceptions (student_id) where student_id is not null;

create trigger trg_autopilot_exceptions_set_updated_at
    before update on public.autopilot_exceptions
    for each row execute function public.set_updated_at();

create table public.preference_tags (
    code        text        primary key,
    category    text        not null check (
        category in ('cuisine_style', 'format', 'sensory', 'protein_style', 'preference_concept', 'review')
    ),
    label       text        not null check (length(btrim(label)) > 0),
    description text        not null,
    is_active   boolean     not null default true,
    created_at  timestamptz not null default now()
);

insert into public.preference_tags (code, category, label, description) values
    ('mexican', 'cuisine_style', 'Mexican', 'Mexican or Tex-Mex style flavours.'),
    ('italian', 'cuisine_style', 'Italian', 'Italian style flavours or dishes.'),
    ('japanese', 'cuisine_style', 'Japanese', 'Japanese style flavours or dishes.'),
    ('asian', 'cuisine_style', 'Asian', 'Broad Asian style flavours where a narrower tag is not appropriate.'),
    ('middle_eastern', 'cuisine_style', 'Middle Eastern', 'Middle Eastern style flavours or dishes.'),
    ('modern_australian', 'cuisine_style', 'Modern Australian', 'Modern Australian cafe-style food.'),
    ('american', 'cuisine_style', 'American', 'American style food.'),
    ('mediterranean', 'cuisine_style', 'Mediterranean', 'Mediterranean style flavours or dishes.'),
    ('wrap', 'format', 'Wrap', 'Wrap or burrito-style handheld meal.'),
    ('bowl', 'format', 'Bowl', 'Bowl-format meal.'),
    ('pasta', 'format', 'Pasta', 'Pasta-format meal.'),
    ('rice', 'format', 'Rice', 'Rice-based meal.'),
    ('salad', 'format', 'Salad', 'Salad-format meal.'),
    ('sandwich', 'format', 'Sandwich', 'Sandwich or roll.'),
    ('burger', 'format', 'Burger', 'Burger-format meal.'),
    ('pizza', 'format', 'Pizza', 'Pizza-format meal.'),
    ('sushi', 'format', 'Sushi', 'Sushi-format meal.'),
    ('snack', 'format', 'Snack', 'Snack-sized item.'),
    ('dessert', 'format', 'Dessert', 'Dessert or dessert-like item.'),
    ('noodle', 'format', 'Noodle', 'Noodle-based meal.'),
    ('curry', 'format', 'Curry', 'Curry-style meal.'),
    ('spicy', 'sensory', 'Spicy', 'Noticeably spicy.'),
    ('mild', 'sensory', 'Mild', 'Mild flavour profile.'),
    ('creamy', 'sensory', 'Creamy', 'Creamy texture or sauce.'),
    ('cheesy', 'sensory', 'Cheesy', 'Cheese-forward item.'),
    ('saucy', 'sensory', 'Saucy', 'Sauce-forward item.'),
    ('fresh', 'sensory', 'Fresh', 'Fresh, crisp, or vegetable-forward item.'),
    ('crispy', 'sensory', 'Crispy', 'Crispy texture.'),
    ('hot_food', 'sensory', 'Hot food', 'Served hot or intended as a hot meal.'),
    ('cold_food', 'sensory', 'Cold food', 'Served cold or suitable cold.'),
    ('plain', 'sensory', 'Plain', 'Plain or simple flavour profile.'),
    ('chicken_style', 'protein_style', 'Chicken style', 'Chicken-forward item.'),
    ('beef_style', 'protein_style', 'Beef style', 'Beef-forward item.'),
    ('seafood_style', 'protein_style', 'Seafood style', 'Seafood-forward item.'),
    ('vegetarian_style', 'protein_style', 'Vegetarian style', 'Vegetarian-forward item.'),
    ('plant_based', 'protein_style', 'Plant based', 'Plant-based or vegan-style item.'),
    ('egg_style', 'protein_style', 'Egg style', 'Egg-forward item.'),
    ('familiar_food', 'preference_concept', 'Familiar food', 'Familiar, low-friction food for students.'),
    ('light_meal', 'preference_concept', 'Light meal', 'Lighter meal.'),
    ('filling_meal', 'preference_concept', 'Filling meal', 'More filling meal.'),
    ('sweet', 'preference_concept', 'Sweet', 'Sweet flavour profile.'),
    ('savory', 'preference_concept', 'Savory', 'Savory flavour profile.'),
    ('easy_to_eat', 'preference_concept', 'Easy to eat', 'Easy to eat during tutoring logistics.'),
    ('customisable', 'preference_concept', 'Customisable', 'Can be customised or has flexible toppings/fillings.'),
    ('other_for_review', 'review', 'Other for review', 'AI could not fit the signal into the canonical taxonomy.')
on conflict (code) do update
set
    category = excluded.category,
    label = excluded.label,
    description = excluded.description,
    is_active = true;

create table public.dish_variant_tags (
    id              uuid        primary key default gen_random_uuid(),
    dish_variant_id uuid        not null references public.dish_variants(id) on delete cascade,
    tag_code        text        not null references public.preference_tags(code) on delete restrict,
    tag_source      text        not null check (tag_source in ('ai_suggested', 'operator_reviewed', 'manual')),
    confidence      numeric(5,4) check (confidence is null or confidence between 0 and 1),
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (dish_variant_id, tag_code)
);
create index idx_dish_variant_tags_tag_code on public.dish_variant_tags (tag_code);
create index idx_dish_variant_tags_variant on public.dish_variant_tags (dish_variant_id);

create trigger trg_dish_variant_tags_set_updated_at
    before update on public.dish_variant_tags
    for each row execute function public.set_updated_at();

create table public.student_meal_feedback (
    id                  uuid        primary key default gen_random_uuid(),
    student_id          uuid        not null references public.students(id) on delete cascade,
    session_id          uuid        references public.sessions(id) on delete set null,
    dish_variant_id     uuid        references public.dish_variants(id) on delete set null,
    order_allocation_id uuid        references public.order_allocations(id) on delete set null,
    rating              smallint    check (rating is null or rating between 1 and 5),
    liked               boolean,
    free_text           text,
    requested_food      text,
    source              text        not null check (source in ('student_form', 'manager_report', 'demo_seed')),
    created_at          timestamptz not null default now(),
    metadata            jsonb       not null default '{}'::jsonb,
    check (
        rating is not null
        or liked is not null
        or nullif(btrim(coalesce(free_text, '')), '') is not null
        or nullif(btrim(coalesce(requested_food, '')), '') is not null
    )
);
create index idx_student_meal_feedback_student on public.student_meal_feedback (student_id, created_at desc);
create index idx_student_meal_feedback_session on public.student_meal_feedback (session_id) where session_id is not null;
create index idx_student_meal_feedback_variant on public.student_meal_feedback (dish_variant_id) where dish_variant_id is not null;

create table public.student_preference_signals (
    id                  uuid        primary key default gen_random_uuid(),
    student_id          uuid        not null references public.students(id) on delete cascade,
    tag_code            text        not null references public.preference_tags(code) on delete restrict,
    affinity_score      numeric(6,4) not null check (affinity_score between -1 and 1),
    confidence          numeric(5,4) not null check (confidence between 0 and 1),
    feedback_count      integer     not null default 0 check (feedback_count >= 0),
    last_observed_at    timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (student_id, tag_code)
);
create index idx_student_preference_signals_student on public.student_preference_signals (student_id);
create index idx_student_preference_signals_tag on public.student_preference_signals (tag_code);

create trigger trg_student_preference_signals_set_updated_at
    before update on public.student_preference_signals
    for each row execute function public.set_updated_at();

create table public.student_fit_debt (
    id                      uuid        primary key default gen_random_uuid(),
    student_id              uuid        not null references public.students(id) on delete cascade,
    service_week_start       date        not null,
    fit_debt_score           numeric(6,4) not null default 0 check (fit_debt_score >= 0),
    reason                  text,
    decayed_from_previous    numeric(6,4) check (decayed_from_previous is null or decayed_from_previous >= 0),
    created_at              timestamptz not null default now(),
    unique (student_id, service_week_start)
);
create index idx_student_fit_debt_week on public.student_fit_debt (service_week_start);
create index idx_student_fit_debt_student on public.student_fit_debt (student_id, service_week_start desc);

create table public.session_catering_feedback (
    id                      uuid        primary key default gen_random_uuid(),
    session_id              uuid        not null references public.sessions(id) on delete cascade,
    caterer_id              uuid        references public.caterers(id) on delete set null,
    delivery_status          text        check (
        delivery_status is null
        or delivery_status in ('on_time', 'late', 'missing_items', 'wrong_items', 'not_delivered', 'unknown')
    ),
    food_quality_rating      smallint    check (food_quality_rating is null or food_quality_rating between 1 and 5),
    leftover_level           text        check (
        leftover_level is null
        or leftover_level in ('none', 'low', 'moderate', 'high', 'unknown')
    ),
    issue_tags              text[]      not null default '{}'::text[],
    manager_notes           text,
    source                  text        not null check (source in ('manager_form', 'operator_note', 'demo_seed')),
    created_at              timestamptz not null default now(),
    metadata                jsonb       not null default '{}'::jsonb
);
create index idx_session_catering_feedback_session on public.session_catering_feedback (session_id, created_at desc);
create index idx_session_catering_feedback_caterer on public.session_catering_feedback (caterer_id, created_at desc)
    where caterer_id is not null;

create table public.caterer_quality_events (
    id              uuid        primary key default gen_random_uuid(),
    caterer_id      uuid        not null references public.caterers(id) on delete cascade,
    session_id      uuid        references public.sessions(id) on delete set null,
    event_type      text        not null check (
        event_type in (
            'late_delivery_pattern',
            'missing_items',
            'food_quality',
            'student_dislike',
            'manager_complaint',
            'positive_feedback',
            'other'
        )
    ),
    severity        text        not null check (severity in ('info', 'review', 'serious')),
    summary         text        not null check (length(btrim(summary)) > 0),
    source          text        not null check (source in ('manager_feedback', 'student_feedback', 'caterer_reply', 'operator_note', 'demo_seed')),
    created_at      timestamptz not null default now(),
    metadata        jsonb       not null default '{}'::jsonb
);
create index idx_caterer_quality_events_caterer on public.caterer_quality_events (caterer_id, created_at desc);
create index idx_caterer_quality_events_type on public.caterer_quality_events (event_type);
create index idx_caterer_quality_events_severity on public.caterer_quality_events (severity);

create table public.caterer_reply_intake (
    id                      uuid        primary key default gen_random_uuid(),
    communication_id         uuid        references public.order_communications(id) on delete set null,
    order_run_id             uuid        references public.order_runs(id) on delete set null,
    caterer_id               uuid        references public.caterers(id) on delete set null,
    provider                 text,
    provider_thread_id       text,
    provider_message_id      text,
    from_email               text,
    subject                 text,
    raw_body                 text        not null,
    received_at              timestamptz not null,
    parsed_intent            text        check (
        parsed_intent is null
        or parsed_intent in (
            'confirmation',
            'item_unavailable',
            'quantity_question',
            'delivery_question',
            'cancellation',
            'other',
            'unknown'
        )
    ),
    handled_status           text        not null default 'received' check (
        handled_status in (
            'received',
            'parsed',
            'auto_handled',
            'auto_adjusted',
            'escalated',
            'ignored',
            'failed'
        )
    ),
    confidence               numeric(5,4) check (confidence is null or confidence between 0 and 1),
    handled_at               timestamptz,
    handling_summary         text,
    metadata                 jsonb       not null default '{}'::jsonb,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);
create index idx_caterer_reply_intake_communication on public.caterer_reply_intake (communication_id)
    where communication_id is not null;
create index idx_caterer_reply_intake_order_run on public.caterer_reply_intake (order_run_id)
    where order_run_id is not null;
create index idx_caterer_reply_intake_caterer on public.caterer_reply_intake (caterer_id, received_at desc)
    where caterer_id is not null;
create index idx_caterer_reply_intake_status on public.caterer_reply_intake (handled_status);

create trigger trg_caterer_reply_intake_set_updated_at
    before update on public.caterer_reply_intake
    for each row execute function public.set_updated_at();

create table public.ai_interpretations (
    id                          uuid        primary key default gen_random_uuid(),
    purpose                     text        not null check (
        purpose in (
            'dish_tagging',
            'student_feedback',
            'manager_feedback',
            'caterer_reply',
            'exception_explanation'
        )
    ),
    provider                    text        not null,
    model                       text        not null,
    prompt_version              text        not null,
    schema_version              text        not null,
    input_hash                  text        not null,
    raw_input                   text,
    raw_output                  text        not null,
    parsed_output               jsonb       not null default '{}'::jsonb,
    confidence                  numeric(5,4) check (confidence is null or confidence between 0 and 1),
    needs_human_review          boolean     not null default false,
    student_meal_feedback_id    uuid        references public.student_meal_feedback(id) on delete set null,
    session_catering_feedback_id uuid       references public.session_catering_feedback(id) on delete set null,
    caterer_reply_id            uuid        references public.caterer_reply_intake(id) on delete set null,
    autopilot_exception_id      uuid        references public.autopilot_exceptions(id) on delete set null,
    metadata                    jsonb       not null default '{}'::jsonb,
    created_at                  timestamptz not null default now()
);
create index idx_ai_interpretations_purpose on public.ai_interpretations (purpose);
create index idx_ai_interpretations_review on public.ai_interpretations (needs_human_review) where needs_human_review;
create index idx_ai_interpretations_created_at on public.ai_interpretations (created_at desc);
create index idx_ai_interpretations_input_hash on public.ai_interpretations (input_hash);

alter table public.caterer_reply_intake
    add column ai_interpretation_id uuid references public.ai_interpretations(id) on delete set null;

create index idx_caterer_reply_intake_ai_interpretation
    on public.caterer_reply_intake (ai_interpretation_id)
    where ai_interpretation_id is not null;

create table public.meal_fit_scoring_versions (
    version         text        primary key,
    weights         jsonb       not null,
    decay_config    jsonb       not null,
    is_active       boolean     not null default false,
    created_at      timestamptz not null default now(),
    check (length(btrim(version)) > 0),
    check (jsonb_typeof(weights) = 'object'),
    check (jsonb_typeof(decay_config) = 'object')
);
create unique index idx_meal_fit_scoring_versions_one_active
    on public.meal_fit_scoring_versions (is_active)
    where is_active;

insert into public.meal_fit_scoring_versions (version, weights, decay_config, is_active) values (
    'meal_fit_v1',
    '{
        "w1_tag_affinity": 2.0,
        "w2_direct_rating": 2.5,
        "w3_population_prior": 1.0,
        "w4_novelty": 0.75,
        "w5_recent_repetition": 1.0,
        "w6_caterer_quality": 1.0,
        "w7_leftover_penalty": 0.75,
        "fit_debt_weight": 1.5,
        "fit_debt_cap": 2.0,
        "waste_weight": 0.35,
        "low_fit_threshold": 0.0
    }'::jsonb,
    '{
        "tag_affinity_half_life_weeks": 8,
        "direct_rating_half_life_weeks": 10,
        "recent_repetition_window_weeks": 3,
        "fit_debt_weekly_decay": 0.25,
        "exploration_bonus_after_try_decay": 1.0,
        "minimum_ai_tag_confidence": 0.70,
        "minimum_ai_auto_handle_confidence": 0.80,
        "score_range": [-1, 1]
    }'::jsonb,
    true
)
on conflict (version) do update
set
    weights = excluded.weights,
    decay_config = excluded.decay_config,
    is_active = excluded.is_active;

create table public.order_allocation_fit_explanations (
    order_allocation_id        uuid        primary key references public.order_allocations(id) on delete cascade,
    scoring_version            text        not null references public.meal_fit_scoring_versions(version) on delete restrict,
    chosen_score               numeric(8,4),
    top_feasible_variant_id     uuid        references public.dish_variants(id) on delete set null,
    top_feasible_score          numeric(8,4),
    constrained_by             text[]      not null default '{}'::text[],
    positive_factors           jsonb       not null default '[]'::jsonb,
    negative_factors           jsonb       not null default '[]'::jsonb,
    fit_debt_applied           numeric(6,4) not null default 0,
    novelty_applied            numeric(6,4) not null default 0,
    explanation                text        not null check (length(btrim(explanation)) > 0),
    metadata                   jsonb       not null default '{}'::jsonb,
    created_at                 timestamptz not null default now(),
    check (jsonb_typeof(positive_factors) = 'array'),
    check (jsonb_typeof(negative_factors) = 'array')
);
create index idx_order_allocation_fit_explanations_version
    on public.order_allocation_fit_explanations (scoring_version);
create index idx_order_allocation_fit_explanations_top_variant
    on public.order_allocation_fit_explanations (top_feasible_variant_id)
    where top_feasible_variant_id is not null;

alter table public.audit_log
    drop constraint if exists audit_log_action_check,
    add constraint audit_log_action_check check (
        action in (
            'order_run_approved',
            'order_run_unapproved',
            'order_run_generated',
            'manual_override_created',
            'communication_exported',
            'communication_sent',
            'communication_send_failed',
            'dish_variant_created',
            'dish_variant_reviewed',
            'dish_variant_availability_updated',
            'menu_offers_updated',
            'autopilot_run_started',
            'autopilot_run_completed',
            'autopilot_exception_created',
            'autopilot_exception_resolved',
            'feedback_recorded',
            'caterer_reply_received',
            'order_run_revised',
            'ai_interpretation_recorded'
        )
    );

alter table public.autopilot_runs                    enable row level security;
alter table public.autopilot_exceptions              enable row level security;
alter table public.preference_tags                   enable row level security;
alter table public.dish_variant_tags                 enable row level security;
alter table public.student_meal_feedback             enable row level security;
alter table public.student_preference_signals        enable row level security;
alter table public.student_fit_debt                  enable row level security;
alter table public.session_catering_feedback         enable row level security;
alter table public.caterer_quality_events            enable row level security;
alter table public.caterer_reply_intake              enable row level security;
alter table public.ai_interpretations                enable row level security;
alter table public.meal_fit_scoring_versions         enable row level security;
alter table public.order_allocation_fit_explanations enable row level security;

revoke all on public.autopilot_runs                    from anon, authenticated;
revoke all on public.autopilot_exceptions              from anon, authenticated;
revoke all on public.preference_tags                   from anon, authenticated;
revoke all on public.dish_variant_tags                 from anon, authenticated;
revoke all on public.student_meal_feedback             from anon, authenticated;
revoke all on public.student_preference_signals        from anon, authenticated;
revoke all on public.student_fit_debt                  from anon, authenticated;
revoke all on public.session_catering_feedback         from anon, authenticated;
revoke all on public.caterer_quality_events            from anon, authenticated;
revoke all on public.caterer_reply_intake              from anon, authenticated;
revoke all on public.ai_interpretations                from anon, authenticated;
revoke all on public.meal_fit_scoring_versions         from anon, authenticated;
revoke all on public.order_allocation_fit_explanations from anon, authenticated;

grant select on
    public.autopilot_runs,
    public.autopilot_exceptions,
    public.preference_tags,
    public.dish_variant_tags,
    public.student_meal_feedback,
    public.student_preference_signals,
    public.student_fit_debt,
    public.session_catering_feedback,
    public.caterer_quality_events,
    public.caterer_reply_intake,
    public.ai_interpretations,
    public.meal_fit_scoring_versions,
    public.order_allocation_fit_explanations
to authenticated;

do $$
declare
    v_table_name text;
begin
    foreach v_table_name in array array[
        'autopilot_runs',
        'autopilot_exceptions',
        'preference_tags',
        'dish_variant_tags',
        'student_meal_feedback',
        'student_preference_signals',
        'student_fit_debt',
        'session_catering_feedback',
        'caterer_quality_events',
        'caterer_reply_intake',
        'ai_interpretations',
        'meal_fit_scoring_versions',
        'order_allocation_fit_explanations'
    ]
    loop
        if not exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = v_table_name
              and policyname = 'authenticated_operators_select'
        ) then
            execute format(
                'create policy authenticated_operators_select on public.%I for select to authenticated using (exists (select 1 from public.operators where id = (select auth.uid())))',
                v_table_name
            );
        end if;
    end loop;
end;
$$;

create or replace view public.operator_autopilot_status
with (security_invoker = true)
as
with latest_runs as (
    select distinct on (ar.service_week_start)
        ar.*
    from public.autopilot_runs ar
    order by ar.service_week_start, ar.started_at desc, ar.created_at desc, ar.id desc
),
exception_counts as (
    select
        ae.autopilot_run_id,
        count(*)::integer as exception_count,
        count(*) filter (where ae.status = 'open')::integer as open_exception_count,
        count(*) filter (where ae.status = 'open' and ae.severity in ('blocked', 'critical'))::integer as blocking_exception_count
    from public.autopilot_exceptions ae
    group by ae.autopilot_run_id
),
communication_counts as (
    select
        oc.order_run_id,
        count(distinct oc.id)::integer as communication_count,
        count(distinct oc.id) filter (where oc.status = 'sent')::integer as sent_communication_count,
        count(distinct oc.id) filter (where oc.status = 'failed')::integer as failed_communication_count
    from public.order_communications oc
    group by oc.order_run_id
)
select
    lr.id as autopilot_run_id,
    lr.service_week_start as week_start,
    lr.idempotency_key,
    lr.status,
    lr.trigger_source,
    lr.started_at,
    lr.completed_at,
    lr.summary,
    lr.generated_order_run_id,
    coalesce(ec.exception_count, lr.exception_count, 0)::integer as exception_count,
    coalesce(ec.open_exception_count, 0)::integer as open_exception_count,
    coalesce(ec.blocking_exception_count, 0)::integer as blocking_exception_count,
    lr.emails_prepared_count,
    lr.emails_sent_count,
    lr.ai_interpretation_count,
    coalesce(cc.communication_count, 0)::integer as communication_count,
    coalesce(cc.sent_communication_count, 0)::integer as sent_communication_count,
    coalesce(cc.failed_communication_count, 0)::integer as failed_communication_count,
    (coalesce(ec.open_exception_count, 0) > 0 or lr.status in ('blocked', 'human_review_required', 'failed')) as requires_human_review,
    lr.metadata
from latest_runs lr
left join exception_counts ec
    on ec.autopilot_run_id = lr.id
left join communication_counts cc
    on cc.order_run_id = lr.generated_order_run_id;

create or replace view public.operator_autopilot_exceptions
with (security_invoker = true)
as
select
    ae.id as exception_id,
    ae.autopilot_run_id,
    ae.service_week_start as week_start,
    ae.severity,
    ae.category,
    ae.title,
    ae.detail,
    ae.recommended_action,
    ae.status,
    ae.ai_confidence,
    ae.student_id,
    st.full_name as student_name,
    ae.session_id,
    s.session_date,
    sc.canonical_name as school_name,
    ae.caterer_id,
    c.name as caterer_name,
    ae.order_run_id,
    ae.dish_variant_id,
    case
        when dv.id is null then null
        when dv.is_default then d.name
        else d.name || ' - ' || dv.name
    end as dish_variant_name,
    ae.metadata,
    ae.created_at,
    ae.resolved_at,
    ae.resolved_by,
    op.display_name as resolved_by_name,
    ae.resolved_note
from public.autopilot_exceptions ae
left join public.students st
    on st.id = ae.student_id
left join public.sessions s
    on s.id = ae.session_id
left join public.schools sc
    on sc.id = s.school_id
left join public.caterers c
    on c.id = ae.caterer_id
left join public.dish_variants dv
    on dv.id = ae.dish_variant_id
left join public.dishes d
    on d.id = dv.dish_id
left join public.operators op
    on op.id = ae.resolved_by;

create or replace view public.operator_meal_fit_signals
with (security_invoker = true)
as
with preference_summary as (
    select
        sps.student_id,
        jsonb_agg(
            jsonb_build_object(
                'tag_code', sps.tag_code,
                'label', pt.label,
                'affinity_score', sps.affinity_score,
                'confidence', sps.confidence,
                'feedback_count', sps.feedback_count,
                'last_observed_at', sps.last_observed_at
            )
            order by abs(sps.affinity_score) desc, sps.confidence desc, sps.tag_code
        ) as preference_signals
    from public.student_preference_signals sps
    join public.preference_tags pt
        on pt.code = sps.tag_code
    group by sps.student_id
),
latest_fit_debt as (
    select distinct on (sfd.student_id)
        sfd.student_id,
        sfd.service_week_start,
        sfd.fit_debt_score,
        sfd.reason
    from public.student_fit_debt sfd
    order by sfd.student_id, sfd.service_week_start desc
)
select
    oa.order_run_id,
    oru.service_week_start as week_start,
    oa.id as allocation_id,
    oa.student_id,
    st.full_name as student_name,
    st.school_id,
    sc.canonical_name as school_name,
    oa.session_id,
    s.session_date,
    oa.dish_variant_id as chosen_dish_variant_id,
    case
        when chosen_variant.id is null then null
        when chosen_variant.is_default then chosen_dish.name
        else chosen_dish.name || ' - ' || chosen_variant.name
    end as chosen_display_name,
    oafe.scoring_version,
    oafe.chosen_score,
    oafe.top_feasible_variant_id,
    case
        when top_variant.id is null then null
        when top_variant.is_default then top_dish.name
        else top_dish.name || ' - ' || top_variant.name
    end as top_feasible_display_name,
    oafe.top_feasible_score,
    oafe.constrained_by,
    oafe.positive_factors,
    oafe.negative_factors,
    oafe.fit_debt_applied,
    oafe.novelty_applied,
    oafe.explanation,
    lfd.fit_debt_score as latest_fit_debt_score,
    lfd.reason as latest_fit_debt_reason,
    coalesce(ps.preference_signals, '[]'::jsonb) as preference_signals,
    oafe.created_at
from public.order_allocation_fit_explanations oafe
join public.order_allocations oa
    on oa.id = oafe.order_allocation_id
join public.order_runs oru
    on oru.id = oa.order_run_id
join public.students st
    on st.id = oa.student_id
join public.schools sc
    on sc.id = st.school_id
join public.sessions s
    on s.id = oa.session_id
left join public.dish_variants chosen_variant
    on chosen_variant.id = oa.dish_variant_id
left join public.dishes chosen_dish
    on chosen_dish.id = chosen_variant.dish_id
left join public.dish_variants top_variant
    on top_variant.id = oafe.top_feasible_variant_id
left join public.dishes top_dish
    on top_dish.id = top_variant.dish_id
left join latest_fit_debt lfd
    on lfd.student_id = oa.student_id
left join preference_summary ps
    on ps.student_id = oa.student_id;

create or replace view public.operator_feedback_events
with (security_invoker = true)
as
select
    smf.id as feedback_id,
    'student_meal_feedback'::text as feedback_type,
    smf.created_at,
    smf.source,
    smf.student_id,
    st.full_name as student_name,
    smf.session_id,
    s.session_date,
    sc.canonical_name as school_name,
    coalesce(smf.dish_variant_id, oa.dish_variant_id) as dish_variant_id,
    case
        when dv.id is null then null
        when dv.is_default then d.name
        else d.name || ' - ' || dv.name
    end as dish_variant_name,
    s.caterer_id,
    c.name as caterer_name,
    smf.rating,
    smf.liked,
    null::text as delivery_status,
    null::text as leftover_level,
    smf.free_text,
    smf.requested_food,
    '{}'::text[] as issue_tags,
    smf.metadata
from public.student_meal_feedback smf
join public.students st
    on st.id = smf.student_id
left join public.sessions s
    on s.id = smf.session_id
left join public.schools sc
    on sc.id = s.school_id
left join public.order_allocations oa
    on oa.id = smf.order_allocation_id
left join public.dish_variants dv
    on dv.id = coalesce(smf.dish_variant_id, oa.dish_variant_id)
left join public.dishes d
    on d.id = dv.dish_id
left join public.caterers c
    on c.id = s.caterer_id
union all
select
    scf.id as feedback_id,
    'session_catering_feedback'::text as feedback_type,
    scf.created_at,
    scf.source,
    null::uuid as student_id,
    null::text as student_name,
    scf.session_id,
    s.session_date,
    sch.canonical_name as school_name,
    null::uuid as dish_variant_id,
    null::text as dish_variant_name,
    coalesce(scf.caterer_id, s.caterer_id) as caterer_id,
    c.name as caterer_name,
    scf.food_quality_rating as rating,
    null::boolean as liked,
    scf.delivery_status,
    scf.leftover_level,
    scf.manager_notes as free_text,
    null::text as requested_food,
    scf.issue_tags,
    scf.metadata
from public.session_catering_feedback scf
join public.sessions s
    on s.id = scf.session_id
join public.schools sch
    on sch.id = s.school_id
left join public.caterers c
    on c.id = coalesce(scf.caterer_id, s.caterer_id);

create or replace view public.operator_caterer_quality_signals
with (security_invoker = true)
as
select
    c.id as caterer_id,
    c.name as caterer_name,
    count(cqe.id)::integer as quality_event_count,
    count(cqe.id) filter (where cqe.severity = 'serious')::integer as serious_event_count,
    count(cqe.id) filter (where cqe.severity = 'review')::integer as review_event_count,
    max(cqe.created_at) as latest_event_at,
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'quality_event_id', cqe.id,
                'event_type', cqe.event_type,
                'severity', cqe.severity,
                'summary', cqe.summary,
                'source', cqe.source,
                'session_id', cqe.session_id,
                'created_at', cqe.created_at,
                'metadata', cqe.metadata
            )
            order by cqe.created_at desc
        ) filter (where cqe.id is not null),
        '[]'::jsonb
    ) as recent_events
from public.caterers c
left join public.caterer_quality_events cqe
    on cqe.caterer_id = c.id
group by c.id, c.name;

create or replace view public.operator_caterer_replies
with (security_invoker = true)
as
select
    cri.id as reply_id,
    cri.communication_id,
    cri.order_run_id,
    oru.service_week_start as week_start,
    cri.caterer_id,
    c.name as caterer_name,
    cri.provider,
    cri.provider_thread_id,
    cri.provider_message_id,
    cri.from_email,
    cri.subject,
    cri.received_at,
    cri.parsed_intent,
    cri.handled_status,
    cri.confidence,
    cri.handled_at,
    cri.handling_summary,
    cri.ai_interpretation_id,
    ai.model as ai_model,
    ai.prompt_version as ai_prompt_version,
    ai.needs_human_review as ai_needs_human_review,
    ai.parsed_output as ai_parsed_output,
    cri.metadata,
    cri.created_at,
    cri.updated_at
from public.caterer_reply_intake cri
left join public.order_runs oru
    on oru.id = cri.order_run_id
left join public.caterers c
    on c.id = cri.caterer_id
left join public.ai_interpretations ai
    on ai.id = cri.ai_interpretation_id;

create or replace view public.operator_ai_interpretations
with (security_invoker = true)
as
select
    ai.id as ai_interpretation_id,
    ai.purpose,
    ai.provider,
    ai.model,
    ai.prompt_version,
    ai.schema_version,
    ai.input_hash,
    ai.parsed_output,
    ai.confidence,
    ai.needs_human_review,
    ai.student_meal_feedback_id,
    ai.session_catering_feedback_id,
    ai.caterer_reply_id,
    ai.autopilot_exception_id,
    ae.service_week_start as exception_week_start,
    ae.title as exception_title,
    cri.caterer_id as reply_caterer_id,
    c.name as reply_caterer_name,
    ai.metadata,
    ai.created_at
from public.ai_interpretations ai
left join public.autopilot_exceptions ae
    on ae.id = ai.autopilot_exception_id
left join public.caterer_reply_intake cri
    on cri.id = ai.caterer_reply_id
left join public.caterers c
    on c.id = cri.caterer_id;

grant select on
    public.operator_autopilot_status,
    public.operator_autopilot_exceptions,
    public.operator_meal_fit_signals,
    public.operator_feedback_events,
    public.operator_caterer_quality_signals,
    public.operator_caterer_replies,
    public.operator_ai_interpretations
to authenticated;
