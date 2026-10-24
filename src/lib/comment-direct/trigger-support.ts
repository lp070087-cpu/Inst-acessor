/**
 * AUDITORIA DE GATILHOS SUPORTADOS — NÚCLEO PURO
 * ==============================================
 * Quais fontes de evento o Inst Acessor pode usar como gatilho de automação,
 * segundo os canais OFICIAIS da Meta — e o que ainda depende de liberação.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * É fácil prometer "responda a Story, DM e comentário" e só ter implementado
 * metade. Este módulo torna explícito, com o mesmo texto para o usuário e para
 * o relatório, o que é REAL hoje:
 *
 *   • comentário em publicação — SUPORTADO (webhook `comments`; já em produção
 *     para as respostas públicas e agora para o Direct).
 *   • comentário em live        — SUPORTADO parcialmente (`live_comments` já é
 *     parseado; sem `media.id`, depende do comentário já conhecido).
 *   • mensagem recebida no DM   — SUPORTADO para LEITURA/exibição e para
 *     "a pessoa já respondeu". NÃO é gatilho de ENVIO automático: responder a
 *     uma mensagem exige respeitar a janela de 24h e as message tags — enviar
 *     sozinho é decisão do humano no painel.
 *   • resposta a Story          — oficialmente a resposta chega como MENSAGEM
 *     de Direct com referência ao Story. O código a lê e exibe como mensagem,
 *     mas NÃO a trata como gatilho determinístico enquanto a Meta não liberar
 *     a leitura de mensagens (depende de `instagram_business_manage_messages`).
 *   • palavra-chave em mensagem — NÃO suportado como gatilho de envio (seria
 *     mensagem não solicitada, proibida pela política). A FAQ + sugestão de IA
 *     cobrem o caso com aprovação humana.
 *
 * Este arquivo não faz I/O: é a fonte única do texto que a UI mostra.
 */

export type TriggerSupportLevel =
  /** Funciona hoje, com os escopos já concedidos. */
  | "supported"
  /** Depende de permissão/liberação da Meta (App Review). */
  | "pending"
  /** Não é feito de propósito (política da Meta ou risco de abuso). */
  | "blocked";

export interface TriggerSupportEntry {
  id: string;
  label: string;
  level: TriggerSupportLevel;
  /** Frase exata que a UI mostra. */
  detail: string;
}

export const TRIGGER_SUPPORT: readonly TriggerSupportEntry[] = [
  {
    id: "comment_keyword",
    label: "Comentário com palavra-chave",
    level: "supported",
    detail:
      "Suportado. O comentário chega pelo webhook oficial e o gatilho é comparado de forma determinística.",
  },
  {
    id: "live_comment",
    label: "Comentário em transmissão ao vivo",
    level: "supported",
    detail:
      "Suportado quando a Meta envia a publicação junto do evento; sem ela, só é avaliado se o comentário já for conhecido.",
  },
  {
    id: "dm_received",
    label: "Mensagem recebida no Direct",
    level: "pending",
    detail:
      "Exibida e registrada quando a permissão de mensagens está liberada. Não dispara envio automático — a resposta passa pela sua aprovação no painel.",
  },
  {
    id: "story_reply",
    label: "Resposta a Story",
    level: "pending",
    detail:
      "Chega oficialmente como mensagem de Direct. É lida e exibida como mensagem, mas só vira insumo quando a permissão de mensagens for liberada.",
  },
  {
    id: "dm_keyword",
    label: "Palavra-chave em mensagem",
    level: "blocked",
    detail:
      "Não é feito de propósito: responder quem não interagiu é mensagem não solicitada, proibida pela política do Instagram. Use a FAQ e a sugestão de IA com sua aprovação.",
  },
] as const;

export const TRIGGER_SUPPORT_LEVEL_LABEL: Record<TriggerSupportLevel, string> = {
  supported: "Disponível",
  pending: "Depende da Meta",
  blocked: "Não utilizado",
};
