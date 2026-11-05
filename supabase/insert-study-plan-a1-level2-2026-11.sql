-- November 2026 study plan from the supplied calendar image.
-- Run supabase/study-plan-monthly-template.sql first on an existing table.
-- This insert is idempotent for a matching user, plan name, date, and title.

do $$
declare
  v_user_id uuid := '7119d3aa-8dfa-4bac-b6c3-9a10cfbf2a0d';
  v_plan_name text := 'A1 — Level 2';
  v_inserted integer;
begin
  with special_days(day_number, tasks) as (
    values
      (1, '[
        ["YouTube em inglês","watch_video",45,null],
        ["Escrever o que entendeu","write_english",30,null],
        ["Tentar corrigir e conferir","write_english",20,null],
        ["Ler resumo em voz alta","conversation_class",10,null]
      ]'::jsonb),
      (8, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Revisar lições","study_lesson",45,null],
        ["Vocabulário","flashcard_review",30,null],
        ["Revisar erros escritos","write_english",30,null],
        ["Listening","watch_video",30,null],
        ["Speaking","conversation_class",30,null]
      ]'::jsonb),
      (15, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Revisar semanas 1–2","study_lesson",45,null],
        ["Vocabulário","flashcard_review",30,null],
        ["Revisar erros escritos","write_english",30,null],
        ["Listening","watch_video",30,null],
        ["Speaking","conversation_class",30,null]
      ]'::jsonb),
      (22, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Revisar lições","study_lesson",45,null],
        ["Vocabulário","flashcard_review",30,null],
        ["Revisar erros escritos","write_english",30,null],
        ["Listening","watch_video",30,null],
        ["Speaking","conversation_class",30,null]
      ]'::jsonb),
      (25, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Vídeo tech","watch_video",40,null],
        ["Resumo","write_english",30,null],
        ["Apresentação profissional","write_english",30,null],
        ["Entrevista","conversation_class",30,null],
        ["Vocabulário","flashcard_review",20,null]
      ]'::jsonb),
      (29, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Revisar novembro","study_lesson",45,null],
        ["Erros recorrentes","write_english",30,null],
        ["Listening sem legenda","watch_video",30,null],
        ["Speaking","conversation_class",30,null],
        ["Texto My November","write_english",30,null]
      ]'::jsonb),
      (30, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Vídeo","watch_video",30,null],
        ["Resumo final","write_english",30,null],
        ["Áudio sem roteiro","conversation_class",20,null],
        ["Avaliar evolução","write_english",30,null],
        ["Vocabulário","flashcard_review",30,null]
      ]'::jsonb)
  ),
  weekday_templates(weekday_number, tasks) as (
    values
      (1, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["YouTube","watch_video",40,null],
        ["Resumo","write_english",30,null],
        ["Correção / reescrita","write_english",30,null],
        ["Speaking","conversation_class",20,null],
        ["Vocabulário","flashcard_review",20,null]
      ]'::jsonb),
      (2, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Aula coletiva","conversation_class",60,null],
        ["Revisar erros","write_english",30,null],
        ["Listening","watch_video",30,null],
        ["Vocabulário","flashcard_review",20,null]
      ]'::jsonb),
      (3, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Vídeo tech","watch_video",40,null],
        ["Resumo","write_english",30,null],
        ["Falar do trabalho","conversation_class",30,null],
        ["Vocabulário tech","flashcard_review",30,null],
        ["Revisão","study_lesson",20,null]
      ]'::jsonb),
      (4, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Aula individual","conversation_class",60,null],
        ["Revisar aula","study_lesson",30,null],
        ["Listening","watch_video",30,null],
        ["5–10 frases","write_english",20,null]
      ]'::jsonb),
      (5, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Aula coletiva","conversation_class",60,null],
        ["YouTube","watch_video",30,null],
        ["Resumo","write_english",30,null],
        ["Vocabulário","flashcard_review",20,null]
      ]'::jsonb),
      (6, '[
        ["Lição 1 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Lição 2 — A1 Level 2","study_lesson",30,"A1 — Level 2"],
        ["Série/YouTube","watch_video",45,null],
        ["Leitura","study_lesson",30,null],
        ["Diário","write_english",30,null],
        ["Speaking","conversation_class",30,null],
        ["Vocabulário","flashcard_review",10,null]
      ]'::jsonb)
  ),
  days as (
    select
      day_number,
      make_date(2026, 11, day_number) as activity_date,
      tasks
    from special_days
    union all
    select
      day_number,
      make_date(2026, 11, day_number),
      template.tasks
    from generate_series(1, 30) as calendar_days(day_number)
    join weekday_templates as template
      on template.weekday_number =
        extract(dow from make_date(2026, 11, calendar_days.day_number))::integer
    where not exists (
      select 1
      from special_days
      where special_days.day_number = calendar_days.day_number
    )
  ),
  expanded as (
    select
      days.activity_date,
      task.value ->> 0 as title,
      task.value ->> 1 as activity_type,
      (task.value ->> 2)::integer as duration_minutes,
      nullif(task.value ->> 3, '') as lesson_reference
    from days
    cross join lateral jsonb_array_elements(days.tasks) as task(value)
  )
  insert into public.study_plan_activities (
    user_id,
    title,
    activity_type,
    starts_on,
    duration_minutes,
    actual_duration_minutes,
    lesson_reference,
    plan_name,
    status
  )
  select
    v_user_id,
    expanded.title,
    expanded.activity_type,
    expanded.activity_date,
    expanded.duration_minutes,
    null,
    expanded.lesson_reference,
    v_plan_name,
    case
      when expanded.activity_date < current_date then 'unrecorded'
      else 'planned'
    end
  from expanded
  where not exists (
    select 1
    from public.study_plan_activities as existing
    where existing.user_id = v_user_id
      and existing.plan_name = v_plan_name
      and existing.starts_on = expanded.activity_date
      and existing.title = expanded.title
  );

  get diagnostics v_inserted = row_count;
  raise notice 'Inserted % activities for % in November 2026.', v_inserted, v_plan_name;
end
$$;
