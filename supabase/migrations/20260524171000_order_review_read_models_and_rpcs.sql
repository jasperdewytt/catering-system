-- M16: Order review read models and audited operator RPCs.

grant select on
    public.caterer_contacts,
    public.manual_overrides
to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'caterer_contacts'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.caterer_contacts
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'manual_overrides'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.manual_overrides
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;
end;
$$;

create or replace view public.operator_order_run_lines
with (security_invoker = true)
as
select
    ol.order_run_id,
    ol.id as order_line_id,
    c.id as caterer_id,
    c.name as caterer_name,
    s.id as session_id,
    sch.canonical_name as school_name,
    s.session_date,
    dv.id as dish_variant_id,
    case
        when dv.name = 'Standard' then d.name
        else d.name || ' - ' || dv.name
    end as display_name,
    ol.quantity,
    (ol.unit_price_cents::numeric / 100.0)::numeric(12, 2) as unit_price,
    (ol.line_total_cents::numeric / 100.0)::numeric(12, 2) as line_total
from public.order_lines ol
join public.sessions s
    on s.id = ol.session_id
join public.schools sch
    on sch.id = s.school_id
join public.caterers c
    on c.id = s.caterer_id
join public.dishes d
    on d.id = ol.dish_id
join public.dish_variants dv
    on dv.id = ol.dish_variant_id;

create or replace view public.operator_order_run_allocations
with (security_invoker = true)
as
with issue_counts as (
    select
        order_run_id,
        session_id,
        student_id,
        count(*)::integer as issue_count
    from public.order_allocation_issues
    group by order_run_id, session_id, student_id
)
select
    oa.order_run_id,
    oa.id as allocation_id,
    st.id as student_id,
    st.full_name as student_name,
    sch.canonical_name as school_name,
    st.year_level,
    s.id as session_id,
    s.session_date,
    dv.id as dish_variant_id,
    case
        when dv.id is null then null::text
        when dv.name = 'Standard' then d.name
        else d.name || ' - ' || dv.name
    end as display_name,
    oa.dietary_tag_codes as dietary_tags,
    oa.status as allocation_status,
    coalesce(ic.issue_count, 0)::integer as issue_count
from public.order_allocations oa
join public.sessions s
    on s.id = oa.session_id
join public.schools sch
    on sch.id = s.school_id
join public.students st
    on st.id = oa.student_id
left join public.dishes d
    on d.id = oa.dish_id
left join public.dish_variants dv
    on dv.id = oa.dish_variant_id
left join issue_counts ic
    on ic.order_run_id = oa.order_run_id
   and ic.session_id = oa.session_id
   and ic.student_id = oa.student_id;

create or replace view public.operator_order_run_issues
with (security_invoker = true)
as
select
    oai.id as issue_id,
    oai.order_run_id,
    oai.severity,
    oai.code as category,
    oai.message,
    oai.student_id,
    oai.session_id,
    oai.dish_variant_id
from public.order_allocation_issues oai;

create or replace view public.operator_order_run_contacts
with (security_invoker = true)
as
with run_caterer_sessions as (
    select distinct
        ol.order_run_id,
        c.id as caterer_id,
        c.name as caterer_name,
        c.delivery_notes as caterer_delivery_notes,
        s.id as session_id,
        sch.canonical_name as school_name,
        s.session_date,
        s.dinner_time,
        s.building,
        s.room,
        s.manager_name,
        s.manager_mobile
    from public.order_lines ol
    join public.sessions s
        on s.id = ol.session_id
    join public.schools sch
        on sch.id = s.school_id
    join public.caterers c
        on c.id = s.caterer_id
),
delivery_notes as (
    select
        rcs.order_run_id,
        rcs.caterer_id,
        string_agg(
            rcs.school_name
            || ' on ' || rcs.session_date::text
            || coalesce(' at ' || rcs.dinner_time::text, '')
            || coalesce(', building ' || rcs.building, '')
            || coalesce(', room ' || rcs.room, '')
            || coalesce(', manager ' || rcs.manager_name, '')
            || coalesce(' ' || rcs.manager_mobile, ''),
            E'\n'
            order by rcs.session_date, rcs.school_name
        ) as session_delivery_notes,
        max(rcs.caterer_delivery_notes) as caterer_delivery_notes
    from run_caterer_sessions rcs
    group by rcs.order_run_id, rcs.caterer_id
)
select
    dn.order_run_id,
    dn.caterer_id,
    c.name as caterer_name,
    cc.id as contact_id,
    cc.display_name as contact_name,
    cc.role::text as contact_role,
    cc.email::text as email,
    cc.cc_preference::text as recipient_kind,
    concat_ws(E'\n', nullif(dn.caterer_delivery_notes, ''), dn.session_delivery_notes)
        as delivery_notes
from delivery_notes dn
join public.caterers c
    on c.id = dn.caterer_id
left join public.caterer_contacts cc
    on cc.caterer_id = dn.caterer_id;

create or replace view public.operator_manual_overrides
with (security_invoker = true)
as
select
    mo.id as manual_override_id,
    mo.order_run_id,
    mo.actor_name,
    mo.override_type,
    mo.entity_type,
    mo.entity_id,
    mo.reason,
    mo.before_state,
    mo.after_state,
    mo.created_at
from public.manual_overrides mo;

create or replace function public.operator_approve_order_run(
    p_order_run_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_reason text := btrim(coalesce(p_reason, ''));
    v_before public.order_runs%rowtype;
    v_after public.order_runs%rowtype;
    v_now timestamptz := now();
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    select *
    into v_before
    from public.order_runs
    where id = p_order_run_id
    for update;

    if not found then
        raise exception 'Order run does not exist.';
    end if;

    if v_before.status <> 'generated' then
        raise exception 'Only generated order runs can be approved.';
    end if;

    if exists (
        select 1
        from public.order_allocation_issues oai
        where oai.order_run_id = p_order_run_id
    ) then
        raise exception 'Order runs with persisted allocation issues cannot be approved.';
    end if;

    update public.order_runs
    set
        status = 'approved',
        approved_at = v_now,
        approved_by = v_actor_name,
        approval_note = v_reason
    where id = p_order_run_id
    returning * into v_after;

    insert into public.audit_log (
        order_run_id,
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        p_order_run_id,
        v_actor_name,
        'order_run_approved',
        'order_run',
        p_order_run_id,
        v_reason,
        to_jsonb(v_before),
        to_jsonb(v_after),
        v_now
    );

    return p_order_run_id;
end;
$$;

create or replace function public.operator_reopen_order_run(
    p_order_run_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_reason text := btrim(coalesce(p_reason, ''));
    v_before public.order_runs%rowtype;
    v_after public.order_runs%rowtype;
    v_now timestamptz := now();
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    select *
    into v_before
    from public.order_runs
    where id = p_order_run_id
    for update;

    if not found then
        raise exception 'Order run does not exist.';
    end if;

    if v_before.status <> 'approved' then
        raise exception 'Only approved order runs can be reopened.';
    end if;

    update public.order_runs
    set
        status = 'generated',
        approved_at = null,
        approved_by = null,
        approval_note = null
    where id = p_order_run_id
    returning * into v_after;

    insert into public.audit_log (
        order_run_id,
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        p_order_run_id,
        v_actor_name,
        'order_run_unapproved',
        'order_run',
        p_order_run_id,
        v_reason,
        to_jsonb(v_before),
        to_jsonb(v_after),
        v_now
    );

    return p_order_run_id;
end;
$$;

create or replace function public.operator_record_manual_override(
    p_order_run_id uuid,
    p_override_type text,
    p_entity_type text,
    p_entity_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_reason text := btrim(coalesce(p_reason, ''));
    v_override_type text := btrim(coalesce(p_override_type, ''));
    v_entity_type text := btrim(coalesce(p_entity_type, ''));
    v_order_run public.order_runs%rowtype;
    v_override_id uuid;
    v_now timestamptz := now();
    v_after_state jsonb;
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    if v_override_type not in (
        'allocation',
        'order_line',
        'student_attendance',
        'dietary_resolution',
        'contact',
        'other'
    ) then
        raise exception 'Invalid manual override type.';
    end if;

    if length(v_entity_type) = 0 then
        raise exception 'Manual override entity type is required.';
    end if;

    select *
    into v_order_run
    from public.order_runs
    where id = p_order_run_id;

    if not found then
        raise exception 'Order run does not exist.';
    end if;

    v_after_state := jsonb_build_object(
        'order_run_id', p_order_run_id,
        'override_type', v_override_type,
        'entity_type', v_entity_type,
        'entity_id', p_entity_id
    );

    insert into public.manual_overrides (
        order_run_id,
        actor_name,
        override_type,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        p_order_run_id,
        v_actor_name,
        v_override_type,
        v_entity_type,
        p_entity_id,
        v_reason,
        '{}'::jsonb,
        v_after_state,
        v_now
    )
    returning id into v_override_id;

    insert into public.audit_log (
        order_run_id,
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        p_order_run_id,
        v_actor_name,
        'manual_override_created',
        'manual_override',
        v_override_id,
        v_reason,
        '{}'::jsonb,
        v_after_state || jsonb_build_object('manual_override_id', v_override_id),
        v_now
    );

    return v_override_id;
end;
$$;

revoke all on
    public.operator_order_run_lines,
    public.operator_order_run_allocations,
    public.operator_order_run_issues,
    public.operator_order_run_contacts,
    public.operator_manual_overrides
from anon, authenticated;

grant select on
    public.operator_order_run_lines,
    public.operator_order_run_allocations,
    public.operator_order_run_issues,
    public.operator_order_run_contacts,
    public.operator_manual_overrides
to authenticated;

revoke all on function public.operator_approve_order_run(uuid, text)
    from public, anon, authenticated;
revoke all on function public.operator_reopen_order_run(uuid, text)
    from public, anon, authenticated;
revoke all on function public.operator_record_manual_override(uuid, text, text, uuid, text)
    from public, anon, authenticated;

grant execute on function public.operator_approve_order_run(uuid, text)
    to authenticated;
grant execute on function public.operator_reopen_order_run(uuid, text)
    to authenticated;
grant execute on function public.operator_record_manual_override(uuid, text, text, uuid, text)
    to authenticated;
