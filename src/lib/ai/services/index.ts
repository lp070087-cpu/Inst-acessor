/**
 * Barrel da camada de serviços da Fase 4.
 * Exports explícitos para evitar colisões de nomes entre módulos
 * (ex.: Platform em score e diagnosis).
 *
 * O erro de "IA não configurada" é uma classe ÚNICA (`AIConfiguredError`)
 * exportada por `@/lib/ai`; mantemos os aliases AIConfiguredError* apenas
 * para compatibilidade com as rotas existentes.
 */

import { AIConfiguredError } from "@/lib/ai";

export { AIConfiguredError as AIConfiguredErrorChat };
export { AIConfiguredError as AIConfiguredErrorCopy };
export { AIConfiguredError as AIConfiguredErrorIdeas };

// Chat
export {
  sendChatMessage,
  listConversations,
  getConversation,
  deleteConversation,
  type ChatResult,
} from "./chat";

// Copy
export {
  generateCopy,
  listCopies,
  saveCopy,
  toggleCopyFavorite,
  deleteCopy,
  type GenerateCopyParams,
} from "./copy";

// Ideias
export {
  generateIdeas,
  listIdeas,
  saveIdea,
  updateIdeaStatus,
  deleteIdea,
  type GeneratedIdea,
} from "./ideas";

// Drafts (Preview Social)
export {
  listDrafts,
  saveDraft,
  updateDraft,
  deleteDraft,
  type DraftData,
} from "./drafts";

// Score
export {
  computeScore,
  persistScore,
  getScoreHistory,
  getLatestScore,
  type ScoreResult,
  type ScorePillar,
  type ScoreFactors,
} from "./score";

// Diagnosis
export {
  runDiagnosis,
  diagnosticStateLabel,
  type DiagnosticItem,
  type DiagnosticState,
} from "./diagnosis";

// Mentorship
export {
  generateRecommendations,
  listRecommendations,
  updateRecommendationStatus,
  type MentorshipCard,
} from "./mentorship";

// Profile (Perfil de Inteligência)
export { getAIProfile, type AIProfileData } from "./profile";

// Analysis (Desempenho)
export {
  runAnalysis,
  type AnalysisResult,
  type AnalysisMetric,
  type BestItem,
  type AnalysisPeriod,
} from "./analysis";

// Tipos compartilhados
export type { Platform } from "./diagnosis";
