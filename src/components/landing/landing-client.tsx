"use client";

import * as React from "react";

/**
 * Inst Acessor — Página de venda (landing).
 *
 * Cliente de animações/interatividade que reproduz fielmente o comportamento
 * do `main.js` da apresentação aprovada (`apresentacao/`), mas sem nenhuma
 * dependência externa (CSS + IntersectionObserver + rAF puros).
 *
 * Responsável por:
 *  - `lnd-js` no root (reveals começam ocultos e animam ao entrar na tela)
 *  - Contadores animados  `[data-count]`
 *  - Barras de progresso  `[data-w]`
 *  - Anéis de score        `[data-ring]`
 *  - Nav fixa com fundo ao rolar + menu mobile
 *  - Scroll suave para âncoras
 *  - Abas `[data-tabs]` (Gerador de Copy, Timeline, Histórico)
 *  - FAQ acordeão
 *  - Spotlight sutil que segue o cursor
 *  - Ano automático no rodapé
 *
 * Respeita `prefers-reduced-motion` (valores finais aplicados sem animação).
 */
export function LandingClient() {
  React.useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lnd-root");
    if (!root) return;

    root.classList.add("lnd-js");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ------------------------------------------------------------
    // Parallax sutil — `[data-parallax]` (flutuação leve ao rolar)
    // Desabilitado com reduced-motion e em telas <= 900px.
    // ------------------------------------------------------------
    const mqNarrow = window.matchMedia("(max-width: 900px)");
    const parallaxEls = () =>
      Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]")).filter((el) => {
        const v = parseFloat(el.dataset.parallax || "0");
        return v > 0;
      });
    let rafId = 0;
    const onParallax = () => {
      if (reduced || mqNarrow.matches) return;
      const rect = root.getBoundingClientRect();
      const mid = window.innerHeight / 2;
      parallaxEls().forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -120 || r.top > window.innerHeight + 120) return;
        const depth = parseFloat(el.dataset.parallax || "0");
        const offset = (r.top + r.height / 2 - mid) * depth;
        el.style.translate = `0 ${Math.round(offset)}px`;
      });
      void rect;
    };
    const onParallaxRaf = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(onParallax);
    };
    if (!reduced) {
      onParallaxRaf();
      window.addEventListener("scroll", onParallaxRaf, { passive: true });
    }

    // ------------------------------------------------------------
    // Contadores
    // ------------------------------------------------------------
    const fmtNumber = (value: number, decimals: number) => {
      if (decimals > 0) {
        return value.toFixed(decimals).replace(".", ",");
      }
      return Math.round(value).toLocaleString("pt-BR");
    };
    const runCounters = (scope: Element) => {
      scope.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        const target = parseFloat(el.dataset.count || "0");
        const dur = parseInt(el.dataset.dur || "1500", 10);
        const decimals = parseInt(el.dataset.decimals || "0", 10);
        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        if (reduced) {
          el.textContent = prefix + fmtNumber(target, decimals) + suffix;
          return;
        }
        const start = performance.now();
        const step = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3); // cubic-out
          el.textContent = prefix + fmtNumber(target * eased, decimals) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = prefix + fmtNumber(target, decimals) + suffix;
        };
        requestAnimationFrame(step);
      });
    };

    // ------------------------------------------------------------
    // Barras e anéis (valores finais)
    // ------------------------------------------------------------
    const fillBars = (scope: Element) => {
      scope.querySelectorAll<HTMLElement>("[data-w]").forEach((el) => {
        el.style.width = (el.dataset.w || "0") + "%";
      });
    };
    const fillRings = (scope: Element) => {
      scope.querySelectorAll<SVGElement>("[data-ring]").forEach((el) => {
        const pct = parseFloat(el.dataset.ring || "0");
        const circ = parseFloat(el.dataset.circ || "0");
        el.style.strokeDashoffset = String(circ * (1 - pct / 100));
      });
    };

    // ------------------------------------------------------------
    // Reveal
    // ------------------------------------------------------------
    const handleReveal: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        el.classList.add("lnd-in");
        fillBars(el);
        fillRings(el);
        runCounters(el);
        observer.unobserve(el);
      });
    };
    const observer = new IntersectionObserver(handleReveal, {
      threshold: 0.12,
      rootMargin: "0px 0px -6% 0px",
    });
    root.querySelectorAll<HTMLElement>(".lnd-reveal").forEach((el) => observer.observe(el));

    // ------------------------------------------------------------
    // Nav
    // ------------------------------------------------------------
    const nav = root.querySelector<HTMLElement>(".lnd-nav");
    const onScroll = () => {
      if (!nav) return;
      nav.classList.toggle("lnd-scrolled", window.scrollY > 14);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const burger = nav?.querySelector<HTMLElement>(".lnd-nav-burger");
    const onBurger = () => nav?.classList.toggle("lnd-open");
    burger?.addEventListener("click", onBurger);

    // ------------------------------------------------------------
    // Scroll suave nas âncoras
    // ------------------------------------------------------------
    const onAnchor = (e: Event) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href")?.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      nav?.classList.remove("lnd-open");
      if (reduced) target.scrollIntoView();
      else target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    root.addEventListener("click", onAnchor);

    // ------------------------------------------------------------
    // Abas [data-tabs]
    // ------------------------------------------------------------
    const onTabs = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-tab-target]");
      if (!btn) return;
      const tabs = btn.closest<HTMLElement>("[data-tabs]");
      if (!tabs) return;
      const targetId = btn.dataset.tabTarget;
      if (!targetId) return;
      tabs.querySelectorAll<HTMLElement>("[data-tab-target]").forEach((b) => {
        b.classList.toggle("lnd-active", b === btn);
      });
      const container = tabs.closest<HTMLElement>(".lnd-copy-output") ?? tabs.parentElement;
      container?.querySelectorAll<HTMLElement>("[data-tab-panel]").forEach((p) => {
        p.style.display = p.id === targetId ? "" : "none";
      });
      if (targetId.startsWith("tab-copy-")) animateCopy(targetId);
    };
    root.addEventListener("click", onTabs);

    // Botões do Gerador de Copy: "Gerar nova copy" re-anima; "Copiar" copia.
    const onCopyActions = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".lnd-copy-btn");
      if (!btn) return;
      const isPrimary = btn.classList.contains("lnd-primary");
      if (isPrimary) {
        const active = root.querySelector<HTMLElement>("[data-tab-target].lnd-active");
        animateCopy(active?.dataset.tabTarget ?? "tab-copy-reel");
        return;
      }
      const box = document.getElementById("lnd-copy-text");
      if (box?.textContent) {
        navigator.clipboard
          ?.writeText(box.textContent)
          .then(() => {
            const original = btn.innerHTML;
            btn.innerHTML = "Copiado!";
            setTimeout(() => (btn.innerHTML = original), 1600);
          })
          .catch(() => undefined);
      }
    };
    root.addEventListener("click", onCopyActions);

    // Estado inicial das abas: para cada grupo [data-tabs], ativa o primeiro
    // botão e mostra apenas o primeiro painel correspondente.
    root.querySelectorAll<HTMLElement>("[data-tabs]").forEach((tabs) => {
      const firstBtn = tabs.querySelector<HTMLElement>("[data-tab-target]");
      const firstId = firstBtn?.dataset.tabTarget;
      if (firstBtn) firstBtn.classList.add("lnd-active");
      // Cada grupo de abas controla APENAS os painéis dentro do seu próprio
      // container (Gerador de Copy, Timeline e Histórico são grupos
      // independentes na página).
      const container = tabs.closest<HTMLElement>(".lnd-copy-output") ?? tabs.parentElement;
      container?.querySelectorAll<HTMLElement>("[data-tab-panel]").forEach((p) => {
        p.style.display = p.id === firstId ? "" : "none";
      });
    });
    // O Gerador de Copy é o único grupo que anima a digitação por padrão.
    const copyPanel = document.getElementById("tab-copy-reel");
    if (copyPanel) copyPanel.style.display = "";

    // ------------------------------------------------------------
    // Gerador de Copy — demonstração animada
    // ------------------------------------------------------------
    const copyTexts: Record<string, string[]> = {
      "tab-copy-reel": [
        "TODA SEGUNDA TEM REEL NOVO NO AR 🔥",
        "Eu testei 3 estratégias de conteúdo… e só UMA dobrou o alcance.",
        "O segredo não é postar mais. É postar com intenção.",
        "Salva este Reel pra aplicar no seu perfil!",
      ],
      "tab-copy-story": [
        "Bora de bastidor? 👀",
        "Mostrei pro meu time o novo calendário de conteúdo…",
        "O Inst Acessor sugere o melhor horário pra cada formato.",
        "Qual vocês querem ver primeiro? Vota nos stories!",
      ],
      "tab-copy-carrossel": [
        "5 ERROS que matam o alcance no Instagram (e como evitar)",
        "1️⃣ Postar sem estratégia de hashtags",
        "2️⃣ Ignorar os insights do próprio perfil",
        "3️⃣ Não ter frequência — o algoritmo prefere quem é previsível",
        "Salva este carrossel e compartilha com quem precisa!",
      ],
      "tab-copy-legenda": [
        "O Instagram não premia quem posta mais. Premia quem entende os dados. 📊",
        "Com o Inst Acessor, você transforma métricas em decisões: melhores horários, formatos que engajam e o que sua audiência quer ver.",
        "Comece hoje e acompanhe seu Score de crescimento.",
        "#instagram #estrategia #crescimento #marketingdigital",
      ],
    };
    let copyTimer: ReturnType<typeof setInterval> | null = null;
    let charTimers: ReturnType<typeof setInterval>[] = [];
    function animateCopy(panelId: string) {
      const box = document.getElementById("lnd-copy-text");
      if (!box) return;
      if (copyTimer) clearInterval(copyTimer);
      charTimers.forEach((t) => clearInterval(t));
      charTimers = [];
      const lines = copyTexts[panelId] ?? copyTexts["tab-copy-reel"];
      box.innerHTML = "";
      let i = 0;
      const typeLine = () => {
        if (i >= lines.length) return;
        const p = document.createElement("p");
        p.style.marginBottom = "10px";
        p.style.lineHeight = "1.5";
        box.appendChild(p);
        let j = 0;
        const ct = setInterval(() => {
          j++;
          p.textContent = lines[i].slice(0, j);
          if (j >= lines[i].length) {
            clearInterval(ct);
            i++;
            copyTimer = setTimeout(typeLine, 160);
          }
        }, 12);
        charTimers.push(ct);
      };
      copyTimer = setTimeout(typeLine, 180);
    }
    if (!reduced) {
      animateCopy("tab-copy-reel");
    } else {
      const box = document.getElementById("lnd-copy-text");
      if (box) {
        box.innerHTML = "";
        copyTexts["tab-copy-reel"].forEach((line) => {
          const p = document.createElement("p");
          p.style.marginBottom = "10px";
          p.style.lineHeight = "1.5";
          p.textContent = line;
          box.appendChild(p);
        });
      }
    }

    // ------------------------------------------------------------
    // FAQ acordeão
    // ------------------------------------------------------------
    const onFaq = (e: Event) => {
      const q = (e.target as HTMLElement).closest<HTMLElement>(".lnd-faq-q");
      if (!q) return;
      q.closest<HTMLElement>(".lnd-faq-item")?.classList.toggle("lnd-open");
    };
    root.addEventListener("click", onFaq);

    // ------------------------------------------------------------
    // Spotlight
    // ------------------------------------------------------------
    const spotlight = root.querySelector<HTMLElement>(".lnd-spotlight");
    const onMove = (e: PointerEvent) => {
      if (!spotlight) return;
      spotlight.style.setProperty("--lnd-mx", e.clientX + "px");
      spotlight.style.setProperty("--lnd-my", e.clientY + "px");
      spotlight.classList.add("lnd-on");
    };
    const onLeave = () => spotlight?.classList.remove("lnd-on");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    // ------------------------------------------------------------
    // Ano
    // ------------------------------------------------------------
    root.querySelectorAll<HTMLElement>("[data-year]").forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onParallaxRaf);
      cancelAnimationFrame(rafId);
      burger?.removeEventListener("click", onBurger);
      root.removeEventListener("click", onAnchor);
      root.removeEventListener("click", onTabs);
      root.removeEventListener("click", onCopyActions);
      root.removeEventListener("click", onFaq);
      if (copyTimer) clearTimeout(copyTimer);
      charTimers.forEach((t) => clearInterval(t));
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return null;
}
