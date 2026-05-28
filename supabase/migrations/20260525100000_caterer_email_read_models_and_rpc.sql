-- M17: Caterer email read models and audited preparation event RPC.

grant select on
    public.order_communication_recipients,
    public.order_communication_events
to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'order_communication_recipients'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.order_communication_recipients
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'order_communication_events'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.order_communication_events
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;
end;
$$;

create or replace view public.operator_communications
with (security_invoker = true)
as
with run_caterers as (
    select
        ol.order_run_id,
        c.id as caterer_id,
        c.name as caterer_name,
        count(distinct ol.id)::integer as line_count,
        coalesce(sum(ol.quantity), 0)::integer as total_quantity
    from public.order_lines ol
    join public.sessions s
        on s.id = ol.session_id
    join public.caterers c
        on c.id = s.caterer_id
    group by ol.order_run_id, c.id, c.name
),
event_counts as (
    select
        oce.communication_id,
        count(*)::integer as event_count,
        max(oce.created_at) as latest_event_at
    from public.order_communication_events oce
    group by oce.communication_id
)
select
    oru.id as order_run_id,
    oru.service_week_start as week_start,
    oru.status as order_run_status,
    oru.issue_count,
    rc.caterer_id,
    rc.caterer_name,
    oc.id as communication_id,
    case
        when oc.id is not null then 'exported'
        when oru.status = 'approved' and oru.issue_count = 0 then 'not_exported'
        else 'not_ready'
    end as email_state,
    oc.subject,
    oc.body,
    oc.rendered_text,
    oc.delivery_note_text,
    oc.template_version,
    oc.exported_at,
    oc.exported_by,
    rc.line_count,
    rc.total_quantity,
    coalesce(ec.event_count, 0)::integer as event_count,
    ec.latest_event_at
from run_caterers rc
join public.order_runs oru
    on oru.id = rc.order_run_id
left join public.order_communications oc
    on oc.order_run_id = rc.order_run_id
   and oc.caterer_id = rc.caterer_id
left join event_counts ec
    on ec.communication_id = oc.id;

create or replace view public.operator_communication_recipients
with (security_invoker = true)
as
select
    ocr.id as recipient_id,
    oc.id as communication_id,
    oc.order_run_id,
    oc.caterer_id,
    c.name as caterer_name,
    ocr.caterer_contact_id,
    ocr.display_name,
    ocr.email::text as email,
    ocr.recipient_type,
    ocr.role,
    ocr.cc_preference,
    ocr.created_at
from public.order_communication_recipients ocr
join public.order_communications oc
    on oc.id = ocr.communication_id
join public.caterers c
    on c.id = oc.caterer_id;

create or replace view public.operator_communication_events
with (security_invoker = true)
as
select
    oce.id as event_id,
    oce.communication_id,
    oc.order_run_id,
    oc.caterer_id,
    c.name as caterer_name,
    oce.event_type,
    oce.actor_name,
    oce.reason,
    oce.metadata,
    oce.created_at
from public.order_communication_events oce
join public.order_communications oc
    on oc.id = oce.communication_id
join public.caterers c
    on c.id = oc.caterer_id;

create or replace function public.operator_record_caterer_email_preparation(
    p_communication_id uuid,
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
    v_communication public.order_communications%rowtype;
    v_order_run public.order_runs%rowtype;
    v_event_id uuid;
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

    select *
    into v_communication
    from public.order_communications
    where id = p_communication_id;

    if not found then
        raise exception 'Communication snapshot does not exist.';
    end if;

    select *
    into v_order_run
    from public.order_runs
    where id = v_communication.order_run_id
    for update;

    if not found then
        raise exception 'Order run does not exist.';
    end if;

    if v_order_run.status <> 'approved' then
        raise exception 'Only approved order runs can have caterer email preparation recorded.';
    end if;

    if v_order_run.issue_count <> 0 or exists (
        select 1
        from public.order_allocation_issues oai
        where oai.order_run_id = v_order_run.id
    ) then
        raise exception 'Order runs with persisted allocation issues cannot have caterer email preparation recorded.';
    end if;

    v_after_state := jsonb_build_object(
        'communication_id', v_communication.id,
        'order_run_id', v_communication.order_run_id,
        'caterer_id', v_communication.caterer_id,
        'snapshot_created', false
    );

    insert into public.order_communication_events (
        communication_id,
        event_type,
        actor_name,
        reason,
        metadata,
        created_at
    )
    values (
        v_communication.id,
        'exported',
        v_actor_name,
        v_reason,
        v_after_state,
        v_now
    )
    returning id into v_event_id;

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
        v_communication.order_run_id,
        v_actor_name,
        'communication_exported',
        'order_communication',
        v_communication.id,
        v_reason,
        '{}'::jsonb,
        v_after_state || jsonb_build_object('event_id', v_event_id),
        v_now
    );

    return v_event_id;
end;
$$;

revoke all on
    public.operator_communications,
    public.operator_communication_recipients,
    public.operator_communication_events
from anon, authenticated;

grant select on
    public.operator_communications,
    public.operator_communication_recipients,
    public.operator_communication_events
to authenticated;

revoke all on function public.operator_record_caterer_email_preparation(uuid, text)
    from public, anon, authenticated;

grant execute on function public.operator_record_caterer_email_preparation(uuid, text)
    to authenticated;
