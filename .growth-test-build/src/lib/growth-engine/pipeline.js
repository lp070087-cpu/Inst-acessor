"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGrowthPipeline = runGrowthPipeline;
const engine_1 = require("./engine");
const actions_1 = require("./actions");
const progress_1 = require("./progress");
const insights_1 = require("./insights");
const automations_1 = require("./automations");
async function runGrowthPipeline(userId) {
    // Expira ações vencidas antes de recomputar (Parte 7).
    await (0, actions_1.expireOverdueActions)(userId);
    // Pipeline puro: dados reais → sinais → prioridades → recomendações.
    const engine = await (0, engine_1.runGrowthEngine)(userId);
    // Sincroniza recomendações atuais como ações (sem duplicar).
    const createdActions = await (0, actions_1.syncRecommendationsToActions)(engine.context, engine.recommendations);
    const actions = await (0, actions_1.listActions)(userId);
    const mission = (0, progress_1.pickDailyMission)(engine.context, engine.priorities, engine.recommendations, actions);
    const plan7 = (0, progress_1.buildPlan7Days)(engine.context, engine.priorities, engine.recommendations);
    const plan30 = (0, progress_1.buildPlan30Days)(engine.context);
    const insights = (0, insights_1.buildProactiveInsights)(engine.signals);
    const automations = (0, automations_1.buildInternalAutomations)(engine.signals, engine.recommendations);
    const changes = (0, insights_1.summarizeChanges)(engine.context, engine.signals);
    return {
        context: engine.context,
        signals: engine.signals,
        priorities: engine.priorities,
        recommendations: engine.recommendations,
        actions,
        createdActions: createdActions.map((a) => a.id),
        mission,
        plan7,
        plan30,
        insights,
        automations,
        changes,
        confidence: engine.confidence,
        insufficientData: engine.insufficientData,
    };
}
