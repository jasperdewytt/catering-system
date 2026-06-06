-- Durable automation jobs for scheduled reply polling and live autopilot progress.

create table public.automation_jobs (
    id                       uuid        primary key default gen_random_uuid(),
    job_type                 text        not null check (
        job_type in ('autopilot_run', 'caterer_reply_poll')
    ),
    idempotency_key          text        not null unique check (length(btrim(idempotency_key)) > 0),
    status                   text        not null default 'queued' check (
        status in ('queued', 'running', 'completed', 'failed')
    ),
    trigger_source           text        not null check (
        trigger_source in ('scheduled', 'manual', 'retry')
    ),
    payload                  jsonb       not null default '{}'::jsonb,
    current_stage            text        not null default 'queued',
    stage_label              text        not null default 'Queued',
    progress_percent         integer     not null default 0 check (
        progress_percent between 0 and 100
    ),
    counters                 jsonb       not null default '{}'::jsonb,
    result                   jsonb       not null default '{}'::jsonb,
    error_detail             text,
    actor_id                 uuid        references public.operators(id) on delete set null,
    actor_name               text        not null check (length(btrim(actor_name)) > 0),
    linked_autopilot_run_id  uuid        references public.autopilot_runs(id) on delete set null,
    available_at             timestamptz not null default now(),
    lease_owner              text,
    lease_expires_at         timestamptz,
    attempt_count            integer     not null default 0 check (attempt_count >= 0),
    max_attempts             integer     not null default 3 check (max_attempts > 0),
    started_at               timestamptz,
    completed_at             timestamptz,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    check (
        (status in ('queued', 'running') and completed_at is null)
        or (status in ('completed', 'failed') and completed_at is not null)
    )
);

create unique index idx_automation_jobs_one_active_scope
    on public.automation_jobs (
        job_type,
        coalesce(payload ->> 'week_start', '')
    )
    where status in ('queued', 'running');
create index idx_automation_jobs_claim
    on public.automation_jobs (status, available_at, created_at)
    where status in ('queued', 'running');
create index idx_automation_jobs_created
    on public.automation_jobs (created_at desc);

create trigger trg_automation_jobs_set_updated_at
    before update on public.automation_jobs
    for each row execute function public.set_updated_at();

create table public.automation_job_events (
    id                uuid        primary key default gen_random_uuid(),
    automation_job_id uuid        not null references public.automation_jobs(id) on delete cascade,
    event_type        text        not null check (
        event_type in ('queued', 'started', 'stage_changed', 'retrying', 'completed', 'failed')
    ),
    stage_code        text,
    stage_label       text,
    progress_percent  integer     check (progress_percent between 0 and 100),
    detail            text,
    counters          jsonb       not null default '{}'::jsonb,
    metadata          jsonb       not null default '{}'::jsonb,
    created_at        timestamptz not null default now()
);

create index idx_automation_job_events_job
    on public.automation_job_events (automation_job_id, created_at, id);

create table public.automation_schedules (
    schedule_key              text        primary key,
    enabled                   boolean     not null default true,
    timezone                  text        not null default 'Australia/Brisbane',
    daytime_start             time        not null default '07:00',
    daytime_end               time        not null default '21:00',
    daytime_interval_seconds  integer     not null default 120 check (
        daytime_interval_seconds > 0
    ),
    overnight_interval_seconds integer    not null default 600 check (
        overnight_interval_seconds > 0
    ),
    last_checked_at           timestamptz,
    last_success_at           timestamptz,
    next_check_at             timestamptz not null default now(),
    last_job_id               uuid        references public.automation_jobs(id) on delete set null,
    last_result               jsonb       not null default '{}'::jsonb,
    last_error                text,
    worker_heartbeat_at       timestamptz,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now()
);

create trigger trg_automation_schedules_set_updated_at
    before update on public.automation_schedules
    for each row execute function public.set_updated_at();

insert into public.automation_schedules (schedule_key)
values ('caterer_reply_poll')
on conflict (schedule_key) do nothing;

create or replace function public.claim_automation_job(
    p_worker_id text,
    p_lease_seconds integer default 120
)
returns setof public.automation_jobs
language plpgsql
set search_path = public
as $$
declare
    v_job public.automation_jobs%rowtype;
begin
    if nullif(btrim(p_worker_id), '') is null then
        raise exception 'worker id is required';
    end if;

    select *
    into v_job
    from public.automation_jobs
    where
        (
            status = 'queued'
            or (
                status = 'running'
                and lease_expires_at is not null
                and lease_expires_at <= now()
            )
        )
        and available_at <= now()
    order by available_at, created_at, id
    for update skip locked
    limit 1;

    if not found then
        return;
    end if;

    update public.automation_jobs
    set
        status = 'running',
        lease_owner = p_worker_id,
        lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
        attempt_count = attempt_count + 1,
        started_at = coalesce(started_at, now()),
        error_detail = null
    where id = v_job.id
    returning * into v_job;

    return next v_job;
end;
$$;

revoke all on function public.claim_automation_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_automation_job(text, integer) to service_role;

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
            'caterer_reply_received',
            'order_run_revised',
            'ai_interpretation_recorded',
            'automation_job_queued',
            'automation_job_completed',
            'automation_job_failed',
            'caterer_reply_poll_completed'
        )
    );

alter table public.automation_jobs enable row level security;
alter table public.automation_job_events enable row level security;
alter table public.automation_schedules enable row level security;

revoke all on
    public.automation_jobs,
    public.automation_job_events,
    public.automation_schedules
from anon, authenticated;

grant select on
    public.automation_jobs,
    public.automation_job_events,
    public.automation_schedules
to authenticated;

create policy authenticated_operators_select
    on public.automation_jobs
    for select
    to authenticated
    using (exists (
        select 1 from public.operators
        where id = (select auth.uid())
    ));

create policy authenticated_operators_select
    on public.automation_job_events
    for select
    to authenticated
    using (exists (
        select 1 from public.operators
        where id = (select auth.uid())
    ));

create policy authenticated_operators_select
    on public.automation_schedules
    for select
    to authenticated
    using (exists (
        select 1 from public.operators
        where id = (select auth.uid())
    ));

create or replace view public.operator_automation_jobs
with (security_invoker = true)
as
select
    aj.id as job_id,
    aj.job_type,
    aj.status,
    aj.trigger_source,
    aj.payload ->> 'week_start' as week_start,
    aj.current_stage,
    aj.stage_label,
    aj.progress_percent,
    aj.counters,
    aj.result,
    aj.error_detail,
    aj.actor_name,
    aj.linked_autopilot_run_id,
    aj.attempt_count,
    aj.max_attempts,
    aj.started_at,
    aj.completed_at,
    aj.created_at,
    aj.updated_at
from public.automation_jobs aj;

create or replace view public.operator_automation_job_events
with (security_invoker = true)
as
select
    aje.id as event_id,
    aje.automation_job_id as job_id,
    aje.event_type,
    aje.stage_code,
    aje.stage_label,
    aje.progress_percent,
    aje.detail,
    aje.counters,
    aje.created_at
from public.automation_job_events aje;

create or replace view public.operator_automation_schedule
with (security_invoker = true)
as
select
    schedule_key,
    enabled,
    timezone,
    daytime_start,
    daytime_end,
    daytime_interval_seconds,
    overnight_interval_seconds,
    last_checked_at,
    last_success_at,
    next_check_at,
    last_job_id,
    last_result,
    last_error,
    worker_heartbeat_at,
    updated_at
from public.automation_schedules;

revoke all on
    public.operator_automation_jobs,
    public.operator_automation_job_events,
    public.operator_automation_schedule
from anon;

grant select on
    public.operator_automation_jobs,
    public.operator_automation_job_events,
    public.operator_automation_schedule
to authenticated;
