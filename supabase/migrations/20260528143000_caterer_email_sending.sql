-- M21: Caterer email live sending state and read model metadata.

alter table public.order_communications
    drop constraint if exists order_communications_status_check,
    add constraint order_communications_status_check check (
        status in ('exported', 'sent', 'failed')
    );

alter table public.order_communication_events
    drop constraint if exists order_communication_events_event_type_check,
    add constraint order_communication_events_event_type_check check (
        event_type in ('exported', 'sent', 'send_failed')
    );

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
            'menu_offers_updated'
        )
    );

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
),
latest_send_events as (
    select distinct on (oce.communication_id)
        oce.communication_id,
        oce.id as latest_send_event_id,
        oce.event_type as latest_send_event_type,
        oce.created_at as latest_send_event_at,
        oce.actor_name as latest_send_actor_name,
        oce.metadata as latest_send_metadata,
        oce.metadata ->> 'provider' as latest_send_provider,
        oce.metadata ->> 'error' as latest_send_error
    from public.order_communication_events oce
    where oce.event_type in ('sent', 'send_failed')
    order by oce.communication_id, oce.created_at desc
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
        when oc.status is not null then oc.status
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
    lse.latest_send_event_id,
    lse.latest_send_event_type,
    lse.latest_send_event_at,
    lse.latest_send_actor_name,
    lse.latest_send_provider,
    lse.latest_send_error,
    lse.latest_send_metadata,
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
    on ec.communication_id = oc.id
left join latest_send_events lse
    on lse.communication_id = oc.id;

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
    oce.metadata ->> 'provider' as provider,
    oce.metadata ->> 'error' as error,
    oce.created_at
from public.order_communication_events oce
join public.order_communications oc
    on oc.id = oce.communication_id
join public.caterers c
    on c.id = oc.caterer_id;

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
        when 'order_run_generated' then 'Order generated'
        when 'manual_override_created' then 'Manual override'
        when 'communication_exported' then 'Communication exported'
        when 'communication_sent' then 'Email sent'
        when 'communication_send_failed' then 'Email send failed'
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

grant select on
    public.operator_communications,
    public.operator_communication_events,
    public.operator_audit_events
to authenticated;
