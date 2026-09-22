import { aiConfigured } from "@/lib/ai";
import { getAIProfile } from "@/lib/ai/services/profile";
import { prisma } from "@/lib/db";
import { classifyComment } from "./classify";
import { analyzeEmptyReason, type AnalyzeEmptyReason } from "./empty-reason";
import { canAutoSend, REVIEW_REASON_LABEL } from "./safety";
import { resolvePriority, type SpecialProfileInput, type TemplateInput } from "./priority";
import { generateReply, isTooSimilar } from "./generator";
import { checkLimits, loadLimitState, pauseForError } from "./limits";
import {
  findLogById,
  findMediaByIgId,
  findReplyByComment,
  getOrCreateRule,
  listSpecialProfiles,
  listTemplates,
  recentSentReplies,
  updateLog,
  updateRule,
  upsertLog,
} from "./db";
import {
  listComments,
  listStoredComments,
  loadCommentCredentials,
  persistComments,
  replyToComment,
  CommentCapabilityError,
} from "./instagram-comments";
import type { CommentCredentials, ListCommentsMeta } from "./instagram-comments";
import type { AutomationRule } from "./db";
import type { CommentCategory, EligibleComment, EligibleMedia, ReplySource } from "./types";

/**
 * MOTOR DE RESPOSTAS INTELIGENTES
 * ================================
 * Orquestra o ciclo completo de UM comentÃƒÂ¡rio:
 *
 *   ler Ã¢â€ â€™ classificar Ã¢â€ â€™ resolver prioridade Ã¢â€ â€™ gerar Ã¢â€ â€™ decidir envio Ã¢â€ â€™ registrar
 *
 * Regras que este arquivo garante:
 *
 *   1. IDEMPOTÃƒÅ NCIA Ã¢â‚¬â€ um `commentId` nunca ÃƒÂ© respondido duas vezes. A checagem
 *      vem do `CommentReplyLog` (com `@@unique([mediaId, commentId])` como
 *      garantia final no banco).
 *   2. FAIL-CLOSED Ã¢â‚¬â€ qualquer dÃƒÂºvida (IA fora, limite estourado, categoria
 *      sensÃƒÂ­vel, sem conexÃƒÂ£o) resulta em NÃƒÆ’O ENVIAR. Nunca em enviar "mesmo
 *      assim".
 *   3. LIMITES Ã¢â‚¬â€ todo envio automÃƒÂ¡tico passa por `checkLimits()`.
 *   4. CAPACIDADE REAL Ã¢â‚¬â€ se a Meta ainda nÃƒÂ£o concedeu acesso a comentÃƒÂ¡rios,
 *      o erro ÃƒÂ© tipado e devolvido como estÃƒÂ¡. Nada ÃƒÂ© contornado.
 *
 * O envio real (`sendApprovedReply`) sÃƒÂ³ ocorre quando chamado explicitamente Ã¢â‚¬â€
 * seja por aprovaÃƒÂ§ÃƒÂ£o humana (modos MANUAL/APPROVAL) ou pelo caminho AUTO, que
 * exige que TODAS as condiÃƒÂ§ÃƒÂµes de seguranÃƒÂ§a estejam satisfeitas.
 */

export interface AnalyzeResultItem {
  comment: EligibleComment;
  category: CommentCategory;
  decisionKind: "EXACT" | "AI" | "REVIEW_ONLY";
  generatedReply: string | null;
  status: "PENDING" | "SKIPPED" | "ERROR";
  /** Por que este comentÃƒÂ¡rio nÃƒÂ£o pode ser enviado automaticamente. */
  reviewReason: string | null;
  reviewReasonLabel: string | null;
  autoSendable: boolean;
  source: ReplySource;
  logId: string | null;
  error?: string;
}

/**
 * O MOTIVO do vazio vive em `./empty-reason` (núcleo puro, provado por
 * execução). Reexportado aqui para os consumidores do motor não precisarem
 * conhecer o arquivo interno — e para que exista UM caminho de importação.
 */
export { analyzeEmptyReason, emptyReasonNotice, emptyReasonNeedsAction } from "./empty-reason";
export type { AnalyzeEmptyReason, EmptySignals } from "./empty-reason";

/**
 * Uma leitura que falhou para UM comentário específico.
 *
 * Existe porque a falha de item era INVISÍVEL: `analyzeSingleComment` lançava,
 * o `catch` do laço gravava o motivo em `dbError` e seguia, mas ao final
 * `emptyReason` só olhava `items.length` e `comments.length` — então 5
 * comentários lidos com 5 falhas de gravação resultavam em `all_deduped`, isto
 * é, "todos já foram analisados". A tela dizia exatamente isso enquanto nada
 * havia sido analisado.
 */
export interface AnalyzeReadError {
  commentId: string;
  message: string;
}

export interface AnalyzeSummary {
  ok: boolean;
  error?: string;
  code?: string;
  media?: EligibleMedia;
  items: AnalyzeResultItem[];
  /** Quantos comentários a Meta devolveu ANTES da deduplicação. */
  fetchedCount?: number;
  /** Quantos já tinham registro de análise (deduplicados). */
  dedupedCount?: number;
  emptyReason?: AnalyzeEmptyReason;
  /** Falha de banco ao ler/gravar nesta análise (não é ausência de dados). */
  dbError?: string;
  /** A leitura ao vivo falhou, mas devolvemos o que estava persistido. */
  usedStoredFallback?: boolean;
  /**
   * Falhas ao PROCESSAR comentários individuais (gravação do log). Vazio =
   * nenhuma. Quando isto não está vazio e `items` também não, a leva é parcial
   * e a UI precisa dizer isso.
   */
  readErrors?: AnalyzeReadError[];
  /** A leitura parou no teto de páginas: a Meta ainda tinha mais comentários. */
  truncated?: boolean;
  /** Páginas da leitura ao vivo (diagnóstico; nunca inclui credencial). */
  pagesFetched?: number;
  /** Falha ao PERSISTIR os comentários lidos — separada da falha de análise. */
  persistError?: string | null;
}

/** Converte a linha do banco no formato esperado pelo resolvedor de prioridade. */
function toTemplateInput(row: {
  id: string;
  text: string;
  category: string;
  exactReply: boolean;
  active: boolean;
}): TemplateInput {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    exactReply: row.exactReply,
    active: row.active,
  };
}

function toSpecialProfileInput(row: {
  id: string;
  instagramUsername: string;
  displayName: string | null;
  customInstructions: string;
  fixedReply: string | null;
  useAI: boolean;
  priority: number;
  active: boolean;
}): SpecialProfileInput {
  return {
    id: row.id,
    instagramUsername: row.instagramUsername,
    displayName: row.displayName,
    customInstructions: row.customInstructions,
    fixedReply: row.fixedReply,
    useAI: row.useAI,
    priority: row.priority,
    active: row.active,
  };
}

/**
 * LÃƒÂª e analisa os comentÃƒÂ¡rios de UMA publicaÃƒÂ§ÃƒÂ£o.
 *
 * @param mediaId            publicaÃƒÂ§ÃƒÂ£o alvo
 * @param opts.onlyUnanswered ignora comentÃƒÂ¡rios que jÃƒÂ¡ tÃƒÂªm registro no log
 * @param opts.persist        grava os resultados em `CommentReplyLog`
 */
export async function analyzeMedia(
  userId: string,
  mediaId: string,
  opts: { onlyUnanswered?: boolean; persist?: boolean } = {}
): Promise<AnalyzeSummary> {
  // ---- conexÃƒÂ£o (mesma do Redes Sociais Ã¢â‚¬â€ sem segundo OAuth) ----
  let credentials;
  try {
    credentials = await loadCommentCredentials(userId);
  } catch (err) {
    const info = err instanceof CommentCapabilityError ? err : null;
    return {
      ok: false,
      error: info?.message ?? "NÃƒÂ£o foi possÃƒÂ­vel acessar a conexÃƒÂ£o do Instagram.",
      code: info?.code ?? "api",
      items: [],
    };
  }

  // ---- comentários (erro tipado se a Meta não autorizar) ----
  //
  // FALLBACK HONESTO: se a leitura ao vivo falhar (rate limit, indisponibilidade
  // momentânea) mas existirem comentários JÁ SINCRONIZADOS para esta publicação,
  // analisamos o que temos em vez de devolver erro e esconder o dado real.
  // A falha NÃO é convertida em "nenhum comentário": ela é reportada no
  // `usedStoredFallback` + `error`, para a UI poder dizer o que de fato ocorreu.
  //
  // `media_not_found` e `capability` NÃO entram no fallback: são condições sobre
  // A PUBLICAÇÃO e a PERMISSÃO, não indisponibilidade passageira. Analisar o
  // que está no banco ali só maquiava o problema — e foi por isso que a tela
  // conseguia dizer "nenhum comentário novo" numa publicação que a Meta nem
  // reconhecia.
  let comments: EligibleComment[];
  let usedStoredFallback = false;
  let liveError: string | null = null;
  let pagesFetched: number | undefined;
  let truncated = false;
  try {
    const liveMeta: ListCommentsMeta = {};
    comments = await listComments(mediaId, credentials, liveMeta);
    pagesFetched = liveMeta.pages;
    truncated = liveMeta.truncated === true;
  } catch (err) {
    const info =
      err instanceof CommentCapabilityError
        ? err
        : new CommentCapabilityError("api", "Não foi possível ler os comentários.");

    if (info.code === "media_not_found" || info.code === "capability") {
      return {
        ok: false,
        error: info.message,
        code: info.code,
        items: [],
        emptyReason: "api_empty",
      };
    }

    let stored: EligibleComment[] = [];
    try {
      stored = await listStoredComments(userId, mediaId);
    } catch {
      stored = [];
    }

    // Sem nada persistido, o erro é a resposta: nunca "zero comentários".
    if (stored.length === 0) {
      return { ok: false, error: info.message, code: info.code, items: [], emptyReason: "api_empty" };
    }

    comments = stored;
    usedStoredFallback = true;
    liveError = info.message;
  }

  // ---- contexto real do usuÃƒÂ¡rio (uma leitura para TODA a leva) ----
  let ctx: CommentAnalysisContext;
  let media: EligibleMedia | undefined;
  try {
    const built = await loadAnalysisContext(userId, mediaId);
    ctx = built.ctx;
    media = built.media;
  } catch (err) {
    const info = err instanceof CommentCapabilityError ? err : null;
    return {
      ok: false,
      error: info?.message ?? "NÃƒÂ£o foi possÃƒÂ­vel carregar a configuraÃƒÂ§ÃƒÂ£o de respostas.",
      code: info?.code ?? "api",
      items: [],
    };
  }

  const items: AnalyzeResultItem[] = [];
  const readErrors: AnalyzeReadError[] = [];
  let dedupedCount = 0;
  let dbError: string | null = null;
  let persistError: string | null = null;

  // PERSISTE o que foi lido da Meta. Sem isto a leitura ao vivo era descartada:
  // o card seguia mostrando só o `comments_count` declarado pela Meta e o banco
  // continuava sem comentário nenhum (a contradição vista em produção).
  // É idempotente (`igCommentId` é único) e nunca apaga o que já existe.
  //
  // `persistError` fica em campo PRÓPRIO: a falha de gravação não pode ser
  // confundida com falha de análise nem com ausência de comentários — este
  // catch também não marca mais `dbError`, que agora significa só "não
  // conseguimos ler/analisar", não "não conseguimos guardar o que lemos".
  if (opts.persist !== false && !usedStoredFallback) {
    try {
      await persistComments(userId, mediaId, comments);
    } catch (err) {
      // Falha ao gravar NÃO invalida a leitura: a análise segue com o que veio
      // da Meta, e a ocorrência fica registrada em vez de virar "sem dados".
      persistError = err instanceof Error ? err.message : "Falha ao gravar os comentários.";
      console.error("[comment-replies] persistComments", err);
    }
  }

  // Publicação fora do banco: o banco é a única origem do contexto de análise
  // (regra, templates, legenda). Sem ele a análise não tem como rodar e o
  // motivo precisa ser dito — antes isso só aparecia depois, sem contexto.
  if (!ctx.media) {
    return {
      ok: false,
      error:
        "Esta publicação não está sincronizada no Inst Acessor. Sincronize a conta e tente novamente.",
      code: "media_unsynced",
      items: [],
      fetchedCount: comments.length,
      emptyReason: "media_unsynced",
      truncated,
      pagesFetched,
    };
  }

  for (const comment of comments) {
    if (opts.onlyUnanswered) {
      let existing: Awaited<ReturnType<typeof findReplyByComment>> = null;
      try {
        existing = await findReplyByComment(mediaId, comment.commentId);
      } catch (err) {
        // FALHA DE BANCO ≠ COMENTÁRIO JÁ ANALISADO. Antes, uma exceção aqui
        // subia e virava 500; agora ela é registrada e a análise continua, para
        // que o motivo real apareça em vez de um "nenhum comentário novo".
        dbError = err instanceof Error ? err.message : "Falha ao consultar o histórico.";
        existing = null;
      }
      // Já respondido ou já registrado: não reanalisa, não duplica.
      if (existing && existing.status !== "ERROR") {
        dedupedCount++;
        continue;
      }
    }

    try {
      items.push(
        await analyzeSingleComment({
          userId,
          mediaId,
          comment,
          ctx,
          credentials,
          persist: opts.persist ?? true,
        })
      );
    } catch (err) {
      // O motivo REAL de cada falha, por comentário. Antes ele ia para o
      // `dbError` geral e o vazio final era classificado como "todos já
      // analisados" — a frase mais enganosa possível para uma leva que não
      // produziu item nenhum.
      const message = err instanceof Error ? err.message : "Falha ao registrar a análise.";
      readErrors.push({ commentId: comment.commentId, message });
      dbError = message;
    }
  }

  // Discriminador — a decisão mora em `analyzeEmptyReason`, um núcleo puro
  // provado por execução (outputs/bench-empty.mjs). Aqui só medimos os fatos.
  const emptyReason: AnalyzeEmptyReason = analyzeEmptyReason({
    itemsCount: items.length,
    fetchedCount: comments.length,
    dedupedCount,
    readErrorCount: readErrors.length,
    hasDbError: dbError != null,
    mediaKnown: ctx.media != null,
  });

  return {
    ok: true,
    media,
    items,
    fetchedCount: comments.length,
    dedupedCount,
    emptyReason,
    dbError: dbError ?? undefined,
    usedStoredFallback,
    readErrors: readErrors.length > 0 ? readErrors : undefined,
    truncated,
    pagesFetched,
    persistError,
    // A leitura ao vivo falhou mas usamos o que estava persistido — a UI
    // informa isso em vez de apresentar o resultado como se fosse fresco.
    error: usedStoredFallback ? liveError ?? undefined : undefined,
  };
}

// ================================================================
// NÃƒÅ¡CLEO DE ANÃƒÂLISE DE UM ÃƒÅ¡NICO COMENTÃƒÂRIO
// ================================================================
//
// `analyzeMedia()` LÃƒÂª os comentÃƒÂ¡rios da API e entÃƒÂ£o analisa cada um. O webhook
// de comentÃƒÂ¡rios do Instagram jÃƒÂ¡ RECEBE o comentÃƒÂ¡rio da Meta e nÃƒÂ£o pode chamar
// `listComments` de novo (seria uma chamada Ã¢â‚¬â€ e um rate limit Ã¢â‚¬â€ por evento).
// Por isso o corpo do laÃƒÂ§o abaixo foi extraÃƒÂ­do para cÃƒÂ¡: os DOIS caminhos usam
// exatamente a mesma classificaÃƒÂ§ÃƒÂ£o, prioridade, geraÃƒÂ§ÃƒÂ£o e regras de seguranÃƒÂ§a.
// Nada de segunda implementaÃƒÂ§ÃƒÂ£o.

/** Contexto do usuÃƒÂ¡rio usado para analisar comentÃƒÂ¡rios (lido UMA vez). */
export interface CommentAnalysisContext {
  rule: AutomationRule;
  media: EligibleMedia | undefined;
  templateInputs: TemplateInput[];
  specialInputs: SpecialProfileInput[];
  aiProfile: Awaited<ReturnType<typeof getAIProfile>>;
  profileNiche: string | null;
  profileObjective: string | null;
  aiAvailable: boolean;
  recentReplies: string[];
}

/**
 * Carrega todo o contexto necessÃƒÂ¡rio para analisar comentÃƒÂ¡rios de um usuÃƒÂ¡rio.
 * Mesmas consultas que `analyzeMedia` jÃƒÂ¡ fazia, agora em um ÃƒÂºnico lugar.
 */
export async function loadAnalysisContext(
  userId: string,
  mediaId: string
): Promise<{ ctx: CommentAnalysisContext; media: EligibleMedia | undefined }> {
  const [rule, templates, specialProfiles, aiProfile, userProfile, available, recentReplies, mediaRow] =
    await Promise.all([
      getOrCreateRule(userId),
      listTemplates(userId),
      listSpecialProfiles(userId),
      getAIProfile(userId),
      prisma.userProfile.findUnique({ where: { userId } }),
      aiConfigured(),
      recentSentReplies(userId, 10),
      findMediaByIgId(userId, mediaId),
    ]);

  const media: EligibleMedia | undefined = mediaRow
    ? {
        id: mediaRow.igMediaId,
        mediaType: mediaRow.mediaType ?? "IMAGE",
        caption: mediaRow.caption,
        thumbnailUrl: mediaRow.thumbnailUrl ?? mediaRow.mediaUrl,
        permalink: mediaRow.permalink,
        timestamp: null,
        commentsCount: mediaRow.commentsCount,
      }
    : undefined;

  const ctx: CommentAnalysisContext = {
    rule,
    media,
    templateInputs: templates.map(toTemplateInput),
    specialInputs: specialProfiles.map(toSpecialProfileInput),
    aiProfile,
    profileNiche: (userProfile as unknown as { niche: string | null } | null)?.niche ?? null,
    profileObjective: (userProfile as unknown as { objective: string | null } | null)?.objective ?? null,
    aiAvailable: available,
    recentReplies,
  };

  return { ctx, media };
}

/**
 * Analisa UM comentÃƒÂ¡rio jÃƒÂ¡ conhecido (vindo da API ou do webhook) e registra a
 * sugestÃƒÂ£o em `CommentReplyLog`. NÃƒÆ’O envia nada: o envio ÃƒÂ© sempre
 * `sendApprovedReply()`, chamado pelo ciclo de automaÃƒÂ§ÃƒÂ£o ou por aprovaÃƒÂ§ÃƒÂ£o.
 *
 * `credentials` pode ser omitido quando o leitor jÃƒÂ¡ tem a conexÃƒÂ£o carregada
 * (`analyzeMedia`); o webhook, que nÃƒÂ£o lÃƒÂª comentÃƒÂ¡rios, passa `null` e a funÃƒÂ§ÃƒÂ£o
 * carrega a conexÃƒÂ£o — ÃƒÂ© preciso o `connectionId` para gravar o log.
 */
export async function analyzeSingleComment(input: {
  userId: string;
  mediaId: string;
  comment: EligibleComment;
  ctx: CommentAnalysisContext;
  credentials?: CommentCredentials | null;
  persist?: boolean;
}): Promise<AnalyzeResultItem> {
  const { userId, mediaId, comment, ctx } = input;
  const persist = input.persist ?? true;

  let credentials = input.credentials ?? null;
  if (!credentials) {
    // Sem conexÃƒÂ£o nÃƒÂ£o hÃƒÂ¡ como registrar a sugestÃƒÂ£o de forma ÃƒÂºtil: o log exige
    // `socialConnectionId`. Fail-closed, com o erro tipado do projeto.
    credentials = await loadCommentCredentials(userId);
  }

  const media = ctx.media;

  const classification = await classifyComment(comment.text, ctx.aiAvailable);

  const decision = resolvePriority({
    commentText: comment.text,
    commenterUsername: comment.username,
    category: classification.category,
    reviewTrigger: classification.reviewTrigger,
    specialProfiles: ctx.specialInputs,
    templates: ctx.templateInputs,
    tone: ctx.aiProfile?.voiceTone ?? null,
  });

  const generated = await generateReply({
    decision,
    commentText: comment.text,
    commenterUsername: comment.username,
    mediaCaption: media?.caption ?? null,
    mediaType: media?.mediaType ?? "IMAGE",
    aiProfile: ctx.aiProfile,
    profileNiche: ctx.profileNiche,
    profileObjective: ctx.profileObjective,
    recentReplies: ctx.recentReplies,
  });

  const autoDecision = canAutoSend({
    category: classification.category,
    text: comment.text,
    mode: ctx.rule.replyMode,
    enabled: ctx.rule.enabled,
    paused: ctx.rule.paused,
  });

  // O modo AUTO tambÃƒÂ©m ÃƒÂ© bloqueado quando o resolvedor de prioridade marca
  // revisÃƒÂ£o obrigatÃƒÂ³ria (perfil especial + conteÃƒÂºdo sensÃƒÂ­vel, por exemplo).
  const forcedReview = decision.kind === "REVIEW_ONLY" || (decision.kind === "AI" && decision.forceReview);

  const reviewReason = classification.reviewTrigger ?? (decision.kind === "REVIEW_ONLY" ? decision.reviewReason : null);

  // Estado inicial: PENDING. A anÃƒÂ¡lise NUNCA envia nada Ã¢â‚¬â€ mesmo quando o
  // comentÃƒÂ¡rio ÃƒÂ© elegÃƒÂ­vel para automaÃƒÂ§ÃƒÂ£o, ele fica aguardando o ciclo de
  // envio (aprovaÃƒÂ§ÃƒÂ£o humana ou `runAutomation`).
  let status: AnalyzeResultItem["status"] = "PENDING";
  if (classification.category === "spam") {
    // Spam nunca ÃƒÂ© respondido Ã¢â‚¬â€ registrado como nÃƒÂ£o respondido, o que jÃƒÂ¡
    // impede nova anÃƒÂ¡lise do mesmo comentÃƒÂ¡rio.
    status = "SKIPPED";
  }

  let logId: string | null = null;
  if (persist) {
    const log = await upsertLog({
      userId,
      socialConnectionId: credentials.connectionId,
      mediaId,
      commentId: comment.commentId,
      commenterUsername: comment.username,
      originalComment: comment.text,
      commentCategory: classification.category,
      generatedReply: generated.reply ?? null,
      status,
      sourceRule: decision.source,
      ruleId: ctx.rule.id,
    });
    logId = log.id;
  }

  return {
    comment,
    category: classification.category,
    decisionKind: decision.kind,
    generatedReply: generated.reply ?? null,
    status,
    reviewReason,
    reviewReasonLabel: reviewReason ? REVIEW_REASON_LABEL[reviewReason] ?? null : null,
    autoSendable: autoDecision.allowed && !forcedReview && generated.ok,
    source: decision.source,
    logId,
    error: generated.ok ? undefined : generated.reason,
  };
}

/**
 * Aprova e ENVIA uma resposta (modos MANUAL/APPROVAL, ou caminho AUTO).
 *
 * O limite ÃƒÂ© checado AQUI, imediatamente antes do envio Ã¢â‚¬â€ nunca no momento da
 * sugestÃƒÂ£o Ã¢â‚¬â€ porque o estado de uso pode ter mudado entre as duas etapas.
 */
export async function sendApprovedReply(
  userId: string,
  logId: string,
  finalReply: string,
  origin: "MANUAL" | "AUTO" = "MANUAL"
): Promise<{ ok: boolean; error?: string; code?: string; replyId?: string }> {
  const log = await findLogById(userId, logId);

  if (!log) return { ok: false, error: "Registro nÃƒÂ£o encontrado.", code: "not_found" };

  // ---- IDEMPOTÃƒÅ NCIA ----
  // JÃƒÂ¡ enviado: devolve o mesmo resultado, sem segunda chamada ÃƒÂ  API.
  if (log.status === "SENT" && log.externalReplyId) {
    return { ok: true, replyId: log.externalReplyId };
  }

  const text = finalReply.trim();
  if (!text) return { ok: false, error: "A resposta estÃƒÂ¡ vazia.", code: "empty" };

  // ---- LIMITES (reavaliados no momento do envio) ----
  const state = await loadLimitState(userId, 0);
  const limits = checkLimits(state);
  if (!limits.allowed) {
    return { ok: false, error: limits.reason ?? "Envio bloqueado pelos limites.", code: "limit" };
  }

  // ---- Para AUTO, revalida a seguranÃƒÂ§a com o texto final ----
  if (origin === "AUTO") {
    const category = (log.commentCategory ?? "outro") as CommentCategory;
    const auto = canAutoSend({
      category,
      text: log.originalComment,
      mode: state.rule.replyMode,
      enabled: state.rule.enabled,
      paused: state.rule.paused,
    });
    if (!auto.allowed) {
      return { ok: false, error: auto.reason ?? "Envio automÃƒÂ¡tico nÃƒÂ£o permitido.", code: "safety" };
    }
  }

  // ---- conexÃƒÂ£o + envio ----
  let credentials;
  try {
    credentials = await loadCommentCredentials(userId);
  } catch (err) {
    const info = err instanceof CommentCapabilityError ? err : null;
    await updateLog(userId, logId, { status: "ERROR", errorCode: info?.code ?? "no_connection" });
    return { ok: false, error: info?.message ?? "Sem conexÃƒÂ£o com o Instagram.", code: info?.code ?? "no_connection" };
  }

  try {
    const { externalReplyId } = await replyToComment(log.commentId, text, credentials);

    await updateLog(userId, logId, {
      finalReply: text,
      status: "SENT",
      externalReplyId,
      sentAt: new Date(),
      approvedAt: log.approvedAt ?? new Date(),
      sourceRule: origin,
    });

    return { ok: true, replyId: externalReplyId };
  } catch (err) {
    const info =
      err instanceof CommentCapabilityError
        ? err
        : new CommentCapabilityError("api", "NÃƒÂ£o foi possÃƒÂ­vel publicar a resposta.");

    await updateLog(userId, logId, { status: "ERROR", errorCode: info.code });

    // Pausa conforme a natureza do erro Ã¢â‚¬â€ sem laÃƒÂ§o infinito de tentativas.
    const pause = pauseForError(info.code);
    if (pause.pause) {
      await updateRule(userId, { paused: true });
    }

    return { ok: false, error: info.message, code: info.code };
  }
}

/**
 * Caminho AUTOMÃƒÂTICO Ã¢â‚¬â€ envia, sem humano, apenas os comentÃƒÂ¡rios que passaram
 * por TODAS as travas. Ordem de verificaÃƒÂ§ÃƒÂ£o: modo Ã¢â€ â€™ regra Ã¢â€ â€™ limites Ã¢â€ â€™
 * seguranÃƒÂ§a Ã¢â€ â€™ idempotÃƒÂªncia Ã¢â€ â€™ envio.
 *
 * Devolve quantos foram enviados e por que os demais ficaram pendentes.
 */
export async function runAutomation(
  userId: string,
  mediaIds: string[]
): Promise<{
  ok: boolean;
  sent: number;
  skipped: number;
  paused: boolean;
  reason?: string;
  code?: string;
  details: { commentId: string; status: string; reason?: string }[];
}> {
  const rule = await getOrCreateRule(userId);
  const details: { commentId: string; status: string; reason?: string }[] = [];

  if (!rule.enabled) {
    return { ok: false, sent: 0, skipped: 0, paused: rule.paused, reason: "A automaÃƒÂ§ÃƒÂ£o estÃƒÂ¡ desativada.", code: "disabled", details };
  }
  if (rule.paused) {
    return { ok: false, sent: 0, skipped: 0, paused: true, reason: "Respostas Inteligentes estÃƒÂ£o pausadas.", code: "paused", details };
  }

  let sent = 0;
  let skipped = 0;
  let sentThisRun = 0;

  for (const mediaId of mediaIds.slice(0, 5)) {
    const analysis = await analyzeMedia(userId, mediaId, { onlyUnanswered: true, persist: true });

    if (!analysis.ok) {
      // Falha de capacidade/conexÃƒÂ£o: interrompe a execuÃƒÂ§ÃƒÂ£o inteira Ã¢â‚¬â€ insistir
      // nas demais publicaÃƒÂ§ÃƒÂµes sÃƒÂ³ multiplicaria o mesmo erro.
      return { ok: false, sent, skipped, paused: true, reason: analysis.error, code: analysis.code, details };
    }

    for (const item of analysis.items) {
      if (!item.autoSendable || !item.logId) {
        skipped++;
        details.push({ commentId: item.comment.commentId, status: "SKIPPED", reason: item.reviewReasonLabel ?? item.error });
        continue;
      }

      // Estados atualizados a cada envio: o limite ÃƒÂ© global, nÃƒÂ£o por publicaÃƒÂ§ÃƒÂ£o.
      const state = await loadLimitState(userId, sentThisRun);
      const limits = checkLimits(state);
      if (!limits.allowed) {
        return {
          ok: true,
          sent,
          skipped,
          paused: state.rule.paused,
          reason: limits.reason,
          code: "limit",
          details,
        };
      }

      const result = await sendApprovedReply(userId, item.logId, item.generatedReply ?? "", "AUTO");
      if (result.ok) {
        sent++;
        sentThisRun++;
        details.push({ commentId: item.comment.commentId, status: "SENT" });
      } else {
        skipped++;
        details.push({ commentId: item.comment.commentId, status: "ERROR", reason: result.error });

        // Erro fatal de conexÃƒÂ£o/capacidade encerra o ciclo na hora.
        if (result.code === "not_connected" || result.code === "capability" || result.code === "rate_limit") {
          return { ok: false, sent, skipped, paused: true, reason: result.error, code: result.code, details };
        }
      }
    }
  }

  return { ok: true, sent, skipped, paused: false, details };
}

/**
 * Detecta repetiÃƒÂ§ÃƒÂ£o nas sugestÃƒÂµes de uma mesma leva e regenera as duplicadas.
 * Ãƒâ€° o tratamento do caso "10 comentÃƒÂ¡rios dizendo 'linda'".
 */
export function markRepetitions(replies: string[]): boolean[] {
  const seen: string[] = [];
  const flags: boolean[] = [];
  for (const reply of replies) {
    const duplicated = seen.some((prev) => isTooSimilar(prev, reply));
    flags.push(duplicated);
    seen.push(reply);
  }
  return flags;
}


