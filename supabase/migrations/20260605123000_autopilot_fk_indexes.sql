-- Final Stage 2 follow-up: cover nullable foreign keys surfaced by Supabase
-- performance advisors after the autopilot schema migration.

create index idx_autopilot_runs_generated_order_run
    on public.autopilot_runs (generated_order_run_id)
    where generated_order_run_id is not null;

create index idx_autopilot_exceptions_session
    on public.autopilot_exceptions (session_id)
    where session_id is not null;

create index idx_autopilot_exceptions_order_run
    on public.autopilot_exceptions (order_run_id)
    where order_run_id is not null;

create index idx_autopilot_exceptions_dish_variant
    on public.autopilot_exceptions (dish_variant_id)
    where dish_variant_id is not null;

create index idx_autopilot_exceptions_resolved_by
    on public.autopilot_exceptions (resolved_by)
    where resolved_by is not null;

create index idx_student_meal_feedback_order_allocation
    on public.student_meal_feedback (order_allocation_id)
    where order_allocation_id is not null;

create index idx_caterer_quality_events_session
    on public.caterer_quality_events (session_id)
    where session_id is not null;

create index idx_ai_interpretations_student_meal_feedback
    on public.ai_interpretations (student_meal_feedback_id)
    where student_meal_feedback_id is not null;

create index idx_ai_interpretations_session_catering_feedback
    on public.ai_interpretations (session_catering_feedback_id)
    where session_catering_feedback_id is not null;

create index idx_ai_interpretations_caterer_reply
    on public.ai_interpretations (caterer_reply_id)
    where caterer_reply_id is not null;

create index idx_ai_interpretations_autopilot_exception
    on public.ai_interpretations (autopilot_exception_id)
    where autopilot_exception_id is not null;
