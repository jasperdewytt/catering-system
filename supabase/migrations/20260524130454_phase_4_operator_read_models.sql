-- M14: Phase 4 operator identity, authenticated read policies, and first
-- browser-safe read models for the Next.js operator UI.

create table public.operators (
    id              uuid        primary key references auth.users(id) on delete cascade,
    display_name    text        not null check (length(btrim(display_name)) > 0),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create trigger trg_operators_set_updated_at
    before update on public.operators
    for each row execute function public.set_updated_at();

alter table public.operators enable row level security;
revoke all on public.operators from anon, authenticated;
grant select on public.operators to authenticated;

create policy operators_select_own_profile
    on public.operators
    for select
    to authenticated
    using (id = (select auth.uid()));

alter table public.audit_log
    drop constraint if exists audit_log_action_check,
    add constraint audit_log_action_check check (
        action in (
            'order_run_approved',
            'order_run_unapproved',
            'manual_override_created',
            'communication_exported',
            'dish_variant_created',
            'dish_variant_reviewed',
            'dish_variant_availability_updated',
            'menu_offers_updated'
        )
    );

grant select on
    public.schools,
    public.caterers,
    public.sessions,
    public.exclusions,
    public.session_enrolments,
    public.students,
    public.absences,
    public.dishes,
    public.dish_variants,
    public.menu_offers,
    public.order_runs,
    public.order_allocations,
    public.order_lines,
    public.order_allocation_issues,
    public.order_communications,
    public.audit_log
to authenticated;

create policy authenticated_operators_select
    on public.schools
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.caterers
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.sessions
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.exclusions
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.session_enrolments
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.students
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.absences
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.dishes
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.dish_variants
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.menu_offers
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.order_runs
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.order_allocations
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.order_lines
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.order_allocation_issues
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.order_communications
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create policy authenticated_operators_select
    on public.audit_log
    for select
    to authenticated
    using (exists (select 1 from public.operators where id = (select auth.uid())));

create or replace view public.operator_weeks
with (security_invoker = true)
as
with session_bounds as (
    select min(session_date) as anchor_date
    from public.sessions
),
week_sessions as (
    select
        (s.session_date - (((s.session_date - sb.anchor_date)::integer % 7)))::date as week_start,
        s.id as session_id,
        s.session_date,
        s.caterer_id
    from public.sessions s
    cross join session_bounds sb
    where sb.anchor_date is not null
),
latest_runs as (
    select distinct on (service_week_start)
        service_week_start as week_start,
        id,
        status,
        approved_at
    from public.order_runs
    order by service_week_start, generated_at desc, created_at desc, id desc
)
select
    ws.week_start,
    max(ws.session_date)::date as week_end,
    count(distinct ws.session_id)::integer as session_count,
    count(distinct se.student_id)::integer as student_count,
    count(distinct ws.caterer_id)::integer as caterer_count,
    lr.id as latest_order_run_id,
    lr.status as latest_order_run_status,
    lr.approved_at,
    count(distinct oc.caterer_id)::integer as exported_caterer_count,
    count(distinct oai.id)::integer as allocation_issue_count
from week_sessions ws
left join public.session_enrolments se
    on se.session_id = ws.session_id
left join latest_runs lr
    on lr.week_start = ws.week_start
left join public.order_communications oc
    on oc.order_run_id = lr.id
left join public.order_allocation_issues oai
    on oai.order_run_id = lr.id
group by
    ws.week_start,
    lr.id,
    lr.status,
    lr.approved_at;

create or replace view public.operator_current_week
with (security_invoker = true)
as
select
    week_start,
    week_end,
    session_count,
    latest_order_run_id,
    latest_order_run_status
from public.operator_weeks
where week_start = (
    select min(week_start)
    from public.operator_weeks
);

create or replace view public.operator_week_status
with (security_invoker = true)
as
with session_caterers as (
    select distinct
        ow.week_start,
        s.caterer_id
    from public.operator_weeks ow
    join public.sessions s
        on s.session_date between ow.week_start and ow.week_end
),
missing_offer_caterers as (
    select
        sc.week_start,
        count(*)::integer as missing_offer_caterer_count
    from session_caterers sc
    where not exists (
        select 1
        from public.menu_offers mo
        join public.dish_variants dv
            on dv.id = mo.dish_variant_id
        join public.dishes d
            on d.id = dv.dish_id
        where mo.service_week_start = sc.week_start
          and d.caterer_id = sc.caterer_id
    )
    group by sc.week_start
),
unreviewed_variants as (
    select
        mo.service_week_start as week_start,
        count(distinct dv.id) filter (
            where dv.ingredient_flags_source <> 'operator_reviewed'
        )::integer as unreviewed_variant_count
    from public.menu_offers mo
    join public.dish_variants dv
        on dv.id = mo.dish_variant_id
    group by mo.service_week_start
),
latest_issue_counts as (
    select
        ow.week_start,
        count(oai.id) filter (where oai.severity = 'error')::integer as blocking_issue_count,
        count(oai.id) filter (where oai.severity = 'warning')::integer as warning_count
    from public.operator_weeks ow
    left join public.order_allocation_issues oai
        on oai.order_run_id = ow.latest_order_run_id
    group by ow.week_start
)
select
    ow.week_start,
    (ow.session_count > 0) as source_data_ready,
    (
        ow.caterer_count > 0
        and coalesce(moc.missing_offer_caterer_count, 0) = 0
    ) as menu_offers_ready,
    (coalesce(uv.unreviewed_variant_count, 0) = 0) as variant_review_ready,
    case
        when ow.latest_order_run_id is null then 'not_generated'
        when ow.latest_order_run_status = 'blocked' then 'blocked'
        when coalesce(lic.blocking_issue_count, 0) > 0 then 'blocked'
        when coalesce(lic.warning_count, 0) > 0 then 'warnings'
        else 'ready'
    end as validation_state,
    ow.latest_order_run_id,
    ow.latest_order_run_status,
    case
        when ow.latest_order_run_id is null then 'not_generated'
        when ow.latest_order_run_status = 'approved' then 'approved'
        when ow.latest_order_run_status = 'generated' then 'pending_approval'
        else ow.latest_order_run_status
    end as approval_state,
    case
        when ow.latest_order_run_id is null then 'not_ready'
        when ow.latest_order_run_status <> 'approved' then 'not_ready'
        when ow.exported_caterer_count >= ow.caterer_count and ow.caterer_count > 0 then 'exported'
        when ow.exported_caterer_count > 0 then 'partial'
        else 'not_exported'
    end as export_state,
    coalesce(lic.blocking_issue_count, 0)::integer as blocking_issue_count,
    coalesce(lic.warning_count, 0)::integer as warning_count,
    coalesce(uv.unreviewed_variant_count, 0)::integer as unreviewed_variant_count,
    coalesce(moc.missing_offer_caterer_count, 0)::integer as missing_offer_caterer_count
from public.operator_weeks ow
left join missing_offer_caterers moc
    on moc.week_start = ow.week_start
left join unreviewed_variants uv
    on uv.week_start = ow.week_start
left join latest_issue_counts lic
    on lic.week_start = ow.week_start;

create or replace view public.operator_week_sessions
with (security_invoker = true)
as
with latest_runs as (
    select distinct on (service_week_start)
        service_week_start as week_start,
        id as order_run_id
    from public.order_runs
    order by service_week_start, generated_at desc, created_at desc, id desc
)
select
    ow.week_start,
    s.id as session_id,
    s.session_date,
    sch.id as school_id,
    sch.canonical_name as school_name,
    c.id as caterer_id,
    c.name as caterer_name,
    s.manager_name,
    s.manager_mobile,
    s.building,
    count(distinct se.student_id)::integer as enrolled_count,
    count(distinct oa.student_id) filter (
        where oa.status not in (
            'skipped_opted_out',
            'skipped_absent',
            'skipped_year_excluded'
        )
    )::integer as orderable_student_count,
    count(distinct oa.student_id) filter (
        where oa.status = 'skipped_year_excluded'
    )::integer as cancelled_count,
    count(distinct ol.id)::integer as latest_order_line_count,
    case
        when lr.order_run_id is null then null
        when oc.id is not null then 'exported'
        else 'not_exported'
    end as export_state
from public.operator_weeks ow
join public.sessions s
    on s.session_date between ow.week_start and ow.week_end
join public.schools sch
    on sch.id = s.school_id
join public.caterers c
    on c.id = s.caterer_id
left join latest_runs lr
    on lr.week_start = ow.week_start
left join public.session_enrolments se
    on se.session_id = s.id
left join public.order_allocations oa
    on oa.order_run_id = lr.order_run_id
   and oa.session_id = s.id
left join public.order_lines ol
    on ol.order_run_id = lr.order_run_id
   and ol.session_id = s.id
left join public.order_communications oc
    on oc.order_run_id = lr.order_run_id
   and oc.caterer_id = s.caterer_id
group by
    ow.week_start,
    s.id,
    s.session_date,
    sch.id,
    sch.canonical_name,
    c.id,
    c.name,
    s.manager_name,
    s.manager_mobile,
    s.building,
    lr.order_run_id,
    oc.id;

create or replace view public.operator_order_runs
with (security_invoker = true)
as
with ranked_runs as (
    select
        r.*,
        row_number() over (
            partition by r.service_week_start
            order by r.generated_at desc, r.created_at desc, r.id desc
        ) = 1 as is_latest
    from public.order_runs r
),
allocation_counts as (
    select order_run_id, count(*)::integer as allocation_count
    from public.order_allocations
    group by order_run_id
),
line_counts as (
    select order_run_id, count(*)::integer as line_count
    from public.order_lines
    group by order_run_id
),
issue_counts as (
    select order_run_id, count(*)::integer as issue_count
    from public.order_allocation_issues
    group by order_run_id
),
export_counts as (
    select order_run_id, count(distinct caterer_id)::integer as exported_caterer_count
    from public.order_communications
    group by order_run_id
)
select
    rr.id as order_run_id,
    rr.service_week_start as week_start,
    rr.status,
    rr.generated_at,
    rr.generated_by,
    rr.approved_at,
    rr.approved_by,
    rr.approval_note,
    coalesce(ac.allocation_count, 0)::integer as allocation_count,
    coalesce(lc.line_count, 0)::integer as line_count,
    coalesce(ic.issue_count, 0)::integer as issue_count,
    coalesce(ec.exported_caterer_count, 0)::integer as exported_caterer_count,
    rr.is_latest
from ranked_runs rr
left join allocation_counts ac
    on ac.order_run_id = rr.id
left join line_counts lc
    on lc.order_run_id = rr.id
left join issue_counts ic
    on ic.order_run_id = rr.id
left join export_counts ec
    on ec.order_run_id = rr.id;

create or replace view public.operator_audit_events
with (security_invoker = true)
as
select
    al.id as audit_id,
    al.created_at,
    al.actor_name,
    al.action,
    case al.action
        when 'order_run_approved' then 'Approve run'
        when 'order_run_unapproved' then 'Reopen run'
        when 'manual_override_created' then 'Manual override'
        when 'communication_exported' then 'Communication exported'
        when 'dish_variant_created' then 'Dish variant created'
        when 'dish_variant_reviewed' then 'Dish variant reviewed'
        when 'dish_variant_availability_updated' then 'Variant availability updated'
        when 'menu_offers_updated' then 'Menu offers updated'
        else al.action
    end as display_action,
    al.entity_type,
    al.entity_id,
    al.order_run_id,
    al.reason,
    al.before_state,
    al.after_state
from public.audit_log al;

revoke all on
    public.operator_current_week,
    public.operator_weeks,
    public.operator_week_status,
    public.operator_week_sessions,
    public.operator_order_runs,
    public.operator_audit_events
from anon, authenticated;

grant select on
    public.operator_current_week,
    public.operator_weeks,
    public.operator_week_status,
    public.operator_week_sessions,
    public.operator_order_runs,
    public.operator_audit_events
to authenticated;
