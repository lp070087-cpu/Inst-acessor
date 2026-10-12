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
  type WeeklyPlanSuggestionItem,
  type WeeklyPlanDay,
} from "./weekly-plan";

// Calendário Inteligente — motor puro (recomendações + desempenho por período)
export {
  buildSmartCalendar,
  aggregateDayPeriods,
  aggregateWeekdays,
  periodForHour,
  DAY_PERIOD_WINDOWS,
  INSUFFICIENT_DATA_MESSAGE,
  MIN_MEDIA_FOR_PERIOD_PATTERN,
  MIN_PERIODS_FOR_BEST_TIME,
  MIN_MEDIA_PER_RECOMMENDED_DAY,
  type SmartCalendarResult,
  type SmartRecommendation,
  type SmartRecommendationKind,
  type DayPeriodPerformance,
  type DayPeriodAggregate,
  type DayPeriodKey,
  type WeekdayPattern,
} from "./smart-calendar";

// Ponte Preview Social → Calendário (Fase 6.5)
export {
  scheduleFromDraft,
  detachDraftFromContent,
  type ScheduleFromDraftInput,
  type ScheduleFromDraftResult,
} from "./schedule-from-draft";

// Aplicação real do plano semanal (aceitar sugestão de um dia, com dedup)
export {
  applyWeeklyPlanDay,
  weeklyDayMarker,
  type ApplyWeeklyDayInput,
  type ApplyWeeklyDayResult,
} from "./apply-weekly-day";
