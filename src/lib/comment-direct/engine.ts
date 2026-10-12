import { matchesTrigger, SKIP_REASONS, type SkipReason } from "./triggers";
import { recordUsage } from "@/lib/billing/usage/meter";
import {
  activeRulesForMedia,
  alreadyMessagedUser,
  countDirectSentSince,
  findDirectLog,
  upsertDirectLog,
  type DirectRuleRow,
} from "./db";
import {
  loadDirectCredentials,
  sendPrivateReply,
  DirectCapabilityError,
  type DirectCredentials,
} from "./instagram-direct";

/**
 * MOTOR — COMENTÁRIO → DIRECT (mensagem privada)
 * ==============================================
 * Liga o núcleo PURO de decisão (`matchesTrigger`) a um caminho de envio REAL,
 * guardado por permissão, idempotência, limites e onePerUser.
 *
 *   comentário → resolve regras ativas → `matchesTrigger` → idempotência →
 *   onePerUser → limite diário → permissão → ENVIA → registra com o resultado
 *
 * REGRA DE OURO: um evento de webhook NÃO é prova de nada por si só. O envio só
 * acontece depois de TODAS as etapas. Falhando qualquer uma, NADA é enviado e o
 * MOTIVO fica registrado em `CommentDirectLog.reason`.
 *
 * FAIL-CLOSED: gatilho não casa, já existe registro, pessoa já recebeu, limite
 * atingido, permissão ausente → registra SKIPPED/BLOCKED e retorna.
 *
 * Este motor é usado pelo webhook (evento real). NÃO é chamado pelo caminho de
 * leitura manual — para SIMULAR sem enviar existe `simulateTrigger`.
 */

export interface EvaluateInput {
  userId: string;
  socialConnectionId: string;
  igMediaId: string;
  commentId: string;
  commenterId: string | null;
  commenterUsername: string | null;
  commentText: string | null;
  /** Credenciais já carregadas; quando ausentes, o motor carrega. */
  credentials?: DirectCredentials | null;
  /** Quando true, apenas avalia e registra — nunca envia (modo teste/manual). */
  dryRun?: boolean;
}

export interface EvaluateOutcome {
  /** E-mail de auditoria: qual regra agiu e o que aconteceu. */
  ruleId: string | null;
  status: "SENT" | "SKIPPED" | "BLOCKED" | "DUPLICATE" | "ERROR" | "NO_RULE";
  /** Motivo legível (o mesmo texto que aparece no histórico). */
  reason: string | null;
  matchedTrigger: string | null;
  externalMessageId: string | null;
}

function skipped(reason: SkipReason, rule: DirectRuleRow | null, matched: string | null): EvaluateOutcome {
  return { ruleId: rule?.id ?? null, status: "SKIPPED", reason: SKIP_REASONS[reason], matchedTrigger: matched, externalMessageId: null };
}

/**
 * Avalia um comentário contra TODAS as regras ativas do usuário para a mídia e,
 * para a PRIMEIRA que casar e passar em todas as travas, envia a mensagem.
 *
 * Enviar por UMA regra é decisão desenhada: a pessoa já interagiu uma vez; duas
 * mensagens privadas automáticas para o MESMO comentário pareceria spam (e é o
 * que a política da Meta desencoraja).
 *
 * ORDEM CORRETA: primeiro a IDEMPOTÊNCIA (um registro existente encerra tudo) e
 * o casamento de TODAS as regras; só DEPOIS de nenhuma casar é que se grava um
 * `TRIGGER_NOT_MATCHED`. Gravar o "não casou" no meio do laço envenenaria a
 * idempotência e impediria uma regra seguinte de casar o mesmo comentário.
 */
export async function evaluateComment(input: EvaluateInput): Promise<EvaluateOutcome> {
  // ---- IDEMPOTÊNCIA, ANTES DE QUALQUER COISA ----
  // Um único registro por (mediaId, commentId) governa tudo: se já existe, o
  // comentário já foi avaliado (enviado, ignorado ou simulado) e não se reavalia.
  const existing = await findDirectLog(input.igMediaId, input.commentId);
  if (existing) {
    return {
      ruleId: existing.ruleId,
      status: existing.status === "SENT" ? "DUPLICATE" : "SKIPPED",
      reason:
        existing.status === "SENT"
          ? SKIP_REASONS.DUPLICATE
          : existing.reason ?? SKIP_REASONS.DUPLICATE,
      matchedTrigger: existing.matchedTrigger,
      externalMessageId: existing.externalMessageId,
    };
  }

  const rules = await activeRulesForMedia(input.userId, input.igMediaId);
  if (rules.length === 0) {
    return { ruleId: null, status: "NO_RULE", reason: null, matchedTrigger: null, externalMessageId: null };
  }

  const commentText = input.commentText ?? "";

  // Credenciais só são carregadas quando alguma regra casa — evita uma leitura
  // de conexão por evento irrelevante.
  let credentials: DirectCredentials | null = input.credentials ?? null;

  // A PRIMEIRA regra que casar é a que age; as demais não são avaliadas.
  const rule = rules.find((r) => matchesTrigger(r.triggerType, r.triggerTerms, commentText).matched);

  if (!rule) {
    // Nenhuma regra casou: grava UM registro auditável e encerra, sem enviar.
    await upsertDirectLog({
      userId: input.userId,
      socialConnectionId: input.socialConnectionId,
      ruleId: rules[0]?.id ?? null,
      mediaId: input.igMediaId,
      commentId: input.commentId,
      commenterId: input.commenterId,
      commenterUsername: input.commenterUsername,
      originalComment: commentText,
      matchedTrigger: null,
      status: "SKIPPED",
      reason: SKIP_REASONS.TRIGGER_NOT_MATCHED,
    });
    return skipped("TRIGGER_NOT_MATCHED", rules[0] ?? null, null);
  }

  const match = matchesTrigger(rule.triggerType, rule.triggerTerms, commentText);

  {

    // ---- onePerUser: esta pessoa já recebeu desta regra? ----
    if (rule.onePerUser) {
      const already = await alreadyMessagedUser(
        input.userId,
        rule.id,
        input.commenterId,
        input.commenterUsername
      );
      if (already) {
        await upsertDirectLog({
          userId: input.userId,
          socialConnectionId: input.socialConnectionId,
          ruleId: rule.id,
          mediaId: input.igMediaId,
          commentId: input.commentId,
          commenterId: input.commenterId,
          commenterUsername: input.commenterUsername,
          originalComment: commentText,
          matchedTrigger: match.matchedTerm,
          status: "SKIPPED",
          reason: SKIP_REASONS.ALREADY_MESSAGED_USER,
        });
        return {
          ruleId: rule.id,
          status: "SKIPPED",
          reason: SKIP_REASONS.ALREADY_MESSAGED_USER,
          matchedTrigger: match.matchedTerm,
          externalMessageId: null,
        };
      }
    }

    // ---- limite diário POR REGRA ----
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await countDirectSentSince(input.userId, rule.id, since);
    if (sentToday >= rule.dailyLimit) {
      await upsertDirectLog({
        userId: input.userId,
        socialConnectionId: input.socialConnectionId,
        ruleId: rule.id,
        mediaId: input.igMediaId,
        commentId: input.commentId,
        commenterId: input.commenterId,
        commenterUsername: input.commenterUsername,
        originalComment: commentText,
        matchedTrigger: match.matchedTerm,
        status: "SKIPPED",
        reason: SKIP_REASONS.DAILY_LIMIT,
      });
      return {
        ruleId: rule.id,
        status: "SKIPPED",
        reason: SKIP_REASONS.DAILY_LIMIT,
        matchedTrigger: match.matchedTerm,
        externalMessageId: null,
      };
    }

    // ---- modo DRY-RUN: registra a decisão sem enviar ----
    if (input.dryRun) {
      await upsertDirectLog({
        userId: input.userId,
        socialConnectionId: input.socialConnectionId,
        ruleId: rule.id,
        mediaId: input.igMediaId,
        commentId: input.commentId,
        commenterId: input.commenterId,
        commenterUsername: input.commenterUsername,
        originalComment: commentText,
        matchedTrigger: match.matchedTerm,
        sentMessage: rule.messageText,
        status: "PENDING",
        reason: "Simulação — nenhuma mensagem foi enviada.",
      });
      return {
        ruleId: rule.id,
        status: "SKIPPED",
        reason: "Simulação — nenhuma mensagem foi enviada.",
        matchedTrigger: match.matchedTerm,
        externalMessageId: null,
      };
    }

    // ---- credenciais + permissão ----
    if (!credentials) {
      try {
        credentials = await loadDirectCredentials(input.userId);
      } catch (err) {
        const info = err instanceof DirectCapabilityError ? err : null;
        await upsertDirectLog({
          userId: input.userId,
          socialConnectionId: input.socialConnectionId,
          ruleId: rule.id,
          mediaId: input.igMediaId,
          commentId: input.commentId,
          commenterId: input.commenterId,
          commenterUsername: input.commenterUsername,
          originalComment: commentText,
          matchedTrigger: match.matchedTerm,
          status: "BLOCKED",
          reason: SKIP_REASONS.NOT_CONNECTED,
          errorCode: info?.code ?? "no_connection",
        });
        return {
          ruleId: rule.id,
          status: "BLOCKED",
          reason: SKIP_REASONS.NOT_CONNECTED,
          matchedTrigger: match.matchedTerm,
          externalMessageId: null,
        };
      }
    }

    // Registra PENDING ANTES do envio: garante a idempotência mesmo com
    // reentrega concorrente do webhook (a unique barra a corrida).
    const logBase = {
      userId: input.userId,
      socialConnectionId: input.socialConnectionId,
      ruleId: rule.id,
      mediaId: input.igMediaId,
      commentId: input.commentId,
      commenterId: input.commenterId,
      commenterUsername: input.commenterUsername,
      originalComment: commentText,
      matchedTrigger: match.matchedTerm,
      sentMessage: rule.messageText,
    };
    const log = await upsertDirectLog({ ...logBase, status: "PENDING" });
    if (log.status === "SENT") {
      return {
        ruleId: rule.id,
        status: "DUPLICATE",
        reason: SKIP_REASONS.DUPLICATE,
        matchedTrigger: log.matchedTrigger,
        externalMessageId: log.externalMessageId,
      };
    }

    // ---- ENVIO ----
    try {
      const { externalMessageId } = await sendPrivateReply(
        credentials,
        input.commentId,
        rule.messageText
      );
      await upsertDirectLog({
        ...logBase,
        status: "SENT",
        externalMessageId,
        sentAt: new Date(),
      });

      // MEDIÇÃO de `auto_reply` — a mensagem privada é uma resposta automática.
      // Registrada SÓ após o envio confirmado pela Meta. A idempotência do envio
      // é do `CommentDirectLog` (`@@unique([mediaId, commentId])`), por isso não
      // passamos chave aqui. `recordUsage` nunca lança.
      await recordUsage({
        userId: input.userId,
        feature: "auto_reply",
        origin: "direct",
      });

      return {
        ruleId: rule.id,
        status: "SENT",
        reason: null,
        matchedTrigger: match.matchedTerm,
        externalMessageId,
      };
    } catch (err) {
      const info =
        err instanceof DirectCapabilityError
          ? err
          : new DirectCapabilityError("api", "Não foi possível enviar a mensagem privada.");
      const blocked = info.code === "capability" || info.code === "not_connected" || info.code === "no_connection";
      await upsertDirectLog({
        ...logBase,
        status: blocked ? "BLOCKED" : "ERROR",
        reason: blocked
          ? info.code === "capability"
            ? SKIP_REASONS.MISSING_PERMISSION
            : SKIP_REASONS.NOT_CONNECTED
          : info.message,
        errorCode: info.code,
      });
      return {
        ruleId: rule.id,
        status: blocked ? "BLOCKED" : "ERROR",
        reason: info.message,
        matchedTrigger: match.matchedTerm,
        externalMessageId: null,
      };
    }
  }

  // Inalcançável: todas as ramificações acima retornam. Existe para o tipo de
  // retorno ser total e para não depender de um estado "último resultado".
  return {
    ruleId: rules[0]?.id ?? null,
    status: "ERROR",
    reason: "Fluxo de avaliação inesperado.",
    matchedTrigger: null,
    externalMessageId: null,
  };
}

/**
 * SIMULAÇÃO — casa um texto contra as regras SEM tocar a rede e SEM gravar.
 * É o que a tela usa no botão "Testar gatilho": mostra o que ACONTECERIA.
 */
export interface SimulationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  matchedTerm: string | null;
  wouldSendMessage: string | null;
}

export async function simulateTrigger(
  userId: string,
  mediaId: string | null,
  text: string
): Promise<SimulationResult[]> {
  const rules = mediaId
    ? await activeRulesForMedia(userId, mediaId)
    : await (await import("./db")).listDirectRules(userId);

  return rules.map((rule) => {
    const match = matchesTrigger(rule.triggerType, rule.triggerTerms, text);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: match.matched,
      matchedTerm: match.matchedTerm,
      wouldSendMessage: match.matched ? rule.messageText : null,
    };
  });
}
