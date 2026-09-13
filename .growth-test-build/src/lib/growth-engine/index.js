"use strict";
/**
 * BARREL — MOTOR OPERACIONAL DE CRESCIMENTO (Fase 8)
 * ====================================================
 * Camada `src/lib/growth-engine`:
 *   engine.ts        — orquestração do pipeline completo
 *   context.ts       — GrowthContext agregado (dados reais)
 *   signals.ts       — sinais determinísticos
 *   priorities.ts    — prioridades (máx. 3)
 *   recommendations.ts — recomendações acionáveis
 *   actions.ts       — GrowthAction (plano de ação) + XP
 *   progress.ts      — missão do dia + planos 7/30 dias
 *   insights.ts      — insights proativos automáticos
 *   db.ts            — delegate Prisma (GrowthAction)
 *   errors.ts        — erros controlados
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toGrowthHttpError = exports.GrowthEngineError = exports.GROWTH_ACTION_STATUSES = exports.SIGNAL_SEVERITY_ORDER = exports.DATA_STATUS_LABELS = exports.ge = exports.automationSafetyNotes = exports.buildInternalAutomations = exports.growthContextToPrompt = exports.summarizeChanges = exports.buildProactiveInsights = exports.buildPlan30Days = exports.buildPlan7Days = exports.pickDailyMission = exports.syncRecommendationsToActions = exports.expireOverdueActions = exports.completeActionWithXp = exports.deleteAction = exports.updateActionStatus = exports.createAction = exports.getAction = exports.listActions = exports.buildRecommendations = exports.SIGNAL_LABELS = exports.prioritizeSignals = exports.detectSignals = exports.buildGrowthContext = exports.runGrowthPipeline = exports.runGrowthEngine = void 0;
// Orquestração
var engine_1 = require("./engine");
Object.defineProperty(exports, "runGrowthEngine", { enumerable: true, get: function () { return engine_1.runGrowthEngine; } });
var pipeline_1 = require("./pipeline");
Object.defineProperty(exports, "runGrowthPipeline", { enumerable: true, get: function () { return pipeline_1.runGrowthPipeline; } });
var context_1 = require("./context");
Object.defineProperty(exports, "buildGrowthContext", { enumerable: true, get: function () { return context_1.buildGrowthContext; } });
var signals_1 = require("./signals");
Object.defineProperty(exports, "detectSignals", { enumerable: true, get: function () { return signals_1.detectSignals; } });
var priorities_1 = require("./priorities");
Object.defineProperty(exports, "prioritizeSignals", { enumerable: true, get: function () { return priorities_1.prioritizeSignals; } });
Object.defineProperty(exports, "SIGNAL_LABELS", { enumerable: true, get: function () { return priorities_1.SIGNAL_LABELS; } });
var recommendations_1 = require("./recommendations");
Object.defineProperty(exports, "buildRecommendations", { enumerable: true, get: function () { return recommendations_1.buildRecommendations; } });
// Ações (GrowthAction + XP)
var actions_1 = require("./actions");
Object.defineProperty(exports, "listActions", { enumerable: true, get: function () { return actions_1.listActions; } });
Object.defineProperty(exports, "getAction", { enumerable: true, get: function () { return actions_1.getAction; } });
Object.defineProperty(exports, "createAction", { enumerable: true, get: function () { return actions_1.createAction; } });
Object.defineProperty(exports, "updateActionStatus", { enumerable: true, get: function () { return actions_1.updateActionStatus; } });
Object.defineProperty(exports, "deleteAction", { enumerable: true, get: function () { return actions_1.deleteAction; } });
Object.defineProperty(exports, "completeActionWithXp", { enumerable: true, get: function () { return actions_1.completeActionWithXp; } });
Object.defineProperty(exports, "expireOverdueActions", { enumerable: true, get: function () { return actions_1.expireOverdueActions; } });
Object.defineProperty(exports, "syncRecommendationsToActions", { enumerable: true, get: function () { return actions_1.syncRecommendationsToActions; } });
// Progresso (Missão do Dia + Planos 7/30 dias)
var progress_1 = require("./progress");
Object.defineProperty(exports, "pickDailyMission", { enumerable: true, get: function () { return progress_1.pickDailyMission; } });
Object.defineProperty(exports, "buildPlan7Days", { enumerable: true, get: function () { return progress_1.buildPlan7Days; } });
Object.defineProperty(exports, "buildPlan30Days", { enumerable: true, get: function () { return progress_1.buildPlan30Days; } });
// Insights proativos
var insights_1 = require("./insights");
Object.defineProperty(exports, "buildProactiveInsights", { enumerable: true, get: function () { return insights_1.buildProactiveInsights; } });
Object.defineProperty(exports, "summarizeChanges", { enumerable: true, get: function () { return insights_1.summarizeChanges; } });
// Prompt/contexto para IA (Parte 14)
var prompt_1 = require("./prompt");
Object.defineProperty(exports, "growthContextToPrompt", { enumerable: true, get: function () { return prompt_1.growthContextToPrompt; } });
// Automações internas (Parte 21)
var automations_1 = require("./automations");
Object.defineProperty(exports, "buildInternalAutomations", { enumerable: true, get: function () { return automations_1.buildInternalAutomations; } });
Object.defineProperty(exports, "automationSafetyNotes", { enumerable: true, get: function () { return automations_1.automationSafetyNotes; } });
// Acesso a dados
var db_1 = require("./db");
Object.defineProperty(exports, "ge", { enumerable: true, get: function () { return db_1.ge; } });
// Tipos
var types_1 = require("./types");
Object.defineProperty(exports, "DATA_STATUS_LABELS", { enumerable: true, get: function () { return types_1.DATA_STATUS_LABELS; } });
Object.defineProperty(exports, "SIGNAL_SEVERITY_ORDER", { enumerable: true, get: function () { return types_1.SIGNAL_SEVERITY_ORDER; } });
Object.defineProperty(exports, "GROWTH_ACTION_STATUSES", { enumerable: true, get: function () { return types_1.GROWTH_ACTION_STATUSES; } });
Object.defineProperty(exports, "GrowthEngineError", { enumerable: true, get: function () { return types_1.GrowthEngineError; } });
// Erros
var errors_1 = require("./errors");
Object.defineProperty(exports, "toGrowthHttpError", { enumerable: true, get: function () { return errors_1.toGrowthHttpError; } });
