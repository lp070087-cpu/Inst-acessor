"use client";

import * as React from "react";

/**
 * Inst Acessor — Storytelling horizontal (GSAP + ScrollTrigger).
 *
 * A partir da seção "Cinco níveis de reconhecimento" (#badges), o scroll
 * vertical passa a controlar uma sequência horizontal de etapas. Cada seção
 * entra pela direita e sai pela esquerda, sincronizada com o scroll (scrub),
 * sem autoplay. A sequência termina quando "Objetivos claros, progresso
 * visível." (#metas) está completamente apresentada — aí o pin é encerrado e
 * a página volta ao scroll vertical normal. Rolar para cima inverte tudo.
 *
 * Arquitetura canônica do ScrollTrigger horizontal:
 *   .lnd-h-pin   → elemento pinado (100vh, overflow:hidden)
 *   .lnd-h-track → faixa flex com 100vw por etapa; GSAP anima o x() do track
 *
 * Regras respeitadas:
 *  - Importa GSAP/ScrollTrigger APENAS aqui (carregamento localizado);
 *  - cleanup completo no unmount e em cada rebuild (kill + revert + remove
 *    classe), sem memory leak nem ScrollTriggers duplicados;
 *  - SSR-safe: roda somente no cliente, via useEffect + import dinâmico;
 *  - Desktop/tablet (>= 901px): pin + scrub horizontal;
 *  - Mobile (<= 900px) e prefers-reduced-motion: NÃO pin; scroll vertical
 *    normal, com os reveals leves já existentes (fallback);
 *  - Nenhuma seção é removida, reordenada ou reescrita — apenas reposicionada
 *    dentro do pin (transform) e, quando necessário, encaixada por escala,
 *    sem alterar a identidade visual aprovada.
 */
export function HorizontalScroll() {
  React.useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lnd-root");
    const pin = root?.querySelector<HTMLElement>(".lnd-h-pin");
    const track = root?.querySelector<HTMLElement>(".lnd-h-track");
    if (!root || !pin || !track) return;

    const mqDesktop = window.matchMedia("(min-width: 901px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canRun = () => mqDesktop.matches && !reduced.matches;

    let teardown: (() => void) | undefined;
    let refresh: (() => void) | undefined;
    let disposed = false;
    let resizeTimer = 0;

    const start = () => {
      if (!canRun()) return;

      let gsapCleanup: (() => void) | undefined;

      void import("gsap").then(({ gsap }) =>
        void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
          // Se o componente desmontou ou o viewport mudou enquanto o módulo
          // carregava, não cria nada (evita trigger órfão / pin no mobile).
          if (disposed || !canRun()) return;
          gsap.registerPlugin(ScrollTrigger);

          const panels = Array.from(
            track.querySelectorAll<HTMLElement>(":scope > .lnd-section")
          );
          if (panels.length < 2) return;

          // Ativa o layout horizontal no CSS (fora daqui o padrão é vertical).
          pin.classList.add("lnd-h-on");

          // Encaixe: nenhuma seção pode ser cortada. Painéis cujo conteúdo é
          // mais alto que a área útil (100vh − nav) recebem uma escala
          // proporcional (nunca acima de 1). Mede no fluxo natural (offsetHeight
          // ignora transforms), depois deixa a regra .lnd-h-fit aplicar o scale.
          // Há um piso de escala (0.78) para não destruir a legibilidade: se nem
          // assim couber, o painel ganha rolagem interna sutil (.lnd-h-tall) — o
          // conteúdo permanece 100% alcançável, sem cortar nem vazar da etapa.
          const navH =
            parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--lnd-nav-h"
              )
            ) || 72;
          const usable = () => window.innerHeight - navH;
          const fitPanels = () => {
            panels.forEach((panel) => {
              const container =
                panel.querySelector<HTMLElement>(".lnd-container");
              if (!container) return;
              container.style.transform = "";
              const needed = container.offsetHeight;
              const area = usable();
              const scale = needed > area ? Math.min(1, area / needed) : 1;
              const fitted = Math.max(0.78, scale);
              if (fitted < 1) {
                panel.classList.add("lnd-h-fit");
                panel.style.setProperty("--lnd-h-fit-scale", fitted.toFixed(3));
                // Se mesmo no piso ainda passar da área, libera rolagem interna
                // no painel (caso raro); senão garante que nada vaze/clipe.
                const fittedNeeded = needed * fitted;
                panel.classList.toggle(
                  "lnd-h-tall",
                  fittedNeeded > area + 24
                );
              } else {
                panel.classList.remove("lnd-h-fit");
                panel.classList.remove("lnd-h-tall");
                panel.style.removeProperty("--lnd-h-fit-scale");
              }
            });
          };
          fitPanels();

          const distancePx = () =>
            Math.max(1, track.scrollWidth - window.innerWidth);

          const tween = gsap.to(track, {
            x: () => -distancePx(),
            ease: "none",
            scrollTrigger: {
              trigger: pin,
              start: "top top",
              end: () => "+=" + distancePx(),
              scrub: 1,
              pin: true,
              pinType: "transform",
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onRefresh: () => fitPanels(),
            },
          });

          const doRefresh = () => {
            if (disposed || !canRun()) return;
            fitPanels();
            ScrollTrigger.refresh();
          };

          gsapCleanup = () => {
            tween.scrollTrigger?.kill();
            tween.kill();
            ScrollTrigger.getAll().forEach((t) => t.kill());
            gsap.set(track, { clearProps: "all" });
            pin.classList.remove("lnd-h-on");
            panels.forEach((p) => {
              p.classList.remove("lnd-h-fit");
              p.classList.remove("lnd-h-tall");
              p.style.removeProperty("--lnd-h-fit-scale");
            });
          };

          refresh = doRefresh;
        })
      );

      return () => {
        refresh = undefined;
        gsapCleanup?.();
      };
    };

    const stop = () => {
      teardown?.();
      teardown = undefined;
      refresh = undefined;
    };

    // Só reconstroi quando o comportamento muda de fato (breakpoint ou
    // reduced-motion). Resize comum apenas recalcula encaixe + pin.
    const onMediaChange = () => {
      stop();
      teardown = start();
    };
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        refresh?.();
      }, 120);
    };
    const onLoaded = () => refresh?.();

    teardown = start();

    mqDesktop.addEventListener?.("change", onMediaChange);
    reduced.addEventListener?.("change", onMediaChange);
    window.addEventListener("resize", onResize);

    // Depois de fontes/imagens carregarem, recalcula encaixe e o pin.
    if (document.fonts?.ready) {
      void document.fonts.ready.then(onLoaded).catch(() => undefined);
    }
    window.addEventListener("load", onLoaded);

    return () => {
      disposed = true;
      stop();
      window.clearTimeout(resizeTimer);
      mqDesktop.removeEventListener?.("change", onMediaChange);
      reduced.removeEventListener?.("change", onMediaChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onLoaded);
    };
  }, []);

  return null;
}
