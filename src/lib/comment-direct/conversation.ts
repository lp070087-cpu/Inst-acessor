import { getAIProvider } from "@/lib/ai";
import { getAIProfile } from "@/lib/ai/services/profile";
import { prisma } from "@/lib/db";
import { normalizeText } from "./triggers";
import {
  loadDirectCredentials,
  listConversations,
  listMessages,
  sendDirectText,
  DirectCapabilityError,
  type DirectCredentials,
} from "./instagram-direct";
import { canManageMessages } from "./permissions";
import {
  findConversation,
  listConversationsForUser,
  listFaqs,
  listMessagesForConversation,
  logAgentAction,
  upsertConversation,
  upsertDirectMessage,
  type DirectConversationRow,
} from "./db";

/**
 * CENTRAL DE DM — SERVIÇO DE CONVERSAS
 * ====================================
 * Orquestra a leitura REAL das conversas (endpoints oficiais), a persistência
 * local (referência, não cópia) e o ENVIO MANUAL de uma resposta.
 *
 * Toda função de leitura devolve dados vazios quando a permissão não foi
 * concedida — nunca uma thread fabricada. O envio só acontece com:
 *   1. permissão concedida (escopo persistido);
 *   2. conversa pertencente ao usuário;
 *   3. texto não vazio;
 *   4. dentro da janela de 24h da Meta (senão `window_closed`, sem insistir).
 */

export interface ConversationView {
  id: string;
  igConversationId: string;
  participantId: string | null;
  participantUsername: string | null;
  participantName: string | null;
  lastMessageAt: string | null;
  unreadCount: number | null;
  lastMessagePreview: string | null;
  windowOpen: boolean | null;
}

export interface MessageView {
  id: string;
  direction: string;
  text: string | null;
  attachmentType: string | null;
  sentAt: string | null;
  fromUs: boolean;
}

function toConversationView(row: DirectConversationRow): ConversationView {
  return {
    id: row.id,
    igConversationId: row.igConversationId,
    participantId: row.participantId,
    participantUsername: row.participantUsername,
    participantName: row.participantName,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    unreadCount: row.unreadCount,
    lastMessagePreview: row.lastMessagePreview,
    windowOpen: row.windowOpen,
  };
}

export interface SyncResult {
  ok: boolean;
  /** Código tipado quando a leitura falhou (`capability` = permissão pendente). */
  code?: string;
  error?: string;
  /** Permissão de mensagens concedida? Determina o estado da UI. */
  permissionGranted: boolean;
  conversations: ConversationView[];
  /** `true` quando não havia conexão — a UI mostra CTA de Redes Sociais. */
  notConnected: boolean;
}

/**
 * Sincroniza as conversas REAIS da conta e persiste as referências.
 *
 * NUNCA lança por falta de dado: só devolve `ok:false` com o código tipado. A
 * permissão pendente é o caso ESPERADO hoje (App Review), então é tratado como
 * um estado normal, não como erro de rede.
 */
export async function syncConversations(userId: string): Promise<SyncResult> {
  let credentials: DirectCredentials;
  try {
    credentials = await loadDirectCredentials(userId);
  } catch (err) {
    const info = err instanceof DirectCapabilityError ? err : null;
    return {
      ok: false,
      code: info?.code ?? "no_connection",
      error: info?.message,
      permissionGranted: false,
      conversations: [],
      notConnected: info?.code === "no_connection" || info?.code === "not_connected",
    };
  }

  const permissionGranted = canManageMessages(credentials.scopes);
  if (!permissionGranted) {
    // Sem permissão não chamamos a API (evita erro cru): devolvemos o que já
    // está persistido localmente e o estado explícito de pendência.
    const stored = await listConversationsForUser(userId);
    return {
      ok: true,
      permissionGranted: false,
      conversations: stored.map(toConversationView),
      notConnected: false,
    };
  }

  try {
    const remote = await listConversations(credentials, { limit: 25 });
    const views: ConversationView[] = [];
    for (const c of remote) {
      const row = await upsertConversation(userId, credentials.connectionId, {
        igConversationId: c.igConversationId,
        participantId: c.participantId,
        participantUsername: c.participantUsername,
        participantName: null,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
        lastMessagePreview: c.lastMessagePreview,
        windowOpen: computeWindowOpen(c.lastMessageAt),
      });
      views.push(toConversationView(row));
    }
    return { ok: true, permissionGranted: true, conversations: views, notConnected: false };
  } catch (err) {
    const info =
      err instanceof DirectCapabilityError
        ? err
        : new DirectCapabilityError("api", "Não foi possível ler as conversas.");
    // Falha de leitura: devolvemos o que está persistido (não "zero conversas").
    const stored = await listConversationsForUser(userId);
    return {
      ok: false,
      code: info.code,
      error: info.message,
      permissionGranted,
      conversations: stored.map(toConversationView),
      notConnected: info.code === "not_connected" || info.code === "no_connection",
    };
  }
}

/**
 * A janela de mensagens da Meta (24h) ainda está aberta?
 *
 * A Meta só permite responder livremente dentro de 24h da última mensagem da
 * pessoa. Passado isso, é preciso uma message tag. `null` quando não sabemos o
 * horário (não inventamos "aberta").
 */
export function computeWindowOpen(lastMessageAt: Date | null): boolean | null {
  if (!lastMessageAt) return null;
  return Date.now() - lastMessageAt.getTime() < 24 * 60 * 60 * 1000;
}

/** Lê as mensagens de uma conversa do usuário (persistido, complementado remoto). */
export async function getConversationMessages(
  userId: string,
  conversationRowId: string
): Promise<{ ok: boolean; code?: string; error?: string; messages: MessageView[] }> {
  const conversation = await findConversation(userId, conversationRowId);
  if (!conversation) return { ok: false, code: "not_found", error: "Conversa não encontrada.", messages: [] };

  let credentials: DirectCredentials | null = null;
  try {
    credentials = await loadDirectCredentials(userId);
  } catch {
    credentials = null;
  }

  // Tenta complementar com a leitura oficial quando possível (best-effort);
  // em qualquer falha, o que está persistido continua sendo a resposta.
  if (credentials && canManageMessages(credentials.scopes)) {
    try {
      const remote = await listMessages(credentials, conversation.igConversationId, { limit: 50 });
      for (const m of remote) {
        await upsertDirectMessage(userId, conversation.id, {
          igMessageId: m.igMessageId,
          direction: m.direction,
          text: m.text,
          attachmentType: m.attachmentType,
          sentAt: m.sentAt,
          fromUs: m.fromUs,
        });
      }
    } catch {
      /* usa o persistido */
    }
  }

  const rows = await listMessagesForConversation(userId, conversation.id);
  return {
    ok: true,
    messages: rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      text: r.text,
      attachmentType: r.attachmentType,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      fromUs: r.fromUs,
    })),
  };
}

/**
 * ENVIO MANUAL — a resposta que o humano aprovou no painel.
 *
 * Travas, na ordem:
 *   1. conversa pertence ao usuário;
 *   2. não vazia e dentro do limite de 900 chars (validado na rota);
 *   3. permissão concedida (escopo persistido);
 *   4. `recipientId` disponível (sem IGSID não há como endereçar);
 *   5. janela de 24h — se fechada, recusa com `window_closed` (não insiste).
 *
 * Após o envio, a mensagem é persistida (idempotente por `mid` da Meta) e a
 * ação é registrada em `DirectAgentAction` para auditoria.
 */
export async function sendManualReply(
  userId: string,
  conversationRowId: string,
  text: string,
  meta: { approvedFromSuggestion: boolean; suggestion?: string | null }
): Promise<{ ok: boolean; code?: string; error?: string; messageId?: string }> {
  const conversation = await findConversation(userId, conversationRowId);
  if (!conversation) return { ok: false, code: "not_found", error: "Conversa não encontrada." };

  const body = text.trim();
  if (!body) return { ok: false, code: "empty", error: "A mensagem está vazia." };

  if (!conversation.participantId) {
    return {
      ok: false,
      code: "no_recipient",
      error: "Não temos o identificador deste contato para responder. Atualize as conversas.",
    };
  }

  let credentials: DirectCredentials;
  try {
    credentials = await loadDirectCredentials(userId);
  } catch (err) {
    const info = err instanceof DirectCapabilityError ? err : null;
    return { ok: false, code: info?.code ?? "no_connection", error: info?.message };
  }

  if (!canManageMessages(credentials.scopes)) {
    return {
      ok: false,
      code: "capability",
      error: "O Instagram ainda não liberou o envio de mensagens privadas nesta conta.",
    };
  }

  // Janela de 24h: recusa ANTES de tocar a rede (fail-closed, sem erro cru).
  const windowOpen = computeWindowOpen(conversation.lastMessageAt);
  if (windowOpen === false) {
    await logAgentAction({
      userId,
      conversationId: conversation.id,
      action: "AUTOREPLY_BLOCKED",
      finalText: body,
      reason: "window_closed",
    });
    return {
      ok: false,
      code: "window_closed",
      error: "A janela de 24 horas para responder esta conversa já fechou.",
    };
  }

  try {
    const { externalMessageId } = await sendDirectText(credentials, conversation.participantId, body);

    await upsertDirectMessage(userId, conversation.id, {
      igMessageId: externalMessageId,
      direction: "OUTBOUND",
      text: body,
      attachmentType: null,
      sentAt: new Date(),
      fromUs: true,
    });

    await logAgentAction({
      userId,
      conversationId: conversation.id,
      action: meta.approvedFromSuggestion ? "APPROVE" : "SEND_MANUAL",
      suggestion: meta.suggestion ?? null,
      finalText: body,
    });

    return { ok: true, messageId: externalMessageId };
  } catch (err) {
    const info =
      err instanceof DirectCapabilityError
        ? err
        : new DirectCapabilityError("api", "Não foi possível enviar a mensagem.");
    await logAgentAction({
      userId,
      conversationId: conversation.id,
      action: "AUTOREPLY_BLOCKED",
      finalText: body,
      reason: info.code,
    });
    return { ok: false, code: info.code, error: info.message };
  }
}

// ================================================================
// IA NAS CONVERSAS — sugestão (nunca envia)
// ================================================================

/** Quantas FAQs entram no contexto (limite defensivo de prompt). */
const FAQ_CONTEXT_LIMIT = 12;

/**
 * Escolhe a FAQ mais provável para o texto recebido, por sobreposição de
 * palavras normalizadas. Puro, determinístico, fail-closed (sem match → null).
 */
export function matchFaq(
  text: string,
  faqs: { question: string; keywords: string[]; answer: string }[]
): { question: string; answer: string } | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  for (const faq of faqs) {
    const candidates = [faq.question, ...faq.keywords];
    for (const c of candidates) {
      const term = normalizeText(c);
      if (term.length >= 2 && normalized.includes(term)) {
        return { question: faq.question, answer: faq.answer };
      }
    }
  }
  return null;
}

export interface SuggestResult {
  ok: boolean;
  code?: string;
  error?: string;
  /** Sugestão da IA (para o humano revisar). Nunca enviada automaticamente. */
  suggestion: string | null;
  /** FAQ que casou, quando houve — base autorizada da resposta. */
  faq: { question: string; answer: string } | null;
  /** `true` quando a IA não está configurada; a sugestão cai na FAQ, se houver. */
  aiUnavailable: boolean;
}

/**
 * Gera uma SUGESTÃO de resposta para a conversa.
 *
 * Regras:
 *   - usa APENAS informação autorizada (FAQ cadastradas pelo usuário + histórico
 *     da própria conversa). Não inventa preço, prazo nem política.
 *   - NUNCA envia: a sugestão volta para o humano aprovar.
 *   - registra a sugestão em `DirectAgentAction` (auditoria).
 */
export async function suggestReply(
  userId: string,
  conversationRowId: string,
  opts: { lastIncomingText?: string | null } = {}
): Promise<SuggestResult> {
  const conversation = await findConversation(userId, conversationRowId);
  if (!conversation) {
    return { ok: false, code: "not_found", error: "Conversa não encontrada.", suggestion: null, faq: null, aiUnavailable: false };
  }

  const messages = await listMessagesForConversation(userId, conversation.id, 20);
  const incoming = [...messages].reverse().find((m) => !m.fromUs && m.text);
  const lastIncoming = opts.lastIncomingText ?? incoming?.text ?? null;
  if (!lastIncoming) {
    return {
      ok: false,
      code: "no_incoming",
      error: "Não há mensagem recebida nesta conversa para responder.",
      suggestion: null,
      faq: null,
      aiUnavailable: false,
    };
  }

  const faqs = await listFaqs(userId, true);
  const matchedFaq = matchFaq(lastIncoming, faqs);

  const provider = await getAIProvider();
  if (!provider) {
    // Sem IA a FAQ ainda serve como base autorizada; sem FAQ, não há sugestão.
    await logAgentAction({
      userId,
      conversationId: conversation.id,
      action: matchedFaq ? "SUGGEST" : "AUTOREPLY_BLOCKED",
      suggestion: matchedFaq?.answer ?? null,
      reason: matchedFaq ? "faq_sem_ia" : "ia_indisponivel",
    });
    return {
      ok: !!matchedFaq,
      code: matchedFaq ? undefined : "ai_unavailable",
      error: matchedFaq ? undefined : "IA não configurada. Escreva a resposta manualmente.",
      suggestion: matchedFaq?.answer ?? null,
      faq: matchedFaq,
      aiUnavailable: true,
    };
  }

  const profile = await getAIProfile(userId);
  const userProfile = await prisma.userProfile.findUnique({ where: { userId } });

  const history = messages
    .slice(-6)
    .map((m) => `${m.fromUs ? "Perfil" : "Contato"}: ${m.text ?? "[anexo]"}`)
    .join("\n");

  const system = [
    "Você ajuda a escrever respostas de Direct no Instagram, em nome do próprio perfil.",
    "Português do Brasil, curto, humano, sem emoji inventado.",
    "NUNCA prometa preço, prazo, desconto, resultado, cura ou sorteio.",
    "NUNCA peça dados pessoais nem combine pagamento pelo Direct.",
    "Use SOMENTE as informações autorizadas abaixo. Se a resposta não estiver nelas, responda de forma acolhedora e diga que vai verificar — nunca invente.",
    "Devolva APENAS o texto da resposta.",
    profile?.voiceTone ? `Tom de voz do perfil: ${profile.voiceTone}.` : "",
    userProfile?.niche ? `Nicho: ${userProfile.niche}.` : "",
    faqs.length > 0
      ? `INFORMAÇÕES AUTORIZADAS (FAQ):\n${faqs
          .slice(0, FAQ_CONTEXT_LIMIT)
          .map((f) => `- ${f.question}: ${f.answer}`)
          .join("\n")}`
      : "O perfil não cadastrou FAQ. Não invente informação.",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = [
    history ? `HISTÓRICO RECENTE:\n${history}` : "",
    `MENSAGEM A RESPONDER: "${lastIncoming}"`,
    matchedFaq ? `A FAQ mais provável é "${matchedFaq.question}" (resposta: ${matchedFaq.answer}).` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    // SEM MEDIÇÃO AQUI (intencional): esta chamada atende ao fluxo de Direct já
    // medido como `auto_reply` pelo medidor externo (`src/lib/comment-direct/
    // engine.ts`). Envolver isto de novo contaria DUAS VEZES a mesma ação.
    const raw = await provider.complete({
      system,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.7,
      maxTokens: 200,
    });
    const suggestion = (raw ?? "").trim().replace(/^(resposta|sugest[ãa]o)\s*:\s*/i, "").slice(0, 900);
    if (!suggestion) {
      return { ok: false, code: "empty", error: "A IA não devolveu uma sugestão utilizável.", suggestion: null, faq: matchedFaq, aiUnavailable: false };
    }

    await logAgentAction({
      userId,
      conversationId: conversation.id,
      action: "SUGGEST",
      suggestion,
    });

    return { ok: true, suggestion, faq: matchedFaq, aiUnavailable: false };
  } catch (err) {
    console.error("[comment-direct/conversation] falha na IA", err);
    return {
      ok: false,
      code: "ai_error",
      error: "Não foi possível gerar a sugestão agora.",
      suggestion: matchedFaq?.answer ?? null,
      faq: matchedFaq,
      aiUnavailable: false,
    };
  }
}
