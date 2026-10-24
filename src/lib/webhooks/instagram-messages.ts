/**
 * PARSER DO WEBHOOK DE MENSAGENS (DIRECT) DO INSTAGRAM (Meta)
 * ==========================================================
 * Núcleo PURO (sem banco, sem rede). Normaliza o payload que a Meta envia para
 * o callback assinado quando a conta RECEBE (ou envia) uma mensagem privada.
 *
 * Formato que a Meta envia para `entry[].messaging[]` (webhook de `messages`):
 *
 *   {
 *     "object": "instagram",
 *     "entry": [
 *       {
 *         "id": "<ig-user-id da conta>",
 *         "time": <epoch em segundos>,
 *         "messaging": [
 *           {
 *             "sender":    { "id": "<IGSID de quem enviou>" },
 *             "recipient": { "id": "<IGSID de quem recebeu>" },
 *             "timestamp": <epoch em ms>,
 *             "message": {
 *               "mid": "<id da mensagem>",
 *               "text": "...",
 *               "attachments": [ { "type": "image", "payload": { "url": "..." } } ]
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * REGRAS (idênticas às do parser de comentários):
 *   - NUNCA inventar campo que a Meta não mandou. Ausente → null.
 *   - NUNCA gerar identificador artificial: sem `mid` não há idempotência.
 *   - Ser DEFENSIVO com `sender/recipient` (formas variam entre versões).
 *   - Iterar TODAS as entries e TODAS as mensagens.
 *
 * Objetivo deste parser: registrar o que REALMENTE chegou para (a) montar a
 * conversa na Central de DM e (b) impedir que a automação responda quem já
 * respondeu no privado (regra de ouro da política de mensagens).
 */

/** Campo de webhook que este projeto assina para mensagens. */
export const MESSAGE_WEBHOOK_FIELDS = ["messages"] as const;

/** Uma mensagem real recebida num payload de webhook. */
export interface IgWebhookMessage {
  /** `entry.id` — a conta do Instagram que recebeu o evento. */
  accountId: string | null;
  /** ID externo da mensagem (`mid`) — chave de idempotência. */
  igMessageId: string;
  /** ID do remetente (IGSID). */
  senderId: string | null;
  /** ID do destinatário (IGSID). */
  recipientId: string | null;
  text: string | null;
  /** Tipo do anexo quando houver (image/video/audio/file/…). */
  attachmentType: string | null;
  /** Momento informado pela Meta, quando interpretável. */
  sentAt: Date | null;
  /** `true` quando a mensagem saiu DESTA conta (recipient é o dono). */
  fromOwnAccount: boolean;
}

export interface ParsedWebhookMessages {
  entriesSeen: number;
  /** Quantos itens de `messaging` foram percorridos. */
  messagingSeen: number;
  messages: IgWebhookMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Lê o id de um bloco `{ id }` (sender/recipient), quando presente. */
function readPartyId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return readId(value.id);
}

function readTimestamp(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // `messaging[].timestamp` vem em MILISSEGUNDOS; `entry.time` em segundos.
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    if (/^\d+$/.test(raw)) return readTimestamp(Number(raw));
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Extrai TODAS as mensagens de um payload de webhook do Instagram.
 * Não lança em payload malformado: devolve o que conseguiu ler.
 */
export function parseInstagramMessageWebhook(payload: unknown): ParsedWebhookMessages {
  const result: ParsedWebhookMessages = { entriesSeen: 0, messagingSeen: 0, messages: [] };

  if (!isRecord(payload)) return result;
  if (payload.object !== "instagram") return result;

  const entries = payload.entry;
  if (!Array.isArray(entries)) return result;
  result.entriesSeen = entries.length;

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    const accountId = readId(entry.id);
    const entryTime = entry.time;
    const messaging = entry.messaging;
    if (!Array.isArray(messaging)) continue;

    for (const item of messaging) {
      result.messagingSeen++;
      if (!isRecord(item)) continue;

      const message = item.message;
      if (!isRecord(message)) continue;

      // Sem o id real da mensagem não há como ser idempotente: descartamos em
      // vez de fabricar um identificador.
      const igMessageId = readId(message.mid);
      if (!igMessageId) continue;

      const senderId = readPartyId(item.sender);
      const recipientId = readPartyId(item.recipient);

      // Mensagem de saída (a própria conta): `sender` é o dono da conta. É
      // marcada para que a Central de DM a mostre como OUTBOUND e para que a
      // automação NUNCA responda a si mesma (proteção contra loop).
      const fromOwnAccount = accountId != null && senderId === accountId;

      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const firstAttachment = attachments.find(isRecord);
      const attachmentType = firstAttachment
        ? typeof firstAttachment.type === "string"
          ? firstAttachment.type
          : null
        : null;

      result.messages.push({
        accountId,
        igMessageId,
        senderId,
        recipientId,
        text: typeof message.text === "string" ? message.text : null,
        attachmentType,
        sentAt: readTimestamp(item.timestamp ?? entryTime),
        fromOwnAccount,
      });
    }
  }

  return result;
}
