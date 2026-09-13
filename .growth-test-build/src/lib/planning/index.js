"use strict";
/**
 * BARREL — MOTOR DE PLANEJAMENTO, CALENDÁRIO E PIPELINE DE CONTEÚDO (Fase 6)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detachDraftFromContent = exports.scheduleFromDraft = exports.generateWeeklyPlanWithAI = exports.buildWeeklyPlan = exports.restoreCopyVersion = exports.addCopyVersion = exports.listCopyVersions = exports.detachExperimentFromContent = exports.attachExperimentToContent = exports.computePipelineCounts = exports.buildCalendarView = exports.duplicatePlannedContent = exports.deletePlannedContent = exports.updatePlannedContent = exports.createPlannedContent = exports.getPlannedContent = exports.listPlannedContent = exports.CONTENT_STATUSES = exports.pl = void 0;
// Acesso a dados
var db_1 = require("./db");
Object.defineProperty(exports, "pl", { enumerable: true, get: function () { return db_1.pl; } });
// Conteúdo planejado (pipeline + CRUD owner-checked)
var content_1 = require("./content");
Object.defineProperty(exports, "CONTENT_STATUSES", { enumerable: true, get: function () { return content_1.CONTENT_STATUSES; } });
Object.defineProperty(exports, "listPlannedContent", { enumerable: true, get: function () { return content_1.listPlannedContent; } });
Object.defineProperty(exports, "getPlannedContent", { enumerable: true, get: function () { return content_1.getPlannedContent; } });
Object.defineProperty(exports, "createPlannedContent", { enumerable: true, get: function () { return content_1.createPlannedContent; } });
Object.defineProperty(exports, "updatePlannedContent", { enumerable: true, get: function () { return content_1.updatePlannedContent; } });
Object.defineProperty(exports, "deletePlannedContent", { enumerable: true, get: function () { return content_1.deletePlannedContent; } });
Object.defineProperty(exports, "duplicatePlannedContent", { enumerable: true, get: function () { return content_1.duplicatePlannedContent; } });
// Calendário (mês/semana/lista) + pipeline counts + associação experimento
var calendar_1 = require("./calendar");
Object.defineProperty(exports, "buildCalendarView", { enumerable: true, get: function () { return calendar_1.buildCalendarView; } });
Object.defineProperty(exports, "computePipelineCounts", { enumerable: true, get: function () { return calendar_1.computePipelineCounts; } });
Object.defineProperty(exports, "attachExperimentToContent", { enumerable: true, get: function () { return calendar_1.attachExperimentToContent; } });
Object.defineProperty(exports, "detachExperimentFromContent", { enumerable: true, get: function () { return calendar_1.detachExperimentFromContent; } });
// Versões de copy (versionamento simples, nunca sobrescreve)
var copy_versions_1 = require("./copy-versions");
Object.defineProperty(exports, "listCopyVersions", { enumerable: true, get: function () { return copy_versions_1.listCopyVersions; } });
Object.defineProperty(exports, "addCopyVersion", { enumerable: true, get: function () { return copy_versions_1.addCopyVersion; } });
Object.defineProperty(exports, "restoreCopyVersion", { enumerable: true, get: function () { return copy_versions_1.restoreCopyVersion; } });
// Plano semanal assistido (real context; DADO INSUFICIENTE quando faltar)
var weekly_plan_1 = require("./weekly-plan");
Object.defineProperty(exports, "buildWeeklyPlan", { enumerable: true, get: function () { return weekly_plan_1.buildWeeklyPlan; } });
Object.defineProperty(exports, "generateWeeklyPlanWithAI", { enumerable: true, get: function () { return weekly_plan_1.generateWeeklyPlanWithAI; } });
// Ponte Preview Social → Calendário (Fase 6.5)
var schedule_from_draft_1 = require("./schedule-from-draft");
Object.defineProperty(exports, "scheduleFromDraft", { enumerable: true, get: function () { return schedule_from_draft_1.scheduleFromDraft; } });
Object.defineProperty(exports, "detachDraftFromContent", { enumerable: true, get: function () { return schedule_from_draft_1.detachDraftFromContent; } });
