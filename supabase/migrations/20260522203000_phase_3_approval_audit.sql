-- M11: Phase 3 approval, audit log, and manual override recording.

alter table public.order_runs
    add column approved_at timestamptz,
    add column approved_by text,
    add column approval_note text,
    add constraint order_runs_approved_requires_audit_metadata check (
        status <> 'approved'
        or (
            approved_at is not null
            and approved_by is not null
            and approval_note is not null
        )
    );

create table public.audit_log (
    id              uuid        primary key default gen_random_uuid(),
    order_run_id    uuid        references public.order_runs(id) on delete set null,
    actor_name      text        not null check (length(btrim(actor_name)) > 0),
    action          text        not null check (
        action in (
            'order_run_approved',
            'order_run_unapproved',
            'manual_override_created',
            'communication_exported'
        )
    ),
    entity_type     text        not null check (length(btrim(entity_type)) > 0),
    entity_id       uuid,
    reason          text        not null check (length(btrim(reason)) > 0),
    before_state    jsonb       not null default '{}'::jsonb,
    after_state     jsonb       not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);
create index idx_audit_log_order_run_id on public.audit_log (order_run_id);
create index idx_audit_log_created_at on public.audit_log (created_at desc);
create index idx_audit_log_action on public.audit_log (action);

create table public.manual_overrides (
    id              uuid        primary key default gen_random_uuid(),
    order_run_id    uuid        not null references public.order_runs(id) on delete cascade,
    actor_name      text        not null check (length(btrim(actor_name)) > 0),
    override_type   text        not null check (
        override_type in (
            'allocation',
            'order_line',
            'student_attendance',
            'dietary_resolution',
            'contact',
            'other'
        )
    ),
    entity_type     text        not null check (length(btrim(entity_type)) > 0),
    entity_id       uuid,
    reason          text        not null check (length(btrim(reason)) > 0),
    before_state    jsonb       not null default '{}'::jsonb,
    after_state     jsonb       not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);
create index idx_manual_overrides_order_run_id on public.manual_overrides (order_run_id);
create index idx_manual_overrides_created_at on public.manual_overrides (created_at desc);
create index idx_manual_overrides_type on public.manual_overrides (override_type);

alter table public.audit_log        enable row level security;
alter table public.manual_overrides enable row level security;

revoke all on public.audit_log        from anon, authenticated;
revoke all on public.manual_overrides from anon, authenticated;
