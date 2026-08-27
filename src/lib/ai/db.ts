import { prisma } from "@/lib/db";
import type {
  AIConversation,
  AIMessage,
  AIProfile,
  GeneratedCopy,
  ContentIdea,
  SocialDraft,
  MentorshipRecommendation,
  ProfileScore,
  ProfileScoreSnapshot,
} from "@prisma/client";

/**
 * Acesso tipado aos delegates Prisma da Fase 4 (IA e Inteligência).
 *
 * O client gerado no `node_modules` do sandbox ainda não conhece os models
 * da Fase 4 (sem rede para `prisma generate`). Este módulo expõe delegates
 * tipados via cast controlado, usando os tipos do shim
 * (`src/types/prisma-shim.d.ts`), que espelham `schema.prisma`.
 *
 * A DONA DEVE rodar `npx prisma generate` localmente. Após isso, o client
 * real passa a ter os delegates nativamente e este módulo continua válido.
 *
 * ⚠️ Os resultados com `include`/`select` exigem tipos explícitos no ponto
 * de uso (ex.: `AIConversationWithMessages`), pois o delegate genérico não
 * infere os relacionamentos.
 */

type AnyPrismaClient = typeof prisma & Record<string, unknown>;
const p = prisma as AnyPrismaClient;

/** Delegate genérico mínimo usado na Fase 4. */
interface Delegate<T> {
  create(args: unknown): Promise<T>;
  findMany(args?: unknown): Promise<T[]>;
  findFirst(args?: unknown): Promise<T | null>;
  findUnique(args: unknown): Promise<T | null>;
  update(args: unknown): Promise<T>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<T>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  upsert(args: unknown): Promise<T>;
}

export const ai = {
  conversation: p.aIConversation as Delegate<AIConversation>,
  message: p.aIMessage as Delegate<AIMessage>,
  profile: p.aIProfile as Delegate<AIProfile>,
  copy: p.generatedCopy as Delegate<GeneratedCopy>,
  idea: p.contentIdea as Delegate<ContentIdea>,
  draft: p.socialDraft as Delegate<SocialDraft>,
  recommendation: p.mentorshipRecommendation as Delegate<MentorshipRecommendation>,
  score: p.profileScore as Delegate<ProfileScore>,
  scoreSnapshot: p.profileScoreSnapshot as Delegate<ProfileScoreSnapshot>,
};

export { prisma };

// ------------------------------------------------------------
// Tipos com relacionamentos (usados nos pontos de leitura)
// ------------------------------------------------------------

export interface AIConversationWithMessages extends AIConversation {
  messages: AIMessage[];
}
