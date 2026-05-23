-- M13: Security advisor fix for the communication event append-only trigger.

alter function public.prevent_order_communication_event_mutation()
    set search_path = pg_catalog;
