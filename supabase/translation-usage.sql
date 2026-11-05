create table if not exists public.translation_monthly_usage (
  month_start date primary key,
  characters_reserved integer not null default 0 check (characters_reserved >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.translation_daily_usage (
  usage_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  requests_reserved integer not null default 0 check (requests_reserved >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, user_id)
);

alter table public.translation_monthly_usage enable row level security;
alter table public.translation_daily_usage enable row level security;

revoke all on public.translation_monthly_usage from public, anon, authenticated;
revoke all on public.translation_daily_usage from public, anon, authenticated;
grant select, insert, update on public.translation_monthly_usage to service_role;
grant select, insert, update on public.translation_daily_usage to service_role;

create or replace function public.reserve_card_translation_usage(
  p_user_id uuid,
  p_characters integer,
  p_monthly_limit integer,
  p_daily_request_limit integer
)
returns table (
  allowed boolean,
  characters_used integer,
  monthly_limit integer,
  daily_requests integer,
  daily_request_limit integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_month_start date := pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC')::date;
  v_usage_date date := (pg_catalog.now() at time zone 'UTC')::date;
  v_monthly_characters integer;
  v_daily_requests integer;
begin
  if p_user_id is null
    or p_characters is null
    or p_characters < 1
    or p_characters > 1000
    or p_monthly_limit is null
    or p_monthly_limit < 1
    or p_monthly_limit > 500000
    or p_daily_request_limit is null
    or p_daily_request_limit < 1
    or p_daily_request_limit > 100
  then
    raise exception 'Invalid translation usage reservation';
  end if;

  insert into public.translation_monthly_usage (month_start)
  values (v_month_start)
  on conflict (month_start) do nothing;

  select monthly_counter.characters_reserved
  into v_monthly_characters
  from public.translation_monthly_usage as monthly_counter
  where monthly_counter.month_start = v_month_start
  for update;

  insert into public.translation_daily_usage (usage_date, user_id)
  values (v_usage_date, p_user_id)
  on conflict (usage_date, user_id) do nothing;

  select daily_counter.requests_reserved
  into v_daily_requests
  from public.translation_daily_usage as daily_counter
  where daily_counter.usage_date = v_usage_date
    and daily_counter.user_id = p_user_id
  for update;

  if v_daily_requests >= p_daily_request_limit
    or v_monthly_characters + p_characters > p_monthly_limit
  then
    return query
      select false, v_monthly_characters, p_monthly_limit, v_daily_requests, p_daily_request_limit;
    return;
  end if;

  update public.translation_monthly_usage
  set characters_reserved = v_monthly_characters + p_characters,
      updated_at = v_now
  where month_start = v_month_start;

  update public.translation_daily_usage
  set requests_reserved = v_daily_requests + 1,
      updated_at = v_now
  where usage_date = v_usage_date
    and user_id = p_user_id;

  return query
    select true, v_monthly_characters + p_characters, p_monthly_limit,
      v_daily_requests + 1, p_daily_request_limit;
end;
$$;

revoke all on function public.reserve_card_translation_usage(uuid, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_card_translation_usage(uuid, integer, integer, integer)
  to service_role;
