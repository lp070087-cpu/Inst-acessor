/**
 * Barrel da camada de serviços da Fase 4.
 * Exports explícitos para evitar colisões de nomes entre módulos
 * (ex.: AIConfiguredError existe em chat e copy; Platform em score e diagnosis).
 */

// Chat
export {
  AIConfiguredError as AIConfiguredErrorChat,
  sendChatMessage,
  listConversations,
  getConversation,
  deleteConversation,
  type ChatResult,
} from "./chat";

// Copy
export {
  AIConfiguredError as AIConfiguredErrorCopy,
  generateCopy,
  listCopies,
  saveCopy,
  toggleCopyFavorite,
  deleteCopy,
  type GenerateCopyParams,
} from "./copy";

// Ideias
export {
  AIConfiguredError as AIConfiguredErrorIdeas,
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
