-- M18: Caterer directory and detail read models for the operator UI.

grant select on public.caterer_weekly_minimums to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'caterer_weekly_minimums'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.caterer_weekly_minimums
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;
end;
$$;

create or replace view public.operator_caterers
with (security_invoker = true)
as
with latest_run as (
    select id as order_run_id, service_week_start, status
    from public.order_runs
    order by generated_at desc, created_at desc, id desc
    limit 1
),
assigned_schools as (
    select
        s.caterer_id,
        array_agg(distinct sch.canonical_name order by sch.canonical_name) as assigned_school_names,
        count(distinct sch.id)::integer as assigned_school_count
    from public.sessions s
    join public.schools sch
        on sch.id = s.school_id
    group by s.caterer_id
),
minimums as (
    select
        cwm.caterer_id,
        array_agg(cwm.menu_item_count order by cwm.menu_item_count)::integer[] as valid_offer_counts,
        jsonb_agg(
            jsonb_build_object(
                'menu_item_count', cwm.menu_item_count,
                'minimum_meals', cwm.minimum_meals
            )
            order by cwm.menu_item_count
        ) as weekly_minimum_tiers
    from public.caterer_weekly_minimums cwm
    group by cwm.caterer_id
),
contact_counts as (
    select
        cc.caterer_id,
        count(*)::integer as contact_count
    from public.caterer_contacts cc
    group by cc.caterer_id
),
primary_contacts as (
    select caterer_id, display_name, email::text as email, role::text as role
    from (
        select
            cc.*,
            row_number() over (
                partition by cc.caterer_id
                order by
                    case cc.role
                        when 'primary' then 0
                        when 'manager' then 1
                        when 'chef' then 2
                        else 3
                    end,
                    cc.display_name,
                    cc.id
            ) as contact_rank
        from public.caterer_contacts cc
    ) ranked_contacts
    where contact_rank = 1
),
menu_summary as (
    select
        d.caterer_id,
        count(distinct d.id)::integer as dish_count,
        count(distinct dv.id)::integer as variant_count,
        count(distinct dv.id) filter (where dv.is_available)::integer as available_variant_count,
        count(distinct dv.id) filter (
            where dv.ingredient_flags_source = 'operator_reviewed'
        )::integer as reviewed_variant_count,
        count(distinct dv.id) filter (
            where dv.ingredient_flags_source <> 'operator_reviewed'
        )::integer as unreviewed_variant_count
    from public.dishes d
    left join public.dish_variants dv
        on dv.dish_id = d.id
    group by d.caterer_id
),
latest_order_totals as (
    select
        s.caterer_id,
        lr.order_run_id,
        lr.service_week_start as latest_order_week_start,
        lr.status as latest_order_run_status,
        count(distinct ol.id)::integer as latest_order_line_count,
        coalesce(sum(ol.quantity), 0)::integer as latest_order_quantity,
        (coalesce(sum(ol.line_total_cents), 0)::numeric / 100.0)::numeric(12, 2)
            as latest_order_total
    from latest_run lr
    join public.order_lines ol
        on ol.order_run_id = lr.order_run_id
    join public.sessions s
        on s.id = ol.session_id
    group by s.caterer_id, lr.order_run_id, lr.service_week_start, lr.status
),
communication_events as (
    select
        oce.communication_id,
        count(*)::integer as event_count,
        max(oce.created_at) as latest_event_at
    from public.order_communication_events oce
    group by oce.communication_id
),
latest_communications as (
    select
        c.id as caterer_id,
        oc.id as communication_id,
        case
            when oc.id is not null then 'exported'
            when lr.order_run_id is not null
             and lr.status = 'approved'
             and coalesce(oru.issue_count, 0) = 0 then 'not_exported'
            else 'not_ready'
        end as email_state,
        oc.exported_at,
        oc.exported_by,
        coalesce(ce.event_count, 0)::integer as communication_event_count,
        ce.latest_event_at as latest_communication_event_at
    from public.caterers c
    left join latest_run lr
        on true
    left join public.order_runs oru
        on oru.id = lr.order_run_id
    left join public.order_communications oc
        on oc.order_run_id = lr.order_run_id
       and oc.caterer_id = c.id
    left join communication_events ce
        on ce.communication_id = oc.id
)
select
    c.id as caterer_id,
    c.name as caterer_name,
    c.region,
    (c.per_item_price_cents::numeric / 100.0)::numeric(12, 2) as per_item_price,
    c.gst_inclusive,
    (c.gst_rate_bps::numeric / 100.0)::numeric(6, 2) as gst_rate_percent,
    (c.delivery_fee_cents::numeric / 100.0)::numeric(12, 2) as delivery_fee,
    c.delivery_scope,
    c.delivery_notes,
    coalesce(asg.assigned_school_names, '{}'::text[]) as assigned_school_names,
    coalesce(asg.assigned_school_count, 0)::integer as assigned_school_count,
    coalesce(cc.contact_count, 0)::integer as contact_count,
    pc.display_name as primary_contact_name,
    pc.email as primary_contact_email,
    pc.role as primary_contact_role,
    coalesce(m.valid_offer_counts, '{}'::integer[]) as valid_offer_counts,
    coalesce(m.weekly_minimum_tiers, '[]'::jsonb) as weekly_minimum_tiers,
    coalesce(ms.dish_count, 0)::integer as dish_count,
    coalesce(ms.variant_count, 0)::integer as variant_count,
    coalesce(ms.available_variant_count, 0)::integer as available_variant_count,
    coalesce(ms.reviewed_variant_count, 0)::integer as reviewed_variant_count,
    coalesce(ms.unreviewed_variant_count, 0)::integer as unreviewed_variant_count,
    lot.order_run_id as latest_order_run_id,
    lot.latest_order_week_start,
    lot.latest_order_run_status,
    coalesce(lot.latest_order_line_count, 0)::integer as latest_order_line_count,
    coalesce(lot.latest_order_quantity, 0)::integer as latest_order_quantity,
    coalesce(lot.latest_order_total, 0)::numeric(12, 2) as latest_order_total,
    lc.communication_id as latest_communication_id,
    lc.email_state,
    lc.exported_at,
    lc.exported_by,
    lc.communication_event_count,
    lc.latest_communication_event_at
from public.caterers c
left join assigned_schools asg
    on asg.caterer_id = c.id
left join minimums m
    on m.caterer_id = c.id
left join contact_counts cc
    on cc.caterer_id = c.id
left join primary_contacts pc
    on pc.caterer_id = c.id
left join menu_summary ms
    on ms.caterer_id = c.id
left join latest_order_totals lot
    on lot.caterer_id = c.id
left join latest_communications lc
    on lc.caterer_id = c.id;

create or replace view public.operator_caterer_detail
with (security_invoker = true)
as
with contacts as (
    select
        cc.caterer_id,
        jsonb_agg(
            jsonb_build_object(
                'contact_id', cc.id,
                'display_name', cc.display_name,
                'role', cc.role::text,
                'email', cc.email::text,
                'cc_preference', cc.cc_preference::text,
                'role_note', cc.role_note,
                'is_verified', cc.is_verified
            )
            order by
                case cc.role
                    when 'primary' then 0
                    when 'manager' then 1
                    when 'chef' then 2
                    else 3
                end,
                cc.display_name,
                cc.id
        ) as contacts
    from public.caterer_contacts cc
    group by cc.caterer_id
),
minimums as (
    select
        cwm.caterer_id,
        jsonb_agg(
            jsonb_build_object(
                'menu_item_count', cwm.menu_item_count,
                'minimum_meals', cwm.minimum_meals
            )
            order by cwm.menu_item_count
        ) as weekly_minimums
    from public.caterer_weekly_minimums cwm
    group by cwm.caterer_id
),
assigned_schools as (
    select
        s.caterer_id,
        jsonb_agg(
            jsonb_build_object(
                'school_id', s.school_id,
                'school_name', sch.canonical_name,
                'session_count', s.session_count,
                'first_session_date', s.first_session_date,
                'last_session_date', s.last_session_date
            )
            order by sch.canonical_name
        ) as assigned_schools
    from (
        select
            sessions.caterer_id,
            sessions.school_id,
            count(*)::integer as session_count,
            min(sessions.session_date)::date as first_session_date,
            max(sessions.session_date)::date as last_session_date
        from public.sessions
        group by sessions.caterer_id, sessions.school_id
    ) s
    join public.schools sch
        on sch.id = s.school_id
    group by s.caterer_id
),
menu_summary as (
    select
        d.caterer_id,
        jsonb_build_object(
            'dish_count', count(distinct d.id)::integer,
            'variant_count', count(distinct dv.id)::integer,
            'available_variant_count', count(distinct dv.id) filter (where dv.is_available)::integer,
            'reviewed_variant_count', count(distinct dv.id) filter (
                where dv.ingredient_flags_source = 'operator_reviewed'
            )::integer,
            'unreviewed_variant_count', count(distinct dv.id) filter (
                where dv.ingredient_flags_source <> 'operator_reviewed'
            )::integer,
            'unavailable_variant_count', count(distinct dv.id) filter (
                where not dv.is_available
            )::integer
        ) as menu_summary
    from public.dishes d
    left join public.dish_variants dv
        on dv.dish_id = d.id
    group by d.caterer_id
),
latest_run as (
    select id as order_run_id, service_week_start, status
    from public.order_runs
    order by generated_at desc, created_at desc, id desc
    limit 1
),
latest_order_totals as (
    select
        s.caterer_id,
        lr.order_run_id,
        lr.service_week_start as week_start,
        lr.status,
        count(distinct ol.id)::integer as line_count,
        count(distinct ol.session_id)::integer as session_count,
        coalesce(sum(ol.quantity), 0)::integer as total_quantity,
        (coalesce(sum(ol.line_total_cents), 0)::numeric / 100.0)::numeric(12, 2)
            as total_amount
    from latest_run lr
    join public.order_lines ol
        on ol.order_run_id = lr.order_run_id
    join public.sessions s
        on s.id = ol.session_id
    group by s.caterer_id, lr.order_run_id, lr.service_week_start, lr.status
),
latest_order_lines as (
    select
        s.caterer_id,
        jsonb_agg(
            jsonb_build_object(
                'order_line_id', ol.id,
                'session_id', s.id,
                'school_name', sch.canonical_name,
                'session_date', s.session_date,
                'dish_variant_id', dv.id,
                'display_name',
                    case
                        when dv.name = 'Standard' then d.name
                        else d.name || ' - ' || dv.name
                    end,
                'quantity', ol.quantity,
                'unit_price', (ol.unit_price_cents::numeric / 100.0)::numeric(12, 2),
                'line_total', (ol.line_total_cents::numeric / 100.0)::numeric(12, 2)
            )
            order by sch.canonical_name, s.session_date, d.name, dv.name
        ) as latest_order_lines
    from latest_run lr
    join public.order_lines ol
        on ol.order_run_id = lr.order_run_id
    join public.sessions s
        on s.id = ol.session_id
    join public.schools sch
        on sch.id = s.school_id
    join public.dishes d
        on d.id = ol.dish_id
    join public.dish_variants dv
        on dv.id = ol.dish_variant_id
    group by s.caterer_id
),
communication_events as (
    select
        oce.communication_id,
        count(*)::integer as event_count,
        max(oce.created_at) as latest_event_at
    from public.order_communication_events oce
    group by oce.communication_id
),
latest_communications as (
    select
        c.id as caterer_id,
        jsonb_build_object(
            'communication_id', oc.id,
            'order_run_id', lr.order_run_id,
            'week_start', lr.service_week_start,
            'email_state',
                case
                    when oc.id is not null then 'exported'
                    when lr.order_run_id is not null
                     and lr.status = 'approved'
                     and coalesce(oru.issue_count, 0) = 0 then 'not_exported'
                    else 'not_ready'
                end,
            'subject', oc.subject,
            'exported_at', oc.exported_at,
            'exported_by', oc.exported_by,
            'event_count', coalesce(ce.event_count, 0),
            'latest_event_at', ce.latest_event_at
        ) as latest_communication
    from public.caterers c
    left join latest_run lr
        on true
    left join public.order_runs oru
        on oru.id = lr.order_run_id
    left join public.order_communications oc
        on oc.order_run_id = lr.order_run_id
       and oc.caterer_id = c.id
    left join communication_events ce
        on ce.communication_id = oc.id
)
select
    oc.caterer_id,
    oc.caterer_name,
    oc.region,
    oc.per_item_price,
    oc.gst_inclusive,
    oc.gst_rate_percent,
    oc.delivery_fee,
    oc.delivery_scope,
    oc.delivery_notes,
    oc.assigned_school_count,
    oc.contact_count,
    oc.dish_count,
    oc.variant_count,
    oc.available_variant_count,
    oc.reviewed_variant_count,
    oc.unreviewed_variant_count,
    coalesce(cn.contacts, '[]'::jsonb) as contacts,
    coalesce(mn.weekly_minimums, '[]'::jsonb) as weekly_minimums,
    coalesce(asg.assigned_schools, '[]'::jsonb) as assigned_schools,
    coalesce(ms.menu_summary, '{}'::jsonb) as menu_summary,
    jsonb_build_object(
        'order_run_id', lot.order_run_id,
        'week_start', lot.week_start,
        'status', lot.status,
        'line_count', coalesce(lot.line_count, 0),
        'session_count', coalesce(lot.session_count, 0),
        'total_quantity', coalesce(lot.total_quantity, 0),
        'total_amount', coalesce(lot.total_amount, 0)
    ) as latest_order_totals,
    coalesce(lol.latest_order_lines, '[]'::jsonb) as latest_order_lines,
    lc.latest_communication
from public.operator_caterers oc
left join contacts cn
    on cn.caterer_id = oc.caterer_id
left join minimums mn
    on mn.caterer_id = oc.caterer_id
left join assigned_schools asg
    on asg.caterer_id = oc.caterer_id
left join menu_summary ms
    on ms.caterer_id = oc.caterer_id
left join latest_order_totals lot
    on lot.caterer_id = oc.caterer_id
left join latest_order_lines lol
    on lol.caterer_id = oc.caterer_id
left join latest_communications lc
    on lc.caterer_id = oc.caterer_id;

revoke all on
    public.operator_caterers,
    public.operator_caterer_detail
from anon, authenticated;

grant select on
    public.operator_caterers,
    public.operator_caterer_detail
to authenticated;
