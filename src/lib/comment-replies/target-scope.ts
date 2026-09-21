/**
 * ESCOPO DA REGRA — O ALVO DO ENVIO AUTOMÁTICO
 * ============================================
 * Núcleo PURO (sem banco, sem rede). Responde uma única pergunta: o comentário
 * que chegou está dentro do alvo configurado na `CommentAutomationRule`?
 *
 * Por que isso vive fora do motor: o webhook do Instagram precisa dessa decisão
 * ANTES de qualquer envio automático, e um arquivo de rota do Next não pode
 * exportar funções auxiliares. Aqui a regra fica testável isoladamente.
 *
 * Valores de `targetType`:
 *   - `all`  → qualquer publicação (padrão de fábrica);
 *   - `media`→ somente a publicação apontada por `mediaId`;
 *   - `post` | `reel` | `carousel` → por formato.
 *
 * FAIL-CLOSED: qualquer valor que não dê para provar — desconhecido, vazio,
 * publicação sem `mediaType`, vídeo sem `mediaProductType` (feed ou Reel?) —
 * devolve `false`. Nunca "provavelmente é".
 */

export interface RuleTarget {
  targetType: string;
  mediaId: string | null;
}

export interface MediaForTarget {
  /** `InstagramMedia.mediaType` — IMAGE | VIDEO | CAROUSEL_ALBUM | ... */
  mediaType?: string | null;
  /** `InstagramMedia.mediaProductType` — FEED | REELS | STORY | AD. */
  mediaProductType?: string | null;
}

export function isWithinRuleTarget(
  rule: RuleTarget,
  target: { igMediaId: string; media: MediaForTarget | null }
): boolean {
  const type = (rule.targetType ?? "all").trim().toLowerCase();

  if (type === "all") return true;

  if (type === "media") {
    const ref = (rule.mediaId ?? "").trim();
    return ref.length > 0 && ref === target.igMediaId;
  }

  // Os valores por formato só são avaliáveis com o tipo REAL da publicação.
  // Sem `InstagramMedia` correspondente não há o que comparar.
  if (!target.media) return false;

  const mediaType = (target.media.mediaType ?? "").toUpperCase();
  const product = (target.media.mediaProductType ?? "").toUpperCase();
  const isCarousel = mediaType === "CAROUSEL_ALBUM";
  const isVideo = mediaType === "VIDEO";
  const isReel = isVideo && product.includes("REELS");

  switch (type) {
    case "carousel":
      return isCarousel;

    case "reel":
      return isReel;

    case "post": {
      if (isCarousel) return false;
      if (!isVideo) return mediaType.length > 0; // imagem do feed
      // Vídeo sem `mediaProductType` é ambíguo entre feed e Reel: bloqueia.
      if (!product) return false;
      return !isReel;
    }

    default:
      return false;
  }
}
