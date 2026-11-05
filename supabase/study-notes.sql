create table if not exists public.study_day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null,
  content text not null default '' check (char_length(content) <= 30000),
  updated_at timestamptz not null default now(),
  unique (user_id, note_date)
);

create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) <= 120),
  content text not null default '' check (char_length(content) <= 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_notes_user_updated
  on public.study_notes (user_id, updated_at desc);

alter table public.study_day_notes enable row level security;
alter table public.study_notes enable row level security;

drop policy if exists "Usuários podem consultar suas anotações diárias"
  on public.study_day_notes;
create policy "Usuários podem consultar suas anotações diárias"
  on public.study_day_notes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem salvar suas anotações diárias"
  on public.study_day_notes;
create policy "Usuários podem salvar suas anotações diárias"
  on public.study_day_notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas anotações diárias"
  on public.study_day_notes;
create policy "Usuários podem atualizar suas anotações diárias"
  on public.study_day_notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem consultar suas notas"
  on public.study_notes;
create policy "Usuários podem consultar suas notas"
  on public.study_notes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar suas notas"
  on public.study_notes;
create policy "Usuários podem criar suas notas"
  on public.study_notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas notas"
  on public.study_notes;
create policy "Usuários podem atualizar suas notas"
  on public.study_notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas notas"
  on public.study_notes;
create policy "Usuários podem excluir suas notas"
  on public.study_notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.study_day_notes, public.study_notes from anon, authenticated;
grant select, insert, update on public.study_day_notes to authenticated;
grant select, insert, update, delete on public.study_notes to authenticated;
