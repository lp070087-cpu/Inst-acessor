"use client";

import * as React from "react";

/**
 * ENQUADRAMENTO DE MÍDIA — zoom + reposicionamento
 * ================================================
 * O preview mostrava a mídia com `object-cover` puro: a imagem era recortada no
 * centro e o usuário não tinha como escolher o que ficava visível. Para uma foto
 * vertical num preview 4:5, isso costuma cortar cabeça ou produto — e o que se
 * via no preview não era o que se queria publicar.
 *
 * Aqui o enquadramento é um PAR (zoom, deslocamento) aplicado como
 * `transform: scale() translate()`. A mídia continua com `object-cover`, então:
 *
 *   - `zoom`   → 1 = cobre o quadro; > 1 aproxima (recorta mais);
 *   - `offset` → quanto a imagem saiu do centro, em FRAÇÃO do quadro (0.5 = 50%
 *                para a direita). Fração, e não pixel, porque o mesmo
 *                enquadramento precisa valer no editor e no preview grande, que
 *                têm larguras diferentes.
 *
 * O que o usuário escolhe é o que o preview mostra: os dois usam esta mesma
 * função. Nada é inventado e nada é recalculado por conta própria.
 *
 * LIMITE HONESTO: como o enquadramento é aplicado em `transform`, ele ainda NÃO
 * viaja para a publicação real — o motor publica a mídia original. Isto é
 * preview + rascunho, exatamente como o resto da tela. Não chamo de "crop" no
 * sentido de recortar o arquivo, porque o arquivo não é recortado.
 */

export interface Framing {
  /** 1 = cobre o quadro. Acima de 1, aproxima. */
  zoom: number;
  /** Deslocamento horizontal, em fração do quadro. Pode ser negativo. */
  offsetX: number;
  /** Deslocamento vertical, em fração do quadro. Pode ser negativo. */
  offsetY: number;
}

export const DEFAULT_FRAMING: Framing = { zoom: 1, offsetX: 0, offsetY: 0 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** Teto do deslocamento — impede arrastar a mídia para fora do quadro. */
const MAX_OFFSET = 0.5;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Estilo de `transform` para um dado enquadramento.
 *
 * Composição de propósito: `translate` ANTES de `scale` faria o deslocamento ser
 * multiplicado pelo zoom, e o arraste ficaria mais rápido quanto maior o zoom.
 * Com `scale` primeiro, `offsetX` é sempre a fração do quadro, independente do
 * zoom — que é a intuição de quem está arrastando.
 */
export function framingStyle(framing: Framing): React.CSSProperties {
  return {
    transform: `scale(${framing.zoom}) translate(${framing.offsetX * 100}%, ${framing.offsetY * 100}%)`,
    transformOrigin: "center",
  };
}

/** Um enquadramento é "neutro" quando não muda nada em relação ao cover puro. */
export function isDefaultFraming(f: Framing): boolean {
  return f.zoom === 1 && f.offsetX === 0 && f.offsetY === 0;
}

/**
 * Arraste com ponteiro, devolvendo o novo deslocamento.
 *
 * Devolve uma função de `onPointerDown` já ligada ao enquadramento atual. Usa
 * `setPointerCapture` para que o arraste continue mesmo se o ponteiro sair do
 * elemento — sem isso o gesto morre na borda, o que é exatamente onde ele
 * costuma terminar num celular.
 */
export function useFramingDrag(
  framing: Framing,
  onChange: (next: Framing) => void
): React.PointerEventHandler<HTMLElement> {
  const start = React.useRef<{
    pointerId: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
    width: number;
    height: number;
  } | null>(null);

  // `framing` e `onChange` mudam a cada render; guardados em ref para que o
  // handler seja estável e não force re-render de quem o consome.
  const framingRef = React.useRef(framing);
  framingRef.current = framing;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  return React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Só botão principal / toque. Ignora clique com botão direito e afins.
    if (event.button !== 0) return;

    start.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: framingRef.current.offsetX,
      oy: framingRef.current.offsetY,
      width: rect.width,
      height: rect.height,
    };

    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* ambientes sem pointer capture: o arraste funciona, só não sai da caixa */
    }

    const move = (e: PointerEvent) => {
      const s = start.current;
      if (!s || e.pointerId !== s.pointerId) return;
      // Divide pelo tamanho do QUADRO (não da imagem): assim o arraste é 1:1
      // com o que o dedo percorre, em qualquer largura de tela.
      const dx = (e.clientX - s.x) / s.width;
      const dy = (e.clientY - s.y) / s.height;
      onChangeRef.current({
        zoom: framingRef.current.zoom,
        offsetX: clamp(s.ox + dx, -MAX_OFFSET, MAX_OFFSET),
        offsetY: clamp(s.oy + dy, -MAX_OFFSET, MAX_OFFSET),
      });
    };

    const end = (e: PointerEvent) => {
      const s = start.current;
      if (s && e.pointerId !== s.pointerId) return;
      start.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }, []);
}

export { MAX_OFFSET };
