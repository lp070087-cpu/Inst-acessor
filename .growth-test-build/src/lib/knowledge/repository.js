"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.kb = void 0;
const db_1 = require("@/lib/db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
const p = db_1.prisma;
exports.kb = {
    version: p.knowledgeVersion,
    module: p.knowledgeModule,
    rule: p.knowledgeRule,
    experiment: p.growthExperiment,
    variant: p.experimentVariant,
    observation: p.experimentObservation,
    insight: p.profileInsight,
};
