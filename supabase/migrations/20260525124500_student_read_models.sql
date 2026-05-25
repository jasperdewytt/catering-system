-- M19: Student directory and detail read models for the operator UI.

grant select on
    public.dietary_tags,
    public.student_dietary_tags,
    public.student_dietary_warnings
to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'dietary_tags'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.dietary_tags
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'student_dietary_tags'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.student_dietary_tags
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'student_dietary_warnings'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.student_dietary_warnings
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;
end;
$$;

create or replace view public.operator_students
with (security_invoker = true)
as
with latest_run as (
    select id as order_run_id, service_week_start, status
    from public.order_runs
    order by generated_at desc, created_at desc, id desc
    limit 1
),
dietary_tags as (
    select
        sdt.student_id,
        array_agg(dt.code order by dt.code) as dietary_tags,
        jsonb_agg(
            jsonb_build_object(
                'code', dt.code,
                'kind', dt.kind::text,
                'description', dt.description
            )
            order by dt.kind::text, dt.code
        ) as dietary_tag_details
    from public.student_dietary_tags sdt
    join public.dietary_tags dt
        on dt.code = sdt.tag_code
    group by sdt.student_id
),
warning_counts as (
    select
        student_id,
        count(*)::integer as warning_count,
        count(*) filter (where status = 'pending')::integer as pending_warning_count
    from public.student_dietary_warnings
    group by student_id
),
enrolment_counts as (
    select
        se.student_id,
        count(*)::integer as enrolment_count,
        min(s.session_date)::date as first_session_date,
        max(s.session_date)::date as last_session_date
    from public.session_enrolments se
    join public.sessions s
        on s.id = se.session_id
    group by se.student_id
),
absence_counts as (
    select
        student_id,
        count(*)::integer as absence_count
    from public.absences
    group by student_id
),
allocation_counts as (
    select
        oa.student_id,
        count(*)::integer as latest_allocation_count,
        count(*) filter (where oa.status = 'allocated')::integer as latest_allocated_count,
        count(*) filter (where oa.status <> 'allocated')::integer as latest_not_allocated_count,
        array_agg(distinct oa.status order by oa.status) as latest_allocation_statuses
    from latest_run lr
    join public.order_allocations oa
        on oa.order_run_id = lr.order_run_id
    group by oa.student_id
)
select
    st.id as student_id,
    st.full_name as student_name,
    st.school_id,
    sch.canonical_name as school_name,
    st.year_level,
    st.subjects_raw as subjects,
    st.opted_out,
    st.dietary_raw,
    coalesce(dt.dietary_tags, '{}'::text[]) as dietary_tags,
    coalesce(dt.dietary_tag_details, '[]'::jsonb) as dietary_tag_details,
    coalesce(wc.warning_count, 0)::integer as warning_count,
    coalesce(wc.pending_warning_count, 0)::integer as pending_warning_count,
    coalesce(ec.enrolment_count, 0)::integer as enrolment_count,
    coalesce(ac.absence_count, 0)::integer as absence_count,
    lr.order_run_id as latest_order_run_id,
    lr.service_week_start as latest_order_week_start,
    lr.status as latest_order_run_status,
    coalesce(alc.latest_allocation_count, 0)::integer as latest_allocation_count,
    coalesce(alc.latest_allocated_count, 0)::integer as latest_allocated_count,
    coalesce(alc.latest_not_allocated_count, 0)::integer as latest_not_allocated_count,
    coalesce(alc.latest_allocation_statuses, '{}'::text[]) as latest_allocation_statuses,
    ec.first_session_date,
    ec.last_session_date,
    st.source_file,
    st.student_email::text as student_email,
    st.parent_name,
    st.parent_email::text as parent_email,
    st.parent_mobile
from public.students st
join public.schools sch
    on sch.id = st.school_id
left join dietary_tags dt
    on dt.student_id = st.id
left join warning_counts wc
    on wc.student_id = st.id
left join enrolment_counts ec
    on ec.student_id = st.id
left join absence_counts ac
    on ac.student_id = st.id
left join latest_run lr
    on true
left join allocation_counts alc
    on alc.student_id = st.id;

create or replace view public.operator_student_detail
with (security_invoker = true)
as
with dietary_warnings as (
    select
        sdw.student_id,
        jsonb_agg(
            jsonb_build_object(
                'warning_id', sdw.id,
                'raw_value', sdw.raw_value,
                'status', sdw.status,
                'resolved_tag_codes', sdw.resolved_tag_codes,
                'resolved_at', sdw.resolved_at,
                'resolved_note', sdw.resolved_note,
                'created_at', sdw.created_at
            )
            order by sdw.created_at desc, sdw.id
        ) as dietary_warnings
    from public.student_dietary_warnings sdw
    group by sdw.student_id
),
enrolments as (
    select
        se.student_id,
        jsonb_agg(
            jsonb_build_object(
                'session_id', s.id,
                'session_date', s.session_date,
                'school_name', sch.canonical_name,
                'caterer_id', c.id,
                'caterer_name', c.name,
                'start_time', s.start_time,
                'end_time', s.end_time,
                'dinner_time', s.dinner_time,
                'building', s.building,
                'room', s.room,
                'manager_name', s.manager_name,
                'manager_mobile', s.manager_mobile,
                'excluded_year_levels', e.excluded_year_levels,
                'exclusion_reason', e.reason
            )
            order by s.session_date, sch.canonical_name, s.id
        ) as enrolments
    from public.session_enrolments se
    join public.sessions s
        on s.id = se.session_id
    join public.schools sch
        on sch.id = s.school_id
    join public.caterers c
        on c.id = s.caterer_id
    left join public.exclusions e
        on e.session_id = s.id
    group by se.student_id
),
absences as (
    select
        a.student_id,
        jsonb_agg(
            jsonb_build_object(
                'absence_id', a.id,
                'session_id', a.session_id,
                'session_date', s.session_date,
                'school_name', sch.canonical_name,
                'note', a.note,
                'source_file', a.source_file,
                'created_at', a.created_at
            )
            order by s.session_date, a.id
        ) as absences
    from public.absences a
    join public.sessions s
        on s.id = a.session_id
    join public.schools sch
        on sch.id = s.school_id
    group by a.student_id
),
latest_run as (
    select id as order_run_id, service_week_start, status
    from public.order_runs
    order by generated_at desc, created_at desc, id desc
    limit 1
),
latest_allocations as (
    select
        oa.student_id,
        jsonb_agg(
            jsonb_build_object(
                'allocation_id', oa.id,
                'order_run_id', oa.order_run_id,
                'week_start', lr.service_week_start,
                'run_status', lr.status,
                'session_id', s.id,
                'session_date', s.session_date,
                'school_name', sch.canonical_name,
                'caterer_name', c.name,
                'dish_variant_id', dv.id,
                'display_name',
                    case
                        when dv.id is null then null::text
                        when dv.name = 'Standard' then d.name
                        else d.name || ' - ' || dv.name
                    end,
                'allocation_status', oa.status,
                'reason_codes', oa.reason_codes,
                'dietary_tag_codes', oa.dietary_tag_codes
            )
            order by s.session_date, sch.canonical_name, oa.id
        ) as latest_allocations
    from latest_run lr
    join public.order_allocations oa
        on oa.order_run_id = lr.order_run_id
    join public.sessions s
        on s.id = oa.session_id
    join public.schools sch
        on sch.id = s.school_id
    join public.caterers c
        on c.id = s.caterer_id
    left join public.dishes d
        on d.id = oa.dish_id
    left join public.dish_variants dv
        on dv.id = oa.dish_variant_id
    group by oa.student_id
),
manual_overrides as (
    select
        st.id as student_id,
        jsonb_agg(
            jsonb_build_object(
                'override_id', mo.id,
                'order_run_id', mo.order_run_id,
                'actor_name', mo.actor_name,
                'override_type', mo.override_type,
                'entity_type', mo.entity_type,
                'entity_id', mo.entity_id,
                'reason', mo.reason,
                'created_at', mo.created_at
            )
            order by mo.created_at desc, mo.id
        ) as manual_overrides
    from public.students st
    join public.manual_overrides mo
        on mo.entity_id = st.id
        or mo.before_state @> jsonb_build_object('student_id', st.id)
        or mo.after_state @> jsonb_build_object('student_id', st.id)
    group by st.id
),
audit_events as (
    select
        st.id as student_id,
        jsonb_agg(
            jsonb_build_object(
                'audit_id', al.id,
                'order_run_id', al.order_run_id,
                'actor_name', al.actor_name,
                'action', al.action,
                'display_action',
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
                    end,
                'entity_type', al.entity_type,
                'entity_id', al.entity_id,
                'reason', al.reason,
                'created_at', al.created_at
            )
            order by al.created_at desc, al.id
        ) as audit_events
    from public.students st
    join public.audit_log al
        on al.entity_id = st.id
        or al.before_state @> jsonb_build_object('student_id', st.id)
        or al.after_state @> jsonb_build_object('student_id', st.id)
    group by st.id
)
select
    os.student_id,
    os.student_name,
    os.school_id,
    os.school_name,
    os.year_level,
    os.subjects,
    os.opted_out,
    os.dietary_raw,
    os.dietary_tags,
    os.dietary_tag_details,
    os.warning_count,
    os.pending_warning_count,
    os.enrolment_count,
    os.absence_count,
    os.latest_order_run_id,
    os.latest_order_week_start,
    os.latest_order_run_status,
    os.latest_allocation_count,
    os.latest_allocated_count,
    os.latest_not_allocated_count,
    os.latest_allocation_statuses,
    os.first_session_date,
    os.last_session_date,
    os.source_file,
    os.student_email,
    os.parent_name,
    os.parent_email,
    os.parent_mobile,
    coalesce(dw.dietary_warnings, '[]'::jsonb) as dietary_warnings,
    coalesce(en.enrolments, '[]'::jsonb) as enrolments,
    coalesce(ab.absences, '[]'::jsonb) as absences,
    coalesce(la.latest_allocations, '[]'::jsonb) as latest_allocations,
    coalesce(mo.manual_overrides, '[]'::jsonb) as manual_overrides,
    coalesce(ae.audit_events, '[]'::jsonb) as audit_events
from public.operator_students os
left join dietary_warnings dw
    on dw.student_id = os.student_id
left join enrolments en
    on en.student_id = os.student_id
left join absences ab
    on ab.student_id = os.student_id
left join latest_allocations la
    on la.student_id = os.student_id
left join manual_overrides mo
    on mo.student_id = os.student_id
left join audit_events ae
    on ae.student_id = os.student_id;

revoke all on
    public.operator_students,
    public.operator_student_detail
from anon, authenticated;

grant select on
    public.operator_students,
    public.operator_student_detail
to authenticated;
