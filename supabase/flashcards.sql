create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  english_text text not null check (length(trim(english_text)) > 0),
  portuguese_text text not null check (length(trim(portuguese_text)) > 0),
  focus_word text,
  category text,
  source text,
  audio_info text,
  level text check (level is null or level in ('beginner', 'intermediate', 'advanced')),
  next_review_at timestamptz not null default now(),
  review_count integer not null default 0,
  mistake_count integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flashcards_user_next_review
  on public.flashcards (user_id, next_review_at);

alter table public.flashcards enable row level security;

create policy "Usuários podem gerenciar apenas seus próprios cartões"
  on public.flashcards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
