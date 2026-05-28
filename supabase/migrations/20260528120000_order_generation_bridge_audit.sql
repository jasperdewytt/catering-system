-- M20: Audit coverage for website-triggered order generation.

alter table public.audit_log
    drop constraint if exists audit_log_action_check,
    add constraint audit_log_action_check check (
        action in (
            'order_run_approved',
            'order_run_unapproved',
            'order_run_generated',
            'manual_override_created',
            'communication_exported',
            'dish_variant_created',
            'dish_variant_reviewed',
            'dish_variant_availability_updated',
            'menu_offers_updated'
        )
    );

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

grant select on public.operator_audit_events to authenticated;
