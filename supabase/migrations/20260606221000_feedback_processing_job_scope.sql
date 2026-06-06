-- Allow concurrent distinct feedback-processing jobs while retaining one active
-- reply poll, feedback dispatch, and week-scoped autopilot run.

drop index if exists public.idx_automation_jobs_one_active_scope;

create unique index idx_automation_jobs_one_active_scope
    on public.automation_jobs (
        job_type,
        (
            case
            when job_type = 'feedback_processing'
                then coalesce(payload ->> 'feedback_id', '')
            else coalesce(payload ->> 'week_start', '')
            end
        )
    )
    where status in ('queued', 'running');
