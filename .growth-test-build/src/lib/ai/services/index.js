"use strict";
/**
 * Barrel da camada de serviços da Fase 4.
 * Exports explícitos para evitar colisões de nomes entre módulos
 * (ex.: AIConfiguredError existe em chat e copy; Platform em score e diagnosis).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAnalysis = exports.getAIProfile = exports.updateRecommendationStatus = exports.listRecommendations = exports.generateRecommendations = exports.diagnosticStateLabel = exports.runDiagnosis = exports.getLatestScore = exports.getScoreHistory = exports.persistScore = exports.computeScore = exports.deleteDraft = exports.updateDraft = exports.saveDraft = exports.listDrafts = exports.deleteIdea = exports.updateIdeaStatus = exports.saveIdea = exports.listIdeas = exports.generateIdeas = exports.AIConfiguredErrorIdeas = exports.deleteCopy = exports.toggleCopyFavorite = exports.saveCopy = exports.listCopies = exports.generateCopy = exports.AIConfiguredErrorCopy = exports.deleteConversation = exports.getConversation = exports.listConversations = exports.sendChatMessage = exports.AIConfiguredErrorChat = void 0;
// Chat
var chat_1 = require("./chat");
Object.defineProperty(exports, "AIConfiguredErrorChat", { enumerable: true, get: function () { return chat_1.AIConfiguredError; } });
Object.defineProperty(exports, "sendChatMessage", { enumerable: true, get: function () { return chat_1.sendChatMessage; } });
Object.defineProperty(exports, "listConversations", { enumerable: true, get: function () { return chat_1.listConversations; } });
Object.defineProperty(exports, "getConversation", { enumerable: true, get: function () { return chat_1.getConversation; } });
Object.defineProperty(exports, "deleteConversation", { enumerable: true, get: function () { return chat_1.deleteConversation; } });
// Copy
var copy_1 = require("./copy");
Object.defineProperty(exports, "AIConfiguredErrorCopy", { enumerable: true, get: function () { return copy_1.AIConfiguredError; } });
Object.defineProperty(exports, "generateCopy", { enumerable: true, get: function () { return copy_1.generateCopy; } });
Object.defineProperty(exports, "listCopies", { enumerable: true, get: function () { return copy_1.listCopies; } });
Object.defineProperty(exports, "saveCopy", { enumerable: true, get: function () { return copy_1.saveCopy; } });
Object.defineProperty(exports, "toggleCopyFavorite", { enumerable: true, get: function () { return copy_1.toggleCopyFavorite; } });
Object.defineProperty(exports, "deleteCopy", { enumerable: true, get: function () { return copy_1.deleteCopy; } });
// Ideias
var ideas_1 = require("./ideas");
Object.defineProperty(exports, "AIConfiguredErrorIdeas", { enumerable: true, get: function () { return ideas_1.AIConfiguredError; } });
Object.defineProperty(exports, "generateIdeas", { enumerable: true, get: function () { return ideas_1.generateIdeas; } });
Object.defineProperty(exports, "listIdeas", { enumerable: true, get: function () { return ideas_1.listIdeas; } });
Object.defineProperty(exports, "saveIdea", { enumerable: true, get: function () { return ideas_1.saveIdea; } });
Object.defineProperty(exports, "updateIdeaStatus", { enumerable: true, get: function () { return ideas_1.updateIdeaStatus; } });
Object.defineProperty(exports, "deleteIdea", { enumerable: true, get: function () { return ideas_1.deleteIdea; } });
// Drafts (Preview Social)
var drafts_1 = require("./drafts");
Object.defineProperty(exports, "listDrafts", { enumerable: true, get: function () { return drafts_1.listDrafts; } });
Object.defineProperty(exports, "saveDraft", { enumerable: true, get: function () { return drafts_1.saveDraft; } });
Object.defineProperty(exports, "updateDraft", { enumerable: true, get: function () { return drafts_1.updateDraft; } });
Object.defineProperty(exports, "deleteDraft", { enumerable: true, get: function () { return drafts_1.deleteDraft; } });
// Score
var score_1 = require("./score");
Object.defineProperty(exports, "computeScore", { enumerable: true, get: function () { return score_1.computeScore; } });
Object.defineProperty(exports, "persistScore", { enumerable: true, get: function () { return score_1.persistScore; } });
Object.defineProperty(exports, "getScoreHistory", { enumerable: true, get: function () { return score_1.getScoreHistory; } });
Object.defineProperty(exports, "getLatestScore", { enumerable: true, get: function () { return score_1.getLatestScore; } });
// Diagnosis
var diagnosis_1 = require("./diagnosis");
Object.defineProperty(exports, "runDiagnosis", { enumerable: true, get: function () { return diagnosis_1.runDiagnosis; } });
Object.defineProperty(exports, "diagnosticStateLabel", { enumerable: true, get: function () { return diagnosis_1.diagnosticStateLabel; } });
// Mentorship
var mentorship_1 = require("./mentorship");
Object.defineProperty(exports, "generateRecommendations", { enumerable: true, get: function () { return mentorship_1.generateRecommendations; } });
Object.defineProperty(exports, "listRecommendations", { enumerable: true, get: function () { return mentorship_1.listRecommendations; } });
Object.defineProperty(exports, "updateRecommendationStatus", { enumerable: true, get: function () { return mentorship_1.updateRecommendationStatus; } });
// Profile (Perfil de Inteligência)
var profile_1 = require("./profile");
Object.defineProperty(exports, "getAIProfile", { enumerable: true, get: function () { return profile_1.getAIProfile; } });
// Analysis (Desempenho)
var analysis_1 = require("./analysis");
Object.defineProperty(exports, "runAnalysis", { enumerable: true, get: function () { return analysis_1.runAnalysis; } });
