-- M15: Menu setup read models and audited operator RPCs.

grant select on public.caterer_weekly_minimums to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'caterer_weekly_minimums'
          and policyname = 'authenticated_operators_select'
    ) then
        create policy authenticated_operators_select
            on public.caterer_weekly_minimums
            for select
            to authenticated
            using (exists (select 1 from public.operators where id = (select auth.uid())));
    end if;
end;
$$;

create or replace view public.operator_menu_setup
with (security_invoker = true)
as
with active_caterers as (
    select distinct
        ow.week_start,
        ow.week_end,
        s.caterer_id
    from public.operator_weeks ow
    join public.sessions s
        on s.session_date between ow.week_start and ow.week_end
),
selected_counts as (
    select
        ac.week_start,
        ac.caterer_id,
        count(mo.id)::integer as current_selected_count
    from active_caterers ac
    left join public.dishes d
        on d.caterer_id = ac.caterer_id
    left join public.dish_variants dv
        on dv.dish_id = d.id
    left join public.menu_offers mo
        on mo.service_week_start = ac.week_start
       and mo.dish_variant_id = dv.id
    group by ac.week_start, ac.caterer_id
),
valid_counts as (
    select
        cwm.caterer_id,
        array_agg(cwm.menu_item_count order by cwm.menu_item_count) as valid_offer_counts
    from public.caterer_weekly_minimums cwm
    group by cwm.caterer_id
)
select
    ac.week_start,
    ac.week_end,
    c.id as caterer_id,
    c.name as caterer_name,
    d.id as dish_id,
    d.name as dish_name,
    d.name_raw as dish_name_raw,
    dv.id as variant_id,
    dv.name as variant_name,
    case
        when dv.name = 'Standard' then d.name
        else d.name || ' - ' || dv.name
    end as display_name,
    dv.is_default,
    dv.is_available,
    (mo.id is not null) as is_offered,
    mo.id as menu_offer_id,
    mo.selected_by,
    mo.selected_at,
    mo.notes as offer_notes,
    dv.is_gluten_free,
    dv.is_dairy_free,
    dv.is_nut_free,
    dv.is_vegetarian_option,
    dv.is_halal_inferred,
    dv.has_no_declared_tags,
    dv.contains_beef,
    dv.contains_pork,
    dv.contains_red_meat,
    dv.contains_fish,
    dv.contains_shellfish,
    dv.ingredient_notes,
    dv.ingredient_flags_source,
    (dv.ingredient_flags_source = 'operator_reviewed') as operator_reviewed,
    dv.tags_reviewed_at,
    dv.tags_reviewed_by,
    dv.tags_review_reason,
    coalesce(vc.valid_offer_counts, '{}'::smallint[]) as valid_offer_counts,
    coalesce(sc.current_selected_count, 0)::integer as current_selected_count,
    cwm.minimum_meals as selected_minimum_meals
from active_caterers ac
join public.caterers c
    on c.id = ac.caterer_id
join public.dishes d
    on d.caterer_id = c.id
join public.dish_variants dv
    on dv.dish_id = d.id
left join public.menu_offers mo
    on mo.service_week_start = ac.week_start
   and mo.dish_variant_id = dv.id
left join selected_counts sc
    on sc.week_start = ac.week_start
   and sc.caterer_id = c.id
left join valid_counts vc
    on vc.caterer_id = c.id
left join public.caterer_weekly_minimums cwm
    on cwm.caterer_id = c.id
   and cwm.menu_item_count = sc.current_selected_count;

create or replace view public.operator_validation_summary
with (security_invoker = true)
as
with active_caterers as (
    select distinct
        ow.week_start,
        ow.week_end,
        s.caterer_id,
        c.name as caterer_name
    from public.operator_weeks ow
    join public.sessions s
        on s.session_date between ow.week_start and ow.week_end
    join public.caterers c
        on c.id = s.caterer_id
),
offer_counts as (
    select
        ac.week_start,
        ac.caterer_id,
        ac.caterer_name,
        count(mo.id)::integer as selected_count
    from active_caterers ac
    left join public.dishes d
        on d.caterer_id = ac.caterer_id
    left join public.dish_variants dv
        on dv.dish_id = d.id
    left join public.menu_offers mo
        on mo.service_week_start = ac.week_start
       and mo.dish_variant_id = dv.id
    group by ac.week_start, ac.caterer_id, ac.caterer_name
),
latest_runs as (
    select distinct on (service_week_start)
        service_week_start as week_start,
        id as order_run_id,
        status
    from public.order_runs
    order by service_week_start, generated_at desc, created_at desc, id desc
)
select
    oc.week_start,
    'error'::text as severity,
    'missing_caterer_offer_set'::text as category,
    1::integer as finding_count,
    oc.caterer_name || ': no menu offers saved for this week.' as summary,
    '/weeks/' || oc.week_start::text || '/menu' as target_route,
    oc.caterer_id,
    oc.caterer_name
from offer_counts oc
where oc.selected_count = 0

union all

select
    oc.week_start,
    'error'::text as severity,
    'invalid_offer_count'::text as category,
    1::integer as finding_count,
    oc.caterer_name || ': ' || oc.selected_count::text
        || ' offered option(s), expected one of '
        || coalesce(
            (
                select array_to_string(array_agg(cwm.menu_item_count order by cwm.menu_item_count), ', ')
                from public.caterer_weekly_minimums cwm
                where cwm.caterer_id = oc.caterer_id
            ),
            'the configured caterer tiers'
        )
        || '.' as summary,
    '/weeks/' || oc.week_start::text || '/menu' as target_route,
    oc.caterer_id,
    oc.caterer_name
from offer_counts oc
where oc.selected_count > 0
  and not exists (
      select 1
      from public.caterer_weekly_minimums cwm
      where cwm.caterer_id = oc.caterer_id
        and cwm.menu_item_count = oc.selected_count
  )

union all

select
    oms.week_start,
    'error'::text as severity,
    'offered_unavailable_variant'::text as category,
    count(*)::integer as finding_count,
    oms.caterer_name || ': '
        || count(*)::text
        || ' offered option(s) are marked unavailable.' as summary,
    '/weeks/' || oms.week_start::text || '/menu' as target_route,
    oms.caterer_id,
    oms.caterer_name
from public.operator_menu_setup oms
where oms.is_offered
  and not oms.is_available
group by oms.week_start, oms.caterer_id, oms.caterer_name

union all

select
    oms.week_start,
    'warning'::text as severity,
    'offered_unreviewed_variant'::text as category,
    count(*)::integer as finding_count,
    oms.caterer_name || ': '
        || count(*)::text
        || ' offered option(s) still need operator review.' as summary,
    '/weeks/' || oms.week_start::text || '/menu' as target_route,
    oms.caterer_id,
    oms.caterer_name
from public.operator_menu_setup oms
where oms.is_offered
  and not oms.operator_reviewed
group by oms.week_start, oms.caterer_id, oms.caterer_name

union all

select
    ow.week_start,
    'info'::text as severity,
    'latest_order_status'::text as category,
    1::integer as finding_count,
    case
        when lr.order_run_id is null then 'No order run has been generated for this week.'
        else 'Latest order run status: ' || lr.status || '.'
    end as summary,
    '/weeks/' || ow.week_start::text || '/orders' as target_route,
    null::uuid as caterer_id,
    null::text as caterer_name
from public.operator_weeks ow
left join latest_runs lr
    on lr.week_start = ow.week_start

union all

select
    lr.week_start,
    case
        when oai.severity = 'error' then 'error'::text
        else 'warning'::text
    end as severity,
    'allocation_issue_summary'::text as category,
    count(*)::integer as finding_count,
    count(*)::text || ' persisted allocation '
        || case when count(*) = 1 then 'issue' else 'issues' end
        || ' on the latest order run.' as summary,
    '/weeks/' || lr.week_start::text || '/orders/' || lr.order_run_id::text as target_route,
    null::uuid as caterer_id,
    null::text as caterer_name
from latest_runs lr
join public.order_allocation_issues oai
    on oai.order_run_id = lr.order_run_id
group by lr.week_start, lr.order_run_id, oai.severity;

create or replace function public.operator_create_dish_variant(
    p_dish_id uuid,
    p_variant_name text,
    p_is_gluten_free boolean,
    p_is_dairy_free boolean,
    p_is_nut_free boolean,
    p_is_vegetarian_option boolean,
    p_is_halal_inferred boolean,
    p_contains_beef boolean,
    p_contains_pork boolean,
    p_contains_red_meat boolean,
    p_contains_fish boolean,
    p_contains_shellfish boolean,
    p_ingredient_notes text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_dish public.dishes%rowtype;
    v_variant_id uuid;
    v_variant_name text := btrim(p_variant_name);
    v_reason text := btrim(p_reason);
    v_now timestamptz := now();
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    if v_variant_name is null or length(v_variant_name) = 0 then
        raise exception 'Variant name is required.';
    end if;

    select *
    into v_dish
    from public.dishes
    where id = p_dish_id;

    if not found then
        raise exception 'Dish does not exist.';
    end if;

    if exists (
        select 1
        from public.dish_variants
        where dish_id = p_dish_id
          and lower(name) = lower(v_variant_name)
    ) then
        raise exception 'A variant with this name already exists for the dish.';
    end if;

    insert into public.dish_variants (
        dish_id,
        name,
        is_default,
        is_available,
        is_gluten_free,
        is_dairy_free,
        is_nut_free,
        is_vegetarian_option,
        is_halal_inferred,
        has_no_declared_tags,
        contains_beef,
        contains_pork,
        contains_red_meat,
        contains_fish,
        contains_shellfish,
        ingredient_notes,
        ingredient_flags_source,
        tags_reviewed_at,
        tags_reviewed_by,
        tags_review_reason
    )
    values (
        p_dish_id,
        v_variant_name,
        false,
        true,
        p_is_gluten_free,
        p_is_dairy_free,
        p_is_nut_free,
        p_is_vegetarian_option,
        p_is_halal_inferred,
        false,
        p_contains_beef,
        p_contains_pork,
        p_contains_red_meat,
        p_contains_fish,
        p_contains_shellfish,
        nullif(btrim(p_ingredient_notes), ''),
        'operator_reviewed',
        v_now,
        v_actor_name,
        v_reason
    )
    returning id into v_variant_id;

    insert into public.audit_log (
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        v_actor_name,
        'dish_variant_created',
        'dish_variant',
        v_variant_id,
        v_reason,
        '{}'::jsonb,
        jsonb_build_object(
            'dish_id', p_dish_id,
            'variant_id', v_variant_id,
            'variant_name', v_variant_name,
            'is_available', true,
            'is_gluten_free', p_is_gluten_free,
            'is_dairy_free', p_is_dairy_free,
            'is_nut_free', p_is_nut_free,
            'is_vegetarian_option', p_is_vegetarian_option,
            'is_halal_inferred', p_is_halal_inferred,
            'contains_beef', p_contains_beef,
            'contains_pork', p_contains_pork,
            'contains_red_meat', p_contains_red_meat,
            'contains_fish', p_contains_fish,
            'contains_shellfish', p_contains_shellfish,
            'ingredient_notes', nullif(btrim(p_ingredient_notes), '')
        ),
        v_now
    );

    return v_variant_id;
end;
$$;

create or replace function public.operator_review_dish_variant(
    p_dish_variant_id uuid,
    p_is_gluten_free boolean,
    p_is_dairy_free boolean,
    p_is_nut_free boolean,
    p_is_vegetarian_option boolean,
    p_is_halal_inferred boolean,
    p_contains_beef boolean,
    p_contains_pork boolean,
    p_contains_red_meat boolean,
    p_contains_fish boolean,
    p_contains_shellfish boolean,
    p_ingredient_notes text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_before jsonb;
    v_after jsonb;
    v_reason text := btrim(p_reason);
    v_now timestamptz := now();
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    select jsonb_build_object(
        'dish_variant_id', id,
        'is_gluten_free', is_gluten_free,
        'is_dairy_free', is_dairy_free,
        'is_nut_free', is_nut_free,
        'is_vegetarian_option', is_vegetarian_option,
        'is_halal_inferred', is_halal_inferred,
        'contains_beef', contains_beef,
        'contains_pork', contains_pork,
        'contains_red_meat', contains_red_meat,
        'contains_fish', contains_fish,
        'contains_shellfish', contains_shellfish,
        'ingredient_notes', ingredient_notes,
        'ingredient_flags_source', ingredient_flags_source,
        'tags_reviewed_at', tags_reviewed_at,
        'tags_reviewed_by', tags_reviewed_by,
        'tags_review_reason', tags_review_reason
    )
    into v_before
    from public.dish_variants
    where id = p_dish_variant_id;

    if v_before is null then
        raise exception 'Dish variant does not exist.';
    end if;

    update public.dish_variants
    set
        is_gluten_free = p_is_gluten_free,
        is_dairy_free = p_is_dairy_free,
        is_nut_free = p_is_nut_free,
        is_vegetarian_option = p_is_vegetarian_option,
        is_halal_inferred = p_is_halal_inferred,
        contains_beef = p_contains_beef,
        contains_pork = p_contains_pork,
        contains_red_meat = p_contains_red_meat,
        contains_fish = p_contains_fish,
        contains_shellfish = p_contains_shellfish,
        ingredient_notes = nullif(btrim(p_ingredient_notes), ''),
        ingredient_flags_source = 'operator_reviewed',
        tags_reviewed_at = v_now,
        tags_reviewed_by = v_actor_name,
        tags_review_reason = v_reason
    where id = p_dish_variant_id;

    select jsonb_build_object(
        'dish_variant_id', id,
        'is_gluten_free', is_gluten_free,
        'is_dairy_free', is_dairy_free,
        'is_nut_free', is_nut_free,
        'is_vegetarian_option', is_vegetarian_option,
        'is_halal_inferred', is_halal_inferred,
        'contains_beef', contains_beef,
        'contains_pork', contains_pork,
        'contains_red_meat', contains_red_meat,
        'contains_fish', contains_fish,
        'contains_shellfish', contains_shellfish,
        'ingredient_notes', ingredient_notes,
        'ingredient_flags_source', ingredient_flags_source,
        'tags_reviewed_at', tags_reviewed_at,
        'tags_reviewed_by', tags_reviewed_by,
        'tags_review_reason', tags_review_reason
    )
    into v_after
    from public.dish_variants
    where id = p_dish_variant_id;

    insert into public.audit_log (
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        v_actor_name,
        'dish_variant_reviewed',
        'dish_variant',
        p_dish_variant_id,
        v_reason,
        v_before,
        v_after,
        v_now
    );

    return p_dish_variant_id;
end;
$$;

create or replace function public.operator_update_dish_variant_availability(
    p_dish_variant_id uuid,
    p_is_available boolean,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_before jsonb;
    v_after jsonb;
    v_reason text := btrim(p_reason);
    v_now timestamptz := now();
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    select jsonb_build_object(
        'dish_variant_id', id,
        'is_available', is_available
    )
    into v_before
    from public.dish_variants
    where id = p_dish_variant_id;

    if v_before is null then
        raise exception 'Dish variant does not exist.';
    end if;

    update public.dish_variants
    set is_available = p_is_available
    where id = p_dish_variant_id;

    select jsonb_build_object(
        'dish_variant_id', id,
        'is_available', is_available
    )
    into v_after
    from public.dish_variants
    where id = p_dish_variant_id;

    insert into public.audit_log (
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        v_actor_name,
        'dish_variant_availability_updated',
        'dish_variant',
        p_dish_variant_id,
        v_reason,
        v_before,
        v_after,
        v_now
    );

    return p_dish_variant_id;
end;
$$;

create or replace function public.operator_save_menu_offers(
    p_week_start date,
    p_caterer_id uuid,
    p_dish_variant_ids uuid[],
    p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid := auth.uid();
    v_actor_name text;
    v_reason text := btrim(p_reason);
    v_now timestamptz := now();
    v_selected_ids uuid[];
    v_selected_count integer;
    v_before_ids uuid[];
    v_week_end date := p_week_start + 6;
begin
    if v_actor_id is null then
        raise exception 'Operator authentication is required.';
    end if;

    select display_name
    into v_actor_name
    from public.operators
    where id = v_actor_id;

    if v_actor_name is null then
        raise exception 'Authenticated user is not a registered operator.';
    end if;

    if length(v_reason) < 10 then
        raise exception 'A reason of at least 10 characters is required.';
    end if;

    if not exists (
        select 1
        from public.caterers
        where id = p_caterer_id
    ) then
        raise exception 'Caterer does not exist.';
    end if;

    if not exists (
        select 1
        from public.sessions
        where caterer_id = p_caterer_id
          and session_date between p_week_start and v_week_end
    ) then
        raise exception 'Caterer is not active for this week.';
    end if;

    if p_dish_variant_ids is null then
        raise exception 'Selected variant ids are required.';
    end if;

    if exists (
        select 1
        from unnest(p_dish_variant_ids) as selected(id)
        where selected.id is null
    ) then
        raise exception 'Selected variant ids cannot contain null values.';
    end if;

    select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_selected_ids
    from (
        select distinct selected.id
        from unnest(p_dish_variant_ids) as selected(id)
    ) deduped;

    v_selected_count := coalesce(cardinality(v_selected_ids), 0);

    if v_selected_count <> coalesce(cardinality(p_dish_variant_ids), 0) then
        raise exception 'Selected variant ids must be unique.';
    end if;

    if v_selected_count = 0 then
        raise exception 'Select at least one offered option.';
    end if;

    if not exists (
        select 1
        from public.caterer_weekly_minimums cwm
        where cwm.caterer_id = p_caterer_id
          and cwm.menu_item_count = v_selected_count
    ) then
        raise exception 'Selected offer count does not match this caterer''s configured menu-item tiers.';
    end if;

    if exists (
        select 1
        from unnest(v_selected_ids) as selected(id)
        left join public.dish_variants dv
            on dv.id = selected.id
        left join public.dishes d
            on d.id = dv.dish_id
        where dv.id is null
           or d.caterer_id <> p_caterer_id
    ) then
        raise exception 'All selected variants must exist and belong to this caterer.';
    end if;

    if exists (
        select 1
        from public.dish_variants dv
        where dv.id = any(v_selected_ids)
          and not dv.is_available
    ) then
        raise exception 'Unavailable variants cannot be offered.';
    end if;

    select coalesce(array_agg(mo.dish_variant_id order by mo.dish_variant_id), '{}'::uuid[])
    into v_before_ids
    from public.menu_offers mo
    join public.dish_variants dv
        on dv.id = mo.dish_variant_id
    join public.dishes d
        on d.id = dv.dish_id
    where mo.service_week_start = p_week_start
      and d.caterer_id = p_caterer_id;

    delete from public.menu_offers mo
    using public.dish_variants dv, public.dishes d
    where mo.dish_variant_id = dv.id
      and dv.dish_id = d.id
      and mo.service_week_start = p_week_start
      and d.caterer_id = p_caterer_id;

    insert into public.menu_offers (
        service_week_start,
        dish_id,
        dish_variant_id,
        selected_by,
        selected_at,
        notes
    )
    select
        p_week_start,
        dv.dish_id,
        dv.id,
        v_actor_name,
        v_now,
        v_reason
    from public.dish_variants dv
    where dv.id = any(v_selected_ids);

    insert into public.audit_log (
        actor_name,
        action,
        entity_type,
        entity_id,
        reason,
        before_state,
        after_state,
        created_at
    )
    values (
        v_actor_name,
        'menu_offers_updated',
        'menu_offer_set',
        p_caterer_id,
        v_reason,
        jsonb_build_object(
            'week_start', p_week_start,
            'caterer_id', p_caterer_id,
            'dish_variant_ids', v_before_ids
        ),
        jsonb_build_object(
            'week_start', p_week_start,
            'caterer_id', p_caterer_id,
            'dish_variant_ids', v_selected_ids
        ),
        v_now
    );

    return v_selected_count;
end;
$$;

revoke all on
    public.operator_menu_setup,
    public.operator_validation_summary
from anon, authenticated;

grant select on
    public.operator_menu_setup,
    public.operator_validation_summary
to authenticated;

revoke all on function public.operator_create_dish_variant(
    uuid,
    text,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    text,
    text
) from public, anon, authenticated;

revoke all on function public.operator_review_dish_variant(
    uuid,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    text,
    text
) from public, anon, authenticated;

revoke all on function public.operator_update_dish_variant_availability(
    uuid,
    boolean,
    text
) from public, anon, authenticated;

revoke all on function public.operator_save_menu_offers(
    date,
    uuid,
    uuid[],
    text
) from public, anon, authenticated;

grant execute on function public.operator_create_dish_variant(
    uuid,
    text,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    text,
    text
) to authenticated;

grant execute on function public.operator_review_dish_variant(
    uuid,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    text,
    text
) to authenticated;

grant execute on function public.operator_update_dish_variant_availability(
    uuid,
    boolean,
    text
) to authenticated;

grant execute on function public.operator_save_menu_offers(
    date,
    uuid,
    uuid[],
    text
) to authenticated;
