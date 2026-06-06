-- Tokenized student/session-manager feedback forms and quality-loop read models.

alter table public.automation_jobs
    drop constraint if exists automation_jobs_job_type_check,
    add constraint automation_jobs_job_type_check check (
        job_type in (
            'autopilot_run',
            'caterer_reply_poll',
            'feedback_dispatch',
            'feedback_processing'
        )
    );

insert into public.automation_schedules (
    schedule_key,
    daytime_interval_seconds,
    overnight_interval_seconds
)
values ('feedback_dispatch', 300, 900)
on conflict (schedule_key) do nothing;

create table public.feedback_requests (
    id                              uuid        primary key default gen_random_uuid(),
    audience                        text        not null check (
        audience in ('student', 'session_manager')
    ),
    status                          text        not null default 'pending' check (
        status in ('pending', 'sent', 'submitted', 'expired', 'failed')
    ),
    order_run_id                    uuid        references public.order_runs(id) on delete set null,
    session_id                      uuid        not null references public.sessions(id) on delete cascade,
    order_allocation_id             uuid        references public.order_allocations(id) on delete cascade,
    student_id                      uuid        references public.students(id) on delete cascade,
    caterer_id                      uuid        references public.caterers(id) on delete set null,
    email_to                        citext,
    eligible_at                     timestamptz not null,
    expires_at                      timestamptz not null,
    sent_at                         timestamptz,
    submitted_at                    timestamptz,
    send_count                      integer     not null default 0 check (send_count >= 0),
    response_student_feedback_id    uuid        references public.student_meal_feedback(id) on delete set null,
    response_session_feedback_id    uuid        references public.session_catering_feedback(id) on delete set null,
    last_error                      text,
    metadata                        jsonb       not null default '{}'::jsonb,
    created_at                      timestamptz not null default now(),
    updated_at                      timestamptz not null default now(),
    check (expires_at > eligible_at),
    check (
        (audience = 'student' and student_id is not null and order_allocation_id is not null)
        or (audience = 'session_manager' and student_id is null and order_allocation_id is null)
    ),
    check (
        (status = 'submitted' and submitted_at is not null)
        or status <> 'submitted'
    )
);

create unique index idx_feedback_requests_student_allocation
    on public.feedback_requests (order_allocation_id)
    where audience = 'student';
create unique index idx_feedback_requests_manager_session
    on public.feedback_requests (session_id)
    where audience = 'session_manager';
create index idx_feedback_requests_due
    on public.feedback_requests (status, eligible_at, expires_at)
    where status in ('pending', 'failed');
create index idx_feedback_requests_session
    on public.feedback_requests (session_id, audience);
create index idx_feedback_requests_student
    on public.feedback_requests (student_id)
    where student_id is not null;
create index idx_feedback_requests_order_run
    on public.feedback_requests (order_run_id)
    where order_run_id is not null;

create trigger trg_feedback_requests_set_updated_at
    before update on public.feedback_requests
    for each row execute function public.set_updated_at();

create table public.feedback_delivery_attempts (
    id                  uuid        primary key default gen_random_uuid(),
    feedback_request_id  uuid        not null references public.feedback_requests(id) on delete cascade,
    channel             text        not null check (channel in ('email', 'operator_link')),
    status              text        not null check (status in ('sent', 'failed', 'skipped')),
    provider            text,
    message_id          text,
    requested_recipient citext,
    actual_recipient    citext,
    error_detail        text,
    metadata            jsonb       not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);
create index idx_feedback_delivery_attempts_request
    on public.feedback_delivery_attempts (feedback_request_id, created_at desc);

alter table public.caterer_quality_events
    add column if not exists source_student_meal_feedback_id uuid
        references public.student_meal_feedback(id) on delete set null,
    add column if not exists source_session_catering_feedback_id uuid
        references public.session_catering_feedback(id) on delete set null,
    add column if not exists event_key text;

create unique index if not exists idx_caterer_quality_events_event_key
    on public.caterer_quality_events (event_key)
    where event_key is not null;
create index if not exists idx_caterer_quality_events_student_feedback
    on public.caterer_quality_events (source_student_meal_feedback_id)
    where source_student_meal_feedback_id is not null;
create index if not exists idx_caterer_quality_events_session_feedback
    on public.caterer_quality_events (source_session_catering_feedback_id)
    where source_session_catering_feedback_id is not null;

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
            'autopilot_exception_dismissed',
            'exception_resolution_proposed',
            'exception_resolution_applied',
            'exception_resolution_failed',
            'feedback_recorded',
            'feedback_request_created',
            'feedback_invitation_sent',
            'feedback_invitation_failed',
            'feedback_processed',
            'feedback_processing_failed',
            'feedback_demo_reset',
            'caterer_reply_received',
            'order_run_revised',
            'ai_interpretation_recorded',
            'automation_job_queued',
            'automation_job_completed',
            'automation_job_failed',
            'caterer_reply_poll_completed'
        )
    );

alter table public.feedback_requests enable row level security;
alter table public.feedback_delivery_attempts enable row level security;

revoke all on
    public.feedback_requests,
    public.feedback_delivery_attempts
from anon, authenticated;

grant select on
    public.feedback_requests,
    public.feedback_delivery_attempts
to authenticated;

create policy authenticated_operators_select
    on public.feedback_requests
    for select
    to authenticated
    using (exists (
        select 1 from public.operators
        where id = (select auth.uid())
    ));

create policy authenticated_operators_select
    on public.feedback_delivery_attempts
    for select
    to authenticated
    using (exists (
        select 1 from public.operators
        where id = (select auth.uid())
    ));

create or replace view public.operator_feedback_requests
with (security_invoker = true)
as
select
    fr.id as request_id,
    fr.audience,
    fr.status,
    fr.order_run_id,
    oru.service_week_start as week_start,
    fr.session_id,
    s.session_date,
    s.dinner_time,
    s.manager_name,
    sc.canonical_name as school_name,
    fr.student_id,
    st.full_name as student_name,
    fr.caterer_id,
    c.name as caterer_name,
    fr.order_allocation_id,
    fr.email_to::text as email_to,
    fr.eligible_at,
    fr.expires_at,
    fr.sent_at,
    fr.submitted_at,
    fr.send_count,
    fr.response_student_feedback_id,
    fr.response_session_feedback_id,
    fr.last_error,
    fr.metadata,
    fr.created_at,
    fr.updated_at
from public.feedback_requests fr
join public.sessions s on s.id = fr.session_id
join public.schools sc on sc.id = s.school_id
left join public.order_runs oru on oru.id = fr.order_run_id
left join public.students st on st.id = fr.student_id
left join public.caterers c on c.id = fr.caterer_id;

create or replace view public.operator_feedback_overview
with (security_invoker = true)
as
with student_feedback as (
    select
        date_trunc('week', s.session_date::timestamp)::date as week_start,
        count(*)::integer as student_feedback_count,
        avg(smf.rating)::numeric(4,2) as average_student_rating,
        count(*) filter (where smf.rating <= 2)::integer as low_student_rating_count,
        count(*) filter (where nullif(btrim(coalesce(smf.requested_food, '')), '') is not null)::integer as requested_food_count
    from public.student_meal_feedback smf
    left join public.sessions s on s.id = smf.session_id
    group by date_trunc('week', s.session_date::timestamp)::date
),
manager_feedback as (
    select
        date_trunc('week', s.session_date::timestamp)::date as week_start,
        count(*)::integer as manager_feedback_count,
        count(*) filter (
            where scf.delivery_status in ('late', 'missing_items', 'wrong_items', 'not_delivered')
               or scf.food_quality_rating <= 2
               or scf.leftover_level = 'high'
        )::integer as manager_issue_count,
        count(*) filter (
            where scf.delivery_status = 'on_time'
              and coalesce(scf.food_quality_rating, 5) >= 4
              and coalesce(scf.leftover_level, 'none') in ('none', 'low')
        )::integer as manager_positive_count
    from public.session_catering_feedback scf
    join public.sessions s on s.id = scf.session_id
    group by date_trunc('week', s.session_date::timestamp)::date
),
requests as (
    select
        coalesce(oru.service_week_start, date_trunc('week', s.session_date::timestamp)::date) as week_start,
        count(*)::integer as request_count,
        count(*) filter (where fr.status = 'sent')::integer as sent_request_count,
        count(*) filter (where fr.status = 'submitted')::integer as submitted_request_count,
        count(*) filter (where fr.status = 'failed')::integer as failed_request_count
    from public.feedback_requests fr
    join public.sessions s on s.id = fr.session_id
    left join public.order_runs oru on oru.id = fr.order_run_id
    group by coalesce(oru.service_week_start, date_trunc('week', s.session_date::timestamp)::date)
),
quality as (
    select
        date_trunc(
            'week',
            coalesce(s.session_date::timestamptz, cqe.created_at)
        )::date as week_start,
        count(*)::integer as quality_event_count,
        count(*) filter (where cqe.severity = 'serious')::integer as serious_quality_event_count,
        count(*) filter (where cqe.severity = 'review')::integer as review_quality_event_count
    from public.caterer_quality_events cqe
    left join public.sessions s on s.id = cqe.session_id
    group by date_trunc(
        'week',
        coalesce(s.session_date::timestamptz, cqe.created_at)
    )::date
),
weeks as (
    select week_start from student_feedback
    union
    select week_start from manager_feedback
    union
    select week_start from requests
    union
    select week_start from quality
)
select
    weeks.week_start,
    coalesce(requests.request_count, 0)::integer as request_count,
    coalesce(requests.sent_request_count, 0)::integer as sent_request_count,
    coalesce(requests.submitted_request_count, 0)::integer as submitted_request_count,
    coalesce(requests.failed_request_count, 0)::integer as failed_request_count,
    coalesce(student_feedback.student_feedback_count, 0)::integer as student_feedback_count,
    student_feedback.average_student_rating,
    coalesce(student_feedback.low_student_rating_count, 0)::integer as low_student_rating_count,
    coalesce(student_feedback.requested_food_count, 0)::integer as requested_food_count,
    coalesce(manager_feedback.manager_feedback_count, 0)::integer as manager_feedback_count,
    coalesce(manager_feedback.manager_issue_count, 0)::integer as manager_issue_count,
    coalesce(manager_feedback.manager_positive_count, 0)::integer as manager_positive_count,
    coalesce(quality.quality_event_count, 0)::integer as quality_event_count,
    coalesce(quality.serious_quality_event_count, 0)::integer as serious_quality_event_count,
    coalesce(quality.review_quality_event_count, 0)::integer as review_quality_event_count
from weeks
left join requests using (week_start)
left join student_feedback using (week_start)
left join manager_feedback using (week_start)
left join quality using (week_start);

create or replace view public.operator_feedback_weekly_trends
with (security_invoker = true)
as
select
    coalesce(oru.service_week_start, date_trunc('week', s.session_date::timestamp)::date) as week_start,
    count(fr.id)::integer as request_count,
    count(fr.id) filter (where fr.status = 'submitted')::integer as submitted_count,
    count(fr.id) filter (where fr.status = 'failed')::integer as failed_count,
    round(
        100.0 * count(fr.id) filter (where fr.status = 'submitted') / nullif(count(fr.id), 0),
        1
    )::numeric(5,1) as response_rate_percent
from public.feedback_requests fr
join public.sessions s on s.id = fr.session_id
left join public.order_runs oru on oru.id = fr.order_run_id
group by coalesce(oru.service_week_start, date_trunc('week', s.session_date::timestamp)::date);

create or replace view public.operator_caterer_feedback_performance
with (security_invoker = true)
as
with student_rows as (
    select
        s.caterer_id,
        count(*)::integer as student_feedback_count,
        avg(smf.rating)::numeric(4,2) as average_student_rating,
        count(*) filter (where smf.rating <= 2)::integer as low_student_rating_count
    from public.student_meal_feedback smf
    join public.sessions s on s.id = smf.session_id
    group by s.caterer_id
),
manager_rows as (
    select
        coalesce(scf.caterer_id, s.caterer_id) as caterer_id,
        count(*)::integer as manager_feedback_count,
        count(*) filter (
            where scf.delivery_status in ('late', 'missing_items', 'wrong_items', 'not_delivered')
               or scf.food_quality_rating <= 2
               or scf.leftover_level = 'high'
        )::integer as manager_issue_count,
        count(*) filter (
            where scf.delivery_status = 'on_time'
              and coalesce(scf.food_quality_rating, 5) >= 4
              and coalesce(scf.leftover_level, 'none') in ('none', 'low')
        )::integer as manager_positive_count
    from public.session_catering_feedback scf
    join public.sessions s on s.id = scf.session_id
    group by coalesce(scf.caterer_id, s.caterer_id)
),
quality_rows as (
    select
        caterer_id,
        count(*)::integer as quality_event_count,
        count(*) filter (where severity = 'serious')::integer as serious_quality_event_count,
        count(*) filter (where severity = 'review')::integer as review_quality_event_count,
        max(created_at) as latest_quality_event_at
    from public.caterer_quality_events
    group by caterer_id
)
select
    c.id as caterer_id,
    c.name as caterer_name,
    coalesce(student_rows.student_feedback_count, 0)::integer as student_feedback_count,
    student_rows.average_student_rating,
    coalesce(student_rows.low_student_rating_count, 0)::integer as low_student_rating_count,
    coalesce(manager_rows.manager_feedback_count, 0)::integer as manager_feedback_count,
    coalesce(manager_rows.manager_issue_count, 0)::integer as manager_issue_count,
    coalesce(manager_rows.manager_positive_count, 0)::integer as manager_positive_count,
    coalesce(quality_rows.quality_event_count, 0)::integer as quality_event_count,
    coalesce(quality_rows.serious_quality_event_count, 0)::integer as serious_quality_event_count,
    coalesce(quality_rows.review_quality_event_count, 0)::integer as review_quality_event_count,
    quality_rows.latest_quality_event_at
from public.caterers c
left join student_rows on student_rows.caterer_id = c.id
left join manager_rows on manager_rows.caterer_id = c.id
left join quality_rows on quality_rows.caterer_id = c.id;

revoke all on
    public.operator_feedback_requests,
    public.operator_feedback_overview,
    public.operator_feedback_weekly_trends,
    public.operator_caterer_feedback_performance
from anon;

grant select on
    public.operator_feedback_requests,
    public.operator_feedback_overview,
    public.operator_feedback_weekly_trends,
    public.operator_caterer_feedback_performance
to authenticated;
