/**
 * SHIM DE TIPOS — Fase 4 (IA e Inteligência)
 * ============================================
 *
 * O sandbox de desenvolvimento não tem rede para baixar o engine Prisma
 * (`prisma generate` falha com 403). O client gerado em `node_modules`
 * ainda NÃO conhece os models da Fase 4.
 *
 * Este arquivo estende o namespace global do @prisma/client para que o
 * TypeScript reconheça os models Fase 4 durante o type-check local.
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
}
