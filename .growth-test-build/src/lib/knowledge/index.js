"use strict";
/**
 * CÉREBRO ESTRATÉGICO — Barrel da base de conhecimento.
 * Exporta tipos, registro oficial (30 módulos) e utilitários de consulta.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeModuleTitles = exports.getRuleBySlug = exports.getRulesByTags = exports.getRulesByCategory = exports.getKnowledgeModule = exports.KNOWLEDGE_RULES = exports.KNOWLEDGE_MODULES = void 0;
__exportStar(require("./types"), exports);
// Registro oficial (fonte única de conhecimento)
var registry_1 = require("./rules/registry");
Object.defineProperty(exports, "KNOWLEDGE_MODULES", { enumerable: true, get: function () { return registry_1.KNOWLEDGE_MODULES; } });
Object.defineProperty(exports, "KNOWLEDGE_RULES", { enumerable: true, get: function () { return registry_1.KNOWLEDGE_RULES; } });
Object.defineProperty(exports, "getKnowledgeModule", { enumerable: true, get: function () { return registry_1.getKnowledgeModule; } });
Object.defineProperty(exports, "getRulesByCategory", { enumerable: true, get: function () { return registry_1.getRulesByCategory; } });
Object.defineProperty(exports, "getRulesByTags", { enumerable: true, get: function () { return registry_1.getRulesByTags; } });
Object.defineProperty(exports, "getRuleBySlug", { enumerable: true, get: function () { return registry_1.getRuleBySlug; } });
Object.defineProperty(exports, "knowledgeModuleTitles", { enumerable: true, get: function () { return registry_1.knowledgeModuleTitles; } });
// Baselines / utilitários que não dependem de banco
__exportStar(require("./baseline"), exports);
