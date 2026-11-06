import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';

import { createLevelTwoSchedule } from './monthly-schedule';

import { CardService, type DailyActivity } from '../cards/card.service';
import { FlashcardGenerationService } from '../core/flashcard-generation.service';
import {
  StudyPlanService,
  type ScheduledReview,
  type StudyActivity,
  type StudyActivityInput,
  type StudyActivityStatus,
  type StudyNote,
  type StudyActivityType,
} from './study-plan.service';

type CalendarView = 'month' | 'week' | 'day';

interface CalendarDay {
  date: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
}

interface ActivityForm {
  title: string;
  activity_type: StudyActivityType;
  starts_on: string;
  start_time: string;
  duration_minutes: number | null;
  actual_duration_minutes: number | null;
  lesson_reference: string;
  plan_name: string;
}

@Component({
  selector: 'app-study-plan',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './study-plan.html',
})
export class StudyPlanComponent implements OnInit, OnDestroy {
  readonly weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  readonly activityTypes: Array<{ value: StudyActivityType; label: string }> = [
    { value: 'study_lesson', label: 'Estudar unidade ou lição' },
    { value: 'flashcard_review', label: 'Revisar flashcards' },
    { value: 'watch_video', label: 'Assistir a vídeos' },
    { value: 'write_english', label: 'Escrever em inglês' },
    { value: 'conversation_class', label: 'Aula de conversação' },
  ];

  view: CalendarView = 'week';
  activeTab: 'calendar' | 'notes' = 'calendar';
  displayedDate = this.startOfDay(new Date());
  selectedDate = this.formatDate(new Date());
  activities: StudyActivity[] = [];
  scheduledReviews: ScheduledReview[] = [];
  dailyActivity: DailyActivity[] = [];
  loading = true;
  saving = false;
  errorMessage = '';
  formError = '';
  formOpen = false;
  editingId = '';
  periodLabel = '';
  monthDays: Array<CalendarDay | null> = [];
  weekDays: CalendarDay[] = [];
  form: ActivityForm = this.emptyForm();
  planName = 'A1 — Level 2';
  planMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  planMessage = '';
  dropTargetDate = '';
  private draggedActivity: StudyActivity | null = null;
  generatingPlan = false;
  deletingPlan = false;
  dayNoteContent = '';
  dayNoteStatus = '';
  notes: StudyNote[] = [];
  selectedNote: StudyNote | null = null;
  noteSearch = '';
  noteTagFilter = '';
  noteTagDraft = '';
  notePreview = false;
  private noteTextarea?: HTMLTextAreaElement;
  notesLoading = false;
  notesError = '';
  creatingNote = false;
  deletingNote = false;
  notePendingDelete: StudyNote | null = null;
  freeNoteStatus = '';
  noteAiError = '';
  noteExplanation = '';
  explainingNote = false;
  private dayNoteTimer: ReturnType<typeof setTimeout> | null = null;
  private freeNoteTimer: ReturnType<typeof setTimeout> | null = null;
  private freeNoteSaveVersion = 0;
  readonly activityStatuses: Array<{ value: StudyActivityStatus; label: string }> = [
    { value: 'planned', label: 'Planejada' },
    { value: 'completed', label: 'Concluída' },
    { value: 'postponed', label: 'Adiada' },
    { value: 'skipped', label: 'Não realizada' },
    { value: 'unrecorded', label: 'Ainda não registrada' },
  ];
  constructor(
    private readonly service: StudyPlanService,
    private readonly cardService: CardService,
    private readonly flashcardGeneration: FlashcardGenerationService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.activeTab = this.router.url.startsWith('/study-notes') ? 'notes' : 'calendar';
    if (this.activeTab === 'notes') {
      void this.loadNotes();
    } else {
      void this.loadCalendar();
    }
  }

  ngOnDestroy() {
    if (this.dayNoteTimer) {
      this.flushDayNote();
    }
    if (this.freeNoteTimer && this.selectedNote) {
      clearTimeout(this.freeNoteTimer);
      void this.service.updateNote(
        this.selectedNote.id,
        this.selectedNote.title,
        this.selectedNote.content,
        this.selectedNote.tags ?? [],
      ).catch((error: unknown) => {
        this.freeNoteStatus =
          error instanceof Error ? error.message : 'Não foi possível salvar a nota.';
      });
    }
  }

  async loadCalendar() {
    this.loading = true;
    this.errorMessage = '';
    this.updateCalendarDays();
    void this.loadDayNote(this.selectedDate);

    try {
      const { start, endExclusive } = this.visibleRange();
      const startDate = this.formatDate(start);
      const endDate = this.formatDate(new Date(endExclusive.getTime() - 86400000));
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const [activities, reviews, dailyActivity] = await Promise.all([
        this.service.listActivities(startDate, endDate),
        this.service.listScheduledReviews(start, endExclusive),
        this.cardService.getActivityCalendar(startDate, endDate, timeZone),
      ]);
      this.activities = activities;
      this.scheduledReviews = reviews;
      this.dailyActivity = dailyActivity;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível carregar seu plano de estudos.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  setView(view: CalendarView) {
    this.view = view;
    void this.loadCalendar();
  }

  setTab(tab: 'calendar' | 'notes') {
    void this.router.navigate([tab === 'notes' ? '/study-notes' : '/study-plan']);
  }

  movePeriod(offset: -1 | 1) {
    this.flushDayNote();
    if (this.view === 'month') {
      this.displayedDate = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth() + offset,
        1,
      );
    } else if (this.view === 'week') {
      this.displayedDate = this.addDays(this.displayedDate, offset * 7);
    } else {
      this.displayedDate = this.addDays(this.displayedDate, offset);
    }
    this.selectedDate = this.formatDate(this.displayedDate);
    this.closeForm();
    void this.loadCalendar();
  }

  goToToday() {
    this.flushDayNote();
    this.displayedDate = this.startOfDay(new Date());
    this.selectedDate = this.formatDate(this.displayedDate);
    this.closeForm();
    void this.loadCalendar();
  }

  startActivityDrag(event: DragEvent, activity: StudyActivity) {
    if (activity.status !== 'planned' && activity.status !== 'unrecorded') {
      event.preventDefault();
      return;
    }
    this.draggedActivity = activity;
    event.dataTransfer?.setData('text/plain', activity.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  allowActivityDrop(event: DragEvent, date: string) {
    if (!this.draggedActivity || this.draggedActivity.starts_on === date) {
      return;
    }
    event.preventDefault();
    this.dropTargetDate = date;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  clearDropTarget(date: string) {
    if (this.dropTargetDate === date) {
      this.dropTargetDate = '';
    }
  }

  async dropActivity(event: DragEvent, date: string) {
    event.preventDefault();
    const activity = this.draggedActivity;
    this.draggedActivity = null;
    this.dropTargetDate = '';
    if (!activity || activity.starts_on === date) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    try {
      await this.service.saveActivity({ ...activity, starts_on: date }, activity.id);
      this.flushDayNote();
      this.selectedDate = date;
      this.displayedDate = this.startOfDay(new Date(`${date}T00:00:00`));
      await this.loadCalendar();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível mover a atividade.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  selectDate(date: string) {
    this.flushDayNote();
    this.selectedDate = date;
    this.displayedDate = this.parseDate(date);
    this.closeForm();
    this.updateCalendarDays();
    void this.loadDayNote(date);
  }

  activityFor(date: string): DailyActivity {
    return (
      this.dailyActivity.find((activity) => activity.date === date) ?? {
        date,
        cardsAdded: 0,
        cardsStudied: 0,
        reviews: 0,
      }
    );
  }

  activityLevel(date: string) {
    const activity = this.activityFor(date);
    const total = activity.cardsAdded + activity.cardsStudied + activity.reviews;
    return total === 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4;
  }

  onDayNoteInput(content: string) {
    this.dayNoteContent = content;
    this.dayNoteStatus = 'Salvando...';
    const date = this.selectedDate;
    if (this.dayNoteTimer) {
      clearTimeout(this.dayNoteTimer);
    }
    this.dayNoteTimer = setTimeout(() => {
      this.dayNoteTimer = null;
      void this.service
        .saveDayNote(date, content)
        .then(() => {
          if (this.selectedDate === date) {
            this.dayNoteStatus = 'Salvo';
          }
        })
        .catch((error: unknown) => {
          if (this.selectedDate === date) {
            this.dayNoteStatus =
              error instanceof Error ? error.message : 'Não foi possível salvar a anotação.';
          }
        })
        .finally(() => this.changeDetector.markForCheck());
    }, 650);
  }

  private flushDayNote() {
    if (!this.dayNoteTimer) {
      return;
    }
    clearTimeout(this.dayNoteTimer);
    this.dayNoteTimer = null;
    const date = this.selectedDate;
    const content = this.dayNoteContent;
    void this.service
      .saveDayNote(date, content)
      .then(() => {
        if (this.selectedDate === date) {
          this.dayNoteStatus = 'Salvo';
        }
      })
      .catch((error: unknown) => {
        if (this.selectedDate === date) {
          this.dayNoteStatus =
            error instanceof Error ? error.message : 'Não foi possível salvar a anotação.';
        }
      })
      .finally(() => this.changeDetector.markForCheck());
  }

  async loadDayNote(date: string) {
    this.dayNoteStatus = 'Carregando...';
    try {
      const content = await this.service.getDayNote(date);
      if (this.selectedDate === date && !this.dayNoteTimer) {
        this.dayNoteContent = content;
        this.dayNoteStatus = '';
      }
    } catch (error) {
      if (this.selectedDate === date) {
        this.dayNoteStatus =
          error instanceof Error ? error.message : 'Não foi possível carregar a anotação.';
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  get filteredNotes() {
    const query = this.noteSearch.trim().toLocaleLowerCase();
    return [...this.notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).filter((note) =>
      (!query || note.title.toLocaleLowerCase().includes(query) || note.content.toLocaleLowerCase().includes(query) || (note.tags ?? []).some((tag) => tag.toLocaleLowerCase().includes(query))) &&
      (!this.noteTagFilter || (note.tags ?? []).includes(this.noteTagFilter)));
  }

  get allNoteTags() { return [...new Set(this.notes.flatMap((note) => note.tags ?? []))].sort(); }

  addNoteTag(event?: Event) {
    event?.preventDefault();
    const note = this.selectedNote;
    const tag = this.noteTagDraft.trim().replace(/^#/, '').slice(0, 30);
    if (!note || !tag || (note.tags ?? []).some((item) => item.toLowerCase() === tag.toLowerCase())) return;
    note.tags = [...(note.tags ?? []), tag]; this.noteTagDraft = ''; this.scheduleNoteSave();
  }

  removeNoteTag(tag: string) {
    if (!this.selectedNote) return;
    this.selectedNote.tags = (this.selectedNote.tags ?? []).filter((item) => item !== tag); this.scheduleNoteSave();
  }

  registerNoteTextarea(element: HTMLTextAreaElement) { this.noteTextarea = element; }

  formatNote(mark: 'bold' | 'italic' | 'code' | 'heading' | 'bullet' | 'number') {
    const note = this.selectedNote;
    const area = this.noteTextarea;
    if (!note || !area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = note.content.slice(start, end);
    let replacement: string;
    if (mark === 'heading') replacement = selected.split('\n').map((line) => `## ${line}`).join('\n');
    else if (mark === 'bullet') replacement = selected.split('\n').map((line) => `- ${line}`).join('\n');
    else if (mark === 'number') replacement = selected.split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n');
    else { const token = mark === 'bold' ? '**' : mark === 'italic' ? '*' : '`'; replacement = `${token}${selected || 'texto'}${token}`; }
    note.content = note.content.slice(0, start) + replacement + note.content.slice(end);
    this.scheduleNoteSave();
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start, start + replacement.length); });
  }

  renderMarkdown(source: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    const lines = source.replace(/\r/g, '').split('\n'); const out: string[] = [];
    for (let i = 0; i < lines.length;) {
      if (lines[i].startsWith('```')) { const code: string[] = []; i++; while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]); i++; out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue; }
      if (/^\|.*\|$/.test(lines[i]) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) { const rows: string[][] = [lines[i].split('|').slice(1, -1).map((x) => x.trim())]; i += 2; while (i < lines.length && /^\|.*\|$/.test(lines[i])) rows.push(lines[i++].split('|').slice(1, -1).map((x) => x.trim())); out.push(`<table><thead><tr>${rows[0].map((x) => `<th>${inline(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((x) => `<td>${inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
      const h = /^(#{1,6})\s+(.+)$/.exec(lines[i]); if (h) { const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
      if (/^\s*[-*+]\s+/.test(lines[i])) { const a: string[] = []; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) a.push(`<li>${inline(lines[i++].replace(/^\s*[-*+]\s+/, ''))}</li>`); out.push(`<ul>${a.join('')}</ul>`); continue; }
      if (/^\s*\d+\.\s+/.test(lines[i])) { const a: string[] = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) a.push(`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ''))}</li>`); out.push(`<ol>${a.join('')}</ol>`); continue; }
      if (lines[i].trim()) out.push(`<p>${inline(lines[i])}</p>`); i++;
    }
    return out.join('');
  }

  async loadNotes() {
    this.notesLoading = true;
    this.notesError = '';
    try {
      this.notes = await this.service.listNotes();
      if (this.selectedNote) {
        this.selectedNote =
          this.notes.find((note) => note.id === this.selectedNote?.id) ?? null;
      }
      if (!this.selectedNote && this.notes.length) {
        this.selectedNote = this.notes[0];
      }
    } catch (error) {
      this.notesError =
        error instanceof Error ? error.message : 'Não foi possível carregar suas notas.';
    } finally {
      this.notesLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  selectNote(note: StudyNote) {
    const previous = this.selectedNote;
    if (previous && previous.id !== note.id && this.freeNoteTimer) {
      clearTimeout(this.freeNoteTimer);
      this.freeNoteTimer = null;
      void this.service
        .updateNote(previous.id, previous.title, previous.content, previous.tags ?? [])
        .catch((error: unknown) => {
          this.notesError = error instanceof Error ? error.message : 'Não foi possível salvar a nota.';
          this.changeDetector.markForCheck();
        });
    }
    this.selectedNote = note;
    this.noteExplanation = '';
    this.noteAiError = '';
    this.freeNoteStatus = '';
  }

  async createFreeNote() {
    if (this.creatingNote) {
      return;
    }
    this.creatingNote = true;
    this.notesError = '';
    try {
      const note = await this.service.createNote('Nova nota');
      this.notes = [note, ...this.notes];
      this.selectedNote = note;
      this.noteSearch = '';
      this.noteExplanation = '';
    } catch (error) {
      this.notesError = error instanceof Error ? error.message : 'Não foi possível criar a nota.';
    } finally {
      this.creatingNote = false;
      this.changeDetector.markForCheck();
    }
  }

  scheduleNoteSave() {
    const note = this.selectedNote;
    if (!note) {
      return;
    }
    this.freeNoteStatus = 'Salvando...';
    if (this.freeNoteTimer) {
      clearTimeout(this.freeNoteTimer);
    }
    const version = ++this.freeNoteSaveVersion;
    this.freeNoteTimer = setTimeout(() => {
      this.freeNoteTimer = null;
      void this.service
        .updateNote(note.id, note.title, note.content, note.tags ?? [])
        .then(() => {
          note.updated_at = new Date().toISOString();
          this.notes = [...this.notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          if (version === this.freeNoteSaveVersion && this.selectedNote?.id === note.id) {
            this.freeNoteStatus = 'Salvo';
          }
        })
        .catch((error: unknown) => {
          if (version === this.freeNoteSaveVersion && this.selectedNote?.id === note.id) {
            this.freeNoteStatus =
              error instanceof Error ? error.message : 'Não foi possível salvar a nota.';
          }
        })
        .finally(() => this.changeDetector.markForCheck());
    }, 1500);
  }

  deleteFreeNote(note: StudyNote) {
    this.notePendingDelete = note;
  }

  async confirmDeleteFreeNote() {
    const note = this.notePendingDelete;
    if (!note) return;
    this.notePendingDelete = null;
    if (this.freeNoteTimer) {
      clearTimeout(this.freeNoteTimer);
      this.freeNoteTimer = null;
    }
    this.deletingNote = true;
    this.notesError = '';
    try {
      await this.service.deleteNote(note.id);
      this.notes = this.notes.filter((item) => item.id !== note.id);
      this.selectedNote = this.notes[0] ?? null;
      this.noteExplanation = '';
      this.freeNoteStatus = '';
    } catch (error) {
      this.notesError =
        error instanceof Error ? error.message : 'Não foi possível excluir a nota.';
    } finally {
      this.deletingNote = false;
      this.changeDetector.markForCheck();
    }
  }

  createCardsFromNote(note: StudyNote) {
    if (note.content.trim().length > 5000) {
      this.noteAiError = 'A IA aceita até 5.000 caracteres. Reduza o texto da nota antes de continuar.';
      return;
    }
    try {
      window.sessionStorage.setItem('flashcards-ai-note-draft', note.content);
    } catch {
      this.noteAiError = 'Não foi possível preparar a nota para a geração com IA neste navegador.';
      return;
    }
    void this.router.navigate(['/generate-cards'], {
      queryParams: { source: `Nota: ${note.title}`.slice(0, 160) },
    });
  }

  async explainNote(note: StudyNote) {
    if (note.content.trim().length > 5000) {
      this.noteAiError = 'A IA aceita até 5.000 caracteres. Reduza o texto da nota antes de continuar.';
      return;
    }
    this.explainingNote = true;
    this.noteAiError = '';
    this.noteExplanation = '';
    try {
      this.noteExplanation = await this.flashcardGeneration.explain(note.content);
    } catch (error) {
      this.noteAiError =
        error instanceof Error ? error.message : 'Não foi possível explicar este conteúdo.';
    } finally {
      this.explainingNote = false;
      this.changeDetector.markForCheck();
    }
  }

  openNewActivity() {
    this.editingId = '';
    this.formError = '';
    this.form = { ...this.emptyForm(), starts_on: this.selectedDate };
    this.formOpen = true;
  }

  editActivity(activity: StudyActivity) {
    this.editingId = activity.id;
    this.formError = '';
    this.form = {
      title: activity.title,
      activity_type: activity.activity_type,
      starts_on: activity.starts_on,
      start_time: activity.start_time?.slice(0, 5) ?? '',
      duration_minutes: activity.duration_minutes,
      actual_duration_minutes: activity.actual_duration_minutes,
      lesson_reference: activity.lesson_reference ?? '',
      plan_name: activity.plan_name ?? '',
    };
    this.formOpen = true;
  }

  closeForm() {
    this.formOpen = false;
    this.formError = '';
    this.editingId = '';
  }

  async saveActivity() {
    if (!this.form.title.trim() || !this.form.starts_on) {
      this.formError = 'Informe o nome e a data da atividade.';
      return;
    }
    if (
      this.form.duration_minutes !== null &&
      (!Number.isInteger(Number(this.form.duration_minutes)) ||
        Number(this.form.duration_minutes) < 1 ||
        Number(this.form.duration_minutes) > 1440)
    ) {
      this.formError = 'A duração deve ser um número entre 1 e 1440 minutos.';
      return;
    }
    if (
      this.form.actual_duration_minutes !== null &&
      (!Number.isInteger(Number(this.form.actual_duration_minutes)) ||
        Number(this.form.actual_duration_minutes) < 1 ||
        Number(this.form.actual_duration_minutes) > 1440)
    ) {
      this.formError = 'O tempo real deve ser um número entre 1 e 1440 minutos.';
      return;
    }

    const existing = this.activities.find((activity) => activity.id === this.editingId);
    const input: StudyActivityInput = {
      title: this.form.title.trim(),
      activity_type: this.form.activity_type,
      starts_on: this.form.starts_on,
      start_time: this.form.start_time || null,
      duration_minutes: this.form.duration_minutes ? Number(this.form.duration_minutes) : null,
      actual_duration_minutes: this.form.actual_duration_minutes
        ? Number(this.form.actual_duration_minutes)
        : null,
      lesson_reference: this.form.lesson_reference.trim() || null,
      plan_name: this.form.plan_name.trim() || null,
      status: existing?.status ?? 'planned',
    };

    this.saving = true;
    this.formError = '';
    try {
      await this.service.saveActivity(input, this.editingId || undefined);
      this.flushDayNote();
      this.selectedDate = input.starts_on;
      this.displayedDate = this.parseDate(input.starts_on);
      this.closeForm();
      await this.loadCalendar();
    } catch (error) {
      this.formError =
        error instanceof Error ? error.message : 'Não foi possível salvar a atividade.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  goToFlashcardGeneration(activity: StudyActivity) {
    const source = activity.lesson_reference
      ? `${activity.lesson_reference} — ${activity.title}`
      : activity.title;
    void this.router.navigate(['/generate-cards'], { queryParams: { source } });
  }

  async changeActivityStatus(activity: StudyActivity, status: StudyActivityStatus) {
    if (activity.status === status) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    try {
      await this.service.updateStatus(activity.id, status);
      await this.loadCalendar();
      if (
        status === 'completed' &&
        window.confirm('Atividade concluída. Quer criar cartões a partir do seu resumo?')
      ) {
        this.goToFlashcardGeneration(activity);
      }
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível atualizar o status.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  async generateMonthlyPlan() {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(this.planMonth) ||
      !this.planName.trim() ||
      this.planName.trim().length > 120
    ) {
      this.planMessage = 'Informe um nome e um mês válidos para criar o plano.';
      return;
    }

    const [yearText, monthText] = this.planMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const startDate = `${this.planMonth}-01`;
    const endDate = `${this.planMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const activities = createLevelTwoSchedule(this.planMonth, this.planName.trim());

    this.generatingPlan = true;
    this.planMessage = '';
    try {
      const created = await this.service.createMonthlyPlan(
        this.planName.trim(),
        startDate,
        endDate,
        activities,
      );
      if (!created) {
        this.planMessage =
          'Já existe um plano com esse nome neste mês. Edite as atividades existentes para evitar duplicatas.';
        return;
      }

      this.flushDayNote();
      this.selectedDate = startDate;
      this.displayedDate = this.parseDate(startDate);
      this.view = 'month';
      this.planMessage = `${activities.length} atividades criadas para ${this.planMonth}. O plano é uma meta orientativa; ajuste o calendário como preferir.`;
      await this.loadCalendar();
    } catch (error) {
      this.planMessage =
        error instanceof Error ? error.message : 'Não foi possível criar o plano mensal.';
    } finally {
      this.generatingPlan = false;
      this.changeDetector.markForCheck();
    }
  }

  async deleteMonthlyPlan() {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(this.planMonth) ||
      !this.planName.trim() ||
      this.planName.trim().length > 120
    ) {
      this.planMessage = 'Informe um nome e um mês válidos para excluir o plano.';
      return;
    }

    const [yearText, monthText] = this.planMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const startDate = `${this.planMonth}-01`;
    const endDate = `${this.planMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const confirmed = window.confirm(
      `Excluir todas as atividades do plano “${this.planName.trim()}” de ${this.planMonth}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) {
      return;
    }

    this.deletingPlan = true;
    this.planMessage = '';
    try {
      const deleted = await this.service.deleteMonthlyPlan(
        this.planName.trim(),
        startDate,
        endDate,
      );
      this.planMessage = deleted
        ? `${deleted} atividades foram excluídas do plano ${this.planName.trim()} em ${this.planMonth}.`
        : `Nenhuma atividade do plano ${this.planName.trim()} foi encontrada em ${this.planMonth}.`;
      await this.loadCalendar();
    } catch (error) {
      this.planMessage =
        error instanceof Error ? error.message : 'Não foi possível excluir o plano mensal.';
    } finally {
      this.deletingPlan = false;
      this.changeDetector.markForCheck();
    }
  }

  get activePlanName() {
    if (this.activeTab === 'notes') {
      return 'Suas anotações de estudo em um espaço dedicado.';
    }
    return this.activities.find((activity) => activity.plan_name)?.plan_name ?? '';
  }

  get selectedDayPlannedMinutes() {
    return this.activitiesOn(this.selectedDate).reduce(
      (total, activity) => total + (activity.duration_minutes ?? 0),
      0,
    );
  }

  get selectedDayActualMinutes() {
    return this.activitiesOn(this.selectedDate).reduce(
      (total, activity) => total + (activity.actual_duration_minutes ?? 0),
      0,
    );
  }

  async deleteActivity(activity: StudyActivity) {
    if (!window.confirm(`Excluir “${activity.title}” do calendário?`)) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    try {
      await this.service.deleteActivity(activity.id);
      await this.loadCalendar();
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Não foi possível excluir a atividade.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  activitiesOn(date: string) {
    return this.activities.filter((activity) => activity.starts_on === date);
  }

  reviewsOn(date: string) {
    return this.scheduledReviews.filter(
      (review) => this.formatDate(new Date(review.next_review_at)) === date,
    );
  }

  reviewTitles(date: string) {
    const reviews = this.reviewsOn(date);
    const titles = reviews
      .slice(0, 2)
      .map((review) => review.english_text)
      .join(' · ');
    return reviews.length > 2 ? `${titles} · +${reviews.length - 2} outros` : titles;
  }

  formatDateLabel(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.parseDate(date));
  }

  formatNoteDate(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  weekdayLong(date: string) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
      .format(this.parseDate(date))
      .replace('.', '');
  }

  activityTypeLabel(type: StudyActivityType) {
    return (
      this.activityTypes.find((item) => item.value === type)?.label ??
      (type === 'flashcard_review' ? 'Revisar flashcards' : 'Estudo')
    );
  }

  activityIcon(type: StudyActivityType) {
    const icons: Record<StudyActivityType, string> = {
      study_lesson: '▤',
      flashcard_review: '◷',
      watch_video: '▶',
      write_english: '✎',
      conversation_class: '◌',
    };
    return icons[type];
  }

  statusLabel(status: StudyActivityStatus) {
    return this.activityStatuses.find((item) => item.value === status)?.label ?? 'Planejada';
  }

  goToReview() {
    void this.router.navigate(['/review']);
  }

  private emptyForm(): ActivityForm {
    return {
      title: '',
      activity_type: 'study_lesson',
      starts_on: this.formatDate(new Date()),
      start_time: '',
      duration_minutes: null,
      actual_duration_minutes: null,
      lesson_reference: '',
      plan_name: '',
    };
  }

  private visibleRange() {
    if (this.view === 'month') {
      const monthStart = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth(),
        1,
      );
      const start = this.addDays(monthStart, -monthStart.getDay());
      const monthEnd = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth() + 1,
        0,
      );
      const lastVisible = this.addDays(monthEnd, 6 - monthEnd.getDay());
      return { start, endExclusive: this.addDays(lastVisible, 1) };
    }

    if (this.view === 'week') {
      const start = this.addDays(this.displayedDate, -this.displayedDate.getDay());
      return { start, endExclusive: this.addDays(start, 7) };
    }

    return { start: this.displayedDate, endExclusive: this.addDays(this.displayedDate, 1) };
  }

  private updateCalendarDays() {
    this.periodLabel =
      this.view === 'day'
        ? this.formatDateLabel(this.selectedDate)
        : this.view === 'week'
          ? this.formatWeekLabel()
          : new Intl.DateTimeFormat('pt-BR', {
              month: 'long',
              year: 'numeric',
            }).format(this.displayedDate);

    const today = this.formatDate(new Date());
    if (this.view === 'month') {
      const first = new Date(this.displayedDate.getFullYear(), this.displayedDate.getMonth(), 1);
      const daysInMonth = new Date(
        this.displayedDate.getFullYear(),
        this.displayedDate.getMonth() + 1,
        0,
      ).getDate();
      this.monthDays = Array.from({ length: first.getDay() + daysInMonth }, (_, index) => {
        if (index < first.getDay()) return null;
        const dayNumber = index - first.getDay() + 1;
        const date = this.formatDate(
          new Date(this.displayedDate.getFullYear(), this.displayedDate.getMonth(), dayNumber),
        );
        return {
          date,
          dayNumber,
          isToday: date === today,
          isSelected: date === this.selectedDate,
        };
      });
    } else {
      this.monthDays = [];
    }

    const weekStart = this.addDays(this.displayedDate, -this.displayedDate.getDay());
    this.weekDays = Array.from({ length: 7 }, (_, index) => {
      const day = this.addDays(weekStart, index);
      const date = this.formatDate(day);
      return {
        date,
        dayNumber: day.getDate(),
        isToday: date === today,
        isSelected: date === this.selectedDate,
      };
    });
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private parseDate(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatWeekLabel() {
    const start = this.addDays(this.displayedDate, -this.displayedDate.getDay());
    const end = this.addDays(start, 6);
    const formatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
    const startLabel = formatter.format(start);
    const endLabel = formatter.format(end);

    return start.getFullYear() === end.getFullYear()
      ? `${startLabel} – ${endLabel} de ${end.getFullYear()}`
      : `${startLabel} de ${start.getFullYear()} – ${endLabel} de ${end.getFullYear()}`;
  }
}
