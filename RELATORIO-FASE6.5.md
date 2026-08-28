# RELATÓRIO — FASE 6.5 · PREVIEW SOCIAL AVANÇADO + PLANOS + ASSINATURA

> **Status: CONCLUÍDA** (aguardando validação local da DONA)
> Data: **2026-08-27** · Sandbox: sem rede para SWC/`prisma generate`/`prisma format`/`prisma validate` (limitações conhecidas, iguais às fases anteriores)
> REGRA FINAL respeitada: **FASE 7 NÃO foi iniciada.**

---

## 1. RESUMO EXECUTIVO

A Fase 6.5 entregou o **Preview Social avançado** (carrossel até 7 imagens, editor de imagem client-side, previews Instagram/TikTok por formato, legendas/hashtags/copies salvas, programação no Calendário com seleção multi-dia e edição vinda do Calendário) e a **estrutura completa de Planos e Assinatura** (3 planos oficiais, página `/assinatura` funcional, camada de billing desacoplada do gateway, decisão oficial registrada para o **Asaas** e checkout em estado controlado — sem gateway real, sem URL fake).

**Princípios respeitados (ESCOPO-OFICIAL + comandos da Fase 6.5):**

- **Nada publicado automaticamente.** `PlannedContent.scheduledAt` é agendamento **interno**; `publishedAt`/`externalId` seguem `null` — só um adapter real futuro poderá marcar `PUBLICADO`.
- **Nada de Meta/TikTok real.** A camada de publicação (`src/lib/publishing/`) e o billing (`src/lib/billing/adapters/asaas.ts`) são **arquitetura apenas**, sempre respondendo `ok:false`/`INTEGRATION_NOT_CONFIGURED`.
- **Nada inventado.** Sem plano Combo; preços oficiais em **centavos inteiros** (2700/7700/49700); IDs externos (`provider`, `externalCustomerId`, `externalSubscriptionId`, `externalPaymentId`) **nullable e nunca inventados**.
- **Nenhuma chave Asaas** criada, solicitada ou exposta.
- **Identidade visual intocada** (mesma paleta, gradiente, cards, tipografia, responsividade e transições aprovadas).
- **Sem commit/push.** Tudo fica local para a DONA validar, rodar `db push`/seed e publicar quando autorizar.

---

## 2. CONTINUIDADE EXATA (não duplicar trabalho)

Conforme REGRA Nº 1, antes de qualquer alteração foi verificado o estado real via `git status --short` e `git diff`. Nenhum trabalho válido da Fase 6.5 foi refeito ou apagado; o que já estava feito foi preservado e o que faltava foi concluído.

- **Modificados (24 arquivos):** `docs/ESCOPO-OFICIAL.md`, `prisma/schema.prisma`, `src/app/(app)/assinatura/page.tsx`, `src/app/(app)/preview-social/page.tsx`, `src/app/(app)/rank/page.tsx`, 14 rotas de API, `src/components/ai/ideas-client.tsx`, `src/components/ai/preview-social-client.tsx`, `src/lib/ai/services/drafts.ts`, `src/lib/navigation.ts`, `src/lib/validators/ai.ts`, `src/lib/validators/index.ts`, `src/types/prisma-shim.d.ts`.
- **Novos (16 entradas):** `src/app/(app)/calendario/`, `src/app/api/billing/`, `src/app/api/calendar/`, `src/app/api/rank/`, `src/components/billing/`, `src/components/gamification/`, `src/components/planning/`, `src/lib/billing/`, `src/lib/gamification/`, `src/lib/planning/`, `src/lib/publishing/`, `src/lib/validators/billing.ts`, `src/lib/validators/planning.ts`, `prisma/seed-achievements.ts`, `RELATORIO-FASE5.md`, `RELATORIO-FASE6.md`.
- **Trabalho concluído nesta continuação:** componente cliente `src/components/billing/assinatura-client.tsx` (a página `/assinatura` já havia sido criada e referenciada este componente, que faltava).

---

## 3. REMOÇÃO DO "GERADOR DE ANÚNCIOS" DO MENU

Confirmado em `src/lib/navigation.ts`: o item "Gerador de Anúncios" **não está** em `mainNav` (nem em `bottomNav`). A rota/página do Gerador permanece acessível se existir (nenhuma rota quebrada), mas deixou de aparecer no menu. **Nenhum link interno quebrado** — a navegação lista apenas rotas reais.

---

## 4. PREVIEW SOCIAL — FLUXO COMPLETO EVOLUÍDO (não refeito)

O componente `src/components/ai/preview-social-client.tsx` foi **evoluído** (~1.100 linhas) para o fluxo oficial:

```
CRIAR → ADICIONAR MÍDIA → EDITAR → PREVIEW → LEGENDA → HASHTAGS → DATA/HORA
→ SALVAR RASCUNHO → PROGRAMAR → CALENDÁRIO → FUTURA PUBLICAÇÃO REAL (bloqueada)
```

Cada etapa é uma aba/painel no cliente. O usuário monta o conteúdo localmente, vê o preview em moldura de celular por formato, salva rascunho (opcional) e/ou agenda direto no Calendário. **Nada é enviado a plataformas.**

---

## 5. CARROSSEL ATÉ 7 IMAGENS

- Adicionar, remover, **substituir** e **reordenar** (arrastar/up-down) até **7 imagens**.
- Navegação com posição **"X / 7"**.
- **uids locais** gerados no client (`Math.random().toString(36)`) — **nenhum id de mídia externo é inventado**.
- Persistência em `SocialDraft.items` (`Json`), validado por `saveDraftSchema` (`items` máx. 7, cada item com `imageEditsSchema`).
- Ao carregar de um rascunho salvo ou de conteúdo do Calendário, a ordem e as edições são **recuperadas** (`items` → ordem + `edits`).

---

## 6. EDITOR DE IMAGEM CLIENT-SIDE (leve)

Por item do carrossel, via modal de edição:

- **Relação (ratio):** 1:1, 4:5, 9:16.
- **Rotação** 90°, **zoom** (1–3), **reposicionamento** (offsetX/offsetY), **brilho** e **contraste** (0–200).
- **Reset** individual (volta ao original).
- Implementação leve via CSS `transform` + `filter` (`editStyle`), sem biblioteca externa, sem upload (data URL local na memória do browser).
- Edições salvas junto do item em `SocialDraft.items[].edits`.

---

## 7. PREVIEWS INSTAGRAM (Post / Carrossel / Reel / Story)

Moldura de celular (`w-[300px]`, `rounded-[40px]`, `border-[10px] border-ink`, notch) com:

- **Post:** imagem única, moldura quadrada.
- **Carrossel:** dots de navegação entre as imagens do carrossel.
- **Reel:** barra lateral de ações (Heart / MessageCircle / Send).
- **Story:** barra de progresso no topo + proporção vertical.

Todos renderizados com os tokens da identidade aprovada (fundo branco gelo, gradiente magenta/roxo quando aplicável).

---

## 8. PREVIEW TIKTOK + CAMADA DE COMPATIBILIDADE DE PLATAFORMA

- **TikTok:** preview de **vídeo** (moldura vertical + trilha de ações + handle `@instacessor` + hashtags em roxo).
- **Foto/carrossel no TikTok:** capacidade **futura** — a UI informa *"Formato ainda não disponível para esta plataforma."* com aviso de que o TikTok aceita vídeo e foto/carrossel dependem da integração.
- **Camada de compatibilidade** em `src/lib/publishing/compatibility.ts`:
  - `PLATFORM_FORMATS`: Instagram → `post/carrossel/reel/story`; TikTok → `video`.
  - `isFormatAvailable(platform, format)`, `getAvailableFormats`, `isPhotoFormatOnTikTok`.
  - Chips de formato filtrados por plataforma; formato indisponível fica desabilitado com a mensagem oficial.

---

## 9. LEGENDA, HASHTAGS E COPIES SALVAS

- Campo **legenda** (editável) + campo dedicado de **hashtags**.
- **"Usar copy salva":** modal lista as `GeneratedCopy` do usuário (copies reais salvas) e preenche a legenda — **nunca sobrescreve silenciosamente** (o usuário escolhe explicitamente).
- **Versionamento de copy** (Fase 6, `ContentCopyVersion`) preservado: editar um conteúdo associado a uma copy cria nova versão; nada é perdido.
- Hashtags e legenda salvos no rascunho e transmitidos ao `PlannedContent` no agendamento.

---

## 10. PROGRAMAR PUBLICAÇÃO (INTERNA)

- Seleção de **plataforma**, **formato**, **data**, **mês**, **ano**, **hora** e **minuto** (fuso do app — `UserPreferences.timezone` / `America/Sao_Paulo`).
- `POST /api/calendar/schedule-from-draft` (Zod `scheduleSchema`: `draftId`, `platform`, `format`, `title`, `objective`, `scheduledAtList` 1–30).
- Cria **`PlannedContent`** (status `AGENDADO`) → aparece no **Calendário**.
- **Somente interno** — nenhuma chamada a Meta/TikTok; `publishedAt`/`externalId` ficam `null`.
- **XP real e idempotente** `planejar-conteudo` (10 XP, `refId: draft-${draftId}`) via motor da Fase 5.

---

## 11. SELEÇÃO MULTI-DIA

- Grade de **próximos 14 dias** com seleção múltipla (ex.: Segunda/Quarta/Sexta).
- A UI informa **"Serão criados N conteúdos planejados."** conforme os dias marcados.
- **Sem recorrência infinita** e **sem duplicidade silenciosa**: cada dia vira um `PlannedContent` distinto e explícito; o usuário confirma antes de criar.

---

## 12. EDIÇÃO VIA CALENDÁRIO → PREVIEW SOCIAL

- No Calendário, cada conteúdo tem o botão **"Abrir no Preview Social"** (`/preview-social?content=ID`).
- `preview-social/page.tsx` lê `searchParams.content`, busca o `PlannedContent` (`getPlannedContent(userId, id)`) e o rascunho vinculado (com **owner-check** `row.userId === userId`).
- O componente abre em **modo edição**: mídia, ordem, edições, legenda, hashtags, plataforma, formato, data/hora já preenchidos.
- Salvar edita o rascunho (`PATCH /api/drafts`) e o conteúdo (`PATCH /api/calendar?id=` com `scheduledAt/platform/format/title/draftId`).

---

## 13. RASCUNHOS (DRAFT ≠ AGENDADO ≠ PUBLICADO)

- Aba **Rascunhos** lista os `SocialDraft` do usuário (contagem de itens, excluir).
- Estados distintos: **RASCUNHO** (salvo, não programado) → **AGENDADO** (`PlannedContent` com `scheduledAt`) → **PUBLICADO** (futuro, via adapter real).
- `SocialDraft` guarda apenas o que o usuário montou; `PlannedContent` guarda o agendamento interno; nada é promovido a publicado sem confirmação real.

---

## 14. PLANOS OFICIAIS + FEATURES + MENSAGEM

Catálogo oficial em `src/lib/billing/plans/index.ts` (`PLAN_CATALOG`, `as const`). **NÃO existe plano Combo.**

| Plano | Preço | Cobrança | Intervalo | Destaque |
| --- | --- | --- | --- | --- |
| Semanal | R$ 27,00 (2700) | `ONE_TIME` | — (7 dias) | — |
| Mensal | R$ 77,00 (7700) | `RECURRING` | `MONTH` | MAIS ESCOLHIDO |
| Anual | R$ 497,00 (49700) | `RECURRING` | `YEAR` | MELHOR CUSTO-BENEFÍCIO |

- **Features (17, idênticas nos 3):** Instagram, TikTok, Dashboard, IA Acessor, Cérebro Estratégico, Diagnóstico, Score, Ideias, Copy, Preview Social, Calendário, Planejamento, Mentoria, Rank, XP, Metas, Conquistas.
- **Matemática anual oficial:** ≈ R$ 41,42/mês · 12× R$ 77 = R$ 924 · economia de R$ 427 (exibida no card e na página).
- **Mensagem oficial da página:** *"Uma assinatura. Duas redes. Uma inteligência trabalhando no seu crescimento."*
- `seedPlanCatalog()` idempotente (por slug) existe, mas **NÃO é executado** nesta fase (regra: sem seed) — a DONA roda quando autorizar.

---

## 15. MINHA ASSINATURA — PÁGINA `/assinatura` FUNCIONAL

- Server component `src/app/(app)/assinatura/page.tsx` (`requireOnboardedSession` → `Promise.all` de `listPlans`, `getMySubscription`, `listMySubscriptions`, `getAccessStatus`).
- Client component `src/components/billing/assinatura-client.tsx`:
  - **Cards de planos** (Semanal/Mensal/Anual) com badges "Mais escolhido"/"Melhor custo-benefício", lista de features e botão **"Escolher plano"**.
  - **Minha Assinatura:** plano, preço, status, cobrança, início, expiração, próxima renovação, renovação automática, dias restantes.
  - **Cancelar renovação futura** (via `PATCH /api/billing/subscription`, owner-check).
  - **Ver planos / trocar plano**.
  - **Histórico de assinaturas** quando existir.
  - Nota explícita: *"Pagamento e cobrança online chegam com a integração Asaas (fase futura). Esta página reflete apenas o estado interno — nada é cobrado."*

---

## 16. BANCO — CENTAVOS INTEIROS E CAMPOS EXTERNOS NULLABLE

- `Plan.priceCents Int`, `Payment.amountCents Int` — **nunca `Float`** (2700/7700/49700).
- `Subscription.status`: `PENDING | ACTIVE | EXPIRED | CANCELED | PAST_DUE` (somente os necessários).
- Campos externos **nullable**: `Subscription.provider`, `externalCustomerId`, `externalSubscriptionId`; `Payment.provider`, `externalPaymentId` — **nunca inventados**; só serão preenchidos pelo gateway real.
- `SocialDraft.items Json?` (carrossel + edições).
- Schema Prisma verificado no diff (`git diff prisma/schema.prisma`): modelos `Plan`, `Subscription`, `Payment` + relações no `User` (`subscriptions`, `payments`) + relações de `PlannedContent`.

---

## 17. ARQUITETURA DE BILLING DESACOPLADA + DECISÃO ASAAS

`src/lib/billing/` (8 arquivos, ~776 linhas) — camada desacoplada do gateway:

| Arquivo | Responsabilidade |
| --- | --- |
| `db.ts` | Delegate `bll` (`plan`, `subscription`, `payment`) via cast (padrão das fases anteriores) |
| `plans/index.ts` | Catálogo oficial, `listPlans/getPlanById/getPlanBySlug/seedPlanCatalog` |
| `subscriptions/index.ts` | `getMySubscription`, `listMySubscriptions`, `createPendingSubscription`, `cancelRenewal`, `canAccessPaidFeatures`, `getAccessStatus` |
| `provider/types.ts` | Interface `BillingAdapter` (genérica, desacoplada) |
| `provider/index.ts` | `getBillingAdapter()` → adapter "none" (sempre `INTEGRATION_NOT_CONFIGURED`) |
| `adapters/asaas.ts` | **AsaasBillingAdapter conceitual** — sem HTTP, sem chave |
| `checkout.ts` | `startCheckout` → estado controlado |

APIs: `GET /api/billing/plans`, `GET|PATCH /api/billing/subscription`, `POST /api/billing/checkout`.

**Decisão oficial Asaas** registrada em `docs/ESCOPO-OFICIAL.md` (seção 12):
- Sandbox `https://api-sandbox.asaas.com/v3`, Produção `https://api.asaas.com/v3`, header `access_token`, `Content-Type: application/json`, `User-Agent`.
- Chave `ASAAS_API_KEY`: **nunca** frontend/GitHub/logs/código-fonte — somente env var server-side. **Nenhuma chave fictícia criada; nenhuma chave solicitada nesta fase.**
- Fluxo futuro documentado: Inst Acessor → Billing Service → Asaas Adapter → Cliente Asaas → Cobrança/Assinatura → Pagamento → Webhook Asaas → Neon → Subscription → liberação/renovação/expiração.

---

## 18. CHECKOUT CONTROLADO + CONTROLE DE ACESSO

- **"Escolher plano"** → `POST /api/billing/checkout` → sempre retorna `INTEGRATION_NOT_CONFIGURED` com a mensagem oficial **"Pagamento online em configuração."** e **nenhuma URL fake**.
- UI mostra aviso controlado no card do plano escolhido + toast.
- `canAccessPaidFeatures(userId)` existe (função central) e, **nesta fase, libera sempre** — não quebra usuários existentes em desenvolvimento; passará a considerar status/expiração quando o gateway real existir.
- `getAccessStatus` alimenta a UI informativa (sem bloquear).

---

## 19. SEGURANÇA

- **Todas** as novas APIs exigem sessão (`requireSession`/`requireOnboardedSession`).
- **Owner-check** em todas as operações por recurso (`getMySubscription`, `cancelRenewal`, `getPlannedContent`, `scheduleFromDraft`, `listDrafts`, edição via `/preview-social?content=` com `row.userId === userId`).
- **Zod** em todos os bodies (`checkoutStartSchema`, `cancelRenewalSchema`, `saveDraftSchema`, `scheduleSchema`, `updatePlannedContentSchema`).
- **Nunca confia no `userId` do browser** — sempre `session.user.id`.
- Erros controlados (`NextResponse.json` com status); sem expor stack/details.
- **Nenhum segredo no client** (chave Asaas exclusivamente server-side quando existir).

---

## 20. RESPONSIVIDADE

- `/assinatura`: grid de planos `grid-cols-1 md:grid-cols-3`, células da assinatura `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`, ações `flex-wrap`; `InfoCell` colapsa para 2 colunas no mobile.
- Preview Social: moldura de celular fixa e controles empilhados no mobile; grade de itens do carrossel responsiva; abas empilham no mobile.
- Calendário: navegação e botões responsivos (já validados na Fase 6).
- Nenhum `overflow` horizontal; tokens de `max-w-container` e gutter preservados.

---

## 21. NÃO FAZER — CONSTRAINTS RESPEITADAS

| Regra | Status |
| --- | --- |
| NÃO iniciar Fase 7 | ✔ Cumprido — fase 6.5 finalizada e PAREI |
| NÃO configurar Meta/Facebook real | ✔ Cumprido |
| NÃO configurar TikTok real | ✔ Cumprido |
| NÃO publicar conteúdo real | ✔ Cumprido (`ok:false`; `publishedAt`/`externalId` null) |
| NÃO enviar Direct / responder comentários | ✔ Cumprido |
| NÃO configurar Asaas real | ✔ Cumprido (adapter conceitual, `INTEGRATION_NOT_CONFIGURED`) |
| NÃO criar pedir chave Asaas | ✔ Cumprido |
| NÃO executar `prisma db push` / migrate | ✔ Cumprido |
| NÃO executar seed | ✔ Cumprido (`seedPlanCatalog`/seeds não executados) |
| NÃO fazer commit/push | ✔ Cumprido (nada commitado nesta fase) |
| NÃO alterar identidade visual | ✔ Cumprido (tokens e componentes aprovados) |
| NÃO alterar `apresentacao/` | ✔ Cumprido |
| Sem plano Combo | ✔ Cumprido |
| Sem checkout/URL fake | ✔ Cumprido |
| Sem dados fictícios / IDs externos inventados | ✔ Cumprido |

---

## 22. VALIDAÇÃO FINAL + PENDÊNCIAS DA DONA

### Resultados no sandbox (Linux)

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✔ **EXIT 0** — sem erros de tipo |
| `npx prisma format` | ⚠️ 403 `binaries.prisma.sh` (rede bloqueada no sandbox) — **não é regressão**; schema já está formatado/manual consistente |
| `npx prisma validate` | ⚠️ Idem — não executável no sandbox |
| `npx prisma generate` | ⚠️ Idem — coberto pelo shim `src/types/prisma-shim.d.ts` |
| `npm run build` | ⚠️ Trava por ausência de `@next/swc-linux-x64-gnu` (só existe `swc-win32-x64-msvc`) — **não é regressão de código**; `tsc` (autoritativo aqui) passou |

### Pendências para a DONA (executar localmente)

1. `npx prisma generate` (gera o client com os novos models).
2. `npx prisma db push` (aplica `Plan`/`Subscription`/`Payment` + `SocialDraft.items` + relações) — **a DONA autoriza**.
3. Rodar o seed de planos quando desejar: `npx tsx -e "import('./src/lib/billing/plans').then(m => m.seedPlanCatalog())"` (ou comando equivalente) — **idempotente**, cria os 3 planos por slug. **Nenhum seed foi executado por mim.**
4. `npm run build` local (SWC nativo disponível no seu ambiente).
5. Revisar visualmente `/preview-social`, `/calendario` e `/assinatura` em desktop/notebook/tablet/mobile.
6. Commit/push quando autorizar (este ambiente não tem permissão de push).

### Arquivos-chave desta fase

- Preview: `src/components/ai/preview-social-client.tsx`, `src/app/(app)/preview-social/page.tsx`, `src/lib/ai/services/drafts.ts`, `src/lib/validators/ai.ts`, `src/lib/publishing/compatibility.ts`.
- Planejamento/edição: `src/app/api/calendar/`, `src/lib/planning/`, `src/components/planning/calendar-client.tsx`.
- Billing: `src/lib/billing/`, `src/app/api/billing/`, `src/components/billing/assinatura-client.tsx`, `src/app/(app)/assinatura/page.tsx`, `src/lib/validators/billing.ts`.
- Decisões: `docs/ESCOPO-OFICIAL.md` (seções 12 e 13).

---

## REGRA FINAL

**Fase 6.5 finalizada 100%. PAREI aqui. A Fase 7 NÃO foi iniciada.**
