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
            'feedback_recorded',
            'caterer_reply_received',
            'order_run_revised',
            'ai_interpretation_recorded'
        )
    );
