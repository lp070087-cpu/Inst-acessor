# RELATÓRIO — DIREÇÃO DE ARTE E REFINAMENTO PREMIUM DA LANDING (ETAPA 1 · AUDITORIA)

Data: 2026-08-31
Branch: `checkpoint-fase8-fase9`
Escopo: **ETAPA 1 — auditoria e direção de arte apenas.** Nenhum arquivo da landing foi editado. Este relatório define o plano; a implementação fica para uma rodada posterior, mediante aprovação.

---

## 1. PROJETOS ANALISADOS (Biblioteca Unitrix — somente leitura)

Foram auditados 13 projetos de referência, focando em **composição, movimento, comportamento, estética e apresentação** (nunca conteúdo):

| Projeto | Stack | O que entrega | Qualidade |
|---|---|---|---|
| `iron-man-main` | Next 16 · framer-motion · Lenis | HUD corners, telemetry mono, score 87.3+sin() ao vivo, card-surface glass, grain, navbar blur-on-scroll, frame-sequence 169 JPEGs | Referência de **data/IA premium** |
| `template-para-inteligencia-artificial-main` | Next 15 · framer-motion · recharts | Hero SVG procedural (aurora + dot-grid), bento glass, mockups de produto em CSS puro, reveals com easing custom | Qualidade alta, peso leve |
| `template-sass-landing-page-main` | Next 15 · Tailwind 4 · cobe · embla | Scramble text, Globe 3D (cobe), marquee vertical, PixelCard canvas, GridBeam | Qualidade média-alta |
| `template-parallax-templates-main` | Next 15 · shaders WebGL | Scroll horizontal, cursor custom (mix-blend-difference), MagneticButton, grain, stats editoriais `text-6xl` | Qualidade média-alta, **peso pesado** |
| `agroeta-main` | Next 15 · Tailwind 3 · CSS puro | **Line-by-line H1 reveal**, toolkit de keyframes, cards editoriais com borda colorida | Qualidade média, **muito leve** |
| `procoat-main` | Next 15 · swiper · SASS | Hero vídeo + intro em camadas, glass form, before/after slider | Qualidade média |
| `Banco XP` | Tailwind 4 · Lenis · GSAP | **Notebook rotateX(90→0) scrub**, glowbox conic-gradient borda animada, **prefers-reduced-motion tratado**, CSS scroll-driven (`animation-timeline: view()`) | Melhor exemplo de a11y |
| `logitech-nanobanana-kling-claude-main` | vanilla canvas | Canvas scroll-scrub 241 frames, sticky 420vh, easing `easedFrame += (t-e)*0.18`, DPR-aware | Técnica de scrub, **peso alto** |
| `Fruity-main` | Vite · React · framer-motion | **Giant word sincronizada a 1 MotionValue**, parallax anti-direcional, **unidade fluida `--u`**, carrossel 3D cilíndrico | Maior refinamento de engenharia |
| `vivence-joias-main` | Next · shadcn · CSS modules | **Zero lib de animação**, grade textura ouro, **shine sweep no CTA**, crossfade de 2 imagens, header transparente→blur, moldura offset | Sistema mais consistente |
| `maryane-master` | vídeo full-screen · Swiper | Hero vídeo, FAQ | Craft baixo, pouco a reusar |
| `Site1` | Lenis · GSAP | Clone Kiwify, reveals GSAP repetidos | Craft baixo — **exemplo do que evitar** |
| `agroeta` / `Banco XP` | (revisados acima) | Revisão dos dois melhores casos de CSS puro | — |

**Conclusão da biblioteca:** nenhum projeto é "copia e cola" — cada um contribui com 2–4 técnicas modulares. A síntese de maior impacto com menor custo é: **HUD/telemetria (iron-man) + bento/mockups CSS (template-IA) + CSS-only shine/crossfade (vivence) + line-by-line H1 (agroeta) + scroll-scrub leve (logitech/Banco XP) + unidade fluida (Fruity)**. Tudo reimplementável sobre a camada de animação já existente da landing (IntersectionObserver + rAF + CSS), **sem novas dependências**.

---

## 2. REFERÊNCIAS ESCOLHIDAS

1. **Linear / Vercel / Stripe** (norte aspiracional de SaaS de dados) — não está na pasta, mas é o padrão de mercado que os projetos da biblioteca imitam; define o tom "plataforma inteligente" em vez de "infoproduto".
2. **iron-man-main** — referência direta para seções de **dados/score/telemetria**: superfícies de console, leitura mono, números ao vivo.
3. **vivence-joias-main** — referência de **precisão e polimento em CSS puro**: shine sweep, crossfade, header com blur.
4. **agroeta-main** — referência do **H1 com reveal linha a linha** (efeito de abertura editorial, estilo Vercel).
5. **Banco XP** — referência de **scroll-scrub nativo (animation-timeline)** e **borda glow animada**, com acessibilidade já resolvida.
6. **Fruity-main** — referência de **tipografia fluida e palavra gigante sincronizada** (aplicado com moderação, no Hero/Score).

A landing continua sendo a **fonte de verdade** de conteúdo, textos, ordem, preços e funcionalidades. A biblioteca contribui apenas com composição e movimento.

---

## 3. TÉCNICAS ESCOLHIDAS

Ordenadas por prioridade (todas sem dependência nova, ou reusando infra já presente):

| # | Técnica | Origem | Custo | Uso planejado |
|---|---|---|---|---|
| T1 | **H1 line-by-line reveal** (`overflow-hidden` + `translateY(100%)→0`) | agroeta | Baixo | Hero — abertura editorial |
| T2 | **Superfícies "console escuro"** (painéis `#111318` derivados do ink) para seções de dados | iron-man | Médio | Dashboard, Score, XP, Rank, Histórico — cria ritmo claro/escuro vertical |
| T3 | **Eyebrow/telemetria mono** (`font-data`, tracking 0.1–0.22em, micro-label) | iron-man | Baixo | Todos os `lnd-eyebrow` + cabeçalhos de card de dados |
| T4 | **Scroll-scrub de barra/linha de progresso** via `animation-timeline: view()` + fallback rAF | Banco XP / logitech | Baixo | ComoFunciona (linha que "preenche"), Hero (progress bar) |
| T5 | **Shine sweep + glow** no CTA primário e medalhas (hover) | vivence | Baixo | CTA final, botões primários, badge do plano "Mais escolhido" |
| T6 | **Glowbox com borda conic-gradient animada** no card destacado de Planos | Banco XP | Médio | Card Mensal (featured) |
| T7 | **Grain overlay sutil** (SVG feTurbulence data-URI, opacity ~0.03) | iron-man / parallax | Baixo | Aplicado na página toda ou em faixas escuras |
| T8 | **Bento assimétrico** na Solução (2 grandes + 2 pequenos, alturas variadas) | template-IA | Médio | Quebra o grid 2x2 simétrico |
| T9 | **Unidade fluida `--u`** para escala tipográfica/espacamento | Fruity | Baixo | Token `--lnd-u: min(1.4vh, max(1vw, 8px + 0.42vw))` |
| T10 | **Micro-interações direcionais** (hover com translateX no eixo de leitura; crossfade de superfície) | vivence / iron-man | Baixo | Cards de IA, análise, redes |
| T11 | **Redução do raio de cards de dados** (mais quadrado, "tech") mantendo pill só em badges | iron-man | Baixo | Distinguir superfície de dados vs superfície de produto |
| T12 | **Palavra-gigante de fundo** (número/score de grande escala, `font-data` `clamp(120–220px)`) | Fruity | Baixo | Score, Rank, CTA final (texto de marca atrás, baixa opacidade) |

---

## 4. TÉCNICAS REJEITADAS (e por quê)

| Técnica | Origem | Motivo da rejeição |
|---|---|---|
| Frame-sequence de 169/241 JPEGs em scroll | iron-man / logitech | Bandwidth altíssimo; custo não se justifica em landing comercial |
| WebGL shaders em tela cheia | template-parallax | GPU pesada, sem função real no produto; contradiz "sem excesso" |
| **Lenis / Locomotive Scroll** | iron-man / Site1 | Adiciona dependência; o scroll nativo + rAF existente cobre. O brief manda verificar deps antes de adicionar. Decisão: **não adicionar** |
| GSAP ScrollTrigger | Site1 / Banco XP | O que precisamos de scrub (barra de progresso) sai com `animation-timeline: view()` + IntersectionObserver. GSAP repetitivo é justamente o "cara de IA" do Site1 |
| Globe 3D (cobe) | template-sass | Fora de contexto (não há mapa/dados geo) |
| Hero em vídeo autoplay | procoat / maryane | Peso + consumo de dados móvel; landing atual já tem mockup forte |
| Cursor custom global | template-parallax | Prejuízo de acessibilidade; o spotlight sutil já existe |
| Scramble text generalizado | template-sass | Efeito "techy" barato se repetido; usar zero ou no máximo 1 ponto |
| Scroll horizontal de seções | template-parallax | Quebra o scroll vertical convencional de uma landing de venda |
| Aurora/gradiente em todo fundo | template-IA | Cairia no "excesso de gradiente" que o brief proíbe |
| `cursor:none` / cursor magnético em tudo | parallax | Só nos 2 CTAs principais, se for aplicado |
| Marquee em rAF | Site1 | Manter CSS `animation` (já é o caso) — nunca rAF (bateria) |

**Decisão estrutural:** a camada de animação existente (`landing-client.tsx` com IntersectionObserver + rAF, gates `.lnd-js`/`.lnd-in`, `data-count`/`data-w`/`data-ring`, spotlight, tabs, FAQ) é **preservada e estendida** — não substituída. É uma base melhor que a maioria dos projetos da biblioteca (que nem tratam `prefers-reduced-motion`).

---

## 5. DIAGNÓSTICO DA LANDING ATUAL

### Estado técnico (o que já existe e é bom)

- **Zero dependências de animação** (só clsx, lucide-react, next, react, tailwind-merge, zod). Animação toda em CSS + um único client leve (`landing-client.tsx`, 491 linhas).
- **`prefers-reduced-motion` tratado** — reduz animações a 0.001s e força estados finais (só o Banco XP faz isso na biblioteca).
- **Mockup de notebook premium no Hero** — já é um diferencial real (perspectiva, base, câmera, tela de dashboard).
- **Dados integrados à composição** — contadores `[data-count]`, rings `[data-ring]`, barras `[data-w]`, gráfico SVG que desenha sozinho.
- **Hierarquia tipográfica correta** — Sora (display) + Plus Jakarta Sans (corpo) + Space Grotesk (dados). Três papéis distintos, já em uso.
- **Sinalização honesta** de dados demo (`lnd-demo-badge`).
- **Mobile próprio** com media queries em 3 breakpoints.

### Contagens que confirmam o problema de repetição

Medidas diretas do código atual (auditoria desta rodada):

| Métrica | Contagem | Leitura |
|---|---|---|
| `.lnd-reveal` (fade-up único) | **109** | Mesma animação de entrada em toda a página |
| `lnd-section-head lnd-center` (cabeçalho central) | **29** | Quase toda seção abre do mesmo jeito |
| `lnd-grad` em textos (H2/etc.) | **36** | Gradiente aplicado em quase todo título |
| `var(--lnd-grad)` em fundos/elementos | **34** | Gradiente como "decoração automática" |
| `border-radius: var(--lnd-r-*)` | **90** | Arredondamento em quase toda superfície |
| Hover `translateY(-4/-5/-6px)` | **17** | Mesmo gesto de "levantar" em todo card |
| Grids `repeat(3/4/5, 1fr)` | **19** | Grade simétrica como padrão universal |
| `data-dir="left/right/scale"` | **22** | Entradas laterais usadas de forma previsível |

### Síntese

A landing está **estruturalmente aprovada e tecnicamente sólida**, mas visualmente **monótona**: ~15 seções compartilham a mesma anatomia (eyebrow pill roxa + H2 gradiente + lead central + grade de cards gêmeos brancos com ícone quadrado + hover lift). O conjunto parece "uma única ideia repetida 40 vezes" em vez de "uma plataforma com 40 funcionalidades".

---

## 6. PROBLEMAS QUE CAUSAM "CARA DE IA"

1. **Anatoma idêntica seção a seção** — cabeçalho centralizado + grid de cards idênticos em ~15 blocos. O olho nunca descansa nem acelera.
2. **Grids perfeitos demais** — 3×3, 4×4, 5×5 sem assimetria, sem quebra, sem elemento "herói" dentro da grade.
3. **Gradiente em todo texto** — 36 títulos com `lnd-grad`. Vira "purple glow sem função" (exatamente o que o brief proíbe).
4. **Cards gêmeos** — mesmo branco, mesmo raio (`--lnd-r-lg`), mesma sombra xs, mesmo hover `translateY(-4px)` em 17 lugares. Zero variação de superfície e profundidade.
5. **Icon+title+paragraph repetido** — o bloco "quadradinho de ícone + título + descrição" é o clichê nº 1 de template.
6. **Eyebrow pill roxa repetida** — 29 seções abrem com o mesmo pill. O rótulo perde o valor de sinal.
7. **Fade-up idêntico** — 109 reveals com a mesma curva/easing/delay; não há narrativa de scroll, só "aparece tudo igual".
8. **Card-in-card em alguns pontos** — painéis que emolduram outros painéis (ex.: xp-card com badge dentro, ai-panel).
9. **Fundo sempre claro, sem alternância** — poucas faixas de contraste (`lnd-xp-section`, `lnd-bg-decor`). A página não respira verticalmente.
10. **Arredondamento excessivo** — 90 raios; cards de dados parecem "app de consumo" em vez de "console de análise".
11. **Sem storytelling de scroll** — nenhum scrub, nenhum sticky além de 1 caso (Estrategia), nenhuma linha que "preenche" com o progresso.
12. **Decoração sem função** — orbs desfocados + grid overlay como padrão repetido de fundo em vez de superfícies que comunicam dados.

---

## 7. DIREÇÃO DE ARTE PROPOSTA

**Conceito: "Inst Acessor é uma plataforma de inteligência, não um app de métricas em cards."**

A página deve parecer que **dados, IA, estratégia e gamificação são um único sistema vivo**, com:

- **Dois tipos de superfície**, com papéis claros:
  - **Superfície de produto** (clara, `--lnd-card`) — para "o que você faz" (gerador de copy, mentoria, calendário, automações, planos).
  - **Superfície de console/dados** (escura, derivada de `--lnd-ink #111318`) — para "o que o sistema lê" (dashboard, score, rank, histórico, telemetria). A alternância **claro → console → claro** cria o ritmo vertical que hoje falta — sem mudar a paleta aprovada.
- **Editorial + técnico**, não "infoproduto": escala tipográfica mais agressiva (palavra-gigante de fundo nos marcos), alinhamentos fortes, dados como tipografia (Space Grotesk em números grandes), menos pill.
- **Narrativa de scroll**: o único gesto recorrente vira uma *assinatura* — uma linha de progresso que preenche (ComoFunciona), o notebook que "entra" com leve scrub no hero, o sticky do Score que segura o número enquanto a lista rola.
- **Controle de gradiente**: gradiente reservado a 3–4 pontos de função (logo, CTA primário, o trecho-chave de 1 H2 por seção, estado "ativo"), nunca como decoração de fundo de texto corrido.
- **Detalhes de estúdio**: grain sutil, shine no CTA, crossfade em previews, micro-labels mono, hover direcional (não só "levanta").

**Anti-cara-de-IA aplicado:** cada seção recebe um **tratamento de ritmo distinto** (ver mapa §8): ora lista editorial, ora console escuro, ora bento assimétrico, ora tabela, ora timeline. Nenhum bloco de 3+ seções compartilha a mesma anatomia.

---

## 8. MAPA SEÇÃO POR SEÇÃO (tratamento de ritmo)

Ordem de seções **inalterada** (aprovada). Coluna "Tratamento" = como a seção se diferencia das vizinhas. Nada de texto/conteúdo é alterado.

### Abertura
| Seção | Tratamento |
|---|---|
| **Hero** | T1 line-by-line no H1; eyebrow vira telemetria mono (T3); notebook mantém (leve scrub de entrada, T4); palavra "84/100" gigante de fundo (T12, sutil) |
| **Marquee** | Mantém; máscara de fade nas bordas + `pauseOnHover` |

### Bloco de produto 01–10 (prints)
| Seção | Tratamento |
|---|---|
| **01 Dashboard** | **Console escuro** (T2): KPIs viram telemetria com dividers mono; gráfico desenha (mantém); remover emolduramento "card em card" |
| **02 Diagnóstico** | Mantém barras por status, mas com **linhas editoriais** (divider vertical colorido por status) em vez de cards 4×4; valores em fonte de dados |
| **03 Gerador de Copy** | Painel "app" com header de janela + hint de teclado; tabs e shimmer mantêm; CTA shine (T5) no "Gerar nova copy" |
| **04 Mentoria** | Vira **trilha vertical** com conector (timeline de orientação); prioridade como chip mono à esquerda; cards variam de largura (2/3 + 1/3 em filas alternadas) |
| **05 XP** | **Console escuro** (T2): barra de XP com milestones brilhantes; número 2.840 como palavra-gigante (T12) |
| **06 Rank** | **Console escuro**: tier em destaque com glow; próximos ranks como "degraus" horizontais |
| **07 Badges** | Medalhas com **shine sweep no hover** (T5); fundo claro (contraste com o console de Rank anterior) |
| **08 Análise de Conteúdos** | **Ranking editorial**: números 1º/2º/3º grandes; thumbnails virando **miniaturas realistas CSS** (camadas, não gradiente chapado); barras de formato mantêm |
| **09 Preview Social** | Dois phones com **crossfade** (T10) + chip flutuante (estilo hero); fundo claro |
| **10 Redes Sociais** | Cards com **borda superior colorida de plataforma** + hover com brilho de marca; ícone maior |

### Comerciais (estratégia/produto)
| Seção | Tratamento |
|---|---|
| **Problema** | Pivot mantém (é forte); cards de problema viram **lista com marcador ✕** (menos cards brancos gêmeos) |
| **Solução** | **Bento assimétrico** (T8): 1 card grande + 2 médios + 1 pequeno; ícone em posições alternadas |
| **Como Funciona** | Steps mantêm; **linha conectora preenche com scroll** (T4, `animation-timeline`) |
| **Score** | **Console escuro**: gauge maior, pilares com gradiente por posição (já existe), número 84 gigante ao fundo (T12); nota em superfície de leitura |
| **IA Acessor** | Bubbles mantêm cascade; avatar com glow; **fundo claro com painel "chat" sem gradient excessivo** |
| **Alertas** | **Timeline vertical** com status dots + borda esquerda colorida (mantém); hora em mono |
| **Estratégia** | Sticky mantém (único sticky da página); "Recomendado esta semana" vira **missão do dia** com check animado |
| **Nichos** | Vira **tabela de benchmark** (linhas com divider, "hot" com glow) — diferencia do padrão card |
| **Calendário** | Grid semanal mantém; **melhor dia com glow e coroa**; insights viram linhas editoriais |
| **Ideias** | **Coluna editorial** (cards com formato como tag mono, ideia em destaque primeiro) |
| **Metas** | **Progress rings** (em vez de barras) para variar o vocabulário visual; XP chip mantém |

### Gamificação/dados
| Seção | Tratamento |
|---|---|
| **Conquistas** | Grid mantém; estados claro: done com preenchimento, progress com anel, locked dessaturado com cadeado |
| **Timeline** | **Linha do tempo horizontal real** com dots e scrub entre períodos (tabs mantêm); valores grandes mono |
| **Perfil** | Cartão vira **"card de compartilhamento"** com glass e sombra realista; evolução em barras (mantém) |
| **Histórico** | **Console escuro**: gráfico grande, mini-cards viram leitura mono com dividers |
| **Diferencial** | Mantém comparação; tradicional (dashed, cinza) vs Acessor (elevado, glow); check com animação de entrada |

### Operação/confiança
| Seção | Tratamento |
|---|---|
| **Central Publicação** | Cards viram **pipeline visual** (Agendado → Publicado → Status) com linha conectora |
| **Automações** | Mantém pronta-vs-futura; "Disponível" com glow, "Em preparação" com dashed (já é) — refinar contraste |
| **Segurança** | **Lista com checkmarks** + nota de transparência em destaque; ícones shield em fileira |

### Conversão
| Seção | Tratamento |
|---|---|
| **Planos** | Card Mensal com **glowbox conic-gradient animado** (T6); badge "Mais escolhido" com shine (T5); preço em fonte de dados |
| **FAQ** | Mantém acordeão; **índice numérico mono** ao lado da pergunta |
| **CTA Final** | **Palavra "crescer" gigante ao fundo** (T12); CTA primário com **shine sweep** (T5); orbs mantêm |
| **Footer** | Refinamento: marca maior, dividers mais finos, disclaimer em superfície de leitura |

---

## 9. IMPACTO EM PERFORMANCE

**Objetivo: zero degradação.** Base de cálculo: landing atual já é leve (nenhuma imagem raster além de ícones SVG; animação em compositor).

| Item | Impacto |
|---|---|
| Novas dependências | **Zero** (nenhuma lib de animação adicionada) |
| Grain overlay | 1 SVG data-URI (~300 B) com `opacity 0.03`, pintura única por camada — negligible |
| Superfícies escuras | Apenas cores de fundo — custo zero |
| `animation-timeline: view()` | CSS nativo; sem JS; fallback mostra estado final para navegadores sem suporte |
| Scroll-scrub de linhas | Reusa o rAF/observer existente (estendido ~60–120 linhas no client) |
| Shine/glowbox/crossfade | `transform` + `opacity` no compositor; sem layout thrash |
| `backdrop-blur` | **Limitado a 2–3 elementos** (nav, 1 card de perfil) — nunca em faixas inteiras |
| Tipografia gigante de fundo | Texto, não imagem — custo de rasterização única por viewport |
| Imagens | Nenhuma imagem raster nova planejada (miniaturas realistas = CSS) |
| rAF | Mantido contido: 1 rAF global no client, com cancelamento no cleanup e desativado em `prefers-reduced-motion` |

Estimativa de delta: **+0 KB JS de libs** (só ~60–120 linhas de client), **+600–1000 linhas CSS**. Custo de pintura total: baixo, dentro do orçamento de uma landing comercial.

---

## 10. ESTRATÉGIA MOBILE (versão própria, não desktop comprimido)

1. **Grids**: 3/4/5 colunas → 1 coluna (já parcialmente feito); **bento assimétrico reflui para pilha** com alturas naturais; tabelas de benchmark viram **linhas empilhadas**.
2. **Console escuro**: padding reduzido; grid interno 2 colunas → 1; dividers substituem colunas laterais.
3. **Palavra-gigante de fundo**: escala via `clamp()` e recua atrás do conteúdo com `z-index`; em telas < 480px, reduz ou oculta para não virar ruído.
4. **Touch**: hovers direcionais/shine são apenas estados de `hover` (não afetam touch); `:focus-visible` mantém feedback para teclado.
5. **Scroll-scrub**: amplitude reduzida em telas pequenas; `animation-timeline` com faixa de `cover` limitada; em `prefers-reduced-motion`, estados finais são aplicados direto (já é o padrão atual).
6. **Sticky do Estratégia** já vira estático ≤900px (mantém).
7. **Notebook do Hero** já escala para ≤460px e chips flutuantes somem ≤640px (mantém).
8. **Marquee**: mantém (CSS), com duração maior em telas pequenas para leitura confortável.

---

## 11. ARQUIVOS QUE SERIAM MODIFICADOS (rodada de implementação)

| Arquivo | Mudança |
|---|---|
| `src/app/landing.css` | **Principal** — novas superfícies de console, line-by-line, shine, glowbox, grain, timeline scrub, token `--lnd-u`, redução de raio em cards de dados, ritmo de faixas |
| `src/components/landing/landing-client.tsx` | Estender a camada de animação: observer de linha de progresso (scrub suave), estado de `:hover`/crossfade opcional, palavra-gigante com parallax leve |
| `src/components/landing/sections-a.tsx` | Hero (line-by-line H1 + telemetria eyebrow), Solução (bento assimétrico), Problema (lista editorial) |
| `src/components/landing/sections-b.tsx` | Score (console + palavra gigante), Nichos (tabela benchmark), Ideias (coluna editorial), Calendário (glow no melhor dia), Metas (rings) |
| `src/components/landing/sections-c.tsx` | XP/Rank/Histórico (console escuro), Conquistas (estados), Perfil (cartão glass), Timeline (linha real), Mentoria (trilha) |
| `src/components/landing/sections-d.tsx` | Planos (glowbox featured), CTA Final (palavra gigante + shine), Preview Social (crossfade 2 phones), Central Publicação (pipeline), FAQ (índice numérico) |
| `src/app/page.tsx` | **Nenhuma mudança de ordem/conteúdo** — no máximo, se necessário, classes wrapper neutras (evitável na maioria dos casos) |

**Não serão tocados:** Admin, Auth, Billing, Prisma, Neon, APIs, rotas do app, `globals.css` do app (isolamento `lnd-` mantido), `.env*`, `package.json` (nenhuma dependência nova), apresentacao/.

---

## VALIDAÇÃO DESTA ETAPA

- **Nenhum arquivo da landing foi editado.** `git status` confirma apenas o relatório novo em `docs/`.
- **Nenhum commit/push.** Biblioteca Unitrix: somente leitura.
- Conteúdo, textos, ordem, preços e funcionalidades: **intactos** (não foram tocados e não serão).
- Próxima rodada (mediante aprovação): implementar a direção de arte seção a seção, com `tsc --noEmit` EXIT 0 como gate e `prefers-reduced-motion` preservado.
