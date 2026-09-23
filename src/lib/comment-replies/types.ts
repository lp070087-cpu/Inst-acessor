/**
 * RESPOSTAS INTELIGENTES A COMENTÁRIOS — TIPOS
 * ============================================
 * Tipos compartilhados entre núcleo puro, serviços e UI.
 */

/** Modo de resposta escolhido pelo usuário. */
export const REPLY_MODES = ["MANUAL", "APPROVAL", "AUTO"] as const;
export type ReplyMode = (typeof REPLY_MODES)[number];

export const REPLY_MODE_LABEL: Record<ReplyMode, string> = {
  MANUAL: "Manual — a IA sugere, você decide",
  APPROVAL: "Aprovação — a IA sugere, você aprova antes do envio",
  AUTO: "Automático — envia sozinho quando o comentário é seguro",
};

/** Classificação do comentário. */
export const COMMENT_CATEGORIES = [
  "emoji",
  "elogio",
  "agradecimento",
  "pergunta_simples",
  "duvida_produto",
  "reclamacao",
  "critica",
  "ofensivo",
  "sensivel",
  "spam",
  "outro",
] as const;
export type CommentCategory = (typeof COMMENT_CATEGORIES)[number];

/** Categorias que a automação PODE responder sozinha (modo AUTO). */
export const AUTO_SAFE_CATEGORIES: readonly CommentCategory[] = [
  "emoji",
  "elogio",
  "agradecimento",
];

/** Categorias que SEMPRE exigem revisão humana, independente do modo. */
export const REVIEW_REQUIRED_CATEGORIES: readonly CommentCategory[] = [
  "reclamacao",
  "critica",
  "ofensivo",
  "sensivel",
  "spam",
  "duvida_produto",
  "pergunta_simples",
];

/** Status do registro em `CommentReplyLog`. */
export const REPLY_STATUSES = [
  "PENDING",
  "APPROVED",
  "SENT",
  "IGNORED",
  "ERROR",
  "SKIPPED",
] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];

/** De onde veio a resposta efetiva. */
export type ReplySource =
  | "PERFIL_ESPECIAL"
  | "TEMPLATE_FIXO"
  | "EMOJI"
  | "IA";

/** Publicação elegível (post, carrossel ou Reel). */
export interface EligibleMedia {
  id: string;
  mediaType: string;
  mediaProductType?: string | null;
  caption?: string | null;
  thumbnailUrl?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
  /** `comments_count` informado pela API — null quando não informado. */
  commentsCount?: number | null;
  /** Comentários REAIS já persistidos no banco para esta publicação. */
  syncedCommentsCount?: number;
  /**
   * Métricas do nó da mídia e do `/insights`, como o sync as gravou.
   *
   * `null` em QUALQUER campo significa "a Meta não disponibilizou" — nunca
   * zero. Zero é medida (a publicação realmente não teve salvamentos); `null` é
   * ausência de dado. A tela distingue os dois, e é por isso que estes campos
   * são `number | null` e não `number`.
   *
   * Opcional para não quebrar quem constrói `EligibleMedia` sem métricas (o
   * motor de análise de comentários, por exemplo, não precisa delas).
   */
  metrics?: {
    likeCount: number | null;
    commentsCount: number | null;
    /** Curtidas e comentários são campos do nó; os demais vêm do `/insights`. */
    reached: number | null;
    impressions: number | null;
    shares: number | null;
    saves: number | null;
    videoViews: number | null;
    videoViewTime: number | null;
  } | null;
}

/** Comentário lido da API. */
export interface EligibleComment {
  commentId: string;
  mediaId: string;
  username: string;
  text: string;
  timestamp?: string | null;
}
