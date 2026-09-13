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
    // Linha de progresso do "Como Funciona" (fallback rAF)
    // Navegadores sem `animation-timeline: view()` preenchem a linha
    // conforme o scroll. Com suporte, o CSS cuida sozinho.
    // ------------------------------------------------------------
    let scrubCleanup: (() => void) | null = null;
    const supportsScrollTimeline =
      typeof CSS !== "undefined" &&
      !!CSS.supports &&
      CSS.supports("animation-timeline: view()");
    if (!supportsScrollTimeline && !reduced) {
      const scrubLine = root.querySelector<HTMLElement>(".lnd-scrub-line");
      const scrubHost = root.querySelector<HTMLElement>(".lnd-steps");
      if (scrubLine && scrubHost) {
        scrubLine.style.transform = "scaleX(0)";
        let scrubRaf = 0;
        const onScrub = () => {
          const r = scrubHost.getBoundingClientRect();
          const vh = window.innerHeight;
          const start = vh * 0.82;
          const end = vh * 0.22;
          const p = Math.min(1, Math.max(0, (vh - r.top - start) / (end - start)));
          scrubLine.style.transform = `scaleX(${p})`;
        };
        const onScrubRaf = () => {
          cancelAnimationFrame(scrubRaf);
          scrubRaf = requestAnimationFrame(onScrub);
        };
        window.addEventListener("scroll", onScrubRaf, { passive: true });
        onScrubRaf();
        scrubCleanup = () => {
          window.removeEventListener("scroll", onScrubRaf);
          cancelAnimationFrame(scrubRaf);
        };
      }
    }

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
    // 5 variações por formato — demonstração funcional SEM API.
    const copyTexts: Record<string, string[][]> = {
      "tab-copy-reel": [
        [
          "TODA SEGUNDA TEM REEL NOVO NO AR 🔥",
          "Eu testei 3 estratégias de conteúdo… e só UMA dobrou o alcance.",
          "O segredo não é postar mais. É postar com intenção.",
          "Salva este Reel pra aplicar no seu perfil!",
        ],
        [
          "O REEL QUE NINGUÉM CONTA PRA VOCÊ 😱",
          "Crescer no Instagram não é sobre sorte.",
          "É sobre dados, horário certo e consistência.",
          "Salva este Reel pra aplicar no seu perfil!",
        ],
        [
          "3 SINAIS de que seu perfil está perdendo alcance",
          "1️⃣ Você posta em horários aleatórios",
          "2️⃣ Não olha os insights dos seus posts",
          "3️⃣ Seguidores não comentam",
          "O Inst Acessor lê tudo isso por você.",
        ],
        [
          "PARE DE POSTAR TODO DIA (se for sem estratégia) 🛑",
          "Postar mais não é postar melhor.",
          "O que engaja é constância + relevância.",
          "Testa essa dica por 7 dias e me conta.",
        ],
        [
          "COMO EU DOBREI MEU ALCANCE EM 30 DIAS 📈",
          "Não foi postando mais. Foi postando melhor.",
          "Melhor horário, melhor formato, melhor gancho.",
          "Comentou que quer o passo a passo?",
        ],
      ],
      "tab-copy-story": [
        [
          "Bora de bastidor? 👀",
          "Mostrei pro meu time o novo calendário de conteúdo…",
          "O Inst Acessor sugere o melhor horário pra cada formato.",
          "Qual vocês querem ver primeiro? Vota nos stories!",
        ],
        [
          "Responde aqui 👇",
          "Qual conteúdo você quer ver essa semana?",
          "Enquete nos stories decide o próximo post.",
        ],
        [
          "O que o algoritmo quer de você: constância",
          "Todo dia um story novo mantém você no topo.",
          "O Inst Acessor monta seu calendário automático.",
        ],
        [
          "Bastidor: eu quase apaguei esse post 😅",
          "Aí vi no dashboard que ele ia bombar.",
          "Confia nos dados. Eles não mentem.",
        ],
        [
          "Ideia de story: os 3 horários que mais engajam",
          "Salva esse story pra aplicar depois!",
        ],
      ],
      "tab-copy-carrossel": [
        [
          "5 ERROS que matam o alcance no Instagram (e como evitar)",
          "1️⃣ Postar sem estratégia de hashtags",
          "2️⃣ Ignorar os insights do próprio perfil",
          "3️⃣ Não ter frequência — o algoritmo prefere quem é previsível",
          "Salva este carrossel e compartilha com quem precisa!",
        ],
        [
          "5 HÁBITOS de quem cresce de verdade no Instagram",
          "1️⃣ Publica com frequência previsível",
          "2️⃣ Analisa os próprios insights",
          "3️⃣ Testa formatos novos todo mês",
          "4️⃣ Responde comentários rápido",
          "5️⃣ Ajusta o que não funciona",
          "Salva pra não esquecer!",
        ],
        [
          "ANTES × DEPOIS: como organizei meu calendário",
          "Antes: postava quando dava vontade",
          "Depois: plano semanal definido com IA",
          "Resultado: +2,1x de alcance em Reels",
          "O Inst Acessor faz o plano pra você.",
        ],
        [
          "O ERRO #1 de quem não cresce no Instagram",
          "Não é falta de conteúdo. É falta de estratégia.",
          "Postar sem saber o que o algoritmo quer.",
          "Cada formato tem o seu melhor horário.",
          "Descubra o seu no Score inteligente.",
        ],
        [
          "Mitos e verdades sobre o algoritmo",
          "MITO: o Instagram esconde seu perfil",
          "VERDADE: ele prioriza constância e retenção",
          "MITO: hashtag é o segredo",
          "VERDADE: dados do seu perfil valem mais",
          "Compartilha com quem precisa ler isso!",
        ],
      ],
      "tab-copy-legenda": [
        [
          "O Instagram não premia quem posta mais. Premia quem entende os dados. 📊",
          "Com o Inst Acessor, você transforma métricas em decisões: melhores horários, formatos que engajam e o que sua audiência quer ver.",
          "Comece hoje e acompanhe seu Score de crescimento.",
          "#instagram #estrategia #crescimento #marketingdigital",
        ],
        [
          "Crescer no Instagram virou ciência, não sorte. 📊",
          "Com o Inst Acessor você acompanha Score, melhores horários e o que sua audiência quer ver.",
          "Comece hoje e veja seu perfil com outros olhos.",
          "#crescimento #moda #instagram",
        ],
        [
          "Você não precisa postar mais. Precisa postar melhor. ✨",
          "Dados no lugar de achismo: o Inst Acessor traduz métricas em decisões.",
          "Seu próximo Reel pode ser o divisor de águas.",
          "#estrategia #conteudo #marketingdigital",
        ],
        [
          "A diferença entre quem cresce e quem trava é a consistência.",
          "O Inst Acessor monta seu calendário ideal e alerta antes das quedas.",
          "Planeje a semana em minutos, não em horas.",
          "#planejamento #crescimento #socialmedia",
        ],
        [
          "Seu perfil fala. Você só precisa aprender a ouvir. 🎧",
          "Insights, alertas e um plano de ação priorizado por impacto.",
          "O Inst Acessor lê os dados pra você agir.",
          "#instagram #crescimento #instacessor",
        ],
      ],
    };
    const lastCopyIdx: Record<string, number> = {};
    let copyTimer: ReturnType<typeof setTimeout> | null = null;
    let charTimers: ReturnType<typeof setInterval>[] = [];
    function animateCopy(panelId: string) {
      const box = document.getElementById("lnd-copy-text");
      if (!box) return;
      if (copyTimer) clearTimeout(copyTimer);
      charTimers.forEach((t) => clearInterval(t));
      charTimers = [];
      const variants = copyTexts[panelId] ?? copyTexts["tab-copy-reel"];
      // Não repete a mesma copy em seguida.
      let next = Math.floor(Math.random() * variants.length);
      if (variants.length > 1 && next === (lastCopyIdx[panelId] ?? -1)) {
        next = (next + 1) % variants.length;
      }
      lastCopyIdx[panelId] = next;
      const lines = variants[next];
      box.innerHTML = "";
      // Estado de carregamento (demo — sem API).
      box.classList.add("lnd-copy-loading");
      box.setAttribute("aria-busy", "true");
      const finishLoading = () => {
        box.classList.remove("lnd-copy-loading");
        box.setAttribute("aria-busy", "false");
        if (reduced) {
          lines.forEach((line) => {
            const p = document.createElement("p");
            p.style.marginBottom = "10px";
            p.style.lineHeight = "1.5";
            p.textContent = line;
            box.appendChild(p);
          });
          return;
        }
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
        typeLine();
      };
      copyTimer = setTimeout(finishLoading, 550);
    }
    if (!reduced) {
      animateCopy("tab-copy-reel");
    } else {
      const box = document.getElementById("lnd-copy-text");
      if (box) {
        box.innerHTML = "";
        (copyTexts["tab-copy-reel"][0] ?? []).forEach((line) => {
          const p = document.createElement("p");
          p.style.marginBottom = "10px";
          p.style.lineHeight = "1.5";
          p.textContent = line;
          box.appendChild(p);
        });
      }
    }

    // ------------------------------------------------------------
    // Chat demonstrativo IA Acessor — [data-ai-q]
    // Perguntas fixas + respostas pré-escritas (SEM API/auth).
    // ------------------------------------------------------------
    const aiAnswers: Record<string, string> = {
      "1": "Analisei os últimos 30 dias: seus Reels perderam força principalmente no <b>3º toque</b> — quem vê para antes do final. Dois ajustes de alto impacto: abre com um <b>gancho nos 2 primeiros segundos</b> (corta o “oi gente”) e testa Reels de <b>15–20s</b>, que seguram retenção. Sua frequência de 4/semana está boa — mantém. Quer que eu monte esse teste no calendário?",
      "2": "Pelo seu histórico, sua audiência engaja mais às <b>11h</b> e <b>21h</b> — o horário das 18h vem perdendo força nas últimas 4 semanas. Sugestão: Reels às <b>11h30</b>, Stories às <b>21h</b> e carrosséis no fim de tarde. Consistência pesa mais que horário “perfeito”: mantém os mesmos dias da semana.",
      "3": "Com base no que mais performou, sugiro: 1 Reel de <b>antes/depois</b> do seu processo (seu formato com melhor retenção), 1 carrossel de <b>3 erros</b> que travam o alcance, e 1 story de <b>bastidor</b> com enquete. Isso cobre descoberta, salvamento e conexão — o trio que move seu Score.",
      "4": "Seu engajamento está em 62 — o gargalo é <b>comunidade</b>: poucos comentários e respostas. Três ações: responda todo comentário na <b>1ª hora</b>, encerre os Reels com uma <b>pergunta</b> (em vez de “salva esse post”), e use stories com <b>caixa de perguntas</b> 2x por semana. Em 14 dias isso costuma subir 8–12 pontos.",
      "5": "Seu perfil está bem, mas 3 pontos seguram o Score: <b>bio sem palavra-chave</b> clara do seu nicho, destaques desatualizados e <b>frequência irregular</b> nos Stories. Passo a passo: bio com o que você faz + pra quem, 3 capas de destaque alinhadas à sua marca e 5 Stories/semana. Posso gerar a bio pronta pra você?",
    };
    let aiTimer: ReturnType<typeof setTimeout> | null = null;
    const onAiQ = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-ai-q]");
      if (!btn) return;
      const key = btn.dataset.aiQ;
      const question = btn.dataset.aiQuestion;
      if (!key || !question) return;
      const panel = btn.closest<HTMLElement>(".lnd-ai-panel");
      const log = panel?.querySelector<HTMLElement>("[data-ai-log]");
      if (!panel || !log) return;
      if (aiTimer) clearTimeout(aiTimer);

      // Se é a primeira pergunta, remove a saudação.
      log.querySelector(".lnd-ai-greet")?.remove();
      // Remove um "analisando…" pendente de uma pergunta anterior não concluída.
      log.querySelector(".lnd-ai-thinking")?.remove();

      // Confirma a pergunta selecionada visualmente.
      panel.querySelectorAll<HTMLElement>("[data-ai-q]").forEach((b) => {
        b.classList.toggle("lnd-active", b === btn);
      });

      const mkTag = (txt: string, cls = "") => {
        const s = document.createElement("span");
        s.className = "lnd-tag" + (cls ? " " + cls : "");
        s.textContent = txt;
        return s;
      };
      const mkBody = (html: string) => {
        const b = document.createElement("span");
        b.className = "lnd-ai-body";
        b.innerHTML = html;
        return b;
      };
      const mkUser = () => {
        const d = document.createElement("div");
        d.className = "lnd-ai-bubble lnd-b-left lnd-ai-dyn";
        d.appendChild(mkTag("Você", "lnd-purple"));
        d.appendChild(mkBody(question.replace(/[<>&]/g, "")));
        log.appendChild(d);
        return d;
      };
      const mkThinking = () => {
        const d = document.createElement("div");
        d.className = "lnd-ai-bubble lnd-b-right lnd-ai-thinking lnd-ai-dyn";
        d.innerHTML =
          '<span class="lnd-tag">IA Acessor</span><span class="lnd-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
        log.appendChild(d);
        return d;
      };
      const mkAnswer = (html: string) => {
        const d = document.createElement("div");
        d.className = "lnd-ai-bubble lnd-b-right lnd-ai-dyn";
        d.appendChild(mkTag("IA Acessor"));
        d.appendChild(mkBody(html));
        log.appendChild(d);
        return d;
      };

      // Novos balões iniciam com a classe que o CSS transiciona; o `lnd-in`
      // é adicionado no próximo frame para a entrada acontecer de fato.
      const userEl = mkUser();
      const thinkEl = mkThinking();
      requestAnimationFrame(() => {
        userEl.classList.add("lnd-in");
        thinkEl.classList.add("lnd-in");
      });

      aiTimer = setTimeout(() => {
        thinkEl.remove();
        const answer = aiAnswers[key] ?? aiAnswers["1"];
        const answerEl = mkAnswer(answer);
        answerEl.classList.add("lnd-in");
        // Segue a conversa até a resposta.
        log.scrollTo({ top: log.scrollHeight, behavior: reduced ? "auto" : "smooth" });
      }, reduced ? 60 : 820);
    };
    root.addEventListener("click", onAiQ);

    // ------------------------------------------------------------
    // Demo social do cartão "Seu crescimento" — curtir, comentários,
    // enviar. Visual apenas (SEM backend/auth/persistência).
    // ------------------------------------------------------------
    const pubLike = (btn: HTMLElement) => {
      const card = btn.closest<HTMLElement>(".lnd-profile-card");
      const likes = card?.querySelector<HTMLElement>("[data-pub-likes] b");
      const on = btn.classList.toggle("lnd-on");
      btn.setAttribute("aria-pressed", String(on));
      if (likes) {
        const cur = parseInt(likes.textContent || "128", 10);
        if (!Number.isNaN(cur)) likes.textContent = String(cur + (on ? 1 : -1));
      }
    };
    const pubToggleComments = (btn: HTMLElement) => {
      const card = btn.closest<HTMLElement>(".lnd-profile-card");
      const comments = card?.querySelector<HTMLElement>("[data-pub-comments]");
      if (!comments) return;
      const open = comments.classList.toggle("lnd-open");
      card
        ?.querySelectorAll<HTMLElement>("[data-pub-comments-toggle], [data-pub-comment-toggle]")
        .forEach((b) => b.setAttribute("aria-expanded", String(open)));
      const label = card?.querySelector<HTMLElement>("[data-pub-comments-toggle]");
      if (label) label.textContent = open ? "Ocultar comentários" : "Ver 3 comentários";
    };
    const onPubSocial = (e: Event) => {
      const t = e.target as HTMLElement;
      const like = t.closest<HTMLElement>("[data-pub-like]");
      if (like) {
        e.preventDefault();
        pubLike(like);
        return;
      }
      const commentsToggle = t.closest<HTMLElement>("[data-pub-comments-toggle]");
      if (commentsToggle) {
        e.preventDefault();
        pubToggleComments(commentsToggle);
        return;
      }
      const commentIcon = t.closest<HTMLElement>("[data-pub-comment-toggle]");
      if (commentIcon) {
        e.preventDefault();
        pubToggleComments(commentIcon);
        return;
      }
      const send = t.closest<HTMLElement>("[data-pub-send]");
      if (send) {
        e.preventDefault();
        send.classList.add("lnd-on");
        setTimeout(() => send.classList.remove("lnd-on"), 500);
      }
    };
    root.addEventListener("click", onPubSocial);

    // ------------------------------------------------------------
    // Preview Social — cards laterais: pulso de toque / clique
    // (`lnd-tapped`). Touch e mouse disparam igual; o efeito some ao
    // fim da animação. Nada depende de hover.
    // ------------------------------------------------------------
    const onPreviewTap = (e: Event) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(".lnd-preview-item");
      if (!item || reduced) return;
      item.classList.remove("lnd-tapped");
      void item.offsetWidth; // reinicia a animação
      item.classList.add("lnd-tapped");
    };
    root.addEventListener("pointerdown", onPreviewTap, { passive: true });

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
      scrubCleanup?.();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onParallaxRaf);
      cancelAnimationFrame(rafId);
      burger?.removeEventListener("click", onBurger);
      root.removeEventListener("click", onAnchor);
      root.removeEventListener("click", onTabs);
      root.removeEventListener("click", onCopyActions);
      root.removeEventListener("click", onFaq);
      root.removeEventListener("click", onAiQ);
      root.removeEventListener("click", onPubSocial);
      root.removeEventListener("pointerdown", onPreviewTap);
      if (copyTimer) clearTimeout(copyTimer);
      if (aiTimer) clearTimeout(aiTimer);
      charTimers.forEach((t) => clearInterval(t));
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return null;
}
