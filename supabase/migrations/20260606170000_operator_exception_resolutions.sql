-- Operator-guided caterer reply resolution previews and idempotent application.

create table public.autopilot_exception_resolutions (
    id                          uuid        primary key default gen_random_uuid(),
    exception_id                uuid        not null references public.autopilot_exceptions(id) on delete cascade,
    caterer_reply_id            uuid        not null references public.caterer_reply_intake(id) on delete cascade,
    source_order_run_id         uuid        not null references public.order_runs(id) on delete restrict,
    operator_instruction        text        not null check (length(btrim(operator_instruction)) > 0),
    ai_interpretation_id        uuid        references public.ai_interpretations(id) on delete set null,
    proposed_action             jsonb       not null default '{}'::jsonb,
    edited_action               jsonb       not null default '{}'::jsonb,
    proposed_message_text       text        not null default '',
    final_message_text          text        not null default '',
    validation_report           jsonb       not null default '{}'::jsonb,
    status                      text        not null default 'draft' check (
        status in ('draft', 'ready', 'applied', 'failed', 'superseded')
    ),
    created_by                  uuid        not null references public.operators(id) on delete restrict,
    created_by_name             text        not null check (length(btrim(created_by_name)) > 0),
    created_at                  timestamptz not null default now(),
    applied_by                  uuid        references public.operators(id) on delete set null,
    applied_by_name             text,
    applied_at                  timestamptz,
    resulting_order_run_id      uuid        references public.order_runs(id) on delete set null,
    resulting_communication_id  uuid        references public.order_communications(id) on delete set null,
    idempotency_key             text        not null unique check (length(btrim(idempotency_key)) > 0),
    failure_detail              text,
    updated_at                  timestamptz not null default now(),
    check (
        (status = 'applied' and applied_at is not null)
        or status <> 'applied'
    )
);

create index idx_exception_resolutions_exception
    on public.autopilot_exception_resolutions (exception_id, created_at desc);
create index idx_exception_resolutions_reply
    on public.autopilot_exception_resolutions (caterer_reply_id, created_at desc);
create index idx_exception_resolutions_source_run
    on public.autopilot_exception_resolutions (source_order_run_id);
create index idx_exception_resolutions_status
    on public.autopilot_exception_resolutions (status);
create index idx_exception_resolutions_ai
    on public.autopilot_exception_resolutions (ai_interpretation_id)
    where ai_interpretation_id is not null;
create index idx_exception_resolutions_created_by
    on public.autopilot_exception_resolutions (created_by);
create index idx_exception_resolutions_applied_by
    on public.autopilot_exception_resolutions (applied_by)
    where applied_by is not null;
create index idx_exception_resolutions_resulting_run
    on public.autopilot_exception_resolutions (resulting_order_run_id)
    where resulting_order_run_id is not null;
create index idx_exception_resolutions_resulting_communication
    on public.autopilot_exception_resolutions (resulting_communication_id)
    where resulting_communication_id is not null;

create trigger trg_autopilot_exception_resolutions_set_updated_at
    before update on public.autopilot_exception_resolutions
    for each row execute function public.set_updated_at();

alter table public.order_communications
    drop constraint if exists order_communications_order_run_id_caterer_id_key,
    add column communication_kind text not null default 'order_snapshot' check (
        communication_kind in ('order_snapshot', 'exception_reply')
    ),
    add column source_reply_id uuid references public.caterer_reply_intake(id) on delete set null,
    add column exception_resolution_id uuid references public.autopilot_exception_resolutions(id) on delete set null;

create unique index idx_order_communications_canonical_snapshot
    on public.order_communications (order_run_id, caterer_id)
    where communication_kind = 'order_snapshot';
create unique index idx_order_communications_exception_resolution
    on public.order_communications (exception_resolution_id)
    where exception_resolution_id is not null;
create index idx_order_communications_source_reply
    on public.order_communications (source_reply_id)
    where source_reply_id is not null;

alter table public.ai_interpretations
    drop constraint if exists ai_interpretations_purpose_check,
    add constraint ai_interpretations_purpose_check check (
        purpose in (
            'dish_tagging',
            'student_feedback',
            'manager_feedback',
            'caterer_reply',
            'exception_explanation',
            'exception_resolution'
        )
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
            'ai_interpretation_recorded'
        )
    );

alter table public.autopilot_exception_resolutions enable row level security;
revoke all on public.autopilot_exception_resolutions from anon, authenticated;
grant select on public.autopilot_exception_resolutions to authenticated;

create policy authenticated_operators_select
    on public.autopilot_exception_resolutions
    for select
    to authenticated
    using (exists (
        select 1 from public.operators where id = (select auth.uid())
    ));

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
    ae.resolved_note,
    cri.id as caterer_reply_id,
    coalesce(
        ai.parsed_output ->> 'summary',
        ae.detail,
        cri.handling_summary,
        cri.subject
    ) as complete_interpreted_summary,
    cri.raw_body as original_reply_body,
    ae.metadata ->> 'deterministic_block_reason' as deterministic_block_reason,
    latest_resolution.id as latest_resolution_id,
    latest_resolution.status as resolution_status,
    latest_resolution.final_message_text as resolution_message_text,
    latest_resolution.resulting_order_run_id,
    latest_resolution.resulting_communication_id
from public.autopilot_exceptions ae
left join public.students st on st.id = ae.student_id
left join public.sessions s on s.id = ae.session_id
left join public.schools sc on sc.id = s.school_id
left join public.caterers c on c.id = ae.caterer_id
left join public.dish_variants dv on dv.id = ae.dish_variant_id
left join public.dishes d on d.id = dv.dish_id
left join public.operators op on op.id = ae.resolved_by
left join public.caterer_reply_intake cri
    on cri.id::text = ae.metadata ->> 'caterer_reply_id'
left join public.ai_interpretations ai on ai.id = cri.ai_interpretation_id
left join lateral (
    select aer.*
    from public.autopilot_exception_resolutions aer
    where aer.exception_id = ae.id
    order by aer.created_at desc
    limit 1
) latest_resolution on true;

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
    cri.updated_at,
    cri.raw_body as original_reply_body,
    coalesce(
        ai.parsed_output ->> 'summary',
        ae.detail,
        cri.handling_summary,
        cri.subject
    ) as complete_interpreted_summary,
    ae.detail as exception_detail,
    coalesce(
        ae.metadata ->> 'deterministic_block_reason',
        cri.metadata ->> 'deterministic_block_reason'
    ) as deterministic_block_reason,
    ae.recommended_action,
    ae.status as exception_status,
    latest_resolution.status as resolution_status,
    latest_resolution.final_message_text as resolution_message_text
from public.caterer_reply_intake cri
left join public.order_runs oru on oru.id = cri.order_run_id
left join public.caterers c on c.id = cri.caterer_id
left join public.ai_interpretations ai on ai.id = cri.ai_interpretation_id
left join public.order_communications linked_oc on linked_oc.id = cri.communication_id
left join public.order_communications revised_oc
    on revised_oc.id::text = cri.metadata ->> 'revised_communication_id'
left join public.autopilot_exceptions ae
    on ae.id::text = cri.metadata ->> 'autopilot_exception_id'
left join lateral (
    select aer.*
    from public.autopilot_exception_resolutions aer
    where aer.caterer_reply_id = cri.id
    order by aer.created_at desc
    limit 1
) latest_resolution on true;

create or replace view public.operator_exception_resolutions
with (security_invoker = true)
as
select
    aer.id as resolution_id,
    aer.exception_id,
    aer.caterer_reply_id,
    aer.source_order_run_id,
    aer.operator_instruction,
    aer.ai_interpretation_id,
    aer.proposed_action,
    aer.edited_action,
    aer.proposed_message_text,
    aer.final_message_text,
    aer.validation_report,
    aer.status,
    aer.created_by,
    aer.created_by_name,
    aer.created_at,
    aer.applied_by,
    aer.applied_by_name,
    aer.applied_at,
    aer.resulting_order_run_id,
    aer.resulting_communication_id,
    aer.failure_detail,
    aer.updated_at
from public.autopilot_exception_resolutions aer;

create or replace view public.operator_exception_resolution_options
with (security_invoker = true)
as
select distinct
    ae.id as exception_id,
    ae.order_run_id,
    ae.caterer_id,
    ol.dish_variant_id,
    case
        when dv.is_default then d.name
        else d.name || ' - ' || dv.name
    end as display_name,
    true as is_current_order_item,
    dv.is_available,
    dv.ingredient_flags_source = 'operator_reviewed' as is_operator_reviewed
from public.autopilot_exceptions ae
join public.order_lines ol on ol.order_run_id = ae.order_run_id
join public.sessions s on s.id = ol.session_id and s.caterer_id = ae.caterer_id
join public.dish_variants dv on dv.id = ol.dish_variant_id
join public.dishes d on d.id = dv.dish_id
where ae.category = 'caterer_reply'
union
select distinct
    ae.id as exception_id,
    ae.order_run_id,
    ae.caterer_id,
    dv.id as dish_variant_id,
    case
        when dv.is_default then d.name
        else d.name || ' - ' || dv.name
    end as display_name,
    false as is_current_order_item,
    dv.is_available,
    dv.ingredient_flags_source = 'operator_reviewed' as is_operator_reviewed
from public.autopilot_exceptions ae
join public.dishes d on d.caterer_id = ae.caterer_id
join public.dish_variants dv on dv.dish_id = d.id
where ae.category = 'caterer_reply';

grant select on
    public.operator_autopilot_exceptions,
    public.operator_caterer_replies,
    public.operator_exception_resolutions,
    public.operator_exception_resolution_options
to authenticated;
