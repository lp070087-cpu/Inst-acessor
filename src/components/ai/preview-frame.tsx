"use client";

import * as React from "react";
import { Image as ImageIcon, Clapperboard, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  framingStyle,
  useFramingDrag,
  type Framing,
} from "@/components/ai/use-media-framing";

/**
 * PREVIEW POR FORMATO — Post · Reel · Story · Carrossel
 * ====================================================
 * Antes, o mockup tinha uma proporção só (440/540px fixos) e o formato mudava
 * apenas um rótulo. Os três formatos ficavam visualmente idênticos — e é
 * justamente a proporção que distingue um Story de um Post na hora de decidir o
 * enquadramento.
 *
 * Proporções usadas (as do próprio Instagram, não inventadas):
 *
 *   Post      → 4:5  vertical (1080×1350) — o retrato padrão do feed
 *   Reel      → 9:16 vertical tela cheia
 *   Story     → 9:16 vertical, tela cheia, com a barra de progresso e o X
 *   Carrossel → 4:5, com navegação entre as imagens
 *
 * Cada formato também muda o CROME do mockup, não só a caixa: Story tem barra
 * de progresso e botão de fechar; Reel tem o rótulo e a coluna de ações à
 * direita; Post/Carrossel têm o rodapé de ações do feed. É o que faz o preview
 * "ler" como o formato escolhido em vez de ser um retângulo colorido.
 */

export type PreviewFormat = "post" | "reel" | "story" | "carrossel";

/**
 * Proporção (largura / altura) da ÁREA DE MÍDIA de cada formato.
 * O CSS usa `aspect-ratio` com este número — um valor só, sem altura fixa, para
 * que o mockup encolha proporcionalmente em tela pequena sem cálculo de JS.
 */
export const FORMAT_ASPECT: Record<PreviewFormat, number> = {
  post: 4 / 5,
  reel: 9 / 16,
  story: 9 / 16,
  carrossel: 4 / 5,
};

/** Rótulo curto mostrado no cromo do mockup. */
const FORMAT_LABEL: Record<PreviewFormat, string> = {
  post: "Publicação",
  reel: "Reel",
  story: "Story",
  carrossel: "Carrossel",
};

export interface PreviewSlide {
  id: string;
  url: string;
  type: "image" | "video";
  framing: Framing;
}

interface PreviewFrameProps {
  format: PreviewFormat;
  slides: PreviewSlide[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onFramingChange: (id: string, framing: Framing) => void;
  /** Bloqueia o arraste (ex.: enquanto o usuário não escolheu mídia). */
  interactive?: boolean;
  /** Só a moldura, sem react-native… usado dentro do modal. */
  compact?: boolean;
  caption?: string;
  tags?: string[];
}

export function PreviewFrame({
  format,
  slides,
  activeIndex,
  onIndexChange,
  onFramingChange,
  interactive = true,
  compact = false,
  caption,
  tags,
}: PreviewFrameProps) {
  const slide = slides[activeIndex] ?? slides[0] ?? null;
  const isStory = format === "story";
  const isReel = format === "reel";
  const isCarousel = format === "carrossel";
  const hasNav = isCarousel && slides.length > 1;

  /**
   * ENQUADRAMENTO DURANTE O ARRASTE — estado LOCAL, não o do pai.
   *
   * Antes, cada `pointermove` chamava `onFramingChange` → `setSlides` no
   * Preview Social (1.601 linhas). Um arraste gera dezenas de eventos por
   * segundo, então o componente INTEIRO re-renderizava dezenas de vezes por
   * segundo — caro em celular fraco e a causa direta de arraste travado.
   *
   * Agora o gesto atualiza SÓ ESTE componente; o estado do pai (e o rascunho)
   * recebe UM `onFramingChange` quando o dedo solta. O resultado visual é o
   * mesmo — ver o efeito abaixo.
   */
  const [liveFraming, setLiveFraming] = React.useState<Framing | null>(null);
  /** Último valor do gesto — lido no `pointerup`, sem depender de re-render. */
  const liveRef = React.useRef<Framing | null>(null);

  // Fora do arraste, o que vale é o valor do PAI (troca de slide, zoom pelo
  // slider, "Centralizar", rascunho reaberto). O local é só o do gesto em curso.
  const effectiveFraming = liveFraming ?? slide?.framing ?? { zoom: 1, offsetX: 0, offsetY: 0 };

  // Sai do modo local assim que o pai confirma o valor — sem isso o componente
  // ficaria preso ao último arraste e ignoraria mudanças externas.
  React.useEffect(() => {
    setLiveFraming(null);
    liveRef.current = null;
  }, [slide?.id, slide?.framing]);

  const commitFraming = React.useCallback(
    (next: Framing) => {
      if (slide && interactive) onFramingChange(slide.id, next);
    },
    [slide, interactive, onFramingChange]
  );

  const onDrag = useFramingDrag(effectiveFraming, (next) => {
    liveRef.current = next;
    setLiveFraming(next);
  }, () => {
    // Fim do gesto: aí sim o pai (e o rascunho) recebe o valor final.
    if (liveRef.current) commitFraming(liveRef.current);
  });

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* ---------- MOLDURA DO APARELHO ---------- */}
      <div
        className={cn(
          "relative w-full rounded-[40px] border-[10px] border-ink bg-ink shadow-brand-lg overflow-hidden",
          compact ? "max-w-[240px]" : "max-w-[300px]"
        )}
        style={{ marginInline: "auto" }}
      >
        {/* Notch — só no chrome de celular; o Story usa a barra de progresso. */}
        {!isStory && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-ink rounded-full z-20" />
        )}

        <div className="relative bg-bg-ice flex flex-col">
          {/* ---------- CABEÇALHO POR FORMATO ---------- */}
          {isStory ? (
            /* Story: barra de progresso + fechar, como no app. */
            <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-3 flex flex-col gap-2">
              <div className="flex gap-1">
                {slides.length > 1 ? (
                  slides.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        "h-[2.5px] flex-1 rounded-full",
                        i <= activeIndex ? "bg-white" : "bg-white/35"
                      )}
                    />
                  ))
                ) : (
                  <span className="h-[2.5px] flex-1 rounded-full bg-white/80" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-brand-grad grid place-items-center text-[10px] font-bold text-white">
                  IA
                </span>
                <span className="text-[12px] font-semibold text-white drop-shadow truncate">
                  Inst Acessor
                </span>
                <span className="ml-auto text-white/90 text-[15px] leading-none">×</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-4 pt-9 pb-2">
              <span className="w-8 h-8 rounded-full bg-brand-grad grid place-items-center text-[11px] font-bold text-white">
                IA
              </span>
              <span className="text-[12.5px] font-semibold text-ink truncate min-w-0">
                Inst Acessor
              </span>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {FORMAT_LABEL[format]}
              </span>
            </div>
          )}

          {/* ---------- ÁREA DE MÍDIA (única parte que muda de proporção) ---------- */}
          <div
            className="relative w-full bg-surface overflow-hidden"
            style={{ aspectRatio: String(FORMAT_ASPECT[format]) }}
          >
            {slide ? (
              <div
                className={cn(
                  "w-full h-full",
                  interactive && "cursor-grab active:cursor-grabbing touch-none"
                )}
                onPointerDown={interactive ? onDrag : undefined}
                title={interactive ? "Arraste para reposicionar o enquadramento" : undefined}
              >
                {slide.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.url}
                    alt="Mídia do preview"
                    draggable={false}
                    decoding="async"
                    className="w-full h-full object-cover select-none"
                    style={framingStyle(slide.framing)}
                  />
                ) : (
                  /* SEM autoPlay: um preview que toca sozinho decodifica vídeo
                     sem o usuário pedir — em celular de entrada isso custa
                     bateria e banda para algo que é uma PRÉVIA. `preload="metadata"`
                     já traz a primeira imagem sem baixar o arquivo inteiro. */
                  <video
                    src={slide.url}
                    className="w-full h-full object-cover"
                    style={framingStyle(slide.framing)}
                    muted
                    playsInline
                    preload="metadata"
                    controls
                  />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted px-6 text-center">
                <ImageIcon size={26} />
                <span className="text-[12px]">
                  Adicione uma mídia para visualizar o preview.
                </span>
              </div>
            )}

            {/* Navegação do carrossel — sobre a imagem, como no feed. */}
            {hasNav && (
              <>
                <button
                  type="button"
                  onClick={() => onIndexChange(Math.max(0, activeIndex - 1))}
                  disabled={activeIndex === 0}
                  aria-label="Imagem anterior"
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/45 text-white grid place-items-center disabled:opacity-0 transition-opacity cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onIndexChange(Math.min(slides.length - 1, activeIndex + 1))}
                  disabled={activeIndex >= slides.length - 1}
                  aria-label="Próxima imagem"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/45 text-white grid place-items-center disabled:opacity-0 transition-opacity cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
                  {slides.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        i === activeIndex ? "bg-white" : "bg-white/50"
                      )}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Reel: coluna de ações à direita, como no app. */}
            {isReel && (
              <div className="absolute right-2 bottom-3 z-10 flex flex-col items-center gap-2.5 text-white text-[9.5px] font-semibold">
                <span className="flex flex-col items-center gap-0.5">♥<span>—</span></span>
                <span className="flex flex-col items-center gap-0.5">💬<span>—</span></span>
                <span className="flex flex-col items-center gap-0.5">↗<span>—</span></span>
              </div>
            )}
          </div>

          {/* ---------- LEGENDA ---------- */}
          {(caption || (tags && tags.length > 0)) && (
            <div
              className={cn(
                "px-4 py-3 flex flex-col gap-1.5",
                isStory && "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-8"
              )}
            >
              {caption && (
                <p
                  className={cn(
                    "text-[12px] leading-snug line-clamp-4 whitespace-pre-wrap break-words",
                    isStory ? "text-white" : "text-ink"
                  )}
                >
                  {caption}
                </p>
              )}
              {tags && tags.length > 0 && (
                <p
                  className={cn(
                    "text-[12px] font-medium break-words",
                    isStory ? "text-white/90" : "text-[#00376B]"
                  )}
                >
                  {tags.join(" ")}
                </p>
              )}
            </div>
          )}

          {/* ---------- RODAPÉ DE AÇÕES (só feed) ---------- */}
          {!isStory && (
            <div className="px-4 py-2 border-t border-border-soft flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink-muted">
                <Clapperboard size={15} />
                <span className="text-[10.5px] font-semibold">{FORMAT_LABEL[format]}</span>
              </div>
              <span className="text-[10.5px] text-ink-muted">Pré-visualização</span>
            </div>
          )}
        </div>
      </div>

      {/* ---------- AVISO DE ENQUADRAMENTO ---------- */}
      {interactive && slide && (
        <p className="text-[11.5px] text-ink-muted text-center">
          Arraste a mídia dentro da prévia para reposicionar. Ajuste o zoom ao lado.
        </p>
      )}
    </div>
  );
}
