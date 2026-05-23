-- M12: Phase 3 communication snapshots and export event tracking.

create table public.order_communications (
    id                  uuid        primary key default gen_random_uuid(),
    order_run_id        uuid        not null references public.order_runs(id) on delete cascade,
    caterer_id          uuid        not null references public.caterers(id) on delete restrict,
    status              text        not null default 'exported'
        check (status in ('exported')),
    subject             text        not null check (length(btrim(subject)) > 0),
    body                text        not null check (length(btrim(body)) > 0),
    rendered_text       text        not null check (length(btrim(rendered_text)) > 0),
    delivery_note_text  text        not null check (length(btrim(delivery_note_text)) > 0),
    template_version    text        not null check (length(btrim(template_version)) > 0),
    created_by          text        not null check (length(btrim(created_by)) > 0),
    created_at          timestamptz not null default now(),
    exported_by         text        not null check (length(btrim(exported_by)) > 0),
    exported_at         timestamptz not null default now(),
    unique (order_run_id, caterer_id)
);
create index idx_order_communications_order_run_id
    on public.order_communications (order_run_id);
create index idx_order_communications_caterer_id
    on public.order_communications (caterer_id);
create index idx_order_communications_exported_at
    on public.order_communications (exported_at desc);

create table public.order_communication_recipients (
    id                  uuid        primary key default gen_random_uuid(),
    communication_id    uuid        not null
        references public.order_communications(id) on delete cascade,
    caterer_contact_id  uuid        references public.caterer_contacts(id) on delete set null,
    display_name        text,
    email               citext      not null check (length(btrim(email::text)) > 0),
    recipient_type      text        not null check (recipient_type in ('to', 'cc', 'bcc')),
    role                text,
    cc_preference       text,
    created_at          timestamptz not null default now()
);
create index idx_order_communication_recipients_communication_id
    on public.order_communication_recipients (communication_id);
create index idx_order_communication_recipients_contact_id
    on public.order_communication_recipients (caterer_contact_id);

create table public.order_communication_events (
    id                  uuid        primary key default gen_random_uuid(),
    communication_id    uuid        not null
        references public.order_communications(id) on delete cascade,
    event_type          text        not null check (event_type in ('exported')),
    actor_name          text        not null check (length(btrim(actor_name)) > 0),
    reason              text        not null check (length(btrim(reason)) > 0),
    metadata            jsonb       not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
);
create index idx_order_communication_events_communication_id
    on public.order_communication_events (communication_id);
create index idx_order_communication_events_created_at
    on public.order_communication_events (created_at desc);

create function public.prevent_order_communication_event_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'order_communication_events is append-only';
end;
$$;

create trigger trg_order_communication_events_append_only
    before update or delete on public.order_communication_events
    for each row execute function public.prevent_order_communication_event_mutation();

alter table public.order_communications             enable row level security;
alter table public.order_communication_recipients   enable row level security;
alter table public.order_communication_events       enable row level security;

revoke all on public.order_communications           from anon, authenticated;
revoke all on public.order_communication_recipients from anon, authenticated;
revoke all on public.order_communication_events     from anon, authenticated;
revoke all on function public.prevent_order_communication_event_mutation()
    from public, anon, authenticated;
