-- M10: Dish variants for customisable orderable menu options.

-- D-09: customisable dishes are parent menu items; orderable options are variants.
create table public.dish_variants (
    id                      uuid        primary key default gen_random_uuid(),
    dish_id                 uuid        not null references public.dishes(id) on delete cascade,
    name                    text        not null,
    is_default              boolean     not null default false,
    is_available            boolean     not null default true,
    is_gluten_free          boolean     not null default false,
    is_dairy_free           boolean     not null default false,
    is_nut_free             boolean     not null default false,
    is_vegetarian_option    boolean     not null default false,
    is_halal_inferred       boolean     not null default false,
    has_no_declared_tags    boolean     not null default false,
    contains_beef           boolean     not null default false,
    contains_pork           boolean     not null default false,
    contains_red_meat       boolean     not null default false,
    contains_fish           boolean     not null default false,
    contains_shellfish      boolean     not null default false,
    ingredient_notes        text,
    ingredient_flags_source text        not null default 'unreviewed'
        check (ingredient_flags_source in ('unreviewed', 'keyword_inferred', 'operator_reviewed')),
    tags_reviewed_at        timestamptz,
    tags_reviewed_by        text,
    tags_review_reason      text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    unique (dish_id, name),
    constraint dish_variants_operator_review_requires_audit check (
        ingredient_flags_source <> 'operator_reviewed'
        or (
            tags_reviewed_at is not null
            and tags_reviewed_by is not null
            and tags_review_reason is not null
        )
    )
);

create unique index idx_dish_variants_one_default_per_dish
    on public.dish_variants (dish_id)
    where is_default;
create index idx_dish_variants_dish_id on public.dish_variants (dish_id);
create index idx_dish_variants_available on public.dish_variants (is_available);

create trigger trg_dish_variants_set_updated_at
    before update on public.dish_variants
    for each row execute function public.set_updated_at();

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
select
    id,
    'Standard',
    true,
    true,
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
from public.dishes
on conflict (dish_id, name) do nothing;

alter table public.menu_offers
    add column dish_variant_id uuid references public.dish_variants(id) on delete restrict;

update public.menu_offers mo
set dish_variant_id = dv.id
from public.dish_variants dv
where dv.dish_id = mo.dish_id
  and dv.is_default;

alter table public.menu_offers
    alter column dish_variant_id set not null;

alter table public.menu_offers
    drop constraint if exists menu_offers_service_week_start_dish_id_key,
    add constraint menu_offers_service_week_start_dish_variant_id_key
        unique (service_week_start, dish_variant_id);

create index idx_menu_offers_dish_variant_id on public.menu_offers (dish_variant_id);

alter table public.order_allocations
    add column dish_variant_id uuid references public.dish_variants(id) on delete restrict;

update public.order_allocations oa
set dish_variant_id = dv.id
from public.dish_variants dv
where oa.dish_id = dv.dish_id
  and dv.is_default
  and oa.dish_id is not null;

alter table public.order_allocations
    drop constraint if exists order_allocations_check,
    add constraint order_allocations_allocated_requires_dish_variant check (
        (
            status = 'allocated'
            and dish_id is not null
            and dish_variant_id is not null
        )
        or (
            status <> 'allocated'
            and dish_id is null
            and dish_variant_id is null
        )
    );

create index idx_order_allocations_dish_variant
    on public.order_allocations (dish_variant_id)
    where dish_variant_id is not null;

alter table public.order_lines
    add column dish_variant_id uuid references public.dish_variants(id) on delete restrict;

update public.order_lines ol
set dish_variant_id = dv.id
from public.dish_variants dv
where ol.dish_id = dv.dish_id
  and dv.is_default;

alter table public.order_lines
    alter column dish_variant_id set not null,
    drop constraint if exists order_lines_order_run_id_session_id_dish_id_key,
    add constraint order_lines_order_run_id_session_id_dish_variant_id_key
        unique (order_run_id, session_id, dish_variant_id);

create index idx_order_lines_dish_variant on public.order_lines (dish_variant_id);

alter table public.order_allocation_issues
    add column dish_variant_id uuid references public.dish_variants(id) on delete restrict;

create index idx_order_allocation_issues_dish_variant
    on public.order_allocation_issues (dish_variant_id)
    where dish_variant_id is not null;

alter table public.dish_variants enable row level security;
revoke all on public.dish_variants from anon, authenticated;
