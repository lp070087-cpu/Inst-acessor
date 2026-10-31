---
name: unitrix-visual-consistency
description: Regras de consistência visual, alinhamento e responsividade do Inst Acessor (tokens --lnd-*, escala de espaço, containers, breakpoints, animações, acessibilidade) e verificação Playwright de overflow/centralização. Usar em QUALQUER mudança de UI, layout ou CSS no Inst Acessor — landing (src/app/landing.css, src/components/landing/*) ou app (globals.css, tailwind.config.ts, componentes).
---

# Consistência visual — Inst Acessor

Ler antes de editar CSS/JSX de layout. Corrigir a **causa estrutural**, nunca o sintoma.

## Tokens existentes (não mudar valores)

Landing — bloco `.lnd-root` no topo de `src/app/landing.css` (escopo da página, não `:root`):
- Cores: `--lnd-bg #f7f8fa`, `--lnd-card #fff`, `--lnd-surface #f1f3f5`, `--lnd-ink #111318`, `--lnd-ink-2/-3 #596579`, `--lnd-border #e5e7eb`, `--lnd-border-soft #edeff2`, `--lnd-magenta #be185d`, `--lnd-purple #6d28d9`, `--lnd-indigo #4f46e5`, `--lnd-blue #1d4ed8`, status `--lnd-success/danger/warn/info/ai` + `-soft`, `--lnd-grad`, `--lnd-grad-soft`. Em `.lnd-console` (fundo escuro) as cores de destaque são redefinidas para tons claros.
- Raios: `--lnd-r-xs 8` · `-sm 12` · `-md 16` · `-lg 22` · `-xl 28` · `-pill 999`.
- Sombras: `--lnd-shadow-xs/sm/md/lg`, `--lnd-shadow-brand(-lg)`.
- Layout: `--lnd-container 1200px`, `--lnd-gutter clamp(20px, 3.6vw, 40px)` (16px ≤400px), `--lnd-nav-h 72px` (62px ≤640px).
- Easing: `--lnd-ease-out cubic-bezier(.22,1,.36,1)`, `--lnd-ease-spring cubic-bezier(.34,1.56,.64,1)`.
- Fontes: `--lnd-font-display` (Sora), `--lnd-font-body` (Plus Jakarta), `--lnd-font-data` (Space Grotesk).
- Escala adicionada (novos): `--lnd-space-1..8` = 4/8/12/16/24/32/48/64px, `--lnd-touch 44px`, `--lnd-dur-fast .2s`, `--lnd-dur-base .35s`, `--lnd-dur-reveal .8s`.

App — `src/app/globals.css` (`:root`) e `tailwind.config.ts`: mesmas cores sem prefixo (`--bg`, `--ink`, `--purple`, `--brand-grad`…), `--r-xs..pill` = Tailwind `rounded-xs..pill`, `shadow-xs..brand-lg`, `--container 1180px` = `max-w-container`, `--gutter clamp(20px, 4vw, 40px)`.

Novos tokens: só acrescentar ao bloco de tokens existente, sem alterar valores atuais.

## Escalas

- Espaço: múltiplos de 4 (usar `--lnd-space-*`). Gaps de grade de cards: 12–18px mobile, 18–24px desktop.
- Seções: `padding-block: clamp(58px, 7vw, 96px)` (54px ≤640px).
- Containers: `.lnd-container` (1200px) para seção; blocos de leitura 760–860px (`.lnd-section-head` 760, FAQ 780).
- Tipografia fluida com `clamp()`: H2 `clamp(30px, 4.6vw, 48px)` (28px ≤640), lead 16–18px, corpo 14–16px, rótulos 11–13px. Nunca < 11px para texto legível; line-height ≥ 1.35 em pílulas/selos, 1.55–1.65 em parágrafos.
- Botões: `.lnd-btn` 15.5px, `padding 14px 26px`; `.lnd-btn-lg` 16.5px; altura mínima 44px (48px em CTAs de plano). Alvos de toque ≥ 44×44px.
- Breakpoints a verificar: 320, 375, 390, 430, 640, 768, 1024, 1366, 1440, 1920. Os do CSS: ≤360/380/400/480/640/900/1080, ≥1280/1600.

## Regras obrigatórias

1. **Sem margem negativa arbitrária** para "acertar" alinhamento.
2. **Sem offset manual válido para uma resolução** (`left: 37px`, `translateX(12px)` para compensar algo).
3. **Sem largura fixa que estoure**: `width: Npx` só com `max-width: 100%`; nada de `min-width` rígido em filho de grade/flex.
4. **Containers**: `width: 100%; max-width: <token>; margin-inline: auto;` + `padding-inline: var(--lnd-gutter)`.
5. **Centralização estrutural** com grid/flex (`place-items`, `justify-content`, `margin-inline: auto`). Absoluto centralizado: `left: X; right: X; width: fit-content; margin-inline: auto` — não `left:50% + translateX(-50%)` quando o elemento também anima transform.
6. **Grades que viram uma coluna**: `grid-template-columns: minmax(0, 1fr)` (nunca `1fr` puro) e filhos com `min-width: 0`. `1fr` = `minmax(auto, 1fr)`: conteúdo `nowrap` alarga a trilha e o card "anda para a direita". Texto que pode ser longo: `overflow-wrap: anywhere`.
7. **Card órfão** (3 itens em 2 colunas): `:last-child:nth-child(odd) { grid-column: 1 / -1; justify-self: center; width: calc(50% - gap/2) }`.
8. **Fluido com `clamp()`** para fonte, padding e gaps; evitar saltos por breakpoint quando um clamp resolve.
9. **Animações não mudam a posição final**: animar só `transform`/`opacity`; estado final = identidade (`transform: none/0`). Reveals laterais (`data-dir="left|right"`) viram verticais ≤900px. Hover com deslocamento lateral só em `@media (hover: hover)` (no toque o `:hover` gruda).
10. **`prefers-reduced-motion: reduce`**: sem reveal, sem loops, transições ≈ 0; conteúdo visível sem JS (`.lnd-js` só é adicionado pelo cliente).
11. **Não mexer no que já está alinhado**: alterar só o seletor com causa comprovada por medição; nada de reescrever seções inteiras.
12. Sem `overflow-x: hidden` novo para esconder estouro — o root já tem; corrigir o elemento.

## Animação e carregamento

- Durações: micro 0.2s, padrão 0.35s, reveal 0.8s (atraso em degraus de 0.1s via `data-delay`). Easing: `--lnd-ease-out`; spring só em hover/ícones.
- Carregamento: botão com `cursor: progress`, `aria-busy`, spinner girando só fora de reduced-motion; reservar altura (sem layout shift); texto de status em `role="status"`.

## Acessibilidade

- Contraste AA (ink-2 `#596579` sobre branco ok; em `.lnd-console` usar os tokens claros).
- Foco visível: `outline: 2px solid var(--lnd-purple)`, offset 2–3px (−2px dentro de cards com `overflow:hidden`).
- Acordeão: `<button aria-expanded aria-controls>` + `role="region" aria-labelledby`; fechado com `visibility:hidden` (fora da ordem de tabulação); altura via `grid-template-rows: 0fr → 1fr` (sem teto de `max-height`).
- Ícones decorativos `aria-hidden="true"`; selos informativos não são botões. Nunca afirmar certificação/parceria Meta.

## Mobile

- Gutter 16px ≤400px; nenhum elemento além de `100vw`; CTAs de herói em largura total ≤640px.
- Pílulas/selos: `min-height` ≥ 32px, `line-height` ≥ 1.35, `white-space: normal` + `max-width` (sem reticências cortando a mensagem).
- Testar 320px com conteúdo real mais longo (contador ativo, nomes longos).

## Verificação (obrigatória após mudança de layout)

Build + `next start` locais (sem serviços reais), depois rodar como usuário `ci`:

```js
// node check-align.mjs  (PLAYWRIGHT_BROWSERS_PATH=/home/ci/.cache/ms-playwright)
import { chromium } from "/home/user/Inst-acessor/node_modules/playwright/index.mjs";
const URL = process.env.URL || "http://127.0.0.1:3114/";
const GRIDS = ".lnd-plans-grid,.lnd-social-grid,.lnd-vmoves,.lnd-kpi-grid,.lnd-preview-list,.lnd-content-ranking,.lnd-faq-list";
const b = await chromium.launch(); let fail = 0;
for (const motion of ["reduce", "no-preference"]) for (const w of [320,375,390,430,768,1024,1366,1440,1920]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: motion })).newPage();
  await p.goto(URL, { waitUntil: "networkidle" });
  for (let y = 0, h = await p.evaluate(() => document.body.scrollHeight); y < h; y += 500) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(80); }
  await p.waitForTimeout(motion === "reduce" ? 100 : 1500);
  const r = await p.evaluate((GRIDS) => {
    const vw = document.documentElement.clientWidth, bad = [];
    for (const el of document.querySelectorAll("main *")) { const q = el.getBoundingClientRect();
      if (q.width && (q.right > vw + 0.5 || q.left < -0.5) && !el.closest("[aria-hidden=true]") && getComputedStyle(el).position !== "fixed") bad.push("overflow " + el.className); }
    for (const g of document.querySelectorAll(GRIDS)) { const c = g.closest(".lnd-container"), cs = getComputedStyle(c), cr = c.getBoundingClientRect();
      const L = cr.left + parseFloat(cs.paddingLeft), R = cr.right - parseFloat(cs.paddingRight);
      for (const k of g.children) { const q = k.getBoundingClientRect(); if (q.width < (R - L) * 0.6) continue;
        const d = Math.abs((q.left - L) - (R - q.right)); if (d > 2) bad.push(`asym ${d.toFixed(1)} ${k.className}`); } }
    const bd = document.querySelector(".lnd-hero-apibadge");
    if (bd && (bd.scrollWidth > bd.clientWidth || bd.getBoundingClientRect().height < 32)) bad.push("badge clipped");
    return bad;
  }, GRIDS);
  if (r.length) { fail++; console.log(motion, w, [...new Set(r)].slice(0, 10)); }
  await p.screenshot({ path: `/home/ci/shots/align/${motion}-${w}.png`, fullPage: true }); await p.context().close();
}
await b.close(); console.log(fail ? "FAIL" : "OK"); process.exit(fail ? 1 : 0);
```

Overflow dentro de caixas com `overflow: hidden` intencionais (marquee, phones) é falso positivo — confirmar no screenshot. Abrir alguns PNGs (320, 768, 1440) antes de entregar.
