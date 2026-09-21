import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getWebhookAppSecret } from "@/lib/integrations/instagram/client";
import { verifyWebhookSignature } from "@/lib/webhooks/signature";
import {
  isOwnAccountComment,
  parseInstagramCommentWebhook,
  type IgWebhookComment,
} from "@/lib/webhooks/instagram-comments";
import {
  analyzeSingleComment,
  loadAnalysisContext,
  sendApprovedReply,
} from "@/lib/comment-replies/engine";
import { isWithinRuleTarget } from "@/lib/comment-replies/target-scope";
import { CommentCapabilityError } from "@/lib/comment-replies/instagram-comments";

/**
 * WEBHOOK REAL DE COMENTÁRIOS DO INSTAGRAM (Meta)
 * ===============================================
 *
 * GET  → verificação do callback: a Meta chama com
 *        `hub.mode=subscribe`, `hub.verify_token` e `hub.challenge`.
 *        FAIL-CLOSED: sem `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` configurado,
 *        NÃO aceitamos challenge nenhum (antes, um token vazio fazia um
 *        `hub.verify_token` vazio passar).
 *
 * POST → eventos assinados. ORDEM OBRIGATÓRIA:
 *        1. ler o corpo BRUTO (sem parsear);
 *        2. ler `x-hub-signature-256`;
 *        3. obter o App Secret com `getWebhookAppSecret()`
 *           (INSTAGRAM_APP_SECRET → META_APP_SECRET);
 *        4. sem App Secret → FAIL-CLOSED (não processa);
 *        5. validar `verifyWebhookSignature(rawBody, assinatura, secret)`;
 *        6. assinatura ausente/inválida → rejeitar (403);
 *        7. SÓ DEPOIS `JSON.parse` do corpo.
 *
 * O que este endpoint NÃO faz:
 *  - não responde comentário diretamente (o envio é sempre
 *    `sendApprovedReply()`, que revalida limites, segurança e conexão);
 *  - não chama `runAutomation()` nem `listComments()` — o comentário já veio
 *    no evento, então nem existe releitura da API por evento;
 *  - não inventa identificador (sem o ID real do comentário, o evento é
 *    descartado em vez de ganhar um ID artificial);
 *  - não grava nada sob um usuário desconhecido: `userId` "unknown" nunca é
 *    usado para persistir;
 *  - não registra assinatura, App Secret, token ou corpo completo em log.
 *
 * Todas as mensagens de log são sanitizadas: contagens, campo do evento,
 * resultado e IDs externos não secretos.
 */

// Nunca cachear: cada entrega da Meta é avaliada na hora.
export const dynamic = "force-dynamic";

// Lido por requisição (e não no escopo do módulo): em serverless, o valor do
// ambiente pode não existir no momento em que o bundle é avaliado.
function configuredVerifyToken(): string {
  return (process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "").trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = (url.searchParams.get("hub.verify_token") ?? "").trim();
  const challenge = url.searchParams.get("hub.challenge");

  const expected = configuredVerifyToken();

  // FAIL-CLOSED: sem token configurado não há como provar que a chamada é da
  // Meta. Antes, com o env ausente, `token === ""` podia casar com um
  // `hub.verify_token` vazio e liberar o challenge.
  if (!expected) {
    console.error(
      "[instagram-webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN não configurado — challenge recusado"
    );
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  if (mode === "subscribe" && token && token === expected && challenge) {
    // O token NUNCA é logado — só o fato de a verificação ter passado.
    console.info("[instagram-webhook] challenge verificado pela Meta");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    `[instagram-webhook] challenge recusado (mode=${mode ?? "ausente"}, token=${
      token ? "não confere" : "ausente"
    }, challenge=${challenge ? "presente" : "ausente"})`
  );
  return new NextResponse("Verificação falhou", { status: 403 });
}

export async function POST(request: Request) {
  // ---- 1. corpo BRUTO (antes de qualquer parse) ----
  const rawBody = await request.text();

  // ---- 2. assinatura ----
  const signature = request.headers.get("x-hub-signature-256");

  // ---- 3 e 4. App Secret — FAIL-CLOSED quando ausente ----
  const appSecret = getWebhookAppSecret();
  if (!appSecret) {
    // Sem secret não é possível provar a origem: nada é processado.
    console.error(
      "[instagram-webhook] App Secret não configurado (INSTAGRAM_APP_SECRET/META_APP_SECRET) — evento recusado"
    );
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  // ---- 5 e 6. validação da assinatura ----
  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    // Nunca logamos a assinatura recebida nem a esperada — só o veredito.
    console.warn(`[instagram-webhook] assinatura ${signature ? "inválida" : "ausente"} — evento recusado`);
    return new NextResponse("Assinatura inválida", { status: 403 });
  }

  // ---- 7. só agora o corpo é interpretado ----
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  // Estrutura inesperada é erro de payload (400) — diferente de um evento
  // válido que simplesmente não tem o que processar (200, abaixo).
  if (body.object !== "instagram" || !Array.isArray(body.entry)) {
    console.warn("[instagram-webhook] payload fora do formato esperado — evento recusado");
    return new NextResponse("Payload inválido", { status: 400 });
  }

  try {
    const result = await processInstagramComments(body);
    console.info(
      `[instagram-webhook] entrega processada: entries=${result.entriesSeen} changes=${result.changesSeen} ` +
        `campos=${result.fieldsSeen.join(",") || "nenhum"} comentarios=${result.commentsSeen} ` +
        `processados=${result.processed} ignorados=${result.skipped} duplicados=${result.duplicate} erros=${result.errors}`
    );
    // SEMPRE 200 depois de um evento válido: um 5xx faria a Meta reentregar o
    // mesmo evento em loop, sem resolver nada (mídia ainda não sincronizada,
    // conta não mapeada, evento desconhecido). `received: true` já vem no
    // próprio resultado da entrega.
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (err) {
    // Falha inesperada NOSSA (banco fora, por exemplo): 500 para a Meta
    // reentregar — mas sem stack trace e sem corpo sensível.
    const name = err instanceof Error ? err.name : "desconhecido";
    console.error(`[instagram-webhook] falha ao processar entrega (${name})`);
    return new NextResponse("Falha ao processar o evento", { status: 500 });
  }
}

// ================================================================
// PROCESSAMENTO
// ================================================================

interface DeliveryResult {
  entriesSeen: number;
  changesSeen: number;
  fieldsSeen: string[];
  /** Comentários válidos que a Meta entregou. */
  commentsSeen: number;
  /** Comentários persistidos (novos ou atualizados). */
  processed: number;
  /** Eventos válidos que não geraram ação — com o motivo no log. */
  skipped: number;
  /** Comentários que já tinham registro anterior. */
  duplicate: number;
  /** Comentários próprios (não geram resposta). */
  own: number;
  /** Comentários automáticos efetivamente enviados. */
  sent: number;
  errors: number;
}

async function processInstagramComments(body: Record<string, unknown>): Promise<DeliveryResult> {
  const parsed = parseInstagramCommentWebhook(body);

  const result: DeliveryResult = {
    entriesSeen: parsed.entriesSeen,
    changesSeen: parsed.changesSeen,
    fieldsSeen: parsed.fieldsSeen,
    commentsSeen: parsed.comments.length,
    processed: 0,
    skipped: 0,
    duplicate: 0,
    own: 0,
    sent: 0,
    errors: 0,
  };

  for (const comment of parsed.comments) {
    try {
      const outcome = await processOneComment(comment);
      switch (outcome) {
        case "processed":
          result.processed++;
          break;
        case "sent":
          result.processed++;
          result.sent++;
          break;
        case "own":
          result.processed++;
          result.own++;
          break;
        case "duplicate":
          result.duplicate++;
          break;
        default:
          result.skipped++;
          break;
      }
    } catch (err) {
      // Um comentário problemático não pode derrubar os outros da entrega.
      result.errors++;
      const name = err instanceof Error ? err.name : "desconhecido";
      const code = err instanceof CommentCapabilityError ? err.code : null;
      console.error(
        `[instagram-webhook] comentário ${comment.igCommentId} não processado (${name}${
          code ? `/${code}` : ""
        })`
      );
    }
  }

  return result;
}

type CommentOutcome = "processed" | "sent" | "own" | "duplicate" | "skipped";

async function processOneComment(comment: IgWebhookComment): Promise<CommentOutcome> {
  // ---- quem é o dono da publicação ----
  const target = await resolveTarget(comment);
  if (!target) {
    // Evento válido, porém sem como ser atribuído a um usuário real: não
    // gravamos nada e não respondemos nada. Motivo no log (sanitizado).
    console.warn(
      `[instagram-webhook] comentário ${comment.igCommentId} sem destino seguro ` +
        `(conta=${comment.accountId ?? "ausente"} mídia=${comment.igMediaId ?? "ausente"}) — ignorado`
    );
    return "skipped";
  }

  // ---- isOwn pela MESMA regra do sync (username comparado sem casing) ----
  // Reforço determinístico: quando a Meta manda o `from.id` do autor e ele é o
  // ID da própria conta conectada, é comentário nosso — mesmo que o username
  // venha ausente ou diferente. Importa para não entrar no loop
  // comentário → webhook → resposta → webhook.
  const isOwn =
    isOwnAccountComment(comment.username, target.ownUsername) ||
    (comment.authorId !== null && comment.authorId === target.ownAccountId);

  // ---- persistência do comentário real (idempotente por igCommentId) ----
  await prisma.instagramComment.upsert({
    where: { igCommentId: comment.igCommentId },
    create: {
      userId: target.userId,
      mediaId: target.mediaRowId,
      igCommentId: comment.igCommentId,
      authorUsername: comment.username,
      authorId: comment.authorId,
      text: comment.text,
      timestamp: comment.createdAt,
      isOwn,
      // O webhook não informa a contagem de respostas: ausência vira null,
      // nunca um zero inventado.
      repliesCount: null,
      syncedAt: new Date(),
    },
    update: {
      authorUsername: comment.username,
      authorId: comment.authorId,
      text: comment.text,
      timestamp: comment.createdAt,
      isOwn,
      syncedAt: new Date(),
    },
  });
  // Nota: `mediaId`/`userId` não entram no `update` de propósito — o registro
  // já pertence a uma publicação e a um dono, e sobrescrever isso numa
  // reentrega só abriria espaço para inconsistência.

  // ---- comentário da própria conta: nunca responde ----
  // (o loop comentário → webhook → resposta → webhook seria infinito)
  if (isOwn) return "own";

  // `resolveTarget` já exige `igMediaId`; esta linha estreita o tipo daqui
  // para baixo (e mantém a garantia explícita: sem mídia, sem análise).
  const igMediaId = comment.igMediaId;
  if (!igMediaId) return "skipped";

  // ---- já existe registro? não regenera nem reenvia ----
  const existing = await prisma.commentReplyLog.findUnique({
    where: { mediaId_commentId: { mediaId: igMediaId, commentId: comment.igCommentId } },
  });
  if (existing && existing.status !== "ERROR") {
    // Cobre SENT (não reenvia), PENDING/APPROVED (já aguarda decisão humana,
    // não duplica a análise) e SKIPPED (spam já descartado).
    return existing.status === "SENT" ? "duplicate" : "skipped";
  }

  // ---- análise pelo MESMO motor da tela de Respostas Inteligentes ----
  const { ctx, media } = await loadAnalysisContext(target.userId, igMediaId);

  const item = await analyzeSingleComment({
    userId: target.userId,
    mediaId: igMediaId,
    comment: {
      commentId: comment.igCommentId,
      mediaId: igMediaId,
      // `username` vazio é o mesmo contrato de `listComments` (ausente → "").
      username: comment.username ?? "",
      text: comment.text ?? "",
      timestamp: comment.createdAt ? comment.createdAt.toISOString() : null,
    },
    ctx,
    // O webhook não lê comentários: a conexão é carregada aqui dentro, só
    // porque o log precisa do `socialConnectionId`.
    credentials: null,
    persist: true,
  });

  // ---- modo MANUAL/APPROVAL: a sugestão fica registrada, sem envio ----
  const mode = ctx.rule.replyMode;
  if (mode !== "AUTO") return "processed";

  // ---- modo AUTO: todas as travas precisam permitir ----
  if (!item.autoSendable || !item.logId) return "processed";
  if (!item.generatedReply) return "processed";
  if (!ctx.rule.enabled || ctx.rule.paused) return "processed";

  // ---- escopo da regra (targetType/mediaId) — fail-closed ----
  // Sem `InstagramMedia` correspondente, os alvos por formato não são
  // verificáveis: `target-scope` devolve `false` e o envio não acontece.
  if (
    !withinTarget(ctx.rule, igMediaId, {
      mediaType: media?.mediaType ?? null,
      mediaProductType: media?.mediaProductType ?? null,
    })
  ) {
    console.warn(
      `[instagram-webhook] comentário ${comment.igCommentId} fora do alvo da regra ` +
        `(target=${ctx.rule.targetType}) — análise registrada, envio automático bloqueado`
    );
    return "processed";
  }

  // O envio NUNCA acontece aqui: `sendApprovedReply` revalida idempotência,
  // limites, segurança, conexão e trata erro/pausa.
  const sent = await sendApprovedReply(target.userId, item.logId, item.generatedReply, "AUTO");
  if (sent.ok) return "sent";

  if (!sent.ok) {
    console.warn(
      `[instagram-webhook] envio automático não realizado no comentário ${comment.igCommentId} (${sent.code ?? "erro"})`
    );
  }
  return "processed";
}

/**
 * Descobre a qual usuário do Inst Acessor o evento pertence.
 *
 * Duas âncoras, nenhuma delas inventada:
 *
 *  1. `InstagramProfile.igAccountId` / `SocialConnection.externalAccountId`
 *     iguais a `entry.id` — o ID da conta do Instagram que a Meta manda é o
 *     MESMO identificador já guardado nesses campos (é de lá que
 *     `loadCommentCredentials` lê o `igUserId`). Usamos a linha encontrada
 *     apenas para obter o `userId` real; não adivinhamos ID nenhum.
 *  2. `InstagramMedia.igMediaId` igual ao `value.media.id` do evento — a
 *     publicação sincronizada já carrega `userId` e o `mediaId` interno.
 *
 * Se as duas âncoras existirem e discordarem, o evento é recusado
 * (fail-closed) em vez de escolher uma delas no chute.
 */
async function resolveTarget(
  comment: IgWebhookComment
): Promise<{
  userId: string;
  mediaRowId: string;
  ownUsername: string | null;
  ownAccountId: string | null;
} | null> {
  // ---- âncora 3: pelo próprio COMENTÁRIO ----
  // `InstagramComment` é @unique em `igCommentId` e já guarda `userId` +
  // `mediaId` interno. Se este comentário já foi persistido (reentrega da
  // Meta, ou leitura anterior pelo sync), não precisamos procurar mais nada.
  let commentRow: { userId: string; mediaId: string } | null = null;
  try {
    commentRow = await prisma.instagramComment.findUnique({
      where: { igCommentId: comment.igCommentId },
      select: { userId: true, mediaId: true },
    });
  } catch {
    // Falha ao consultar não é motivo para inventar destino: segue para as
    // outras âncoras e, se nenhuma resolver, o evento é ignorado.
    commentRow = null;
  }

  const anchor = comment.accountId ? await findByAccountId(comment.accountId) : null;

  if (!comment.igMediaId) {
    // Sem `value.media.id` no evento, a única forma de resolver é o próprio
    // comentário já conhecido (ex.: `live_comments`, onde a Meta não manda a
    // publicação). Sem isso, não há `mediaId` — e não inventamos um.
    if (!commentRow) return null;
    return {
      userId: commentRow.userId,
      mediaRowId: commentRow.mediaId,
      ownUsername: anchor?.ownUsername ?? null,
      ownAccountId: anchor?.ownAccountId ?? null,
    };
  }

  const mediaRow = await prisma.instagramMedia.findUnique({
    where: { igMediaId: comment.igMediaId },
    select: { id: true, userId: true, profile: { select: { username: true } } },
  });

  if (!mediaRow) return null;

  if (anchor && anchor.userId !== mediaRow.userId) {
    console.warn(
      `[instagram-webhook] âncoras divergentes para o comentário ${comment.igCommentId} — evento ignorado`
    );
    return null;
  }

  return {
    userId: mediaRow.userId,
    mediaRowId: mediaRow.id,
    ownUsername: anchor?.ownUsername ?? mediaRow.profile?.username ?? null,
    ownAccountId: anchor?.ownAccountId ?? null,
  };
}

/**
 * Procura a conexão do Instagram cujo identificador externo é o `entry.id`
 * da Meta. Lê o `userId` da PRÓPRIA linha encontrada.
 */
async function findByAccountId(
  accountId: string
): Promise<{ userId: string; ownUsername: string | null; ownAccountId: string | null } | null> {
  const connection = await prisma.socialConnection.findFirst({
    where: {
      platform: "instagram",
      OR: [{ externalAccountId: accountId }, { igProfiles: { igAccountId: accountId } }],
    },
    select: {
      userId: true,
      username: true,
      externalAccountId: true,
      igProfiles: { select: { username: true, igAccountId: true } },
    },
  });

  if (!connection) return null;

  return {
    userId: connection.userId,
    ownUsername: connection.igProfiles?.username ?? connection.username ?? null,
    // O identificador da própria conta: comparado com `from.id` do autor para
    // reconhecer comentário nosso com certeza.
    ownAccountId: connection.igProfiles?.igAccountId ?? connection.externalAccountId ?? null,
  };
}

/**
 * O comentário cai dentro do alvo configurado na regra?
 * A regra em si (incluindo o comportamento fail-closed) vive em
 * `target-scope.ts` — núcleo puro e testável; aqui só passamos os dados reais.
 *
 * Os dois campos de mídia são normalizados para `string | null` (o
 * `EligibleMedia` marca `mediaProductType` como opcional).
 */
function withinTarget(
  rule: { targetType: string; mediaId: string | null },
  igMediaId: string,
  media: { mediaType: string | null; mediaProductType: string | null }
): boolean {
  return isWithinRuleTarget(rule, { igMediaId, media });
}
