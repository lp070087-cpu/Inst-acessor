# RELATÓRIO — Reconstrução da Página de Venda a partir da Apresentação Original

**Data:** 2026-08-29
**Branch:** `checkpoint-fase8-fase9`
**Escopo:** Somente a página de venda (`/` — landing). Nenhum outro módulo foi tocado.
**Status:** Implementação concluída · `tsc --noEmit` EXIT 0 · build bloqueado no sandbox (SWC download EAI_AGAIN — DONA roda local)

---

## 1. Objetivo

Refazer a página de venda do **Inst Acessor** usando a **apresentação original** (`apresentacao/Apresentação da pagina de venda.html` + `_parts/`, `assets/css/style.css`, `assets/js/main.js`) como referência **visual primária** — migrada corretamente para Next.js/React (sem iframe), preservando identidade, cores, gradientes, tipografia, animações e ritmo visual da apresentação, e mantendo todas as seções comerciais exigidas na Fase 10.

---

## 2. Fidelidade à apresentação

A landing foi reconstruída para ser reconhecida imediatamente como a **apresentação original**, agora como página de venda real:

| Aspecto | Origem na apresentação | Migração |
|---|---|---|
| Paleta e gradientes | `--grad`, orbs, spotlight | Tokens `--lnd-*` idênticos (bg `#F7F8FA`, ink `#111318`, grad `#F43F8E→#A855F7→#6366F1`) |
| Tipografia | Sora / Plus Jakarta Sans / Space Grotesk | `--lnd-font-display/body/data` |
| Abertura cinematográfica | Hero com mockup flutuante, grid-overlay, orbs | Hero + mockup dashboard real (dados animados) + parallax + float chips |
| Reveal por scroll | `IntersectionObserver` | `.lnd-reveal`/`.lnd-in` com `data-dir`/`data-delay` (threshold 0.12, rootMargin -6%) |
| Contadores | `[data-count]` | Animação de contagem (cubic-out) |
| Barras de progresso | `[data-w]` | `fillBars` no reveal |
| Anéis SVG | `[data-ring]`/`data-circ` | `strokeDashoffset` animado (1.2–1.6s) |
| Abas | `[data-tabs]` | Gerador de Copy, Timeline, Histórico (grupos independentes) |
| Parallax | `[data-parallax]` | Flutuação sutil no mockup do hero |
| Marquee | Faixa de destaques | Marquee 32s com itens duplicados |
| Chips flutuantes | Orbs / chips | `lnd-float-chip` f1/f2/f3 |
| Spotlight cursor | Efeito de luz | `lnd-spotlight` (radial rgba(168,85,247,.07)) |
| Microinterações | Hover cards | Elevação + borda gradiente em todos os cards |
| `prefers-reduced-motion` | Respeitado | Animações zeradas + valores finais aplicados |

---

## 3. Seções implementadas (36 blocos, ordem da apresentação)

1. **Nav** — logo, 7 links âncora, Entrar→`/login`, Criar conta→`/cadastro`, burger mobile.
2. **Hero** — kicker com pulse, h1 com gradiente, sub, CTAs (`Começar agora`→`/cadastro`, `Conhecer a plataforma`→`#dashboard`), trust com avatares + **mockup dashboard real** (topbar `app.instacessor.com.br`, seguidores 12.840, engajamento 6,4%, chart 12 barras, anel Score 84, pills 74/88/91, 3 float chips animados) com parallax.
3. **Marquee** — 12 itens de destaque.
4. **Problema** — 7 cards + pivot Antes/Depois.
5. **Solução** — 4 cards F10.
6. **Como Funciona** — 4 passos + flow-note.
7. **Dashboard** — 6 KPIs animados, chart SVG de alcance, 2 cards de comparação semanal/mensal.
8. **Score** — gauge 84 com anel gradiente, 4 pilares (92/76/84/68), nota.
9. **IA Acessor** — 4 chips de recursos + painel de chat com bubbles.
10. **Diagnóstico** — 8 cards com 4 estados (strong/opp/warn/weak) e barras animadas.
11. **Alertas** — 5 alertas (warn/danger/success) com hora.
12. **Estratégia** — score ring 76 + 5 movimentos priorizados + faixa "Recomendado esta semana".
13. **Nichos** — 8 cards de nicho (hot = Moda & Lifestyle).
14. **Calendário** — semana 7 dias (Terça = Melhor) + 3 insights.
15. **Ideias** — 9 cards com ícone + tag de formato.
16. **Gerador de Copy** — 4 abas com digitação animada real (Reel/Story/Carrossel/Legenda) + botões Gerar/Copiar.
17. **Mentoria** — 6 cards (problema → explicação → ação → prioridade).
18. **Metas** — diária/semanal/mensal com barras, meta, tempo restante e XP.
19. **XP** — Nível 8, 2.840 XP, barra, 5 marcos, 2 stats (6 semanas/12 metas), fundo decorado.
20. **Rank** — card atual (Estrategista, Rank 8) + progresso + 3 próximos ranks + menu 4 destinos.
21. **Conquistas** — 10 cards (done/progress/locked) com barras de progresso.
22. **Badges** — 5 tiers (Bronze→Lendário) com medalha gradiente 3D e status.
23. **Timeline** — abas Hoje/7d/30d/90d × 5 cards cada (dados exatos da apresentação).
24. **Análise de Conteúdos** — ranking 1º/2º/3º + engajamento por formato (4 barras).
25. **Perfil Público** — card com cover, avatar, handle, badges, stats, botão Compartilhar→`/cadastro`, evolução 90d.
26. **Histórico** — abas 7d/30d/90d/6m/1a com **gráfico SVG real** (área + linha + ponto) + 5 mini-cards.
27. **Diferencial** — tradicional (X) vs Inst Acessor (check) com logo.
28. **Preview Social** — 4 itens + mockup de celular (Reel 0:18, ações, legenda).
29. **Central de Publicação** — 4 cards "Disponível".
30. **Automações** — Growth Engine (Disponível) vs Comentários (Em preparação).
31. **Redes Sociais** — Instagram + TikTok.
32. **Segurança** — 6 cards (Conexão autorizada, Integração oficial, Permissões controladas, Tokens protegidos, Desconectar, Nenhuma senha) + nota de transparência.
33. **Planos** — Semanal R$27/semana, Mensal R$77/mês (destaque), Anual R$497/ano (preços preservados).
34. **FAQ** — 6 perguntas em acordeão.
35. **CTA Final** — fundo decorado, `Começar agora`→`/cadastro`, `Ver planos`→`#planos`.
36. **Footer** — marca, 3 colunas, disclaimer, ano automático.

---

## 4. Interatividade migrada (sem bibliotecas externas)

Implementada em `landing-client.tsx` com CSS + IntersectionObserver + rAF puros:

- Reveal por scroll com direções (up/left/right/scale) e delays 1–9
- Contadores animados com sufixo/precisão decimal (`pt-BR`)
- Barras `[data-w]` e anéis `[data-ring]` preenchidos ao entrar na tela
- Parallax no mockup do hero (rAF-throttled, desabilitado <900px e reduced-motion)
- Nav fixa com fundo ao rolar + menu mobile
- Scroll suave em âncoras (com `scroll-margin-top`)
- Abas por grupo independente (Copy/Timeline/Histórico)
- Gerador de Copy com digitação por caractere e botões Gerar/Copiar
- FAQ acordeão
- Spotlight que segue o cursor
- Ano automático no rodapé

---

## 5. Ajustes técnicos pontuais

1. **Escopo das abas corrigido** em `landing-client.tsx`: cada grupo `[data-tabs]` agora controla **apenas os painéis do seu próprio container** (antes, o init global escondia painéis de grupos diferentes — quebraria Timeline e Histórico).
2. **Classe de plataforma corrigida**: o componente emite `lnd-s-instagram`/`lnd-s-tiktok`; o CSS agora aceita os dois nomes (mantendo `lnd-s-ig`/`lnd-s-tk` legados).
3. **CSS novo anexado**: ~1.300 linhas de estilos para as seções recriadas (Diagnóstico, Alertas, Estratégia, Nichos, Metas/XP, Rank, Conquistas, Badges, Timeline, Perfil, Histórico, Diferencial, Segurança) + suportes do Hero + responsivo 1080/900/640 + reduced-motion estendido.

---

## 6. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/app/page.tsx` | Ordem completa das 36 seções + `Timeline`/`Historico` adicionados |
| `src/components/landing/sections-a.tsx` | Nav, Hero (mockup real), Marquee, Problema, Solução, Como Funciona, Dashboard |
| `src/components/landing/sections-b.tsx` | Score, IA, Diagnóstico, Alertas, Estratégia, Nichos, Calendário, Ideias, Copy, Mentoria |
| `src/components/landing/sections-c.tsx` | Metas, XP, Rank, Conquistas, Badges, Timeline, Análise, Perfil, Histórico, Diferencial |
| `src/components/landing/sections-d.tsx` | Preview, Publicação, Automações, Redes, **Segurança (reescrita)**, Planos, FAQ, CTA, Footer |
| `src/components/landing/landing-client.tsx` | Escopo das abas corrigido; parallax (novo) |
| `src/app/landing.css` | +~1.300 linhas: estilos das seções recriadas + responsivo + reduced-motion |

---

## 7. Validação

- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` → **EXIT 0** ✅ (gate de código)
- `npm run build` → bloqueado no sandbox: `Failed to load SWC binary for linux/x64` (download EAI_AGAIN — rede indisponível). **Esperado e documentado**: a DONA roda `npm run build` localmente.
- Braces do CSS balanceados (812/812).
- Todos os 362 tokens `lnd-*` usados nos componentes têm definição no CSS (as ocorrências "undefined" são variáveis CSS ou prefixos de template-literal resolvidos pelos estados `strong/opp/warn/weak`, `warn/danger/success`, `t-bronze/...`).

---

## 8. Não executado (conforme instruções)

- ❌ Nenhum `git commit` / `git push` / `git merge` / deploy / Vercel
- ❌ Nenhum `git restore` (working tree preservado)
- ❌ Nenhum `npm audit fix --force`
- ❌ Nenhuma alteração em auth, admin, Instagram/TikTok, Prisma, banco, IA, Asaas, publishing backend, automações backend ou dashboard
- ❌ Biblioteca Unitrix não consultada (economia de tokens, conforme orientação)

---

## 9. Próximos passos para a DONA (local)

1. `npm install` (se necessário) e `npm run build` para confirmar o bundle.
2. Abrir `/` e comparar visualmente com `apresentacao/Apresentação da pagina de venda.html`.
3. Quando aprovado, commitar e pushar normalmente.
4. Tarefa separada (não desta rodada): investigar `/login?error=Configuration`.
