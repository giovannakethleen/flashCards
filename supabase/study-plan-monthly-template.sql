alter table public.study_plan_activities
  add column if not exists actual_duration_minutes integer,
  add column if not exists plan_name text;

alter table public.study_plan_activities
  drop constraint if exists study_plan_activities_actual_duration_minutes_check,
  add constraint study_plan_activities_actual_duration_minutes_check
    check (actual_duration_minutes between 1 and 1440),
  drop constraint if exists study_plan_activities_plan_name_check,
  add constraint study_plan_activities_plan_name_check
    check (plan_name is null or char_length(trim(plan_name)) between 1 and 120),
  drop constraint if exists study_plan_activities_status_check,
  add constraint study_plan_activities_status_check
    check (status in ('planned', 'completed', 'postponed', 'skipped', 'unrecorded'));

create unique index if not exists idx_study_plan_activities_plan_day_title
  on public.study_plan_activities (user_id, plan_name, starts_on, title)
  where plan_name is not null;

drop policy if exists "Usuários podem excluir suas atividades de estudo"
  on public.study_plan_activities;
create policy "Usuários podem excluir suas atividades de estudo"
  on public.study_plan_activities
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.study_plan_activities from anon, authenticated;
grant select, insert, update, delete on public.study_plan_activities to authenticated;
