/**
 * PARSER DO WEBHOOK DE COMENTÁRIOS DO INSTAGRAM (Meta)
 * ====================================================
 * Núcleo PURO (sem banco, sem rede) que normaliza o payload que a Meta envia
 * para o callback assinado. Fica fora de `route.ts` porque um arquivo de rota
 * do Next só pode exportar handlers — e porque este formato merece ser testado
 * sem subir servidor.
 *
 * Formato que a Meta envia (webhook de `comments` / `live_comments`):
 *
 *   {
 *     "object": "instagram",
 *     "entry": [
 *       {
 *         "id": "<ig-user-id da conta que recebeu o evento>",
 *         "time": <epoch em segundos>,
 *         "changes": [
 *           {
 *             "field": "comments",
 *             "value": {
 *               "id": "<id do comentário>",
 *               "text": "...",
 *               "from": { "id": "<id do autor>", "username": "..." },
 *               "media": { "id": "<id da publicação>", "media_product_type": "..." },
 *               "parent_id": "<id do comentário respondido, quando é resposta>"
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * REGRAS DESTE MÓDULO (todas derivadas do escopo da tarefa):
 *   - NUNCA inventar campo que a Meta não mandou. Ausente → null.
 *   - NUNCA gerar identificador artificial: sem o `id` real do comentário não
 *     existe idempotência possível, então o evento é descartado.
 *   - Ser DEFENSIVO: a Meta varia nomes/casing entre versões (`media` como
 *     objeto ou `media_id` direto; `from` ausente em comentário removido;
 *     `timestamp` em segundos ou string). Aceitamos as duas formas sem
 *     afirmar qual delas veio.
 *   - Iterar TODAS as entries e TODAS as changes — não só a primeira.
 *   - Evento desconhecido (outro `field`, outro `object`) é ignorado em
 *     silêncio, sem quebrar o endpoint.
 */

/** Campos de `changes` que este projeto assina no painel da Meta. */
export const COMMENT_WEBHOOK_FIELDS = ["comments", "live_comments"] as const;

/** Um comentário real recebido da Meta, já normalizado. */
export interface IgWebhookComment {
  /** O campo que originou o evento (`comments` ou `live_comments`). */
  field: string;
  /** `entry.id` — a conta do Instagram que recebeu o evento. */
  accountId: string | null;
  /** ID EXTERNO do comentário — chave de idempotência (`InstagramComment.igCommentId`). */
  igCommentId: string;
  /** ID EXTERNO da publicação comentada. `null` em eventos sem mídia (ex.: live). */
  igMediaId: string | null;
  /** ID do comentário respondido, quando este evento é uma resposta. */
  parentId: string | null;
  text: string | null;
  /** Username do autor — o campo que o Instagram Business Login envia. */
  username: string | null;
  /** ID do autor quando a Meta informa (`from.id`). */
  authorId: string | null;
  /** Momento do comentário, quando informado e interpretável. */
  createdAt: Date | null;
}

export interface ParsedWebhookComments {
  /** Quantas `entry` o payload trazia. */
  entriesSeen: number;
  /** Quantas `changes` foram percorridas (todos os campos, não só comentários). */
  changesSeen: number;
  /** Campos distintos vistos — usado só em log sanitizado. */
  fieldsSeen: string[];
  /** Comentários válidos extraídos. */
  comments: IgWebhookComment[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lê um identificador externo aceitando string ou número. Vazio → null. */
function readId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Texto do comentário. `null` quando a Meta não envia (comentário removido). */
function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Username do autor. O Instagram Business Login entrega `username` no nível do
 * comentário; `from.username` é usado como reserva quando existir — mesma
 * precedência já adotada em `listComments()` e `getMediaComments()`.
 */
function readUsername(value: Record<string, unknown>): string | null {
  const direct = typeof value.username === "string" ? value.username.trim() : "";
  if (direct) return direct;
  const from = value.from;
  if (isRecord(from) && typeof from.username === "string") {
    const nested = from.username.trim();
    if (nested) return nested;
  }
  return null;
}

/** ID do autor (`from.id`), quando a Meta informar. */
function readAuthorId(value: Record<string, unknown>): string | null {
  const from = value.from;
  if (!isRecord(from)) return null;
  return readId(from.id);
}

/**
 * ID da publicação comentada.
 * A Meta já enviou `value.media.id` (objeto) e `value.media_id` (string) em
 * versões diferentes do mesmo evento — as duas formas são aceitas.
 */
function readMediaId(value: Record<string, unknown>): string | null {
  const media = value.media;
  if (isRecord(media)) {
    const nested = readId(media.id);
    if (nested) return nested;
  }
  return readId(value.media_id);
}

/**
 * Converte o instante do evento em `Date`.
 * A Meta usa epoch em SEGUNDOS; valores já em milissegundos e strings ISO são
 * aceitos também. O que não for interpretável vira `null` — nunca "agora".
 */
function readTimestamp(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
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
 * Extrai TODOS os comentários de um payload de webhook do Instagram.
 *
 * Não lança em payload malformado: devolve o que conseguiu ler com as
 * contagens. Quem chama decide o status HTTP (o parser não tem essa opinião).
 */
export function parseInstagramCommentWebhook(payload: unknown): ParsedWebhookComments {
  const result: ParsedWebhookComments = {
    entriesSeen: 0,
    changesSeen: 0,
    fieldsSeen: [],
    comments: [],
  };

  if (!isRecord(payload)) return result;
  // Outro objeto (ex.: "page") não é deste endpoint — ignorado, não é erro.
  if (payload.object !== "instagram") return result;

  const entries = payload.entry;
  if (!Array.isArray(entries)) return result;
  result.entriesSeen = entries.length;

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    const accountId = readId(entry.id);
    const entryTime = entry.time;
    const changes = entry.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      result.changesSeen++;
      if (!isRecord(change)) continue;

      const field = typeof change.field === "string" ? change.field.trim() : "";
      if (field && !result.fieldsSeen.includes(field)) result.fieldsSeen.push(field);
      if (!(COMMENT_WEBHOOK_FIELDS as readonly string[]).includes(field)) continue;

      const value = change.value;
      if (!isRecord(value)) continue;

      // Sem o ID real do comentário não há como ser idempotente: descartamos o
      // evento em vez de fabricar um identificador.
      const igCommentId = readId(value.id);
      if (!igCommentId) continue;

      result.comments.push({
        field,
        accountId,
        igCommentId,
        igMediaId: readMediaId(value),
        parentId: readId(value.parent_id),
        text: readText(value.text),
        username: readUsername(value),
        authorId: readAuthorId(value),
        // `created_time` é do comentário; `entry.time` é do evento — usado só
        // como reserva quando o comentário não traz o seu próprio instante.
        createdAt: readTimestamp(value.created_time ?? value.timestamp ?? entryTime),
      });
    }
  }

  return result;
}

/**
 * Compara o username do autor com o da conta conectada, do mesmo jeito que o
 * sync já faz em `normalizeComment()` — sem duplicar a regra em dois lugares
 * diferentes de comportamento.
 */
export function isOwnAccountComment(
  authorUsername: string | null,
  ownUsername: string | null
): boolean {
  if (!authorUsername || !ownUsername) return false;
  return authorUsername.toLowerCase() === ownUsername.toLowerCase();
}
