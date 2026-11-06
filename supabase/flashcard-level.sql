alter table public.flashcards
  add column if not exists level text
  check (level is null or level in ('beginner', 'intermediate', 'advanced'));

notify pgrst, 'reload schema';
