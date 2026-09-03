# RELATÓRIO — AJUSTES DE PRODUÇÃO · DOMÍNIO · PWA · RANK · GSAP

> Rodadas **#270–#278** do Inst Acessor — consolidação final pós-validação local na máquina da DONA.
> Data: **2026-09-03** · Projeto: `C:\Users\55819\Desktop\Inst Acessor` · Stack: Next.js 14.2.35 · App Router · TS strict · Prisma/Neon · Auth.js
>
> **Este relatório NÃO contém secrets, tokens, API keys ou valores sensíveis.** Apenas nomes de variáveis.

---

## 1. Validações realizadas (resultados REAIS na máquina da DONA)

| Etapa | Comando | Resultado |
|---|---|---|
| Instalação do GSAP | `npm install gsap` | ✅ **SUCESSO** — added 1 package; `package-lock.json` atualizado |
| TypeScript | `npx tsc --noEmit` | ✅ **SUCESSO** — EXIT 0, nenhum erro |
| Build de produção | `npm run build` | ✅ **SUCESSO** — Next.js 14.2.35, Compiled successfully, validity of types OK, **41/41** páginas estáticas geradas |

> ⚠️ O `npm install` exibiu **2 vulnerabilities de severidade `high`**.
> **NÃO foi executada correção automática e NENHUMA dependência foi alterada por causa disso.** Em especial, **NÃO** foi executado `npm audit fix --force`. As vulnerabilidades ficam **registradas como pendência externa** para avaliação manual consciente (ver §9).

---

## 2. Rank / Momentum — concluído (#274)

Núcleo puro reescrito em `src/lib/gamification/momentum-core.ts` + camada de persistência `momentum.ts` (motor **Impulso/Ritmo**), exposto via `src/lib/gamification` e consumido em `src/app/(app)/rank/page.tsx` e `src/app/api/rank/route.ts`.

### 2.1 Metas automáticas
`RITMO_BANDS` com 14 metas exatas em 3 janelas:

- **Diárias:** Ganhar seguidores (10/dia) · Gerar ideias (2) · Criar copy (1) · Utilizar IA Acessor (3) · Publicar conteúdo (1)
- **Semanais:** Crescimento de seguidores (20) · Alcance (15%) · Engajamento (15%) · Conteúdos publicados (3) · Copies criadas (5)
- **Mensais:** Meta de seguidores (80) · Alcance (25%) · Engajamento (25%) · Crescimento geral (10%)

### 2.2 XP e idempotência
- XP por meta conforme o plano de gamificação; bônus de **sequência/streak** 3/7/15/30 → +20/+50/+120/+300.
- Concessão **idempotente** via `grantXpAmount`, reutilizando o vínculo `@@unique([userId, source, refId])` — a mesma ação nunca concede XP duas vezes.
- Fontes novas em `xp.ts`: `ritmo-*` + `streak-bonus`; barrel `src/lib/gamification/index.ts` alinhado (sem referências órfãs às constantes antigas).

### 2.3 Streak
Coleta única de evidências por janela (`Promise.all`); `actionSince = min(início do mês, início da semana)` para a semana que atravessa a virada do mês; deltas por plataforma somadas.

### 2.4 Display name
- Nome exibido gerenciado em `src/lib/gamification/display-name-core.ts` + `display-name.ts` (preferência em `UserPreferences.dashboard`, chave `displayNameSource`).
- Fallback honesto: nome de perfil → `"Usuário"`; quando a fonte é Instagram, exige `name`/`@username` reais.
- Novo endpoint `src/app/api/rank/display-name/route.ts` (GET/PATCH protegido por sessão).
- Aplicação automática no ranking/rota via `applySelfDisplayName` para o próprio usuário (`isMe`).

### 2.5 Otimização das queries do Rank
- `page.tsx` **reconcilia o Ritmo/Impulso primeiro** (`recomputeRitmo`), concedendo XP de metas batidas + bônus de streak **antes** das leituras.
- Leituras paralelizadas com `Promise.all` (progresso, resumo do rank, ranking, evolução, conquistas, metas, display name) — uma única rodada de consultas, sem chamadas em sequência.

### 2.6 UI (sem redesign)
`src/components/gamification/rank-client.tsx` estendido com a seção **"Impulso"** (chips de sequência, próximo marco 3/7/15/30, XP de hoje, seletor de nome exibido), reutilizando os cards/badges/`ProgressBar` existentes. **Abas Visão geral / Ranking / Metas / Conquistas / Histórico INTACTAS; conquistas NÃO alteradas; botão "Criar meta" preservado** (regra absoluta de não-redesign). Teste dedicado: `npm run rank:test` (`tsconfig.rank-test.json` + `scripts/rank-tests.ts`).

---

## 3. IA — OpenAI + Gemini em camada única (#273)

- `src/lib/ai/provider.ts` consolidado: classes únicas `AIProviderError` (codes `not_configured`/`timeout`/`rate_limit`/`quota`/`auth`/`http`) e `AIConfiguredError`; `aiFetchWithTimeout` (45s); `throwAIHTTPError`; `aiProviderErrorMessage`.
- `openai.ts` e `gemini.ts` aceitam `(apiKey, model)` explicitamente e usam timeout/erros padronizados.
- `getAIProvider()` **propaga o `model` resolvido** (não fixo).
- Serviços chat/copy/ideas importam a classe única; rotas `/api/ai/chat`, `/generate-copy`, `/generate-ideas` tratam: auth → 401 · quota → 429 · demais → 502.
- Badge do admin: **"Configuração pendente"** quando não há chave configurada. **Sem mock** — sem chave, respostas controladas de "não configurado".

---

## 4. InfinitePay — checkouts oficiais e planos completos (#272)

### 4.1 Preços e links atuais (fonte de verdade: `src/lib/billing/plans/catalog.ts`)

| Plano | Preço | Intervalo | Badge | Checkout (URL pública InfinitePay) |
|---|---|---|---|---|
| Semanal | **R$ 27,00** (2700) | 7 dias, ONE_TIME | — | `https://invoice.infinitepay.io/plans/unitrix/QxyWJ8UOq6` |
| Mensal | **R$ 77,00** (7700) | Mensal recorrente | MAIS_ESCOLHIDO | `https://invoice.infinitepay.io/plans/unitrix/gC8t6WTiVQ` |
| Anual | **R$ 547,00** (54700) | Anual recorrente | MELHOR_CUSTO_BENEFICIO | `https://invoice.infinitepay.io/plans/unitrix/5LZNvhvbLY` |

> Preço anual oficial desde 2026-08-31: **R$ 547,00** (o antigo R$ 497,00 não é mais válido). Equivalente aproximado: R$ 45,58/mês.
> Preços sempre em **centavos inteiros** (nunca Float). Moeda sempre `BRL`.

### 4.2 Todos os planos com todas as funcionalidades
Os **3 planos** liberam **todos** os recursos — **NÃO existe plano "Combo"** nem plano com funcionalidades cortadas. Lista comum de features em cada plano:

Instagram · TikTok · Dashboard · IA Acessor · Cérebro Estratégico · Diagnóstico · Score · Ideias · Copy · Preview Social · Calendário · Planejamento · Mentoria · Rank · XP · Metas · Conquistas.

---

## 5. Domínio oficial — `unitrixapp.com.br` (#271)

- Camada centralizada em `src/lib/config/site.ts`.
- `OFFICIAL_SITE_URL = "https://unitrixapp.com.br"` · `OFFICIAL_SITE_DOMAIN = "unitrixapp.com.br"`. `www.` também configurado.
- Resolução server-side de `getAppBaseUrl()`: `SITE_URL` → `AUTH_URL` → `NEXTAUTH_URL` → `VERCEL_URL` → `http://localhost:3000`.
- `getOfficialSiteUrl()`: em produção prefere **sempre** o domínio oficial; nunca o domínio técnico da Vercel (que permanece apenas para previews/verificação técnica).
- `AUTH_URL`/`NEXTAUTH_URL` injetados via config do NextAuth.

### 5.1 URLs de webhook
- Webhook oficial InfinitePay (página Admin > Webhooks e validação server-side):
  `https://unitrixapp.com.br/api/webhooks/infinitepay`
- As demais rotas de integração (Instagram/TikTok/Meta) são configuradas externamente nos portais das plataformas com as mesmas URLs base derivadas de `getAppBaseUrl()`. **Nomes de variáveis** de verificação: `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `TIKTOK_WEBHOOK_VERIFY_TOKEN` (valores nunca são gravados neste relatório).

---

## 6. Landing — correções visuais, remoção do notebook, responsividade (#275, #279–#285)

- **Remoção do notebook:** moldura do mockup de notebook removida do Hero (task #279); largura premium em degraus (1440/1920, container cresce até 1240px/1360px — #280); logo lado a lado com ícone oficial (#281); copy do Hero pronta com chip "Reel" (#282); card "Análise completa" sem área branca (#283); gráfico/área escura vazia corrigida (#284); responsividade completa revisada (#285).
- Nenhuma alteração de conteúdo/texto/preços/ordem além das citadas; identidade visual aprovada preservada.

---

## 7. PWA — instalável Android/iOS (#276)

- **Manifest:** `public/manifest.webmanifest` — nome "Inst Acessor", `display: standalone`, `orientation: portrait`, `background_color #0B0B12`, `theme_color #F43F8E`, `lang pt-BR`.
- **Ícones:** `public/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png` (+ `favicon.svg` atualizado).
- **Service worker:** `public/sw.js` (cache `instacessor-v1`) — estratégia **network-first** para navegações e **stale-while-revalidate** para assets estáticos; **nunca** intercepta `/api/*`, webhooks, auth nem páginas autenticadas (sessão sempre intacta). Registrado no cliente via `navigator.serviceWorker.register("/sw.js")`.
- `layout.tsx`: metadados de PWA ligados (`manifest`, ícones `apple`, `themeColor`).

---

## 8. GSAP + ScrollTrigger — storytelling horizontal (#277)

- **Dependência:** `gsap@^3.12.5` (importada de forma **localizada**, apenas no componente client dedicado — nenhuma outra página carrega GSAP).
- **Componente:** `src/components/landing/horizontal-scroll.tsx` (novo, `"use client"`) com **import dinâmico** de `gsap` e `gsap/ScrollTrigger`; cleanup completo no unmount/mudança de viewport (sem memory leak / triggers duplicados); SSR-safe (roda apenas via `useEffect`).
- **Envoltório na página:** `src/app/page.tsx` — as **15 etapas** entre "Cinco níveis de reconhecimento" e "Objetivos claros, progresso visível." embrulhadas em `.lnd-h-pin > .lnd-h-track`:

  `Badges → AnaliseConteudos → PreviewSocial → RedesSociais → Problema → Solucao → ComoFunciona → Score → IaAcessor → Alertas → Estrategia → Nichos → Calendario → Ideias → Metas`

  Ordem e conteúdo preservados; nenhuma seção removida/resumida/reorganizada.
- **CSS:** bloco `STORYTELLING HORIZONTAL` em `src/app/landing.css` — estado **padrão vertical** (seguro para SSR/no-JS); classe `.lnd-h-on` ativa o modo horizontal (pin `100vh`, painéis `100vw`, flex row) **apenas** quando o GSAP roda. Encaixe por escala `.lnd-h-fit` (`--lnd-h-fit-scale`, piso 0.78) para nenhum conteúdo ser cortado; `.lnd-h-tall` libera rolagem interna sutil em casos raros. `.lnd-scrub-line` (efeito de scroll vertical do "Como Funciona") fica oculto somente no modo horizontal.
- **Comportamento:** pin + `scrub` sincronizados ao scroll vertical; seções entram pela **direita** e saem pela **esquerda**; o pin **termina** quando a etapa "Objetivos claros, progresso visível." está totalmente apresentada e devolve ao scroll vertical; rolar para **cima** reverte exatamente.
- **Fallback mobile (≤900px) e `prefers-reduced-motion`:** NUNCA horizontal — scroll vertical normal, com animações leves já existentes (reveals). Resets CSS garantem que escala/`overflow` não vazem.
- Validação: componente aprovado no typecheck (com shim local temporário de tipos, **nunca commitado**, pois sombraria os tipos reais do pacote) + **validação real concluída na máquina da DONA** (ver §1).

---

## 9. Pendências externas (fora do código / dependem de configuração ou decisão da DONA)

1. **Instalação do GSAP já concluída na máquina da DONA** (`npm install gsap`) — nada pendente localmente.
2. **2 vulnerabilidades `high`** reportadas pelo `npm install`. **Não corrigidas** (sem `npm audit fix --force`; nenhuma dependência alterada). Recomenda-se avaliação manual consciente e futura.
3. **Configuração externa (portais/plataformas), apenas nomes de variáveis:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAIL`, `EMAIL_PROVIDER`, credenciais Meta/Instagram (`META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_SCOPES`, `TOKEN_ENCRYPTION_KEY`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`), TikTok (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_VERIFY_TOKEN`), IA (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`), InfinitePay (`INFINITEPAY_API_KEY`, `INFINITEPAY_WEBHOOK_TOKEN`, `INFINITEPAY_ACCOUNT_ID`) e Asaas legado (`ASAAS_*`).
4. **Webhooks externos:** verificação do webhook da Meta/Instagram, do TikTok (Content Posting) e do InfinitePay nos respectivos portais usando as URLs do §5.1.
5. **Commit / push / deploy** — feitos localmente pela DONA (regra permanente); este relatório apenas registra o estado.

---

## 10. Mudanças de banco eventualmente PREPARADAS (NÃO aplicadas)

- Existe artefato de migração **preparado mas NÃO aplicado**: `prisma-diff-neon.sql` (raiz) e espelho do schema `schema-neon-atual.prisma` — referem-se a campos adicionais de eventos/pagamento (`Payment.eventId`, `Payment.eventType`; `Subscription.accessSource`, `amountCents`, `currency`, etc.).
- **NENHUMA migração foi executada.** Regra permanente: `prisma db push`/migrate somente após a DONA inspecionar o diff e autorizar explicitamente. Nada de `--accept-data-loss`.

---

## 11. Arquivos novos/modificados relevantes

**Novos:**
- `src/components/landing/horizontal-scroll.tsx` — storytelling horizontal GSAP (#277)
- `src/lib/config/site.ts` — centralização de URLs/domínio oficial (#271)
- `src/lib/gamification/momentum-core.ts`, `momentum.ts` (#274)
- `src/lib/gamification/display-name-core.ts`, `display-name.ts` (#274)
- `src/app/api/rank/display-name/route.ts` (#274)
- `scripts/rank-tests.ts`, `tsconfig.rank-test.json` (#274)
- `public/` (PWA): `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `sw.js` (#276)

**Modificados (destaque):**
- `package.json` / `package-lock.json` — dependência `gsap@^3.12.5`
- `src/app/page.tsx`, `src/app/landing.css` — wrapper das 15 etapas + CSS storytelling horizontal + ajustes de responsividade
- `src/app/layout.tsx` — metadados PWA/manifest/ícones/theme-color + registro do SW
- `src/components/landing/sections-a.tsx`, `sections-c.tsx`, `sections-d.tsx` — ajustes visuais/responsivos da landing
- `src/app/(app)/rank/page.tsx`, `src/app/api/rank/route.ts`, `src/components/gamification/rank-client.tsx`, `src/lib/gamification/index.ts`, `src/lib/gamification/xp.ts` — Rank/Momentum/display name
- `src/lib/ai/*` — camada única OpenAI + Gemini
- `src/lib/billing/plans/catalog.ts` — preços/links/features oficiais
- `.env.example`, `.gitignore` (build dir do teste de rank)

---

## 12. Conclusão e estado para avançar

- **Concluído:** Rank/Momentum, metas automáticas, XP idempotente, streak, display name, otimização de queries; IA OpenAI+Gemini em camada única; InfinitePay com 3 planos completos (R$ 27/77/547); domínio oficial `unitrixapp.com.br`; landing (notebook removido, correções visuais, responsividade); PWA instalável (manifest/ícones/service worker); GSAP+ScrollTrigger com 15 etapas horizontais, fallback mobile e `prefers-reduced-motion`; validações locais reais **todas com sucesso**.
- **Depende de configuração externa:** variáveis de ambiente nos portais (apenas nomes listados no §9), verificação de webhooks Meta/Instagram/TikTok/InfinitePay, e decisão consciente sobre as 2 vulnerabilidades `high` (sem correção automática).
- **Mudança de banco pendente:** **SIM, apenas PREPARADA e NÃO aplicada** — `prisma-diff-neon.sql` aguarda autorização explícita da DONA após inspeção do diff.
- **Seguro avançar para git diff/commit/push/deploy:** **SIM** para o código atual — as rodadas #270–#277 estão validadas localmente (`tsc` EXIT 0, build 41/41). O commit/push é feito pela DONA; nenhuma migração de banco deve acompanhar sem a inspeção do §10.
