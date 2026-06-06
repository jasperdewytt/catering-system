-- Advisor-driven feedback request FK index coverage.

create index idx_feedback_requests_caterer
    on public.feedback_requests (caterer_id)
    where caterer_id is not null;

create index idx_feedback_requests_response_student_feedback
    on public.feedback_requests (response_student_feedback_id)
    where response_student_feedback_id is not null;

create index idx_feedback_requests_response_session_feedback
    on public.feedback_requests (response_session_feedback_id)
    where response_session_feedback_id is not null;
