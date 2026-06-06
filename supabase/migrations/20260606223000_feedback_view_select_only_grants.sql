-- Feedback operator views are read models. Keep authenticated access SELECT-only.

revoke all on
    public.operator_feedback_requests,
    public.operator_feedback_overview,
    public.operator_feedback_weekly_trends,
    public.operator_caterer_feedback_performance
from anon, authenticated;

grant select on
    public.operator_feedback_requests,
    public.operator_feedback_overview,
    public.operator_feedback_weekly_trends,
    public.operator_caterer_feedback_performance
to authenticated;
