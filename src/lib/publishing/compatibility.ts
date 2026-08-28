/**
 * COMPATIBILIDADE POR PLATAFORMA — Fase 6.5/7
 * ============================================
 * Camada interna que define quais formatos estão DISPONÍVEIS hoje no
 * Inst Acessor para cada plataforma. NÃO afirma capacidades oficiais de
 * Meta/TikTok — é uma regra interna do produto.
 *
 *   Instagram: POST · CAROUSEL · REEL · STORY
 *   TikTok:    VIDEO (foto/carrossel = capability futura a confirmar)
 *
 * Fase 7 (Parte 8): validações de compatibilidade de mídia — contagem,
 * MIME type, imagem/vídeo, proporção e tamanho QUANDO conhecidos.
 * Usadas pela fila antes de enfileirar e pela UI para orientar o usuário.
 *
 * Quando o formato não estiver disponível, a UI mostra:
 *   "Formato ainda não disponível para esta plataforma."
 */

export const PLATFORM_FORMATS: Record<string, string[]> = {
  instagram: ["post", "carrossel", "reel", "story"],
  tiktok: ["video"],
};

export const FORMAT_LABELS: Record<string, string> = {
  post: "Post",
  carrossel: "Carrossel",
  reel: "Reel",
  story: "Story",
  video: "Vídeo",
};

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Formato disponível para a plataforma? */
export function isFormatAvailable(platform: string, format: string): boolean {
  const allowed = PLATFORM_FORMATS[platform];
  if (!allowed) return false;
  return allowed.includes(format);
}

/** Lista os formatos disponíveis para a plataforma (ordem estável). */
export function getAvailableFormats(platform: string): string[] {
  return PLATFORM_FORMATS[platform] ?? [];
}

/**
 * "Dica" de formato para o TikTok quando o usuário tenta usar um formato
 * de imagem/carrossel: retorna true se for um formato de foto não suportado.
 */
export function isPhotoFormatOnTikTok(platform: string, format: string): boolean {
  return platform === "tiktok" && ["post", "carrossel", "story"].includes(format);
}

// ------------------------------------------------------------
// FASE 7 — VALIDAÇÃO DE COMPATIBILIDADE DE MÍDIA (Parte 8)
// ------------------------------------------------------------

/** MIME types aceitos por plataforma/formato (quando a integração real disser). */
export const PLATFORM_MIME_TYPES: Record<string, string[]> = {
  instagram: [
    "image/jpeg",
    "image/png",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ],
  tiktok: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ],
};

/** Limites de mídia (quando a plataforma fornecer). */
export interface MediaLimits {
  maxItems: number;
  maxSizeMb: number;
  minRatio?: number;
  maxRatio?: number;
}

export const PLATFORM_MEDIA_LIMITS: Record<string, MediaLimits> = {
  instagram: {
    maxItems: 10,
    maxSizeMb: 100,
  },
  tiktok: {
    maxItems: 1,
    maxSizeMb: 500,
  },
};

/** Formato esperado de mídia por plataforma/formato. */
export function expectedMediaType(platform: string, format: string): "image" | "video" | "any" {
  if (format === "reel" || format === "video") return "video";
  if (format === "story") return "video"; // stories podem ser foto ou vídeo — flexível
  if (platform === "tiktok") return "video";
  return "image";
}

export interface CompatibilityIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface CompatibilityInput {
  platform: string;
  format: string;
  mediaCount: number;
  /** MIME type da capa quando conhecido. */
  mimeType?: string;
  /** Lista de MIME types por item (carrossel). */
  mediaMimeTypes?: string[];
  /** Largura/altura da capa em px quando conhecidos. */
  width?: number;
  height?: number;
  /** Tamanho do arquivo em MB quando conhecido. */
  sizeMb?: number;
  /** Se o conteúdo tem legenda. */
  hasCaption?: boolean;
  /** Texto de hashtags (para orientações). */
  hashtags?: string;
  /** Se o conteúdo tem hashtags. */
  hasHashtags?: boolean;
}

/**
 * Avalia a compatibilidade de um conteúdo com a plataforma/formato.
 * Retorna issues (erros bloqueiam publicação; warnings orientam).
 * Baseia-se em regras internas do produto — NUNCA afirma limites oficiais
 * que a integração real ainda não confirmou.
 */
export function checkCompatibility(input: CompatibilityInput): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  // Formato disponível na plataforma?
  if (!isFormatAvailable(input.platform, input.format)) {
    issues.push({
      code: "FORMAT_UNAVAILABLE",
      message: `O formato ${FORMAT_LABELS[input.format] ?? input.format} não está disponível para ${PLATFORM_LABELS[input.platform] ?? input.platform} no Inst Acessor.`,
      severity: "error",
    });
    return issues;
  }

  // Mídia obrigatória.
  if (input.mediaCount <= 0) {
    issues.push({
      code: "NO_MEDIA",
      message: "Adicione ao menos uma mídia antes de publicar.",
      severity: "error",
    });
  }

  // Limite de itens.
  const limits = PLATFORM_MEDIA_LIMITS[input.platform];
  if (limits && input.mediaCount > limits.maxItems) {
    issues.push({
      code: "TOO_MANY_ITEMS",
      message: `${PLATFORM_LABELS[input.platform] ?? input.platform} aceita no máximo ${limits.maxItems} mídias neste formato.`,
      severity: "error",
    });
  }

  // Tipo de mídia esperado.
  const expected = expectedMediaType(input.platform, input.format);
  if (expected !== "any" && input.mimeType) {
    const isVideoMime = input.mimeType.startsWith("video/");
    if (expected === "video" && !isVideoMime) {
      issues.push({
        code: "MEDIA_TYPE_MISMATCH",
        message: `O formato ${FORMAT_LABELS[input.format] ?? input.format} precisa de um vídeo.`,
        severity: "error",
      });
    }
    if (expected === "image" && isVideoMime) {
      issues.push({
        code: "MEDIA_TYPE_MISMATCH",
        message: `O formato ${FORMAT_LABELS[input.format] ?? input.format} precisa de uma imagem.`,
        severity: "error",
      });
    }
  }

  // MIME type aceito (quando conhecido).
  if (input.mimeType && !input.mimeType.startsWith("image/") && !input.mimeType.startsWith("video/")) {
    issues.push({
      code: "MIME_UNSUPPORTED",
      message: "O arquivo selecionado não é uma imagem ou vídeo suportado.",
      severity: "error",
    });
  }

  // Tamanho (quando conhecido).
  if (limits && input.sizeMb && input.sizeMb > limits.maxSizeMb) {
    issues.push({
      code: "FILE_TOO_LARGE",
      message: `O arquivo excede ${limits.maxSizeMb} MB, limite interno para ${PLATFORM_LABELS[input.platform] ?? input.platform}.`,
      severity: "error",
    });
  }

  // Proporção (apenas quando ambos conhecidos e fornecidos).
  if (input.width && input.height) {
    const ratio = input.width / input.height;
    if (input.format === "story" && (ratio < 0.4 || ratio > 1.2)) {
      issues.push({
        code: "RATIO_WARNING",
        message: "Stories ficam melhores em proporção vertical (9:16).",
        severity: "warning",
      });
    }
    if (input.format === "carrossel" && Math.abs(ratio - 1) > 0.2 && input.mediaCount > 1) {
      issues.push({
        code: "RATIO_WARNING",
        message: "No carrossel, todas as imagens ficam melhores na mesma proporção.",
        severity: "warning",
      });
    }
  }

  // Legenda/hashtags (orientação, não bloqueia).
  if (!input.hasCaption) {
    issues.push({
      code: "NO_CAPTION",
      message: "Sem legenda — considere adicionar uma para contexto.",
      severity: "warning",
    });
  }
  if (input.hasHashtags && (input.hashtags ?? "").length > 0 && input.platform === "instagram" && input.format === "reel") {
    issues.push({
      code: "HASHTAG_NOTE",
      message: "No Instagram, hashtags também funcionam na legenda do Reel.",
      severity: "warning",
    });
  }

  return issues;
}

/** Apenas erros (bloqueiam). */
export function compatibilityErrors(input: CompatibilityInput): CompatibilityIssue[] {
  return checkCompatibility(input).filter((i) => i.severity === "error");
}

/** True se o conteúdo pode ser enfileirado (sem erros bloqueantes). */
export function isCompatible(input: CompatibilityInput): boolean {
  return compatibilityErrors(input).length === 0;
}
