import { prisma } from "@/lib/db";

/**
 * REPOSITÓRIO — COMENTÁRIO → DIRECT + CENTRAL DE DM
 * =================================================
 * Acesso aos 6 models novos (`CommentDirectRule`, `CommentDirectLog`,
 * `DirectConversation`, `DirectMessage`, `DirectFaq`, `DirectAgentAction`).
 *
 * Mesmo padrão "delegate cast" já usado em `comment-replies/db.ts`: os models
 * existem no schema, mas o client Prisma gerado em disco pode não conhecê-los
 * até o próximo `prisma generate`. O cast mantém o typecheck do projeto válido
 * nesse intervalo e concentra o acesso num único lugar.
 *
 * ISOLAMENTO: TODA função de leitura/escrita recebe `userId` e filtra por ele.
 * Nenhuma consulta cruza usuários.
 */

type AnyPrismaClient = typeof prisma & Record<string, unknown>;

interface Delegate {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findFirst: (args?: unknown) => Promise<unknown | null>;
  findUnique: (args?: unknown) => Promise<unknown | null>;
  create: (args?: unknown) => Promise<unknown>;
  update: (args?: unknown) => Promise<unknown>;
  updateMany: (args?: unknown) => Promise<{ count: number }>;
  delete: (args?: unknown) => Promise<unknown>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
  count: (args?: unknown) => Promise<number>;
  upsert: (args: unknown) => Promise<unknown>;
}

function db(): Record<string, Delegate> {
  return prisma as unknown as AnyPrismaClient as never;
}

// ---------------------------------------------------------------- tipos

export interface DirectRuleRow {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  platform: string;
  mediaId: string | null;
  mediaCaption: string | null;
  scope: string;
  triggerType: string;
  triggerTerms: string[];
  messageText: string;
  dailyLimit: number;
  onePerUser: boolean;
  pausedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectLogRow {
  id: string;
  userId: string;
  socialConnectionId: string;
  ruleId: string | null;
  mediaId: string;
  commentId: string;
  commenterId: string | null;
  commenterUsername: string | null;
  originalComment: string;
  matchedTrigger: string | null;
  sentMessage: string | null;
  status: string;
  reason: string | null;
  externalMessageId: string | null;
  errorCode: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface DirectConversationRow {
  id: string;
  userId: string;
  socialConnectionId: string;
  igConversationId: string;
  participantId: string | null;
  participantUsername: string | null;
  participantName: string | null;
  lastMessageAt: Date | null;
  unreadCount: number | null;
  lastMessagePreview: string | null;
  windowOpen: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectMessageRow {
  id: string;
  userId: string;
  conversationId: string;
  igMessageId: string;
  direction: string;
  text: string | null;
  attachmentType: string | null;
  sentAt: Date | null;
  fromUs: boolean;
  createdAt: Date;
}

export interface DirectFaqRow {
  id: string;
  userId: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------- regras

export async function listDirectRules(userId: string): Promise<DirectRuleRow[]> {
  return (await db().commentDirectRule.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })) as DirectRuleRow[];
}

export async function findDirectRule(userId: string, id: string): Promise<DirectRuleRow | null> {
  return (await db().commentDirectRule.findFirst({ where: { id, userId } })) as DirectRuleRow | null;
}

/** Regras ATIVAS e não pausadas que se aplicam a uma publicação. */
export async function activeRulesForMedia(
  userId: string,
  mediaId: string
): Promise<DirectRuleRow[]> {
  const now = new Date();
  const rows = (await db().commentDirectRule.findMany({
    where: {
      userId,
      enabled: true,
      OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }],
      AND: [{ OR: [{ scope: "all" }, { scope: "media", mediaId }] }],
    },
    orderBy: { createdAt: "asc" },
  })) as DirectRuleRow[];
  return rows;
}

export async function createDirectRule(
  userId: string,
  data: {
    name: string;
    mediaId?: string | null;
    mediaCaption?: string | null;
    scope?: string;
    triggerType: string;
    triggerTerms: string[];
    messageText: string;
    dailyLimit?: number;
    onePerUser?: boolean;
    enabled?: boolean;
  }
): Promise<DirectRuleRow> {
  return (await db().commentDirectRule.create({
    data: {
      userId,
      name: data.name,
      // Nasce SEMPRE desligada, mesmo que o cliente peça `enabled: true`.
      // Uma automação que envia DM nunca começa ativa por acidente.
      enabled: false,
      mediaId: data.mediaId ?? null,
      mediaCaption: data.mediaCaption ?? null,
      scope: data.scope ?? "all",
      triggerType: data.triggerType,
      triggerTerms: data.triggerTerms,
      messageText: data.messageText,
      dailyLimit: data.dailyLimit ?? 50,
      onePerUser: data.onePerUser ?? true,
    },
  })) as DirectRuleRow;
}

export async function updateDirectRule(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      DirectRuleRow,
      | "name"
      | "enabled"
      | "mediaId"
      | "mediaCaption"
      | "scope"
      | "triggerType"
      | "triggerTerms"
      | "messageText"
      | "dailyLimit"
      | "onePerUser"
      | "pausedUntil"
    >
  >
): Promise<DirectRuleRow | null> {
  const owned = await findDirectRule(userId, id);
  if (!owned) return null;
  return (await db().commentDirectRule.update({ where: { id }, data: patch })) as DirectRuleRow;
}

export async function deleteDirectRule(userId: string, id: string): Promise<boolean> {
  const owned = await findDirectRule(userId, id);
  if (!owned) return false;
  await db().commentDirectRule.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------- log / idempotência

export async function findDirectLog(
  mediaId: string,
  commentId: string
): Promise<DirectLogRow | null> {
  return (await db().commentDirectLog.findUnique({
    where: { mediaId_commentId: { mediaId, commentId } },
  })) as DirectLogRow | null;
}

/** Já existe mensagem registrada para este comentário? (idempotência) */
export async function directLogExists(mediaId: string, commentId: string): Promise<boolean> {
  const row = await findDirectLog(mediaId, commentId);
  return row != null;
}

/** Já foi enviada mensagem desta regra para esta pessoa? (onePerUser) */
export async function alreadyMessagedUser(
  userId: string,
  ruleId: string,
  commenterId: string | null,
  commenterUsername: string | null
): Promise<boolean> {
  if (!commenterId && !commenterUsername) return false;
  const OR: Record<string, unknown>[] = [];
  if (commenterId) OR.push({ commenterId });
  if (commenterUsername) OR.push({ commenterUsername });
  const count = (await db().commentDirectLog.count({
    where: { userId, ruleId, status: "SENT", OR },
  })) as number;
  return count > 0;
}

/** Envios desta regra desde um instante — para o limite diário. */
export async function countDirectSentSince(
  userId: string,
  ruleId: string,
  since: Date
): Promise<number> {
  return (await db().commentDirectLog.count({
    where: { userId, ruleId, status: "SENT", sentAt: { gte: since } },
  })) as number;
}

/**
 * Cria o registro de forma idempotente. A `@@unique([mediaId, commentId])` é a
 * garantia final: quando a Meta reentrega o mesmo webhook em paralelo, o insert
 * perdedor estoura P2002 e devolvemos a linha vencedora em vez de duplicar.
 *
 * O catch é ESTREITO (P2002 no alvo mediaId_commentId) — qualquer outro erro
 * continua subindo.
 */
export async function upsertDirectLog(input: {
  userId: string;
  socialConnectionId: string;
  ruleId: string | null;
  mediaId: string;
  commentId: string;
  commenterId?: string | null;
  commenterUsername?: string | null;
  originalComment: string;
  matchedTrigger?: string | null;
  sentMessage?: string | null;
  status?: string;
  reason?: string | null;
  externalMessageId?: string | null;
  errorCode?: string | null;
  sentAt?: Date | null;
}): Promise<DirectLogRow> {
  const existing = await findDirectLog(input.mediaId, input.commentId);
  if (existing) {
    // Já existe registro: NÃO reescreve o status de um SENT (a idempotência
    // manda). Só completa dados que faltavam.
    if (existing.status === "SENT") return existing;
    return (await db().commentDirectLog.update({
      where: { id: existing.id },
      data: {
        status: input.status ?? existing.status,
        reason: input.reason ?? existing.reason,
        sentMessage: input.sentMessage ?? existing.sentMessage,
        externalMessageId: input.externalMessageId ?? existing.externalMessageId,
        errorCode: input.errorCode ?? existing.errorCode,
        sentAt: input.sentAt ?? existing.sentAt,
      },
    })) as DirectLogRow;
  }

  try {
    return (await db().commentDirectLog.create({
      data: {
        userId: input.userId,
        socialConnectionId: input.socialConnectionId,
        ruleId: input.ruleId,
        mediaId: input.mediaId,
        commentId: input.commentId,
        commenterId: input.commenterId ?? null,
        commenterUsername: input.commenterUsername ?? null,
        originalComment: input.originalComment,
        matchedTrigger: input.matchedTrigger ?? null,
        sentMessage: input.sentMessage ?? null,
        status: input.status ?? "PENDING",
        reason: input.reason ?? null,
        externalMessageId: input.externalMessageId ?? null,
        errorCode: input.errorCode ?? null,
        sentAt: input.sentAt ?? null,
      },
    })) as DirectLogRow;
  } catch (err) {
    if (!isUniqueRaceOnComment(err)) throw err;
    const winner = await findDirectLog(input.mediaId, input.commentId);
    if (!winner) throw err;
    return winner;
  }
}

function isUniqueRaceOnComment(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  const fields = Array.isArray(target)
    ? target.map((t) => String(t))
    : typeof target === "string"
      ? [target]
      : [];
  return fields.includes("mediaId") && fields.includes("commentId");
}

export async function listDirectLogs(userId: string, limit = 100): Promise<DirectLogRow[]> {
  return (await db().commentDirectLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  })) as DirectLogRow[];
}

// ---------------------------------------------------------------- contadores

/** Contadores REAIS para o painel — nunca estimados. */
export async function countDirect(userId: string): Promise<{
  rules: number;
  conversations: number;
  faqs: number;
}> {
  const [rules, conversations, faqs] = await Promise.all([
    db().commentDirectRule.count({ where: { userId } }),
    db().directConversation.count({ where: { userId } }),
    db().directFaq.count({ where: { userId } }),
  ]);
  return { rules, conversations, faqs };
}

// ---------------------------------------------------------------- conversas

export async function listConversationsForUser(
  userId: string,
  limit = 50
): Promise<DirectConversationRow[]> {
  return (await db().directConversation.findMany({
    where: { userId },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: Math.min(limit, 100),
  })) as DirectConversationRow[];
}

export async function findConversation(
  userId: string,
  id: string
): Promise<DirectConversationRow | null> {
  return (await db().directConversation.findFirst({ where: { id, userId } })) as DirectConversationRow | null;
}

/**
 * Procura a conversa pelo CONTATO (IGSID), não pela chave da thread.
 *
 * Existe porque há duas origens de conversa: a leitura oficial (que usa o id da
 * thread da Meta) e o webhook de mensagens (que pode não trazer o id da thread).
 * Sem esta busca, a MESMA pessoa viraria duas conversas — uma da leitura, outra
 * do evento. Aqui o webhook reusa a linha que a leitura já criou.
 */
export async function findConversationByParticipant(
  userId: string,
  participantId: string
): Promise<DirectConversationRow | null> {
  return (await db().directConversation.findFirst({
    where: { userId, participantId },
    orderBy: { updatedAt: "desc" },
  })) as DirectConversationRow | null;
}

/** Upsert por `igConversationId` (idempotente por definição). */
export async function upsertConversation(
  userId: string,
  socialConnectionId: string,
  data: {
    igConversationId: string;
    participantId?: string | null;
    participantUsername?: string | null;
    participantName?: string | null;
    lastMessageAt?: Date | null;
    unreadCount?: number | null;
    lastMessagePreview?: string | null;
    windowOpen?: boolean | null;
  }
): Promise<DirectConversationRow> {
  return (await db().directConversation.upsert({
    where: { igConversationId: data.igConversationId },
    create: {
      userId,
      socialConnectionId,
      igConversationId: data.igConversationId,
      participantId: data.participantId ?? null,
      participantUsername: data.participantUsername ?? null,
      participantName: data.participantName ?? null,
      lastMessageAt: data.lastMessageAt ?? null,
      unreadCount: data.unreadCount ?? null,
      lastMessagePreview: data.lastMessagePreview ?? null,
      windowOpen: data.windowOpen ?? null,
    },
    update: {
      // Nunca sobrescreve dado do dono numa releitura; só completa o que veio.
      participantId: data.participantId ?? null,
      participantUsername: data.participantUsername ?? null,
      participantName: data.participantName ?? null,
      lastMessageAt: data.lastMessageAt ?? null,
      unreadCount: data.unreadCount ?? null,
      lastMessagePreview: data.lastMessagePreview ?? null,
      windowOpen: data.windowOpen ?? null,
    },
  })) as DirectConversationRow;
}

/** Atualiza uma conversa por id INTERNO (usado quando o webhook reusa a linha). */
export async function updateConversationById(
  conversationId: string,
  data: {
    lastMessageAt?: Date | null;
    lastMessagePreview?: string | null;
    participantId?: string | null;
    participantUsername?: string | null;
  }
): Promise<void> {
  await db().directConversation.update({ where: { id: conversationId }, data });
}

export async function listMessagesForConversation(
  userId: string,
  conversationId: string,
  limit = 100
): Promise<DirectMessageRow[]> {
  return (await db().directMessage.findMany({
    where: { userId, conversationId },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
    take: Math.min(limit, 200),
  })) as DirectMessageRow[];
}

/** Upsert por `igMessageId` — idempotente para a reentrega do webhook. */
export async function upsertDirectMessage(
  userId: string,
  conversationId: string,
  data: {
    igMessageId: string;
    direction: string;
    text?: string | null;
    attachmentType?: string | null;
    sentAt?: Date | null;
    fromUs?: boolean;
  }
): Promise<DirectMessageRow> {
  return (await db().directMessage.upsert({
    where: { igMessageId: data.igMessageId },
    create: {
      userId,
      conversationId,
      igMessageId: data.igMessageId,
      direction: data.direction,
      text: data.text ?? null,
      attachmentType: data.attachmentType ?? null,
      sentAt: data.sentAt ?? null,
      fromUs: data.fromUs ?? false,
    },
    update: {
      text: data.text ?? null,
      attachmentType: data.attachmentType ?? null,
      sentAt: data.sentAt ?? null,
      direction: data.direction,
      fromUs: data.fromUs ?? false,
    },
  })) as DirectMessageRow;
}

// ---------------------------------------------------------------- FAQ

export async function listFaqs(userId: string, onlyActive = false): Promise<DirectFaqRow[]> {
  return (await db().directFaq.findMany({
    where: onlyActive ? { userId, active: true } : { userId },
    orderBy: { createdAt: "asc" },
  })) as DirectFaqRow[];
}

export async function createFaq(
  userId: string,
  data: { question: string; answer: string; keywords: string[]; category?: string }
): Promise<DirectFaqRow> {
  return (await db().directFaq.create({
    data: {
      userId,
      question: data.question,
      answer: data.answer,
      keywords: data.keywords,
      category: data.category ?? "geral",
    },
  })) as DirectFaqRow;
}

export async function updateFaq(
  userId: string,
  id: string,
  patch: Partial<Pick<DirectFaqRow, "question" | "answer" | "keywords" | "category" | "active">>
): Promise<DirectFaqRow | null> {
  const owned = (await db().directFaq.findFirst({ where: { id, userId } })) as DirectFaqRow | null;
  if (!owned) return null;
  return (await db().directFaq.update({ where: { id }, data: patch })) as DirectFaqRow;
}

export async function deleteFaq(userId: string, id: string): Promise<boolean> {
  const owned = (await db().directFaq.findFirst({ where: { id, userId } })) as DirectFaqRow | null;
  if (!owned) return false;
  await db().directFaq.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------- log de ações da IA

export async function logAgentAction(input: {
  userId: string;
  conversationId?: string | null;
  messageId?: string | null;
  action: string;
  suggestion?: string | null;
  finalText?: string | null;
  reason?: string | null;
}): Promise<void> {
  await db().directAgentAction.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      action: input.action,
      suggestion: input.suggestion ?? null,
      finalText: input.finalText ?? null,
      reason: input.reason ?? null,
    },
  });
}

export async function listAgentActions(userId: string, limit = 50) {
  return (await db().directAgentAction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  })) as unknown as {
    id: string;
    conversationId: string | null;
    messageId: string | null;
    action: string;
    suggestion: string | null;
    finalText: string | null;
    reason: string | null;
    createdAt: Date;
  }[];
}
