import { type StudyActivityInput, type StudyActivityStatus, type StudyActivityType } from './study-plan.service';

function addActivity(
  activities: StudyActivityInput[],
  planName: string,
  date: string,
  title: string,
  activity_type: StudyActivityType,
  duration_minutes: number,
  lesson_reference: string | null = null,
  status: StudyActivityStatus = 'planned',
) {
  activities.push({
    title,
    activity_type,
    starts_on: date,
    start_time: null,
    duration_minutes,
    actual_duration_minutes: null,
    lesson_reference,
    plan_name: planName,
    status,
  });
}

export function createLevelTwoSchedule(month: string, planName: string): StudyActivityInput[] {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let lessonNumber = 0;
  const activities: StudyActivityInput[] = [];

  for (let day = 1; day <= dayCount; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, monthNumber - 1, day).getDay();
    const status: StudyActivityStatus =
      new Date(year, monthNumber - 1, day) < today ? 'unrecorded' : 'planned';
    const lesson = () => {
      lessonNumber += 1;
      const source = `${planName} · Lição ${lessonNumber}`;
      addActivity(
        activities,
        planName,
        date,
        `Lição ${lessonNumber} — A1 Level 2`,
        'study_lesson',
        30,
        source,
        status,
      );
    };
    const add = (title: string, type: StudyActivityType, duration: number) =>
      addActivity(activities, planName, date, title, type, duration, null, status);
    const vocabulary = (title = 'Revisar vocabulário com flashcards', duration = 20) =>
      add(title, 'flashcard_review', duration);

    if (day === 1) {
      add('Assistir a vídeo em inglês', 'watch_video', 50);
      add('Escrever o que entendeu', 'write_english', 30);
      add('Corrigir e conferir o texto', 'write_english', 20);
      add('Resumir o vídeo em voz alta', 'conversation_class', 10);
      continue;
    }

    if (day === 8 || day === 22) {
      lesson();
      add('Revisar as lições da semana', 'study_lesson', 30);
      vocabulary('Revisar vocabulário da semana', 25);
      add('Revisar erros escritos', 'write_english', 25);
      add('Listening da semana', 'watch_video', 30);
      add('Speaking: resumo da semana', 'conversation_class', 20);
      continue;
    }

    if (day === 15) {
      lesson();
      add('Revisar as lições da semana', 'study_lesson', 30);
      vocabulary('Revisar vocabulário das semanas', 25);
      add('Revisar erros escritos', 'write_english', 25);
      add('Listening da semana', 'watch_video', 30);
      add('Speaking: resumo da semana', 'conversation_class', 20);
      add('Rever as semanas anteriores', 'study_lesson', 30);
      continue;
    }

    if (day === 29) {
      add('Revisar o mês', 'study_lesson', 30);
      add('Revisar erros recorrentes', 'write_english', 30);
      add('Listening sem legenda', 'watch_video', 45);
      add('Speaking: temas do mês', 'conversation_class', 30);
      add('Escrever retrospectiva em inglês', 'write_english', 30);
      continue;
    }

    if (day === 25) {
      lesson();
      lesson();
      add('Assistir a vídeo técnico em inglês', 'watch_video', 30);
      add('Resumir o conteúdo técnico', 'write_english', 30);
      add('Preparar apresentação profissional', 'write_english', 30);
      add('Praticar entrevista de emprego', 'conversation_class', 30);
      vocabulary('Revisar vocabulário profissional', 20);
      continue;
    }

    if (day === 30) {
      lesson();
      lesson();
      add('Assistir a vídeo em inglês', 'watch_video', 30);
      add('Escrever resumo final do mês', 'write_english', 30);
      add('Gravar áudio de retrospectiva', 'conversation_class', 20);
      add('Avaliar a evolução do mês', 'study_lesson', 20);
      vocabulary('Revisar vocabulário do mês', 20);
      continue;
    }

    if (dayOfWeek === 0) {
      lesson();
      add('Revisar as lições da semana', 'study_lesson', 30);
      vocabulary('Revisar vocabulário da semana', 30);
      add('Revisar erros escritos', 'write_english', 30);
      add('Listening em inglês', 'watch_video', 30);
      add('Speaking: resumo da semana', 'conversation_class', 20);
      continue;
    }

    lesson();
    lesson();
    switch (dayOfWeek) {
      case 1:
        add('Assistir a vídeo em inglês', 'watch_video', 30);
        add('Escrever resumo do vídeo', 'write_english', 30);
        add('Corrigir ou reescrever o resumo', 'write_english', 30);
        add('Speaking: contar o que estudou', 'conversation_class', 20);
        vocabulary();
        break;
      case 2:
        add('Aula coletiva de conversação', 'conversation_class', 60);
        add('Revisar erros da conversação', 'write_english', 30);
        add('Listening em inglês', 'watch_video', 30);
        vocabulary();
        break;
      case 3:
        add('Assistir a vídeo de tecnologia em inglês', 'watch_video', 30);
        add('Escrever resumo técnico', 'write_english', 30);
        add('Prática oral sobre trabalho', 'conversation_class', 30);
        vocabulary('Revisar vocabulário técnico', 20);
        add('Revisar conteúdo técnico', 'study_lesson', 20);
        break;
      case 4:
        add('Aula individual de conversação', 'conversation_class', 60);
        add('Revisar conteúdo da aula', 'study_lesson', 30);
        add('Listening em inglês', 'watch_video', 30);
        add('Registrar 5 a 10 frases', 'write_english', 20);
        break;
      case 5:
        add('Aula coletiva de conversação', 'conversation_class', 60);
        add('Assistir a vídeo no YouTube', 'watch_video', 30);
        add('Escrever resumo do vídeo', 'write_english', 30);
        vocabulary();
        break;
      case 6:
        add('Assistir a série ou vídeo em inglês', 'watch_video', 45);
        add('Leitura em inglês', 'study_lesson', 30);
        add('Escrever diário em inglês', 'write_english', 30);
        add('Speaking: narrar o dia', 'conversation_class', 20);
        vocabulary();
        break;
    }
  }

  return activities;
}
