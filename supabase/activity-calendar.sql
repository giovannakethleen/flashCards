create table if not exists public.flashcard_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  activity_type text not null check (activity_type in ('card_added', 'card_reviewed')),
  review_result text check (review_result in ('miss', 'hard', 'remembered', 'easy')),
  occurred_at timestamptz not null default now(),
  constraint flashcard_activity_review_consistency_check
    check (
      (activity_type = 'card_reviewed' and review_result is not null)
      or (activity_type = 'card_added' and review_result is null)
    )
);

create index if not exists idx_flashcard_activity_user_date
  on public.flashcard_activity (user_id, occurred_at);

create index if not exists idx_flashcard_activity_user_card_date
  on public.flashcard_activity (user_id, card_id, occurred_at)
  where activity_type = 'card_reviewed';

create unique index if not exists idx_flashcard_activity_card_added
  on public.flashcard_activity (card_id)
  where activity_type = 'card_added';

alter table public.flashcard_activity enable row level security;

drop policy if exists "Usuários podem consultar apenas sua própria atividade"
  on public.flashcard_activity;
create policy "Usuários podem consultar apenas sua própria atividade"
  on public.flashcard_activity
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.flashcard_activity from anon, authenticated;
grant select on public.flashcard_activity to authenticated;

create or replace function public.log_flashcard_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.flashcard_activity (user_id, card_id, activity_type, occurred_at)
  values (new.user_id, new.id, 'card_added', new.created_at)
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.log_flashcard_created() from public, anon, authenticated;

drop trigger if exists flashcards_log_created on public.flashcards;
create trigger flashcards_log_created
  after insert on public.flashcards
  for each row execute function public.log_flashcard_created();

insert into public.flashcard_activity (user_id, card_id, activity_type, occurred_at)
select user_id, id, 'card_added', created_at
from public.flashcards
on conflict do nothing;

create or replace function public.record_flashcard_review(
  p_card_id uuid,
  p_result text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_interval interval;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_interval := case p_result
    when 'miss' then interval '1 hour'
    when 'hard' then interval '1 day'
    when 'remembered' then interval '3 days'
    when 'easy' then interval '7 days'
    else null
  end;

  if v_interval is null then
    raise exception 'Invalid review result';
  end if;

  update public.flashcards
  set
    review_count = coalesce(review_count, 0) + 1,
    mistake_count = coalesce(mistake_count, 0)
      + case when p_result in ('miss', 'hard') then 1 else 0 end,
    next_review_at = v_now + v_interval,
    last_reviewed_at = v_now
  where id = p_card_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Flashcard not found';
  end if;

  insert into public.flashcard_activity (user_id, card_id, activity_type, review_result, occurred_at)
  values (v_user_id, p_card_id, 'card_reviewed', p_result, v_now);
end;
$$;

revoke all on function public.record_flashcard_review(uuid, text) from public, anon;
grant execute on function public.record_flashcard_review(uuid, text) to authenticated;

create or replace function public.get_flashcard_activity(
  p_start_date date,
  p_end_date date,
  p_timezone text
)
returns table (
  activity_date date,
  cards_added bigint,
  cards_studied bigint,
  reviews bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_start_date is null or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 400
  then
    raise exception 'Invalid activity date range';
  end if;

  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Invalid time zone';
  end if;

  return query
  with days as (
    select series.activity_date::date as activity_date
    from pg_catalog.generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    ) as series(activity_date)
  ),
  daily_activity as (
    select
      (activity.occurred_at at time zone p_timezone)::date as activity_date,
      count(*) filter (where activity.activity_type = 'card_added') as cards_added,
      count(distinct activity.card_id) filter (
        where activity.activity_type = 'card_reviewed'
      ) as cards_studied,
      count(*) filter (where activity.activity_type = 'card_reviewed') as reviews
    from public.flashcard_activity as activity
    where activity.user_id = auth.uid()
      and (activity.occurred_at at time zone p_timezone)::date between p_start_date and p_end_date
    group by (activity.occurred_at at time zone p_timezone)::date
  )
  select
    days.activity_date,
    coalesce(daily_activity.cards_added, 0),
    coalesce(daily_activity.cards_studied, 0),
    coalesce(daily_activity.reviews, 0)
  from days
  left join daily_activity using (activity_date)
  order by days.activity_date;
end;
$$;

revoke all on function public.get_flashcard_activity(date, date, text) from public, anon;
grant execute on function public.get_flashcard_activity(date, date, text) to authenticated;
