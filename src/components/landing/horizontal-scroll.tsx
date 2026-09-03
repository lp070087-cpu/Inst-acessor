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
 * GEOMETRIA (o que causava o desalinhamento):
 *  - Cada painel (`.lnd-h-track > .lnd-section`) recebe via style inline a
 *    MESMA largura em px = largura real do palco (`pin.clientWidth`), com
 *    flex 0 0 fixo, sem shrink/grow. Nenhuma largura é derivada de conteúdo,
 *    não há gap nem margem externa — o painel é exatamente 1 viewport útil.
 *  - O track NÃO tem `width: max-content`: é um flex `nowrap`, então o
 *    `scrollWidth` real = n × largura do painel, e a distância percorrida é
 *    `track.scrollWidth - pin.clientWidth` (nunca aproximada).
 *  - O antigo "fit" aplicava escala DIFERENTE por painel (e mudava durante o
 *    scroll). Agora há UMA escala única (`--lnd-h-s`) para TODOS os painéis,
 *    calculada UMA vez por refresh, aplicada apenas no container INTERNO. A
 *    largura/posição externa do painel nunca muda. Caso raro de viewport muito
 *    baixa: o painel ganha rolagem interna (`lnd-h-tall`) sem mexer na largura.
 *  - Nada de translate/scale no track além do `x` do GSAP; sem xPercent.
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
 *    dentro do pin (transform), sem alterar a identidade visual aprovada.
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

    // Altura real do header fixo, lida do token da landing (.lnd-root).
    const navHeight = () => {
      const raw = getComputedStyle(root).getPropertyValue("--lnd-nav-h");
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) && n > 0 ? n : 72;
    };

    let teardown: (() => void) | undefined;
    let refresh: (() => void) | undefined;
    let disposed = false;
    let resizeTimer = 0;
    // Geração do run: impede que um import("gsap") pendente de um run antigo
    // crie ScrollTrigger duplicado se o breakpoint alternou (desktop→mobile→
    // desktop) antes do módulo resolver.
    let runId = 0;

    const start = () => {
      if (!canRun()) return;

      let gsapCleanup: (() => void) | undefined;
      const myRun = ++runId;
      void import("gsap").then(({ gsap }) =>
        void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
          // Se o componente desmontou, o run foi superado ou o viewport mudou
          // enquanto o módulo carregava, não cria nada (evita trigger órfão,
          // pin no mobile e instâncias duplicadas).
          if (disposed || myRun !== runId || !canRun()) return;
          gsap.registerPlugin(ScrollTrigger);

          const panels = Array.from(
            track.querySelectorAll<HTMLElement>(":scope > .lnd-section")
          );
          if (panels.length < 2) return;

          const stageWidth = () =>
            Math.max(1, pin.clientWidth || window.innerWidth);
          const stageArea = () => {
            // Palco = altura total do pin (100vh). A folga da nav fixa é
            // reservada pelo padding-top do painel; aqui mede-se o espaço
            // disponível para o conteúdo interno.
            const h = pin.clientHeight || window.innerHeight;
            return Math.max(240, h - navHeight());
          };

          const applyWidths = (vp: number) => {
            for (const panel of panels) {
              panel.style.flex = `0 0 ${vp}px`;
              panel.style.width = `${vp}px`;
              panel.style.minWidth = `${vp}px`;
              panel.style.maxWidth = `${vp}px`;
            }
          };

          // Encaixe vertical: UMA escala única para todos, aplicada no
          // container interno (nunca no painel, nunca durante o scroll).
          const measureFit = (vp: number) => {
            applyWidths(vp);
            const containers = panels
              .map((p) => p.querySelector<HTMLElement>(".lnd-container"))
              .filter((c): c is HTMLElement => Boolean(c));

            let maxNeeded = 0;
            for (const c of containers) {
              const h = c.offsetHeight;
              if (h > maxNeeded) maxNeeded = h;
            }
            const area = stageArea();
            let scale = maxNeeded > 0 ? area / maxNeeded : 1;
            if (scale > 1) scale = 1;
            // Piso de legibilidade: se nem no piso couber, o painel ganha
            // rolagem interna — nunca texto minúsculo nem conteúdo cortado.
            const FLOOR = 0.6;
            const uniform = scale < FLOOR ? FLOOR : scale;

            // A classe no .lnd-root ativa o scale só quando < 1 (preserva
            // position:sticky/fixed em qualquer seção fora do storytelling).
            root.style.setProperty(
              "--lnd-h-s",
              uniform < 1 ? uniform.toFixed(4) : "1"
            );
            root.classList.toggle("lnd-h-scaled", uniform < 1);

            for (let i = 0; i < panels.length; i++) {
              const c = containers[i];
              if (!c) continue;
              const stillTall = c.offsetHeight * uniform > area + 2;
              panels[i].classList.toggle("lnd-h-tall", stillTall);
            }
          };

          const geometry = () => {
            const vp = stageWidth();
            measureFit(vp);
            return {
              vp,
              dist: Math.max(1, track.scrollWidth - pin.clientWidth),
            };
          };

          // Ativa o layout horizontal (fora daqui o padrão é vertical).
          pin.classList.add("lnd-h-on");
          const geo = geometry();

          const tween = gsap.to(track, {
            // Lê o valor atualizado de geo a cada refresh (invalidateOnRefresh).
            x: () => -geo.dist,
            ease: "none",
            scrollTrigger: {
              trigger: pin,
              // Começa quando o topo do palco encosta no topo do viewport. A
              // nav é position:fixed e fica por cima; a folga do header é
              // reservada pelo padding-top do painel — sem deslocar o pin.
              start: "top top",
              // A distância real em pixels: soma dos painéis − palco.
              end: () => "+=" + geo.dist,
              scrub: 0.8,
              pin: true,
              pinType: "transform",
              anticipatePin: 1,
              invalidateOnRefresh: true,
              // Snap suave: cada painel assenta exatamente na viewport.
              snap: {
                snapTo: 1 / (panels.length - 1),
                duration: { min: 0.15, max: 0.55 },
                delay: 0.08,
                ease: "power2.out",
              },
            },
          });

          const refreshAll = () => {
            if (disposed || !canRun()) return;
            const next = geometry();
            // Se a distância mudou (resize/fonte/imagem), re-aponta o tween e
            // deixa o invalidateOnRefresh reavaliar a função x().
            if (Math.abs(next.dist - geo.dist) > 0.5) {
              geo.dist = next.dist;
            }
            ScrollTrigger.refresh();
          };

          gsapCleanup = () => {
            tween.scrollTrigger?.kill();
            tween.kill();
            ScrollTrigger.getAll().forEach((t) => t.kill());
            gsap.set(track, { clearProps: "all" });
            pin.classList.remove("lnd-h-on");
            root.classList.remove("lnd-h-scaled");
            root.style.setProperty("--lnd-h-s", "1");
            for (const panel of panels) {
              panel.style.flex = "";
              panel.style.width = "";
              panel.style.minWidth = "";
              panel.style.maxWidth = "";
              panel.classList.remove("lnd-h-tall");
            }
          };

          refresh = refreshAll;
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

    // Só reconstrói quando o comportamento muda de fato (breakpoint ou
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
