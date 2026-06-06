create or replace function public.claim_automation_job(
    p_worker_id text,
    p_lease_seconds integer default 120
)
returns setof public.automation_jobs
language plpgsql
set search_path = public
as $$
declare
    v_job public.automation_jobs%rowtype;
begin
    if nullif(btrim(p_worker_id), '') is null then
        raise exception 'worker id is required';
    end if;

    select *
    into v_job
    from public.automation_jobs
    where
        (
            status = 'queued'
            or (
                status = 'running'
                and lease_expires_at is not null
                and lease_expires_at <= now()
            )
        )
        and available_at <= now()
    order by available_at, created_at, id
    for update skip locked
    limit 1;

    if not found then
        return;
    end if;

    update public.automation_jobs
    set
        status = 'running',
        lease_owner = p_worker_id,
        lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
        attempt_count = attempt_count + 1,
        started_at = coalesce(started_at, now()),
        error_detail = null
    where id = v_job.id
    returning * into v_job;

    return next v_job;
end;
$$;

revoke all on function public.claim_automation_job(text, integer)
    from public, anon, authenticated;
grant execute on function public.claim_automation_job(text, integer)
    to service_role;
