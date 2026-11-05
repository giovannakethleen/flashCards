create table if not exists public.study_plan_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  activity_type text not null check (
    activity_type in (
      'study_lesson',
      'flashcard_review',
      'watch_video',
      'write_english',
      'conversation_class'
    )
  ),
  starts_on date not null,
  start_time time,
  duration_minutes integer check (duration_minutes between 1 and 1440),
  actual_duration_minutes integer check (actual_duration_minutes between 1 and 1440),
  lesson_reference text check (lesson_reference is null or char_length(lesson_reference) <= 160),
  plan_name text check (plan_name is null or char_length(trim(plan_name)) between 1 and 120),
  status text not null default 'planned' check (
    status in ('planned', 'completed', 'postponed', 'skipped', 'unrecorded')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_activities_user_date
  on public.study_plan_activities (user_id, starts_on, start_time);

create unique index if not exists idx_study_plan_activities_plan_day_title
  on public.study_plan_activities (user_id, plan_name, starts_on, title)
  where plan_name is not null;

alter table public.study_plan_activities enable row level security;

drop policy if exists "Usuários podem consultar suas atividades de estudo"
  on public.study_plan_activities;
create policy "Usuários podem consultar suas atividades de estudo"
  on public.study_plan_activities
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar suas atividades de estudo"
  on public.study_plan_activities;
create policy "Usuários podem criar suas atividades de estudo"
  on public.study_plan_activities
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas atividades de estudo"
  on public.study_plan_activities;
create policy "Usuários podem atualizar suas atividades de estudo"
  on public.study_plan_activities
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas atividades de estudo"
  on public.study_plan_activities;
create policy "Usuários podem excluir suas atividades de estudo"
  on public.study_plan_activities
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.study_plan_activities from anon, authenticated;
grant select, insert, update, delete on public.study_plan_activities to authenticated;
