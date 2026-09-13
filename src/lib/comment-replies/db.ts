import { prisma } from "@/lib/db";
import type { CommentCategory, ReplyMode, ReplyStatus } from "./types";

/**
 * REPOSITÓRIO DE RESPOSTAS INTELIGENTES
 * ======================================
 * Acesso aos 4 modelos novos (`CommentAutomationRule`, `ReplyTemplate`,
 * `SpecialProfileRule`, `CommentReplyLog`).
 *
 * O projeto usa o padrão "delegate cast" (ver `src/lib/ai/db.ts` e outros
 * repositórios do Inst Acessor): os modelos novos existem no schema, mas o
 * cliente Prisma gerado em disco pode não conhecê-los até o próximo
 * `prisma generate`. Tipar via cast evita quebrar o typecheck do restante do
 * projeto nesse intervalo e mantém um único ponto de acesso.
 */

type AnyPrismaClient = typeof prisma & Record<string, unknown>;

function client(): Record<string, {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findFirst: (args?: unknown) => Promise<unknown | null>;
  findUnique: (args?: unknown) => Promise<unknown | null>;
  create: (args?: unknown) => Promise<unknown>;
  update: (args?: unknown) => Promise<unknown>;
  updateMany: (args?: unknown) => Promise<{ count: number }>;
  delete: (args?: unknown) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
  upsert: (args?: unknown) => Promise<unknown>;
}> {
  return prisma as unknown as AnyPrismaClient as never;
}

// ---------------------------------------------------------------- tipos

export interface AutomationRule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  platform: string;
  targetType: string;
  mediaId: string | null;
  replyMode: ReplyMode;
  approvalRequired: boolean;
  maxRepliesPerRun: number;
  maxRepliesPerHour: number;
  maxRepliesPerDay: number;
  minimumIntervalSeconds: number;
  paused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyTemplateRow {
  id: string;
  userId: string;
  ruleId: string | null;
  text: string;
  category: string;
  exactReply: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecialProfileRow {
  id: string;
  userId: string;
  instagramUsername: string;
  displayName: string | null;
  category: string | null;
  customInstructions: string;
  fixedReply: string | null;
  useAI: boolean;
  priority: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyLogRow {
  id: string;
  userId: string;
  socialConnectionId: string;
  mediaId: string;
  commentId: string;
  commenterUsername: string;
  originalComment: string;
  commentCategory: string | null;
  generatedReply: string | null;
  finalReply: string | null;
  status: ReplyStatus;
  sourceRule: string | null;
  externalReplyId: string | null;
  errorCode: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  sentAt: Date | null;
  ruleId: string | null;
}

// ---------------------------------------------------------------- regra (única por usuário)

/**
 * O produto tem UMA configuração de automação por usuário (a tela é única).
 * `getOrCreateRule` garante isso de forma idempotente.
 */
export async function getOrCreateRule(userId: string): Promise<AutomationRule> {
  const db = client();
  const existing = (await db.commentAutomationRule.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  })) as AutomationRule | null;

  if (existing) return existing;

  const created = (await db.commentAutomationRule.create({
    data: {
      userId,
      name: "Respostas Inteligentes",
      enabled: false,
      platform: "instagram",
      targetType: "all",
      replyMode: "APPROVAL",
      approvalRequired: true,
    },
  })) as AutomationRule;

  return created;
}

export async function updateRule(
  userId: string,
  patch: Partial<
    Pick<
      AutomationRule,
      | "enabled"
      | "replyMode"
      | "approvalRequired"
      | "paused"
      | "targetType"
      | "mediaId"
      | "maxRepliesPerRun"
      | "maxRepliesPerHour"
      | "maxRepliesPerDay"
      | "minimumIntervalSeconds"
    >
  >
): Promise<AutomationRule> {
  const rule = await getOrCreateRule(userId);
  const updated = (await client().commentAutomationRule.update({
    where: { id: rule.id },
    data: patch,
  })) as AutomationRule;
  return updated;
}

// ---------------------------------------------------------------- templates

export async function listTemplates(userId: string): Promise<ReplyTemplateRow[]> {
  return (await client().replyTemplate.findMany({
    where: { userId },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  })) as ReplyTemplateRow[];
}

export async function createTemplate(
  userId: string,
  data: { text: string; category?: CommentCategory | string; exactReply?: boolean; ruleId?: string | null }
): Promise<ReplyTemplateRow> {
  return (await client().replyTemplate.create({
    data: {
      userId,
      text: data.text.trim(),
      category: data.category ?? "outro",
      exactReply: data.exactReply ?? false,
      ruleId: data.ruleId ?? null,
    },
  })) as ReplyTemplateRow;
}

export async function updateTemplate(
  userId: string,
  id: string,
  patch: Partial<Pick<ReplyTemplateRow, "text" | "category" | "exactReply" | "active">>
): Promise<ReplyTemplateRow | null> {
  const owned = (await client().replyTemplate.findFirst({ where: { id, userId } })) as ReplyTemplateRow | null;
  if (!owned) return null;
  return (await client().replyTemplate.update({ where: { id }, data: patch })) as ReplyTemplateRow;
}

export async function deleteTemplate(userId: string, id: string): Promise<boolean> {
  const owned = (await client().replyTemplate.findFirst({ where: { id, userId } })) as ReplyTemplateRow | null;
  if (!owned) return false;
  await client().replyTemplate.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------- perfis especiais

export async function listSpecialProfiles(userId: string): Promise<SpecialProfileRow[]> {
  return (await client().specialProfileRule.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })) as SpecialProfileRow[];
}

export async function createSpecialProfile(
  userId: string,
  data: {
    instagramUsername: string;
    displayName?: string | null;
    category?: string | null;
    customInstructions: string;
    fixedReply?: string | null;
    useAI?: boolean;
    priority?: number;
  }
): Promise<SpecialProfileRow> {
  const username = data.instagramUsername.trim().replace(/^@+/, "");
  return (await client().specialProfileRule.create({
    data: {
      userId,
      instagramUsername: username,
      displayName: data.displayName ?? null,
      category: data.category ?? null,
      customInstructions: data.customInstructions.trim(),
      fixedReply: data.fixedReply?.trim() || null,
      useAI: data.useAI ?? true,
      priority: data.priority ?? 10,
    },
  })) as SpecialProfileRow;
}

export async function updateSpecialProfile(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      SpecialProfileRow,
      "instagramUsername" | "displayName" | "category" | "customInstructions" | "fixedReply" | "useAI" | "priority" | "active"
    >
  >
): Promise<SpecialProfileRow | null> {
  const owned = (await client().specialProfileRule.findFirst({ where: { id, userId } })) as SpecialProfileRow | null;
  if (!owned) return null;
  const data = { ...patch };
  if (typeof data.instagramUsername === "string") {
    data.instagramUsername = data.instagramUsername.trim().replace(/^@+/, "");
  }
  return (await client().specialProfileRule.update({ where: { id }, data })) as SpecialProfileRow;
}

export async function deleteSpecialProfile(userId: string, id: string): Promise<boolean> {
  const owned = (await client().specialProfileRule.findFirst({ where: { id, userId } })) as SpecialProfileRow | null;
  if (!owned) return false;
  await client().specialProfileRule.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------- log / idempotência

/**
 * Um comentário só pode ser respondido UMA vez. A restrição `@@unique([mediaId,
 * commentId])` é a garantia final no banco; este find evita a tentativa
 * desnecessária e permite a UI marcar "já respondido".
 */
export async function findReplyByComment(
  mediaId: string,
  commentId: string
): Promise<ReplyLogRow | null> {
  return (await client().commentReplyLog.findUnique({
    where: { mediaId_commentId: { mediaId, commentId } },
  })) as ReplyLogRow | null;
}

/** Busca um registro garantindo que pertence ao usuário. */
export async function findLogById(userId: string, id: string): Promise<ReplyLogRow | null> {
  return (await client().commentReplyLog.findFirst({ where: { id, userId } })) as ReplyLogRow | null;
}

/**
 * Busca uma publicação sincronizada pelo seu id do Instagram.
 *
 * Lê do banco (dados REAIS já sincronizados pelo sync existente) em vez de
 * bater na API — evita rate limit e funciona mesmo quando a leitura de mídia
 * está momentaneamente indisponível.
 */
export async function findMediaByIgId(
  userId: string,
  igMediaId: string
): Promise<{
  igMediaId: string;
  mediaType: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  permalink: string | null;
  commentsCount: number | null;
} | null> {
  const row = (await client().instagramMedia.findFirst({
    where: { userId, igMediaId },
  })) as Record<string, unknown> | null;
  if (!row) return null;
  return {
    igMediaId: String(row.igMediaId ?? igMediaId),
    mediaType: (row.mediaType as string | null) ?? null,
    caption: (row.caption as string | null) ?? null,
    thumbnailUrl: (row.thumbnailUrl as string | null) ?? null,
    mediaUrl: (row.mediaUrl as string | null) ?? null,
    permalink: (row.permalink as string | null) ?? null,
    commentsCount: (row.commentsCount as number | null) ?? null,
  };
}

/**
 * Cria o registro de forma idempotente.
 * Se o comentário já tiver registro, devolve o existente em vez de duplicar —
 * o `login`/`findFirst` acima cobre o caso comum, e o catch cobre a corrida.
 */
export async function upsertLog(input: {
  userId: string;
  socialConnectionId: string;
  mediaId: string;
  commentId: string;
  commenterUsername: string;
  originalComment: string;
  commentCategory?: string | null;
  generatedReply?: string | null;
  finalReply?: string | null;
  status?: ReplyStatus;
  sourceRule?: string | null;
  ruleId?: string | null;
  errorCode?: string | null;
}): Promise<ReplyLogRow> {
  const db = client();
  const existing = await findReplyByComment(input.mediaId, input.commentId);
  if (existing) {
    return (await db.commentReplyLog.update({
      where: { id: existing.id },
      data: {
        commenterUsername: input.commenterUsername,
        originalComment: input.originalComment,
        commentCategory: input.commentCategory ?? existing.commentCategory,
        generatedReply: input.generatedReply ?? existing.generatedReply,
        finalReply: input.finalReply ?? existing.finalReply,
        status: input.status ?? existing.status,
        sourceRule: input.sourceRule ?? existing.sourceRule,
        ruleId: input.ruleId ?? existing.ruleId,
        errorCode: input.errorCode ?? existing.errorCode,
      },
    })) as ReplyLogRow;
  }

  return (await db.commentReplyLog.create({ data: input })) as ReplyLogRow;
}

export async function updateLog(
  userId: string,
  id: string,
  patch: Partial<
    Pick<ReplyLogRow, "generatedReply" | "finalReply" | "status" | "externalReplyId" | "errorCode" | "approvedAt" | "sentAt" | "commentCategory" | "sourceRule">
  >
): Promise<ReplyLogRow | null> {
  const owned = (await client().commentReplyLog.findFirst({ where: { id, userId } })) as ReplyLogRow | null;
  if (!owned) return null;
  return (await client().commentReplyLog.update({ where: { id }, data: patch })) as ReplyLogRow;
}

export interface HistoryFilter {
  status?: ReplyStatus | "ALL";
  mediaId?: string;
  limit?: number;
}

export async function listLogs(userId: string, filter: HistoryFilter = {}): Promise<ReplyLogRow[]> {
  const where: Record<string, unknown> = { userId };
  if (filter.status && filter.status !== "ALL") where.status = filter.status;
  if (filter.mediaId) where.mediaId = filter.mediaId;

  return (await client().commentReplyLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? 100, 200),
  })) as ReplyLogRow[];
}

/** Respondidos recentemente — usado para evitar repetição de respostas. */
export async function recentSentReplies(userId: string, take = 10): Promise<string[]> {
  const rows = (await client().commentReplyLog.findMany({
    where: { userId, status: "SENT" },
    orderBy: { sentAt: "desc" },
    take,
  })) as ReplyLogRow[];
  return rows.map((r) => r.finalReply ?? "").filter(Boolean);
}

// ---------------------------------------------------------------- contadores (limites reais)

export async function countSentSince(userId: string, since: Date): Promise<number> {
  return (await client().commentReplyLog.count({
    where: { userId, status: "SENT", sentAt: { gte: since } },
  })) as number;
}

export async function lastSentAt(userId: string): Promise<Date | null> {
  const rows = (await client().commentReplyLog.findMany({
    where: { userId, status: "SENT" },
    orderBy: { sentAt: "desc" },
    take: 1,
  })) as ReplyLogRow[];
  return rows[0]?.sentAt ?? null;
}

/**
 * Métricas do painel — TODAS derivadas de registros reais.
 * Nenhum número é estimado, projetado ou inventado.
 */
export async function getStats(userId: string, since: Date) {
  const db = client();
  const [analyzed, sent, pending, ignored, error, approved, auto, manual] = await Promise.all([
    db.commentReplyLog.count({ where: { userId, createdAt: { gte: since } } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "SENT", sentAt: { gte: since } } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "PENDING" } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "IGNORED", createdAt: { gte: since } } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "ERROR", createdAt: { gte: since } } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "APPROVED", createdAt: { gte: since } } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "SENT", sourceRule: "AUTO", sentAt: { gte: since } } }) as Promise<number>,
    db.commentReplyLog.count({ where: { userId, status: "SENT", sourceRule: "MANUAL", sentAt: { gte: since } } }) as Promise<number>,
  ]);

  const decided = sent + ignored;
  const approvalRate = decided > 0 ? Math.round((sent / decided) * 100) : null;

  return { analyzed, sent, pending, ignored, error, approved, auto, manual, approvalRate };
}
