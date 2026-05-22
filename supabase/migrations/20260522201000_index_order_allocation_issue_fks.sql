-- M9: Cover nullable foreign keys on order_allocation_issues.

create index idx_order_allocation_issues_session
    on public.order_allocation_issues (session_id)
    where session_id is not null;

create index idx_order_allocation_issues_student
    on public.order_allocation_issues (student_id)
    where student_id is not null;

create index idx_order_allocation_issues_dish
    on public.order_allocation_issues (dish_id)
    where dish_id is not null;
