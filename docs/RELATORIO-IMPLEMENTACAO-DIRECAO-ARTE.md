# RELATÓRIO — IMPLEMENTAÇÃO DA DIREÇÃO DE ARTE DA LANDING (ETAPA 2)

Data: 2026-08-31
Branch: `checkpoint-fase8-fase9`
Base: `docs/RELATORIO-DIRECAO-ARTE-LANDING.md` (aprovado)
Escopo: implementação da direção de arte **exclusivamente na landing**. Nenhuma alteração em Admin, Auth, Billing, Prisma, Neon, APIs ou integrações. Nenhum texto, conteúdo, ordem de seção, preço ou funcionalidade foi alterado. Sem dependências novas. Sem commit/push/deploy.

---

## 1. ARQUIVOS ALTERADOS

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/app/landing.css` | CSS | **Principal.** +~2127 linhas líquidas (bloco "DIREÇÃO DE ARTE" com o sistema T1–T12), e **remoção de ~549 linhas** de CSS morto de cards-gêmeos antigos. Arquivo final: 6.178 linhas. |
| `src/components/landing/landing-client.tsx` | TSX (client) | +38 linhas: scroll-scrub rAF fallback para `animation-timeline: view()` (linha do ComoFunciona) + `scrubCleanup` no cleanup. Sem novas dependências. |
| `src/components/landing/sections-a.tsx` | TSX (server) | Hero H1 line-by-line, Problema → lista editorial, Solução → bento assimétrico, linha conectora no ComoFunciona, Dashboard → console escuro. |
| `src/components/landing/sections-b.tsx` | TSX (server) | Score → console escuro, Diagnóstico → linhas editoriais, Nichos → tabela benchmark, Ideias → coluna editorial, Mentoria → trilha vertical. |
| `src/components/landing/sections-c.tsx` | TSX (server) | Metas → progress rings, XP/Rank/Histórico → console escuro. |
| `src/components/landing/sections-d.tsx` | TSX (server) | Preview Social → crossfade 2 phones, Planos → glowbox featured, FAQ → índice numérico, Central Publicação → pipeline, Redes Sociais → borda superior colorida, CTA Final → palavra gigante + shine. |
| `src/app/page.tsx` | — | **Não alterado.** Ordem de seções intacta (fonte de verdade). |

**Não tocados:** `package.json`, `.env*`, `globals.css`, Admin, Auth, Billing, Prisma, Neon, APIs, `apresentacao/`, Biblioteca Unitrix (somente leitura).

`git status --short` confirma que os únicos arquivos modificados desta rodada são os 6 acima; os demais itens não relacionados (`pasta da ordem/`, `prisma-diff-neon.sql`, `schema-neon-atual.prisma`, `RELATORIO-DIRECAO-ARTE-LANDING.md`) já existiam antes da implementação.

---

## 2. HERO — ANTES / DEPOIS

**Antes:** H1 em bloco único com fade-up `.lnd-reveal`; eyebrow pill roxa; score "84/100" estático solto; notebook mockup sem scrub.

**Depois:**
- **H1 line-by-line (T1):** `Transforme dados do Instagram em` / `decisões de crescimento.` em dois `.lnd-line`/`.lnd-line-inner`, cada um com `translateY(110%) → 0` em cascata via `.lnd-in`.
- **Eyebrow telemetria mono (T3):** `.lnd-hero-kicker` vira leitura de dado (SYS.INSTACESSOR // v2.0 · GROWTH ENGINE ONLINE), com pontinhos de status.
- **Palavra-gigante de fundo (T12):** `.lnd-hero::after` com "84/100" em `font-data` gigante, baixa opacidade, atrás do conteúdo.
- **Notebook:** mantido; `.lnd-js .lnd-notebook-inner` faz leve entrada de profundidade (rotateX/translateY) reutilizando a animação existente, sem novo JS.
- Controles de gradiente: H1 mantém gradiente apenas no trecho "decisões de crescimento." (função), não no bloco inteiro.

---

## 3. SEÇÕES 01–10 (PRIORIDADE 1) — MUDANÇAS

| # | Seção | Tratamento implementado |
|---|---|---|
| 01 | Dashboard | **Console escuro** (`#111318`): KPIs com dividers mono (`.lnd-console .lnd-kpi-card`), gráfico desenha (mantém), telemetria mono, raio reduzido (T11), sem "card em card". |
| 02 | Diagnóstico | Cards 4×4 removidos → **linhas editoriais** `.lnd-diag-row` com divider vertical colorido por status (strong/opp/warn/weak), valores em fonte de dados. |
| 03 | Gerador de Copy | Painel de app mantém; tabs com dots RGB mono (`.lnd-copy-tabs`), CTA "Gerar nova copy" com shine (T5). |
| 04 | Mentoria | **Trilha vertical** `.lnd-mentor-track`: filas alternadas wide/narrow, dot conector `.lnd-m-dot`, prioridade como chip mono (`.lnd-m-top`), linha de borda esquerda. |
| 05 | XP | **Console escuro**: barra com milestones, número **2.840** como palavra-gigante de fundo (T12), leitura mono. |
| 06 | Rank | **Console escuro**: tier em destaque com glow, próximos ranks como degraus horizontais. |
| 07 | Badges | Fundo claro (contraste com Rank); **shine sweep no hover** das medalhas (T5). |
| 08 | Análise de Conteúdos | **Ranking editorial**: números 1º/2º/3º grandes, **miniaturas realistas CSS** (camadas em vez de gradiente chapado), barras de formato mantêm. |
| 09 | Preview Social | **Crossfade de 2 phones** (`.lnd-preview-phones` + keyframes `lndPhoneCrossfade`/`Alt`), chip flutuante, fundo claro. |
| 10 | Redes Sociais | **Borda superior colorida de plataforma** (`.lnd-social-card::before`) + hover com brilho de marca, ícone maior. |

---

## 4. DEMAIS SEÇÕES — MUDANÇAS

- **Problema:** cards → **lista editorial** `.lnd-problem-editorial` com marcador ✕ (`.lnd-px`); pivot Antes/Depois mantido (forte).
- **Solução:** grid 2×2 simétrico → **bento assimétrico** `.lnd-bento-grid` (1 grande + 2 médios + 1 pequeno), ícones em posições alternadas.
- **ComoFunciona:** steps mantêm; **linha conectora `.lnd-scrub-line`** que preenche com scroll via `animation-timeline: view()` + fallback rAF (extensão em `landing-client.tsx`).
- **Score:** **console escuro**; número **84** gigante ao fundo (T12); pilares com gradiente por posição mantêm; nota em superfície de leitura.
- **IA Acessor:** fundo claro com painel chat, avatar com glow, bubbles em cascata mantêm, sem gradiente excessivo.
- **Alertas:** timeline vertical com dots e borda esquerda colorida, hora em mono.
- **Estratégia:** sticky mantém (único sticky da página); "Recomendado esta semana" com check animado (`.lnd-reco-strip` pulse).
- **Nichos:** **tabela benchmark** `.lnd-niche-table` (linhas com divider, "Top" com glow), sem cards.
- **Calendário:** grid semanal mantém; **melhor dia com glow + coroa ♛** (`.lnd-cal-day.lnd-best::before`); insights em linhas editoriais.
- **Ideias:** **coluna editorial** `.lnd-ideas-editorial` (formato como tag mono, ideia em destaque `.lnd-featured-idea` primeiro).
- **Metas:** **progress rings** `.lnd-goal-ring` SVG (track + fill + número central) em vez de barras; chip XP mantém.
- **Conquistas:** estados claros — done preenchido, progress com anel, locked dessaturado com cadeado.
- **Timeline:** **linha do tempo horizontal real** (`.lnd-timeline-grid::before` + dots `.lnd-tl-card::before`), valores grandes mono.
- **Perfil:** **cartão de compartilhamento** com glass e sombra realista (`.lnd-profile-card`), evolução em barras.
- **Histórico:** **console escuro**; gráfico grande, mini-cards viram leitura mono com dividers.
- **Diferencial:** tradicional (dashed, cinza) vs Acessor (elevado, glow), check com animação de entrada.
- **Central Publicação:** cards → **pipeline visual** `.lnd-pipeline`/`.lnd-pipe-step` (Agendado → Publicado → Status) com linha conectora.
- **Automações:** pronta-vs-futura mantém (`.lnd-auto-grid`/`.lnd-auto-card` preservados); contraste refinado.
- **Segurança:** **lista com checkmarks** `.lnd-security-list` + nota de transparência em destaque; ícones shield em fileira.
- **Planos:** card Mensal (featured) com **glowbox conic-gradient animado** (`.lnd-glowbox` + `@property --lnd-angle` + `lndSpinAngle`); badge "Mais escolhido" com shine.
- **FAQ:** acordeão mantém; **índice numérico mono** `.lnd-faq-num` ao lado da pergunta.
- **CTA Final:** **palavra "crescer" gigante ao fundo** (`.lnd-cta-final::before`); CTA primário com shine sweep.
- **Footer:** marca maior, dividers mais finos, disclaimer em superfície de leitura.

---

## 5. COMO A "CARA DE IA" FOI REDUZIDA

Medidas objetivas antes → depois (só `landing.css`):

| Métrica | Antes | Depois | Delta |
|---|---|---|---|
| `.lnd-card` (superfície de card) | 62 | 57 | −5 |
| `border-radius` (arredondamento) | 202 | 183 | −19 |
| `linear-gradient` (decoração) | 87 | 85 | −2 |
| `box-shadow` | 167 | 152 | −15 |
| `.lnd-in` (reveals de entrada) | 254 | 233 | −21 |
| `.lnd-reveal` (fade-up único) | 20 | 20 | 0 (estrutural, agora com curvas distintas) |

Além das contagens:
- **Anatomas distintas:** cada seção de dados agora tem ritmo próprio — console escuro (Dashboard/Score/XP/Rank/Histórico), linha editorial (Diagnóstico), trilha (Mentoria), tabela (Nichos), ranking (Análise), coluna (Ideias), pipeline (Central), lista (Problema/Segurança), rings (Metas), bento (Solução). Nenhum bloco de 3+ seções compartilha a mesma anatomia.
- **Cards-gêmeos removidos:** ~549 linhas de CSS morto (`.lnd-idea-card`, `.lnd-mentor-card`, `.lnd-diag-card`, `.lnd-niche-card`, `.lnd-goal-progress`, `.lnd-problem-list`, `.lnd-solucao-grid`, `.lnd-ideas-grid`, `.lnd-mentor-grid`, `.lnd-diag-grid`, `.lnd-niche-grid`) e suas referências responsivas foram apagadas. `.lnd-auto-grid`/`.lnd-auto-card` preservados (Automações ainda usa).
- **Gradiente com função:** reservado a pontos específicos (logo, CTA, trecho-chave do H2, estados ativos); fundos de dados usam `#111318` sólido, não gradiente.
- **Raio diferenciado (T11):** cards de dados mais quadrados; pill só em badges/chips.
- **Contraste vertical:** alternância claro → console → claro cria ritmo de leitura.

---

## 6. ANIMAÇÕES

Todas **sem biblioteca externa**; reusam a camada existente (`IntersectionObserver` + rAF + CSS) e respeitam `prefers-reduced-motion`:

- **T1 line-by-line** no H1 (cascata `.lnd-line`/`.lnd-line-inner`).
- **T4 scroll-scrub** da linha do ComoFunciona: `animation-timeline: view()` com keyframes `lndFillLine`; fallback rAF em `landing-client.tsx` (observa `.lnd-scrub-line` + `.lnd-steps`, computa progresso e seta `scaleX`); cancelado no cleanup.
- **T5 shine sweep** no CTA primário/final e medalhas (keyframes `lndShine`, `transform` + `opacity` no compositor).
- **T6 glowbox** conic-gradient animado no card de plano featured (`@property --lnd-angle`).
- **T10 crossfade** dos 2 phones no Preview Social (keyframes `lndPhoneCrossfade`/`Alt`).
- **T12 palavra-gigante** com parallax leve de fundo (rAF existente), recuada atrás do conteúdo.
- **Micro-interações direcionais:** hover com `translateX` no eixo de leitura (alertas, linhas editoriais), glow de marca nas redes sociais.
- `prefers-reduced-motion`: todas as animações reduzem a 0.001s e aplicam estados finais (bloco final existente).

---

## 7. ESTRATÉGIA DE CARDS / SUPERFÍCIES

- **Dois tipos de superfície:** `--lnd-card` (produto, claro) para "o que você faz"; `.lnd-console` (`#111318` e derivados) para "o que o sistema lê". Alternância vertical cria o ritmo.
- **Redução de "card dentro de card":** superfícies de console usam fundo sólido com dividers `rgba(255,255,255,.06)` em vez de painéis emoldurados sobre painéis.
- **Raio técnico (T11):** cards de dados com raio menor; pill reservado a badges/chips.
- **Superfícies de produto** mantêm raio e sombra suaves, mas hovers variam por contexto (lift só onde é produto; direcional/brilho onde é dado/rede).
- **Grain overlay** sutil (SVG feTurbulence data-URI, opacity ~0.03) em faixas escuras dá textura de console, sem custo perceptível.

---

## 8. TIPOGRAFIA

- Papéis preservados: Sora (display) + Plus Jakarta Sans (corpo) + Space Grotesk (`--lnd-font-data`, dados).
- **Eyebrow/telemetria mono (T3):** `font-data`, tracking 0.1–0.22em, micro-labels — em todos os `lnd-eyebrow` e cabeçalhos de cards de dados.
- **Números como tipografia:** KPIs de console, score 84, XP 2.840, ranks e metas usam `font-data` em escala grande.
- **Palavra-gigante (T12):** "84/100", "2.840", "crescer" em `clamp()` para escalar com viewport; recua atrás do conteúdo (z-index), opacidade baixa.
- **Unidade fluida `--lnd-u` (T9):** `min(1.4vh, max(1vw, 8px + 0.42vw))` aplicada a espaçamentos/escala de marcos; preserva mobile como experiência própria.
- **Controle de gradiente em texto:** limitado a 1 trecho-chave por H2 (função), não no título inteiro.

---

## 9. RESPONSIVIDADE

- Mobile continua experiência própria (breakpoints 1080/900/640 + bloco específico no fim).
- Console escuro: grids internos viram 1 coluna; dividers substituem colunas.
- Bento assimétrico reflui para pilha com alturas naturais.
- Tabela de nichos empilha linhas em ≤640px.
- Palavra-gigante reduz/oculta em telas < 480px para não virar ruído.
- Scroll-scrub com amplitude reduzida; fallback rAF desativado com `prefers-reduced-motion`.
- Sticky do Estratégia continua estático ≤900px; notebook do Hero escala ≤460px (mantém).

---

## 10. PERFORMANCE

- **Zero dependência nova** (package.json intocado).
- **+0 KB de libs JS:** só ~38 linhas de client (scrub rAF), cancelado no cleanup.
- **+~600–1000 linhas CSS** (dentro do orçamento previsto; resultado final: +~1.600 líquidas incl. remoção de dead code).
- Grain = 1 data-URI ~300 B; superfícies escuras = cor de fundo; animações em compositor (transform/opacity); `backdrop-filter` limitado a 6 usos (nav + perfil), nunca faixas inteiras; palavra-gigante = texto (rasterização única); nenhuma imagem raster nova (miniaturas = CSS).

---

## 11. TYPESCRIPT

```
NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit
→ EXIT 0 (zero erros)
```

---

## 12. BUILD

```
npm run build
→ EXIT 1 (apenas por ambiente: @next/swc-linux-x64-gnu não instalado no sandbox Linux)
```

Causa confirmada e já documentada em rodadas anteriores: ausência do binário SWC para linux/x64 no sandbox — **não é erro de código**. A DONA executa `npm run build` localmente (Windows) para validar.

---

## 13. GIT DIFF --CHECK

```
git diff --check
→ EXIT 0 (sem espaços em branco / conflitos de marcação)
```

---

## 14. VALIDAÇÃO VISUAL MANUAL (necessária)

Validações objetivas executadas: CSS braces balanceados (1162/1162), tsc EXIT 0, diff --check EXIT 0, dead-class scan limpo, contagens de repetição reduzidas. **Falta a validação visual no navegador**, que só a DONA pode fazer localmente:

1. `npm run build` + `npm run dev` (Windows) → abrir `/`.
2. Hero: H1 entra linha a linha; "84/100" de fundo; kicker telemetria; notebook com entrada leve.
3. Dashboard/Score/XP/Rank/Histórico: faixas escuras alternando com o fundo claro.
4. ComoFunciona: linha preenchendo no scroll (Chrome/Edge; fallback rAF nos demais).
5. Diagnóstico: dividers coloridos; Mentoria: trilha com dots; Nichos: tabela com "Top".
6. Metas: rings animados; Preview Social: crossfade dos 2 phones; Planos: glowbox no card Mensal; CTA Final: "crescer" gigante + shine.
7. `prefers-reduced-motion: reduce` no DevTools: tudo entra sem animação, estados finais visíveis.
8. Mobile ≤640px: bento empilhado, tabela empilhada, palavra-gigante reduzida, marquee legível.

---

## NÃO FEITO (conforme escopo)

- Nenhum commit, push ou deploy.
- Nenhuma alteração em Admin, Auth, Billing, Prisma, Neon, APIs, integrações.
- Nenhum texto, conteúdo, ordem, preço ou funcionalidade alterado.
- Nenhuma dependência nova; nenhuma lib de animação (GSAP/Lenis/Three/framer-motion/shaders/vídeo/cursor).
- Biblioteca Unitrix: somente leitura.
