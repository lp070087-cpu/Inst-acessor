# Relatório — Correção do storytelling horizontal GSAP (alinhamento 100vw/painel)

**Escopo:** landing do Inst Acessor — `.lnd-h-pin > .lnd-h-track` com as 15 etapas (Badges → Metas).
**Regra respeitada:** nenhum commit/push; nenhuma alteração de dependências/banco/conteúdo/identidade.

## Causa raiz encontrada

O desalinhamento ("pulo", painéis em larguras diferentes, sobras laterais, vazios verticais) tinha **quatro causas somadas**, todas na camada de geometria do storytelling:

1. **Largura do track derivada de conteúdo** — `width: max-content` fazia o trilho poder exceder `n × 100vw` e o `scrollWidth`/distância ficar imprevisível; `align-items: flex-start` deixava cada painel com altura própria.
2. **"Fit" por painel com escala variável** — o antigo `.lnd-h-fit` aplicava escala **diferente por seção** (com piso), então cada painel tinha geometria interna distinta; pior, era re-medido/re-escalado **a cada ciclo de refresh do ScrollTrigger**, produzindo "pulo" contínuo durante o scroll e bordas/seções entrando com larguras diferentes.
3. **Distância calculada por aproximação** — usava `window.innerWidth` e larguras estimadas, em vez da largura real do palco (`pin.clientWidth`) e do `scrollWidth` real do track.
4. **Offset do header mal aplicado** — o pin começava deslocado (`top top+=nav`) mantendo 100vh, empurrando a área útil para baixo da dobra e causando corte/deslocamento vertical. A nav é `position: fixed` e já cobre o topo; a folga correta é `padding-top` no painel.

## Arquivos alterados

- `src/components/landing/horizontal-scroll.tsx` — reescrito (geometria, encaixe único, cleanup).
- `src/app/landing.css` — bloco do storytelling refeito (painéis 100vw, escala única gated, fallbacks).
- `.gitignore` — tocado apenas por mudança de fim de linha (CRLF→LF); **restaurado** via `git checkout`, sem conteúdo alterado.

## Como ficou o cálculo do horizontal

- Track: `display:flex; flex-wrap:nowrap` (SEM `width:max-content`, SEM gap, SEM margem externa).
- Painéis: `flex:0 0 {vp}px; width/min/max-width = {vp}px` com `vp = pin.clientWidth` (largura real do palco), reforçado por inline style — nunca derivado de conteúdo.
- Distância real: `track.scrollWidth - pin.clientWidth`. Com `n` painéis de largura igual, isso é exatamente `(n−1) × vp`.
- ScrollTrigger: `trigger: pin`, `start: "top top"`, `end: "+=" + dist`, `scrub: 0.8`, `pin: true`, `pinType: "transform"` (necessário pelo `overflow-x:hidden` no `.lnd-root`), `anticipatePin: 1`, `invalidateOnRefresh: true`, snap suave `1/(panels.length−1)`.
- `refreshAll` recalcula a distância (muda `geo.dist` apenas se variou > 0,5px) e chama `ScrollTrigger.refresh()`; roda em resize (debounce 120ms), `fonts.ready` e `window.load`.

## Como garantiu 100vw por painel

- **Sem largura derivada de conteúdo, sem gap, sem margem** — o painel externo é exatamente a largura do palco, sempre.
- A redução vertical (quando o conteúdo é alto para `100vh − nav`) acontece **apenas no container interno**, com **uma escala única e fixa** (`--lnd-h-s`) igual para todos os painéis, calculada **uma vez por refresh** e **nunca durante o scroll**. A classe `.lnd-h-scaled` no `.lnd-root` só é ligada quando a escala < 1 — sem ela o container não tem `transform`, preservando `position: sticky/fixed` de descendentes.
- Caso raro de viewport muito baixa (nem no piso 0,6 cabe): o painel ganha rolagem interna sutil (`.lnd-h-tall`) sem nunca mudar a largura.
- O track **não recebe** nenhum `translate/scale` além do `x` do GSAP; sem `xPercent`; sem CSS + GSAP simultâneos no mesmo eixo.
- **Garantia matemática:** `flex: 0 0 vp` + `nowrap` + sem gap/margem ⇒ `panel[i].offsetLeft = i × vp` e `getBoundingClientRect().width === vp` para todos.

## Como eliminou o "pulo"

- Removida a escala/per-panel e o re-fit por refresh; agora o encaixe é medido uma única vez e estabilizado.
- Removido `width:max-content` do track e centralização vertical flex por painel (`align-items:stretch` + conteúdo centralizado por painel com a mesma área útil).
- Pin começa em `top top` com `padding-top: var(--lnd-nav-h)` no painel — a área útil visível fica exatamente `[nav, 100vh]`, sem 72px invisíveis abaixo da dobra.
- Adicionada guarda de geração (`runId`) que impede ScrollTrigger duplicado se o breakpoint alternar rápido enquanto o `import("gsap")` ainda resolve.

## Desktop / tablet / mobile

- **Desktop (≥ 901px, sem reduced-motion):** pin + scrub horizontal; cada painel em repouso ocupa exatamente a viewport, sem sobra de painel vizinho, sem gap lateral, conteúdo centralizado.
- **Tablet (901–1024px):** mantém o horizontal (largura ainda folgada); encaixe e escala recalculados no resize.
- **Mobile (≤ 900px) e `prefers-reduced-motion`:** **fallback vertical obrigatório** — o JS nem inicia o pin; e mesmo que a classe `.lnd-h-on`/`.lnd-h-scaled`/`.lnd-h-tall` ainda exista durante a transição, os media queries de fallback têm cobertura de especificidade e declaram `transform:none`/largura normal depois da regra de escala, então o fallback **sempre vence**.

## Resultado `npx tsc --noEmit`

- **No sandbox:** typecheck escopado do componente com `--strict` e os **tipos reais de `gsap@3.15.0`** (instalado) → **EXIT 0**. O `tsc` do projeto inteiro **não roda no sandbox** (OOM/limite de tempo por memória do VM — limitação do ambiente, não erro de código). CSS balanceado 1225/1225.
- **Pendente na máquina da DONA:** rodar `npx tsc --noEmit` e `npm run build` reais (mesmo fluxo validado nos ciclos #277/#278).

## Resultado `npm run build`

- **Não executado no sandbox** (depende do `tsc` completo + rede). Executar localmente na máquina da DONA.
- Nenhuma dependência foi alterada; `package.json`/lockfile intactos; nenhum commit/push.
