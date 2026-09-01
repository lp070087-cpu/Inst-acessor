/**
 * SHIM DE TIPOS — Fase 4 (IA e Inteligência)
 * ============================================
 *
 * O sandbox de desenvolvimento não tem rede para baixar o engine Prisma
 * (`prisma generate` falha com 403). O client gerado em `node_modules`
 * ainda NÃO conhece os models da Fase 4+.
 *
 * Este arquivo estende o namespace global do @prisma/client para que o
 * TypeScript reconheça os models Fase 4+ durante o type-check local.
 *
 * ⚠️ NÃO é o schema real — é um ESPELHO para tipagem apenas.
 * A DONA DEVE rodar localmente:
 *   npx prisma validate
 *   npx prisma generate
 *   npx prisma db push   (somente após revisão)
 *
 * Os tipos abaixo espelham fielmente `prisma/schema.prisma`.
 */
import "@prisma/client";

declare module "@prisma/client" {
  interface User {
    asaasCustomerId?: string | null;
    firstAccessCompleted?: boolean;
    firstAccessCompletedAt?: Date | null;
    tourCompleted?: boolean;
    tourCompletedAt?: Date | null;
  }

  interface AIConversation {
    id: string;
    userId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface AIMessage {
    id: string;
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    createdAt: Date;
  }

  interface AIProfile {
    id: string;
    userId: string;
    summary?: string | null;
    niche?: string | null;
    subNiche?: string | null;
    objectives?: string | null;
    communicationStyle?: string | null;
    observedPatterns?: string | null;
    preferredFormats?: string | null;
    ctaPatterns?: string | null;
    hookPatterns?: string | null;
    postingFrequency?: string | null;
    voiceTone?: string | null;
    writingStyle?: string | null;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface GeneratedCopy {
    id: string;
    userId: string;
    platform: string;
    format: string;
    objective?: string | null;
    tone?: string | null;
    audience?: string | null;
    context?: string | null;
    content: string;
    hookType?: string | null;
    structure?: string | null;
    isFavorite: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ContentIdea {
    id: string;
    userId: string;
    category: string;
    title: string;
    format?: string | null;
    objective?: string | null;
    context?: string | null;
    rationale?: string | null;
    status: string;
    platform?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface SocialDraft {
    id: string;
    userId: string;
    platform: string;
    mediaType: string;
    mediaUrl?: string | null;
    caption?: string | null;
    hashtags?: string | null;
    format?: string | null;
    items?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }

  interface MentorshipRecommendation {
    id: string;
    userId: string;
    category: string;
    priority: string;
    problem: string;
    explanation?: string | null;
    action?: string | null;
    evidence?: string | null;
    ruleSlug?: string | null;
    test?: string | null;
    result?: string | null;
    status: string;
    source?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ProfileScore {
    id: string;
    userId: string;
    platform: string;
    overall: number;
    growth?: number | null;
    engagement?: number | null;
    reach?: number | null;
    consistency?: number | null;
    frequency?: number | null;
    content?: number | null;
    factors?: unknown;
    version: string;
    coverage?: number | null;
    weighting?: unknown;
    createdAt: Date;
  }

  interface ProfileScoreSnapshot {
    id: string;
    userId: string;
    platform: string;
    scoreId: string;
    overall: number;
    createdAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 4.5 — CÉREBRO ESTRATÉGICO
  // ------------------------------------------------------------
  interface KnowledgeVersion {
    id: string;
    version: number;
    label?: string | null;
    active: boolean;
    createdAt: Date;
  }

  interface KnowledgeModule {
    id: string;
    number: number;
    slug: string;
    title: string;
    description?: string | null;
    version: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface KnowledgeRule {
    id: string;
    slug: string;
    moduleId?: string | null;
    module: number;
    title: string;
    category: string;
    content: string;
    type: string;
    priority: string;
    tags: string[];
    version: number;
    versionId?: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface GrowthExperiment {
    id: string;
    userId: string;
    platform: string;
    hypothesis: string;
    variable: string;
    baseline?: string | null;
    status: string;
    startedAt?: Date | null;
    endedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ExperimentVariant {
    id: string;
    experimentId: string;
    contentId?: string | null;
    variation?: string | null;
    hookType?: string | null;
    format?: string | null;
    theme?: string | null;
    structure?: string | null;
    createdAt: Date;
  }

  interface ExperimentObservation {
    id: string;
    experimentId: string;
    metric: string;
    before?: number | null;
    after?: number | null;
    delta?: number | null;
    conclusion?: string | null;
    confidence?: string | null;
    createdAt: Date;
  }

  interface ProfileInsight {
    id: string;
    userId: string;
    platform: string;
    type: string;
    summary: string;
    detail?: string | null;
    ruleSlug?: string | null;
    experimentId?: string | null;
    confidence?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 5 — RANK, XP, METAS, CONQUISTAS E PROGRESSÃO
  // ------------------------------------------------------------
  interface UserLevel {
    id: string;
    userId: string;
    xp: number;
    level: number;
    totalXpEarned: number;
    lastLevelUpAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface XpLog {
    id: string;
    userId: string;
    source: string;
    refId: string;
    amount: number;
    createdAt: Date;
  }

  interface UserGoal {
    id: string;
    userId: string;
    category: string;
    title: string;
    description?: string | null;
    targetValue?: number | null;
    currentValue?: number | null;
    unit?: string | null;
    platform?: string | null;
    status: string;
    deadline?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface Achievement {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    xpReward: number;
    threshold: number;
    unit?: string | null;
    tier: string;
    hidden: boolean;
    version: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface UserAchievement {
    id: string;
    userId: string;
    achievementId: string;
    progress: number;
    unlocked: boolean;
    unlockedAt?: Date | null;
    xpGranted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 6 — PLANEJAMENTO, CALENDÁRIO E PIPELINE DE CONTEÚDO
  // ------------------------------------------------------------
  interface PlannedContent {
    id: string;
    userId: string;
    platform: string;
    format: string;
    title: string;
    theme?: string | null;
    objective?: string | null;
    status: string;
    scheduledAt?: Date | null;
    publishedAt?: Date | null;
    externalId?: string | null;
    notes?: string | null;
    hypothesis?: string | null;
    ideaId?: string | null;
    copyId?: string | null;
    draftId?: string | null;
    goalId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface PlannedContentExperiment {
    id: string;
    contentId: string;
    experimentId: string;
    createdAt: Date;
  }

  interface ContentCopyVersion {
    id: string;
    userId: string;
    contentId: string;
    version: number;
    content: string;
    note?: string | null;
    createdAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 6.5 — PLANOS OFICIAIS E ASSINATURA
  // ------------------------------------------------------------
  interface Plan {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    currency: string;
    type: string;
    billingInterval?: string | null;
    durationDays?: number | null;
    description?: string | null;
    features: string[];
    badge?: string | null;
    active: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }

  interface Subscription {
    id: string;
    userId: string;
    planId: string;
    status: string;
    billingType: string;
    billingInterval?: string | null;
    startAt?: Date | null;
    expiresAt?: Date | null;
    autoRenew: boolean;
    nextBillingAt?: Date | null;
    canceledAt?: Date | null;
    provider?: string | null;
    externalCustomerId?: string | null;
    externalSubscriptionId?: string | null;
    externalPaymentId?: string | null;
    amountCents?: number | null;
    currency: string;
    paidAt?: Date | null;
    idempotencyKey?: string | null;
    accessSource?: string | null;
    grantedByAdminId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface Payment {
    id: string;
    userId: string;
    planId?: string | null;
    subscriptionId?: string | null;
    amountCents: number;
    currency: string;
    status: string;
    provider?: string | null;
    externalPaymentId?: string | null;
    paidAt?: Date | null;
    eventType?: string | null;
    eventId?: string | null;
    createdAt: Date;
  }

  interface BillingEvent {
    id: string;
    eventId: string;
    provider: string;
    type: string;
    userId?: string | null;
    subscriptionId?: string | null;
    payload?: unknown;
    processed: boolean;
    processedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 7 — PUBLICAÇÃO REAL, FILA E CENTRAL DE PUBLICAÇÃO
  // ------------------------------------------------------------
  interface PublishQueue {
    id: string;
    userId: string;
    contentId: string;
    platform: string;
    format: string;
    status: string; // AGENDADO | PROCESSANDO | PUBLICADO | FALHOU | CANCELADO
    scheduledAt?: Date | null;
    attempts: number;
    lastAttemptAt?: Date | null;
    nextAttemptAt?: Date | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    externalId?: string | null;
    provider?: string | null;
    idempotencyKey?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface PublishLog {
    id: string;
    userId: string;
    queueId?: string | null;
    contentId?: string | null;
    platform: string;
    operation: string;
    status: string;
    attempts: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    externalId?: string | null;
    provider?: string | null;
    createdAt: Date;
  }

  interface AutomationRule {
    id: string;
    userId: string;
    name: string;
    trigger: string;
    platform: string;
    keywords: string[];
    action: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface AutomationEvent {
    id: string;
    userId: string;
    eventId: string;
    platform: string;
    type: string;
    payload?: unknown;
    processed: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface AutomationExecution {
    id: string;
    userId: string;
    ruleId?: string | null;
    eventId?: string | null;
    status: string;
    detail?: string | null;
    createdAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 8 — AUTOMAÇÕES INTELIGENTES + MOTOR OPERACIONAL DE CRESCIMENTO
  // ------------------------------------------------------------
  interface GrowthAction {
    id: string;
    userId: string;
    platform: string; // "instagram" | "tiktok"
    title: string;
    description?: string | null;
    reason?: string | null;
    priority: string; // PRIORIDADE 1 | 2 | 3
    status: string; // PENDING | IN_PROGRESS | COMPLETED | DISMISSED | EXPIRED
    dueAt?: Date | null;
    completedAt?: Date | null;
    dismissedAt?: Date | null;
    sourceSignal?: string | null;
    sourceRecommendation?: string | null;
    metricToWatch?: string | null;
    baselineValue?: number | null;
    resultValue?: number | null;
    resultNote?: string | null;
    xpGranted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  // ------------------------------------------------------------
  // FASE 10 — CONFIGURAÇÕES ADMINISTRATIVAS (SystemSetting)
  // ------------------------------------------------------------
  interface SystemSetting {
    id: string;
    key: string;
    value: string;
    createdAt: Date;
    updatedAt: Date;
  }

  // ------------------------------------------------------------
  // FASE "PRIMEIRO ACESSO" — ATIVAÇÃO PÓS-COMPRA
  // ------------------------------------------------------------
  interface AccessGrant {
    id: string;
    email: string;
    userId?: string | null;
    planId?: string | null;
    planName?: string | null;
    origin: string; // "INFINITEPAY" | "ASAAS" | "ADMIN_MANUAL"
    status: string; // PENDING_FIRST_ACCESS | ACTIVE | EXPIRED | CANCELED
    startAt: Date;
    expiresAt?: Date | null;
    grantedByAdminId?: string | null;
    externalPaymentId?: string | null;
    externalSubscriptionId?: string | null;
    firstAccessCompleted: boolean;
    firstAccessCompletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface FirstAccessToken {
    id: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt?: Date | null;
    consumed: boolean;
    createdAt: Date;
    userId?: string | null;
  }

  interface PasskeyCredential {
    id: string;
    userId: string;
    credentialId: string;
    publicKey: string;
    transports?: string | null;
    deviceName?: string | null;
    createdAt: Date;
    lastUsedAt?: Date | null;
  }
}
