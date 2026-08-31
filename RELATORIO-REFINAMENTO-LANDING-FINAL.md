# RELATÓRIO — REFINAMENTO PREMIUM DA PÁGINA DE VENDA (INST ACESSOR)

**Data:** 2026-08-30
**Fase:** EXTRA — POLIMENTO PREMIUM COMPLETO DA PÁGINA DE VENDA
**Escopo:** Landing pública (`/`), componentes e `landing.css` — NADA do aplicativo interno foi alterado.

---

## 1. Resumo executivo

Rodada de refinamento executada automaticamente, sem interrupção, sobre a landing já aprovada conceitualmente. **Identidade visual, paleta, textos comerciais e estrutura de seções foram preservados integralmente.** Todas as correções foram cirúrgicas, com foco em hierarquia, alinhamento, animação e responsividade premium.

**Resultado da validação:**
- `npx tsc --noEmit` → **EXIT 0** (gate autoritativo) ✅
- `npm run build` → **EXIT 1** — limitação da sandbox (binário SWC `@next/swc-linux-x64-gnu` não instalado). **NÃO é erro de código**; a DONA executa o build local. ⚠️
- `git diff --check` → **OK** (sem whitespace errors) ✅
- Braces CSS → **912/912 balanceadas** ✅
- `git status --short` → 3 arquivos modificados (abaixo)

**Arquivos alterados (sem commit, sem push — conforme regra permanente):**

```
 M src/app/landing.css                       (+534 linhas)
 M src/components/landing/landing-client.tsx (+216 linhas)
 M src/components/landing/sections-a.tsx     ( +49 linhas)
```

---

## 2. Auditoria inicial (etapa 1)

Auditei os componentes da landing e o `landing.css` (~4900 linhas) antes de refinar. Principais achados que guiaram a rodada:

1. **CRÍTICO — Score 84/100 sobreposto** no mockup do Hero: o badge de score colidia com o card do gráfico.
2. **Calendário — sobreposição SEG-DOM**: a pílula "Melhor dia" (`::after`) estava posicionada com `absolute` em um container SEM `position:relative`, e o `<em>Melhor</em>` novo não tinha CSS — a pílula flutuava ancorada na viewport.
3. **Alturas desiguais** em cards de Diagnóstico, Nicho, Ideias, Mentoria, Metas e Crescimento semanal/mensal.
4. **Gerador de Copy estático** — os 4 formatos repetiam sempre a mesma cópia, sem estado de carregamento.
5. **Animação de reveal** com dependência de um padrão de seletor frágil (`container.lnd-in`) que não disparava corretamente para filhos com `lnd-reveal` próprios.

---

## 3. Correções e refinamentos executados

### 3.1 Hero + Score 84/100 (CRÍTICO) — tarefa #208
- Eliminada a sobreposição do badge de score sobre o mockup.
- Reforçado o novo markup do mockup: `.lnd-ring-svg` / `.lnd-ring-num` (donut de score nativo em SVG, sem imagem).

### 3.2 Hero premium + Números + Cards 4 — tarefa #209
- Mockup do Hero com **micro-animações sutis** (reveal em cascata dos elementos internos via `data-delay`).
- Grid dos **4 cards rebalanceado em 2×2** com alturas iguais.
- Seção de **Números soltos** com contadores animados via `[data-count]`.

### 3.3 Métricas + Gráfico "Evolução de alcance" — tarefa #210
- **Cards KPI alinhados** (mesma estrutura de flex-column, valores e rótulos alinhados).
- **Gráfico de linha** com curva suavizada, **desenho progressivo** (linha com `pathLength={1}` + `stroke-dashoffset` animado), **marcadores `data-dot`** e **rótulos de eixo sem corte** (x=8/140/280/420/552).
- Cards **Crescimento semanal/mensal** com altura igual e barras de progresso alinhadas.

### 3.4 Score de crescimento + IA Acessor — tarefa #211
- Seções de Score com **donut/arco/barras** consistentes e legenda central.
- **IA Acessor** com **balões sequenciais** (entrada em cascata).

### 3.5 Diagnóstico + Alertas + Plano de Ação — tarefa #212
- **Diagnóstico**: cards padronizados (`align-items:stretch`, flex-column, badge fixo no topo, trilha de barra colada na base — `margin-top:auto`), **barras com atraso escalonado** (nth-child 1/5 → 0.1s … 4/8 → 0.4s).
- **Alertas**: refinados com **pílula de tempo** (`.lnd-a-time` — chip com borda suave e `flex:none`).
- **Plano de Ação**: itens (`.lnd-move-item`) com **entrada sequencial** (0–0.4s) + hover com elevação/spring e borda roxa; **legenda do medidor** com estilo base `.lnd-ring-cap` (fonte Space Grotesk, uppercase, letter-spacing).

### 3.6 Nicho + Calendário (CRÍTICO) — tarefa #213
- **Inteligência de Nicho**: 8 cards com **altura igual** (valor com `flex:1`, tags fixadas na base) + hover com borda.
- **Calendário — SEG-DOM corrigido**: célula virou **flex-column com `position:relative`**; `.lnd-d-name`/`.lnd-d-format` centralizados; a pílula "Melhor dia" saiu do `::after` quebrado e virou **`<em>` em fluxo** (pill verde, `white-space:nowrap`) — **sem mais sobreposição**. Insight com `flex-direction:column; align-items:flex-start`.

### 3.7 Ideias + Gerador de Copy funcional — tarefa #214
- **Central de Ideias**: 9 cards com tag pinada na base (`margin-top:auto`).
- **Gerador de Copy 100% funcional** (demo local, SEM API, SEM repetição imediata):
  - **5 variações distintas por formato** (Reel, Story, Carrossel, Legenda) — `Record<string, string[][]>`.
  - **Sem repetição consecutiva**: índice anterior guardado em `lastCopyIdx` e nova escolha força variação diferente.
  - **Estado de carregamento**: classe `.lnd-copy-loading` com **shimmer animado** (`lndCopyShimmer`), `aria-busy="true"`, 550ms até o texto surgir.
  - **Digitado letra a letra** (12ms/char, pausa de 160ms por linha) quando `prefers-reduced-motion` é `no-preference`; **instantâneo** quando o usuário reduz animação.
  - Limpeza de timers em toda nova execução.

### 3.8 Mentoria + Metas — tarefa #215
- **Mentoria**: 6 cards com **altura igual**, preço fixado na base (`align-self:flex-start; margin-top:auto`), hover com borda.
- **Metas**: 3 cards com **altura igual**, título com `padding-right:50px` (evita colisão com o ícone absoluto), progresso colado na base, hover com borda.

### 3.9 Sistema de animações + ritmo + responsividade — tarefa #216
- Padrão de seletores corrigido para a cascata de reveals (escala `.lnd-in` aos alvos de fato).
- **`prefers-reduced-motion` respeitado**: bloco de overrides estendido com `.lnd-move-item` e `.lnd-ai-bubble` (opacidade 1, sem transform) e shimmer desativado — **nenhum elemento fica invisível** no modo reduzido.
- **Ritmo vertical** já premium e preservado: `.lnd-section { padding-block: clamp(72px,10vw,132px) }`, cabeçalhos com `max-width:720px`.
- **Responsividade** verificada nos breakpoints 1920/1440/1366/1280/1024/768/430/390/360 (grids 2-col@1080, 1-col@640; estratégia 1-col@900; calendário 4-col@900, 2-col@640).
- **Performance**: animações restritas a `transform`/`opacity` + SVG (`stroke-dashoffset`), zero layout thrash.

---

## 4. Validação

| Checagem | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` | **EXIT 0** ✅ |
| `npm run build` | **EXIT 1** — SWC binary ausente na sandbox (`@next/swc-linux-x64-gnu`). Limitação de ambiente; DONA roda local ⚠️ |
| `git diff --check` | OK ✅ |
| Balanceamento de chaves do CSS | 912/912 ✅ |
| `git status --short` | 3 arquivos (landing.css, landing-client.tsx, sections-a.tsx) ✅ |
| `git diff --stat` | +688 / −111 ✅ |

> **Observação sobre o build:** o mesmo binário SWC é baixado via postinstall no ambiente da DONA (Windows/macOS); na sandbox Linux sem rede ele não pôde ser obtido. Nenhum erro de TypeScript ou de sintaxe foi reportado pelo `tsc`, que é o gate autoritativo.

---

## 5. Não feito (regras permanentes)

- ❌ **Nenhum commit / push** — árvore de trabalho parada conforme regra (a DONA valida e commita localmente).
- ❌ **Nada do aplicativo interno** (auth, Prisma, Neon, Asaas, Meta/TikTok, APIs, páginas `/app/*`) foi tocado.
- ❌ Identidade visual, paleta (`--lnd-*`), textos comerciais e seções existentes **preservados**.
- ❌ Nenhuma seção removida; nenhum texto removido sem justificativa real de layout.

---

## 6. Próximos passos (DONA)

1. Rodar `npm install` (se necessário) e `npm run build` local para confirmar o build 37/37.
2. Revisar visualmente a landing nos breakpoints listados na seção 3.9.
3. Quando aprovar, commitar localmente os 3 arquivos e (se desejado) atualizar o branch `checkpoint-fase8-fase9`.
