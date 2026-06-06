alter table public.caterer_reply_intake
    drop constraint if exists caterer_reply_intake_handled_status_check,
    add constraint caterer_reply_intake_handled_status_check check (
        handled_status in (
            'received',
            'parsed',
            'auto_handled',
            'auto_adjusted',
            'escalated',
            'ignored',
            'failed'
        )
    );
