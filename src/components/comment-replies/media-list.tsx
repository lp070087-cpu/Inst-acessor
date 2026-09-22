"use client";

import * as React from "react";
import { Images, Film, Grid3x3, MessageCircle, Loader2, Sparkles, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MediaInsightsModal } from "./media-insights-modal";

/**
 * LISTA DE PUBLICAÇÕES
 * ====================
 * Posts, carrosséis e Reels com thumbnail, legenda resumida, data, tipo e
 * contagem de comentários. Todos os dados vêm do sync real do Instagram — nada
 * é estimado.
 */

export interface MediaItem {
  id: string;
  mediaType: string;
  mediaProductType?: string | null;
  caption?: string | null;
  thumbnailUrl?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
  /** `comments_count` informado pela API — null quando a API não informou. */
  commentsCount?: number | null;
  /** Comentários REAIS já sincronizados e guardados no banco. */
  syncedCommentsCount?: number;
}

interface MediaListProps {
  media: MediaItem[];
  onAnalyze: (item: MediaItem) => void;
  busyId: string | null;
  busy: boolean;
}

/** Traduz o tipo bruto da API para um rótulo legível + ícone. */
function describeType(item: MediaItem): { label: string; Icon: typeof Images } {
  const t = (item.mediaType ?? "").toUpperCase();
  if (t === "CAROUSEL_ALBUM") return { label: "Carrossel", Icon: Grid3x3 };
  if (t === "VIDEO") {
    // A API distingue Reels por `media_product_type`.
    const product = (item.mediaProductType ?? "").toUpperCase();
    return product.includes("REELS")
      ? { label: "Reels", Icon: Film }
      : { label: "Vídeo", Icon: Film };
  }
  return { label: "Post", Icon: Images };
}

function formatDate(iso?: string | null): string {
  if (!iso) return "Data indisponível";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Data indisponível";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function MediaList({ media, onAnalyze, busyId, busy }: MediaListProps) {
  // Insights da publicação (PARTES 10 e 11). O modal é UM só para a lista
  // inteira — abrir 60 modais (um por card) só para deixar 59 fechados
  // custaria render desnecessário em conta com muito histórico.
  const [insightsFor, setInsightsFor] = React.useState<MediaItem | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {media.map((item) => {
        const { label, Icon } = describeType(item);
        const isBusy = busyId === item.id;
        // DUAS ORIGENS DIFERENTES, DUAS LEITURAS DIFERENTES.
        //  - `synced`: comentários REAIS no banco (o que a tela consegue listar).
        //  - `commentsCount`: o `comments_count` DECLARADO pela Meta no nó da
        //    mídia — que pode existir sem nenhum comentário importado.
        // Somar/alternar as duas num único badge foi o que produziu a
        // contradição em produção ("5 comentários" no card + "nenhum comentário
        // novo" ao analisar). Agora o número grande é o que TEMOS, e a
        // divergência com a Meta aparece explicitamente.
        const synced = item.syncedCommentsCount ?? 0;
        const apiCount = item.commentsCount;
        const shownComments = synced > 0 ? synced : apiCount ?? null;
        const hasComments = (shownComments ?? 0) > 0;
        // A Meta diz que existem mais do que importamos, e já tentamos (já há
        // análise registrada): vale avisar em vez de deixar o número mentir.
        const pendingFromMeta = apiCount != null && apiCount > synced;

        return (
          <div
            key={item.id}
            className="flex flex-col bg-card border border-border-soft rounded-md shadow-xs overflow-hidden transition-all duration-300 hover:shadow-md"
          >
            {/* Thumbnail real (quando o sync trouxe) */}
            <div className="relative aspect-square bg-surface">
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-ink-muted">
                  <Icon size={30} strokeWidth={1.5} />
                </div>
              )}

              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-pill bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 backdrop-blur-sm">
                <Icon size={12} />
                {label}
              </span>
            </div>

            <div className="flex flex-col flex-1 p-4">
              <p className="text-[13px] text-ink leading-relaxed min-h-[2.6em]">
                {item.caption ? truncate(item.caption, 110) : (
                  <span className="text-ink-muted italic">Sem legenda</span>
                )}
              </p>

              <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                <span className="text-[11.5px] text-ink-muted">{formatDate(item.timestamp)}</span>
                <Badge tone={hasComments ? "brand" : "neutral"} size="xs">
                  <MessageCircle size={11} />
                  {shownComments === null ? "—" : shownComments}
                </Badge>
                {/* O Instagram informa mais comentários do que os importados.
                    Dizemos isso com o número real da Meta — nunca escondemos a
                    diferença nem a apresentamos como se já estivesse tudo aqui. */}
                {pendingFromMeta && (
                  <span
                    className="text-[10.5px] text-ink-muted"
                    title="Comentários declarados pelo Instagram. Use “Analisar comentários” para importar e analisar."
                  >
                    ({apiCount} no Instagram)
                  </span>
                )}
              </div>

              {/* BLOCO 5 — no celular o botão e o link "Abrir" dividem a mesma
                  linha. `min-w-0` no botão impede que o rótulo ("Analisar
                  comentários") force a linha a crescer; `flex-wrap` deixa o
                  link descer para a linha de baixo em telas de 320px em vez de
                  comprimir o botão. */}
              <div className="mt-4 pt-3.5 border-t border-border-soft flex items-center gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => onAnalyze(item)}
                  disabled={busy}
                  className="flex-1 min-w-0"
                >
                  {isBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {isBusy ? "Analisando…" : "Analisar comentários"}
                </Button>

                {/* "Abrir" passou a abrir os INSIGHTS da publicação dentro do
                    Inst Acessor (PARTES 10 e 11), em vez de mandar o usuário
                    embora para o Instagram. O link externo continua existindo
                    como ação secundária dentro do próprio modal. */}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setInsightsFor(item)}
                  className="px-2"
                >
                  <Eye size={13} />
                  Abrir
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <MediaInsightsModal
        open={insightsFor != null}
        mediaId={insightsFor?.id ?? null}
        formatHint={insightsFor ? describeType(insightsFor).label : undefined}
        onClose={() => setInsightsFor(null)}
      />
    </div>
  );
}
