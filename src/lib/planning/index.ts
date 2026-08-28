/**
 * BARREL — MOTOR DE PLANEJAMENTO, CALENDÁRIO E PIPELINE DE CONTEÚDO (Fase 6)
 */

// Acesso a dados
export { pl } from "./db";

// Conteúdo planejado (pipeline + CRUD owner-checked)
export {
  CONTENT_STATUSES,
  listPlannedContent,
  getPlannedContent,
  createPlannedContent,
  updatePlannedContent,
  deletePlannedContent,
  duplicatePlannedContent,
  type PlannedContentView,
  type ContentStatus,
} from "./content";

// Calendário (mês/semana/lista) + pipeline counts + associação experimento
export {
  buildCalendarView,
  computePipelineCounts,
  attachExperimentToContent,
  detachExperimentFromContent,
  type CalendarView,
  type CalendarDay,
  type PipelineCounts,
} from "./calendar";

// Versões de copy (versionamento simples, nunca sobrescreve)
export {
  listCopyVersions,
  addCopyVersion,
  restoreCopyVersion,
  type ContentCopyVersionView,
} from "./copy-versions";

// Plano semanal assistido (real context; DADO INSUFICIENTE quando faltar)
export {
  buildWeeklyPlan,
  generateWeeklyPlanWithAI,
  type WeeklyPlanSuggestion,
} from "./weekly-plan";

// Ponte Preview Social → Calendário (Fase 6.5)
export {
  scheduleFromDraft,
  detachDraftFromContent,
  type ScheduleFromDraftInput,
  type ScheduleFromDraftResult,
} from "./schedule-from-draft";
