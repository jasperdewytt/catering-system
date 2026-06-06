create index idx_automation_jobs_actor
    on public.automation_jobs (actor_id)
    where actor_id is not null;

create index idx_automation_jobs_autopilot_run
    on public.automation_jobs (linked_autopilot_run_id)
    where linked_autopilot_run_id is not null;

create index idx_automation_schedules_last_job
    on public.automation_schedules (last_job_id)
    where last_job_id is not null;
