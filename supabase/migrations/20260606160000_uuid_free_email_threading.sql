-- Persist RFC email threading identity for UUID-free caterer order subjects.

alter table public.order_communications
    add column outbound_message_id text,
    add column in_reply_to_message_id text,
    add column reference_message_ids text[] not null default '{}'::text[];

create unique index idx_order_communications_outbound_message_id
    on public.order_communications (outbound_message_id)
    where outbound_message_id is not null;
create index idx_order_communications_in_reply_to_message_id
    on public.order_communications (in_reply_to_message_id)
    where in_reply_to_message_id is not null;
create index idx_order_communications_reference_message_ids
    on public.order_communications using gin (reference_message_ids);

alter table public.caterer_reply_intake
    add column in_reply_to_message_id text,
    add column reference_message_ids text[] not null default '{}'::text[];

create index idx_caterer_reply_intake_in_reply_to_message_id
    on public.caterer_reply_intake (in_reply_to_message_id)
    where in_reply_to_message_id is not null;
create index idx_caterer_reply_intake_reference_message_ids
    on public.caterer_reply_intake using gin (reference_message_ids);

drop view public.operator_communications;

create view public.operator_communications
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
    oc.outbound_message_id,
    oc.in_reply_to_message_id,
    oc.reference_message_ids,
    case
        when oc.id is null then 'not_prepared'
        when oc.outbound_message_id is null then 'message_id_pending'
        when oc.in_reply_to_message_id is null then 'thread_started'
        when oc.in_reply_to_message_id = any(oc.reference_message_ids) then 'reply_in_thread'
        else 'reply_headers_incomplete'
    end as thread_status,
    oc.exported_at,
    oc.exported_by,
    rc.line_count,
    rc.total_quantity,
    coalesce(ec.event_count, 0)::integer as event_count,
    ec.latest_event_at,
    lse.latest_send_event_id,
    lse.latest_send_event_type,
    lse.latest_send_event_at,
    lse.latest_send_actor_name,
    lse.latest_send_provider,
    lse.latest_send_error,
    lse.latest_send_metadata
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

drop view public.operator_caterer_replies;

create view public.operator_caterer_replies
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
    cri.in_reply_to_message_id,
    cri.reference_message_ids,
    linked_oc.outbound_message_id as linked_outbound_message_id,
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
    revised_oc.id as revised_communication_id,
    revised_oc.status as revised_email_state,
    revised_oc.outbound_message_id as revised_outbound_message_id,
    revised_oc.in_reply_to_message_id as revised_parent_message_id,
    revised_oc.reference_message_ids as revised_reference_message_ids,
    case
        when revised_oc.id is null then 'not_prepared'
        when revised_oc.outbound_message_id is null then 'message_id_pending'
        when revised_oc.in_reply_to_message_id is null then 'not_threaded'
        when revised_oc.in_reply_to_message_id = any(revised_oc.reference_message_ids)
            then 'reply_in_thread'
        else 'reply_headers_incomplete'
    end as revised_thread_status,
    cri.metadata,
    cri.created_at,
    cri.updated_at
from public.caterer_reply_intake cri
left join public.order_runs oru
    on oru.id = cri.order_run_id
left join public.caterers c
    on c.id = cri.caterer_id
left join public.ai_interpretations ai
    on ai.id = cri.ai_interpretation_id
left join public.order_communications linked_oc
    on linked_oc.id = cri.communication_id
left join public.order_communications revised_oc
    on revised_oc.id::text = cri.metadata ->> 'revised_communication_id';

grant select on
    public.operator_communications,
    public.operator_caterer_replies
to authenticated;
