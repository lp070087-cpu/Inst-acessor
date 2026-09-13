"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecommendations = exports.prioritizeSignals = exports.detectSignals = exports.buildGrowthContext = void 0;
exports.runGrowthEngine = runGrowthEngine;
const context_1 = require("./context");
const signals_1 = require("./signals");
const priorities_1 = require("./priorities");
const recommendations_1 = require("./recommendations");
/**
 * Executa o pipeline completo do Growth Engine para um usuário.
 * Todos os dados vêm de fontes reais; ausência → DADO INSUFICIENTE.
 */
async function runGrowthEngine(userId) {
    const context = await (0, context_1.buildGrowthContext)(userId);
    const signals = await (0, signals_1.detectSignals)(context);
    const priorities = (0, priorities_1.prioritizeSignals)(context, signals);
    const recommendations = (0, recommendations_1.buildRecommendations)(context, priorities);
    const hasRealData = context.instagram.snapshotCount >= 2 || context.tiktok.snapshotCount >= 2;
    const insufficientData = !hasRealData || recommendations.length === 0;
    return {
        context,
        signals,
        priorities,
        recommendations,
        confidence: context.confidence,
        insufficientData,
    };
}
// Re-exports para o barrel
var context_2 = require("./context");
Object.defineProperty(exports, "buildGrowthContext", { enumerable: true, get: function () { return context_2.buildGrowthContext; } });
var signals_2 = require("./signals");
Object.defineProperty(exports, "detectSignals", { enumerable: true, get: function () { return signals_2.detectSignals; } });
var priorities_2 = require("./priorities");
Object.defineProperty(exports, "prioritizeSignals", { enumerable: true, get: function () { return priorities_2.prioritizeSignals; } });
var recommendations_2 = require("./recommendations");
Object.defineProperty(exports, "buildRecommendations", { enumerable: true, get: function () { return recommendations_2.buildRecommendations; } });
