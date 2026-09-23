"use client";

import * as React from "react";
import {
  Images,
  Film,
  Grid3x3,
  MessageCircle,
  Loader2,
  Sparkles,
  Eye,
  Heart,
  Share2,
  Bookmark,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MediaInsightsModal } from "./media-insights-modal";

/**
 * LISTA DE PUBLICAÇÕES
 * ====================
 * Posts, carrosséis e Reels com thumbnail, legenda resumida, data, tipo e
 * contagem de comentários. Todos os dados vêm do sync real do Instagram — nada
 * é estimado.
 *
 * CARD INDEPENDENTE POR FONTE DE DADO (item 11)
 * ---------------------------------------------
 * O card é a entidade principal e NENHUMA fonte secundária pode impedi-lo de
 * aparecer:
 *   • thumbnail quebrada  → o card renderiza com o ícone do formato no lugar;
 *   • métrica ausente     → mostra "—", nunca `0`;
 *   • comentários que não puderam ser lidos → mostra o estado de comentário,
 *     nunca `0` como se fosse dado.
 * Por isso o card NÃO busca nada na Meta: tudo vem do que o sync já gravou.
 * Uma falha de leitura já aconteceu antes, no servidor, e chega aqui como
 * `null` — que é um valor, não uma exceção.
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
  /**
   * Métricas gravadas pelo sync. Cada campo `null` = a Meta não disponibilizou
   * (nunca zero). `metrics` inteiro ausente = publicação sem insights lidos.
   */
  metrics?: {
    likeCount: number | null;
    commentsCount: number | null;
    reached: number | null;
    impressions: number | null;
    shares: number | null;
    saves: number | null;
    videoViews: number | null;
    videoViewTime: number | null;
  } | null;
}

interface MediaListProps {
  media: MediaItem[];
  onAnalyze: (item: MediaItem) => void;
  busyId: string | null;
  busy: boolean;
  /**
   * A Meta recusou a LEITURA de comentários para esta conta (`false` em
   * `commentsAvailable`). É um fato da CONTA, não desta publicação.
   *
   * Existe aqui porque a diferença é o que o item 13 exige: sem isto, todo card
   * sem comentário importado diria "ainda não recebeu comentários" — afirmando
   * zero quando na verdade não conseguimos ler. Com isto, o card diz "não foi
   * possível carregar os comentários", que é a verdade.
   */
  commentsReadFailed?: boolean;
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
  // "Imagem", e não "Post", para bater com o rótulo do painel de insights
  // (`mediaFormatLabel` em `lib/publishing/media-insights.ts`). Os dois aparecem
  // no MESMO fluxo — o card e o painel que ele abre — e diziam nomes diferentes
  // para a mesma publicação ("Post" no card, "Imagem" no painel). O card apenas
  // adiciona o que ele precisa e o painel não dá: o ícone.
  return { label: "Imagem", Icon: Images };
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

/**
 * Formata uma métrica para o card COMPACTO.
 *
 * A regra é a mesma do modal (`formatMetric`): `null` significa "a Meta não
 * disponibilizou" e NUNCA vira "0". No card, que é apertado, a ausência é um
 * traço com `title` explicando — a frase longa do modal não caberia aqui, mas
 * dizer "0" seria afirmar uma medida que ninguém mediu.
 */
function compactMetric(value: number | null | undefined): {
  text: string;
  unavailable: boolean;
} {
  if (value == null) return { text: "—", unavailable: true };
  if (value >= 1000) {
    const k = value / 1000;
    return {
      text: `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(".", ",")} mil`,
      unavailable: false,
    };
  }
  return { text: String(value), unavailable: false };
}

const UNAVAILABLE_TITLE = "Dado não disponibilizado pela Meta para esta publicação.";

/**
 * Uma métrica do bloco compacto. `unavailable` aplica o estilo apagado — o
 * visual precisa deixar claro que aquele número não existe, para ele não ser
 * lido como zero num relance.
 */
function CompactMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Heart;
  value: number | null | undefined;
  label: string;
}) {
  const m = compactMetric(value);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] ${
        m.unavailable ? "text-ink-muted/70" : "text-ink-soft"
      }`}
      title={m.unavailable ? UNAVAILABLE_TITLE : `${label}: ${value}`}
    >
      <Icon size={12} className="flex-none" />
      {m.text}
    </span>
  );
}

/**
 * O CARD de uma publicação.
 *
 * É um componente próprio (e não um bloco dentro do `.map`) por um motivo
 * concreto: o estado `thumbFailed` precisa ser POR CARD. Como hook só pode ser
 * chamado no topo de um componente, um `useState` dentro do `map` violaria as
 * regras dos hooks — e a alternativa (um mapa de falhas no pai) faria todo card
 * re-renderizar quando qualquer imagem falhasse.
 *
 * `commentsReadFailed` é uma propriedade da CONTA (a Meta recusou a leitura),
 * não desta publicação — por isso vem de fora, em vez de cada card tentar
 * descobrir sozinho.
 */
function MediaCard({
  item,
  busy,
  isBusy,
  commentsReadFailed,
  onAnalyze,
  onOpenInsights,
}: {
  item: MediaItem;
  busy: boolean;
  isBusy: boolean;
  commentsReadFailed: boolean;
  onAnalyze: (item: MediaItem) => void;
  onOpenInsights: (item: MediaItem) => void;
}) {
  const [thumbFailed, setThumbFailed] = React.useState(false);
  const { label, Icon } = describeType(item);

  // DUAS ORIGENS DIFERENTES, DUAS LEITURAS DIFERENTES.
  //  - `synced`: comentários REAIS no banco (o que a tela consegue listar).
  //  - `apiCount`: o `comments_count` DECLARADO pela Meta no nó da mídia — que
  //    pode existir sem nenhum comentário importado.
  // Somar/alternar as duas num único badge foi o que produziu a contradição em
  // produção ("5 comentários" no card + "nenhum comentário novo" ao analisar).
  // Agora o número grande é o que TEMOS, e a divergência aparece explicitamente.
  const synced = item.syncedCommentsCount ?? 0;
  const apiCount = item.commentsCount;
  const shownComments = synced > 0 ? synced : apiCount ?? null;
  const hasComments = (shownComments ?? 0) > 0;
  const pendingFromMeta = apiCount != null && apiCount > synced;

  return (
    <div className="flex flex-col bg-card border border-border-soft rounded-md shadow-xs overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Thumbnail real (quando o sync trouxe).
          Se a imagem não carregar, o `onError` troca para o ícone do formato:
          uma thumbnail quebrada NÃO pode derrubar nem degradar o card. */}
      <div className="relative aspect-square bg-surface">
        {item.thumbnailUrl && !thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={() => setThumbFailed(true)}
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
          {/* O Instagram informa mais comentários do que os importados. Dizemos
              isso com o número real da Meta — nunca escondemos a diferença nem
              a apresentamos como se já estivesse tudo aqui. */}
          {pendingFromMeta && (
            <span
              className="text-[10.5px] text-ink-muted"
              title="Comentários declarados pelo Instagram. Use “Analisar comentários” para importar e analisar."
            >
              ({apiCount} no Instagram)
            </span>
          )}
        </div>

        {/* MÉTRICAS REAIS DO CARD (itens 9 e 10).
            Só o que a Meta forneceu. Cada valor ausente é "—" e não 0 — um card
            que mostra "0 salvamentos" quando a Meta não devolveu salvamento
            afirma uma medida que ninguém mediu. */}
        {item.metrics && (
          <div className="flex items-center gap-x-3 gap-y-1.5 mt-3 flex-wrap">
            <CompactMetric icon={Eye} value={item.metrics.reached} label="Alcance" />
            <CompactMetric icon={Heart} value={item.metrics.likeCount} label="Curtidas" />
            <CompactMetric
              icon={MessageCircle}
              value={item.metrics.commentsCount ?? shownComments}
              label="Comentários"
            />
            <CompactMetric icon={Share2} value={item.metrics.shares} label="Compartilhamentos" />
            <CompactMetric icon={Bookmark} value={item.metrics.saves} label="Salvamentos" />
          </div>
        )}

        {/* SITUAÇÃO DOS COMENTÁRIOS (itens 7 e 13).
            Três estados distintos, e nenhum deles é "0 comentários" por falha:
              • não conseguimos ler    → "Não foi possível carregar os comentários."
              • lemos e não há nenhum  → "Esta publicação ainda não recebeu comentários."
              • lemos e há comentários → o badge com o número.
            A publicação continua no card nos TRÊS casos. */}
        {commentsReadFailed ? (
          <p className="text-[11px] text-ink-muted mt-2">
            Não foi possível carregar os comentários.
          </p>
        ) : hasComments === false ? (
          <p className="text-[11px] text-ink-muted mt-2">
            Esta publicação ainda não recebeu comentários.
          </p>
        ) : null}

        {/* BLOCO 5 — no celular o botão e o link "Abrir" dividem a mesma linha.
            `min-w-0` no botão impede que o rótulo ("Analisar comentários") force
            a linha a crescer; `flex-wrap` deixa o link descer para a linha de
            baixo em telas de 320px em vez de comprimir o botão. */}
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

          {/* "Ver insights" abre os INSIGHTS da publicação dentro do Inst
              Acessor (itens 9, 10 e 11), em vez de mandar o usuário embora para
              o Instagram. O link externo continua como ação secundária dentro
              do próprio painel. */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onOpenInsights(item)}
            className="px-2"
          >
            <Eye size={13} />
            Ver insights
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MediaList({
  media,
  onAnalyze,
  busyId,
  busy,
  commentsReadFailed = false,
}: MediaListProps) {
  // Insights da publicação (itens 9 e 10). O painel é UM só para a lista
  // inteira — abrir 60 painéis (um por card) só para deixar 59 fechados
  // custaria render desnecessário em conta com muito histórico.
  const [insightsFor, setInsightsFor] = React.useState<MediaItem | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {media.map((item) => (
        <MediaCard
          key={item.id}
          item={item}
          busy={busy}
          isBusy={busyId === item.id}
          commentsReadFailed={commentsReadFailed}
          onAnalyze={onAnalyze}
          onOpenInsights={setInsightsFor}
        />
      ))}

      <MediaInsightsModal
        open={insightsFor != null}
        mediaId={insightsFor?.id ?? null}
        formatHint={insightsFor ? describeType(insightsFor).label : undefined}
        onClose={() => setInsightsFor(null)}
      />
    </div>
  );
}
