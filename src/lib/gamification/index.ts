export { gp } from "./db";
export {
  XP_VALUES,
  XP_SOURCES,
  xpForSource,
  xpToNextLevel,
  xpRequiredForLevel,
  levelInfoFromXp,
  stableRefId,
  grantXp,
  grantXpAmount,
  getUserProgress,
  type GrantResult,
  type LevelInfo,
  type UserProgress,
} from "./xp";
export {
  ACHIEVEMENT_CATALOG,
  getAchievementBySlug,
  visibleAchievements,
  toAchievementModel,
  type AchievementDefinition,
  type AchievementCatalogEntry,
  type ProgressKind,
} from "./achievements";
export {
  computeProgress,
  seedAchievements,
  getUserAchievements,
  checkAndUnlockAchievements,
  type ProgressResult,
  type UserAchievementView,
  type UnlockResult,
} from "./progress";
export {
  listGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  recomputeGoalProgress,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  type UserGoalView,
  type GoalCategory,
  type GoalStatus,
} from "./goals";
export {
  getRanking,
  getUserRankSummary,
  getEvolutionHistory,
  type RankingEntry,
  type UserRankSummary,
  type EvolutionPoint,
} from "./ranking";
