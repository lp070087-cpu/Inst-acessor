# RELATÓRIO — QA FINAL PONTA A PONTA

> Data: **2026-08-30** · Branch: `checkpoint-fase8-fase9` · HEAD: `d1c0ba4`
> Escopo: recuperação de estado → auditoria dirigida → validação completa → classificação para produção

---

## 1. Estado recuperado (ponto de partida)

- **Branch**: `checkpoint-fase8-fase9`
- **HEAD**: `d1c0ba4` "Fix Prisma billing relations" (push da DONA confirmado)
- **Ancestral**: `57abf3f` "Checkpoint final — Asaas, primeiro acesso, publishing, admin e landing"
- **Working tree**: limpo, exceto `package-lock.json` modificado (resquício de instalação na sandbox; sem impacto)
- **Schema**: `prisma/schema.prisma` com **54 models**; relação inversa `BillingEvent` confirmada presente (correção do commit `d1c0ba4`); datasource `postgresql` com `DATABASE_URL` + `DIRECT_URL`
- **Sem migrations versionadas**: o projeto usa **`prisma db push`** (padrão das fases anteriores) — não há diretório `prisma/migrations/`

## 2. Auditoria dirigida (o que foi verificado, arquivo por arquivo)

### 2.1 Primeiro Acesso (pós-pagamento / pós-liberação)

| Verificação | Resultado |
| --- | --- |
| Fluxo `/primeiro-acesso` completo (e-mail → token → senha → boas-vindas → tour → onboarding) | ✅ Presente (5 estágios + tour) |
| Identidade = e-mail do `AccessGrant` (origem `ASAAS`/`ADMIN_MANUAL`) | ✅ `AccessGrant.email` normalizado |
| Nunca senha automática | ✅ Cliente cria a própria senha (bcrypt 12) |
| Token de uso único: `randomBytes(32)` → SHA-256 hash no banco, TTL 60 min, replay-safe | ✅ `FirstAccessToken` com `tokenHash @unique`, `consumed` |
| Anti-enumeração (resposta genérica) | ✅ Mensagem única `EMAIL_NOT_ELIGIBLE_MESSAGE` |
| Provider de e-mail fail-closed (nunca finge envio) | ✅ `src/lib/email` — sem provider → não envia (dev mostra na tela) |
| Rate limit em todas as 5 rotas | ✅ request 5/min, verify 15/min, complete 10/min, tour 20/min, lookup 30/min |
| Passkey/WebAuthn honesto (sem implementação falsa) | ✅ `src/lib/webauthn` enabled=false; pendência documentada |
| Expiração bloqueia (`/expirado`) | ✅ `getActiveAccessForUser` + gate no `(app)/layout.tsx` |
| Respostas nunca expõem `passwordHash`/tokens | ✅ Verificado em verify/complete/lookup |
| `verify` route: hash, rate limit, sem vazamento | ✅ `verifyTokenRateLimiter` 15/min |

### 2.2 Regra absoluta do ADMIN (único ADMIN; CLIENT bloqueado)

| Verificação | Resultado |
| --- | --- |
| `requireAdminSession` consulta o banco (role + status), nunca confia no frontend | ✅ `src/lib/auth/guard.ts` |
| `CLIENT` tentando URL direta de `/admin/*` → redirecionado para `/dashboard` | ✅ Layout admin (`src/app/admin/layout.tsx`) chama `requireAdminSession()` — **cobertura total** |
| Todas as 6 rotas `/api/admin/*` protegidas | ✅ `users`, `access-grants`, `access-grant`, `overview`, `ia`, `ia/status` — todas chamam `requireAdminSession()` |
| Páginas `/admin/*` protegidas | ✅ `page.tsx` (dashboard), `assinaturas`, `ia`, `integracoes`, `usuarios` + layout central |
| Admin consulta usuários, assinaturas/acessos, origem e histórico | ✅ `/admin/usuarios` (Acessos liberados + todos os usuários), `/admin/assinaturas`, `/api/admin/overview` |
| Liberação manual 7/30/90/custom dias, origem `ADMIN_MANUAL` | ✅ `manual-access.ts` + validador `adminGrantAccessSchema` |
| Sem criar pagamento falso / sem tocar no Asaas na liberação manual | ✅ `grantManualAccess` não chama Asaas; cria `AccessGrant` ou `Subscription` com `provider="MANUAL"` |
| Sem criar usuário com senha falsa (CENÁRIO D) | ✅ e-mail sem conta → só `AccessGrant` `PENDING_FIRST_ACCESS`, `userId=null` |

### 2.3 Asaas (billing)

| Verificação | Resultado |
| --- | --- |
| Webhook autenticado (fail-closed 503 sem token) | ✅ `src/app/api/webhooks/asaas/route.ts` |
| `timingSafeEqual` na comparação do token | ✅ `safeEqual` |
| Idempotência: `BillingEvent.eventId` unique + claim-first | ✅ `handleAsaasEvent` cria `BillingEvent` antes de aplicar; duplicado → `duplicate` |
| Nunca confia em `userId` do payload | ✅ `resolveOwnerByExternalRef` (customer/subscription/payment id) |
| **Checkout não ativa acesso** | ✅ Nenhuma ativação na criação de checkout; `ACTIVE` só em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` |
| Pagamento confirmado é o gatilho real | ✅ `applyEvent` → `subscription ACTIVE` + `upsertAsaasAccessGrant` (origem `ASAAS`) |
| `AccessGrant` mantém origem/rastreabilidade | ✅ `externalPaymentId`/`externalSubscriptionId` reais, nunca inventados |
| Estorno → revoga; overdue → PAST_DUE; cancelado → PENDING | ✅ |
| Sanitização do payload antes de persistir | ✅ `sanitizeAsaasPayload` |
| Preço sempre do servidor | ✅ Planos oficiais server-side (Semanal R$27 ONE_TIME 7d, Mensal R$77 recorrente, Anual R$497 recorrente) |
| Nenhum secret exposto | ✅ token só no servidor; `.env.example` com valores vazios |

### 2.4 Publicação real (honestidade)

| Verificação | Resultado |
| --- | --- |
| Instagram: `POST /{ig-user-id}/media` → `POST /{ig-user-id}/media_publish` → `id` real | ✅ `src/lib/publishing/instagram/index.ts` |
| Instagram: carrossel/container/pai | ✅ `buildInstagramContainers` |
| Instagram: mídia local-only (data URL) → `VALIDATION` honesto | ✅ `extractMediaRefs` + `isPublicMediaUrl` |
| TikTok: Content Posting API `init/` → `publish_id` → polling `status/fetch/` | ✅ `src/lib/publishing/tiktok/index.ts` |
| TikTok: **LIVE só após `PUBLISH_COMPLETE`/`PUBLISHED`** | ✅ `pollTikTokStatus` (5×4s) |
| TikTok: `FAILED` → erro (não vira LIVE) | ✅ |
| **Nunca fabrica externalId** | ✅ `ok:true` apenas com `id`/`publish_id` reais retornados |
| Owner-check: userId derivado do `plannedContent` (nunca do payload) | ✅ adapters fazem `prisma.plannedContent.findUnique` |
| Erros classificados (AUTH/RATE_LIMIT/RETRYABLE/PERMANENT) | ✅ `classifyHttpError` |
| `markFailed` guarda externalId (TikTok sem duplicar) | ✅ `markFailed(queueId, code, msg, attempts, retry, externalId)` |
| `INTEGRATION_NOT_CONFIGURED` = fail-closed sem conexão | ✅ 48 ocorrências em billing/publishing — padrão correto |

## 3. Validação completa executada (nesta sandbox)

| Gate | Resultado |
| --- | --- |
| `npx tsc --noEmit` (NODE_OPTIONS max-old-space 4096) | ✅ **EXIT 0** |
| `npm run growth:test` | ✅ **28/28** |
| `npm run billing:test` | ✅ **31/31** |
| `npm run publishing:test` | ✅ **25/25** |
| `npm run first-access:test` | ✅ **39/39** |
| **Total de testes** | ✅ **123/123** |
| `npx prisma validate` | ⚠️ **BLOQUEADO na sandbox** (403 ao baixar engine Linux `binaries.prisma.sh`) — DONA confirma OK localmente |
| `npm run build` | ⚠️ **BLOQUEADO na sandbox** (SWC binary linux/x64 ausente) — DONA confirma build **37/37 páginas** localmente |

> Os dois bloqueios são **exclusivos do ambiente sandbox** (sem rede para binários Prisma/SWC), não do código. O gate autoritativo `tsc --noEmit` está **limpo** e os **123 testes passam**.

## 4. Buscas de produção (TODO/mock/segredos/localhost)

| Padrão | Resultado |
| --- | --- |
| `TODO`/`FIXME` | 2 reais: (1) `src/app/api/webhooks/tiktok/route.ts:91` enfileirar processamento de eventos (futuro); (2) `src/lib/email/index.ts:53` integrar provider (decisão externa). Demais = falsos positivos ("TODOS" em filtros UI, "TODOS os dados") |
| `localhost` | 6 ocorrências — todas fallback `process.env.AUTH_URL || "http://localhost:3000"`. Seguro: em produção `AUTH_URL` é definida. |
| `mock`/`fake`/`placeholder` | Nenhum mock de integração. Classes CSS (`lnd-dash-mock` na landing), `placeholder=` de inputs de UI, e `src/lib/webauthn` "placeholder honesto" (documentado). |
| `NOT_CONFIGURED`/`INTEGRATION_NOT_CONFIGURED` | 48 ocorrências — padrão **fail-closed** correto (billing/publishing). |
| `AUTH_SECRET` | Apenas `AUTH_SECRET=""` no `.env.example` (nunca hardcoded). |
| `CRON` | Nenhum cron real no código; fila de publicação processada por chamada manual/worker futuro. |
| Variáveis `process.env.*` usadas | 28 únicas (listadas na Matriz do HANDOFF). Nenhuma `NEXT_PUBLIC_*` para secrets. |

## 5. Classificação para produção

### A) Resolvido / pronto no código
- Primeiro acesso completo (e-mail → token → senha → tour → onboarding)
- Admin único server-side (layout + 6 APIs)
- Asaas webhook seguro + idempotente; checkout não ativa; pagamento confirmado é o gatilho
- Publishing real (IG container/publish; TikTok init/poll) — sem fake success
- `tsc --noEmit` EXIT 0; 123/123 testes
- Health endpoint, not-found global, MAPA-ROTAS, CHECKLIST-VERCEL, DIAGNOSTICO-PRODUCAO

### B) Comportamento seguro/fail-closed intencional
- `EMAIL_PROVIDER` vazio → não envia (nunca finge)
- `ASAAS_API_KEY` vazio → checkout controlado (não cobra)
- IA sem chave → estado controlado
- Passkey → pendência controlada (enabled=false)
- Mídia local-only → `VALIDATION` honesto

### C) Configuração externa necessária (não-bloqueador de código)
- Variáveis reais no Vercel (ver Matriz no HANDOFF)
- Meta App Review (Instagram/TikTok) + produtos/URLs de redirecionamento
- Provider de e-mail (Resend/SendGrid/SES/Mailgun/Brevo)
- Asaas: API key real + webhook token + URL de produção
- `npx prisma db push` não-destrutivo no Neon

### D) Bloqueadores reais de produção
- **Nenhum bloqueador de código.** Tudo o que depende de código local está feito e testado.
- Pendências são **configuração externa** (credenciais, App Review, e-mail, db push local).

## 6. Conclusão

O projeto **Inst Acessor** está **pronto no código** para produção, com todas as fases concluídas
(Fases 1–11, Primeiro Acesso, Asaas, Publishing Real, QA). A validação nesta sandbox atingiu
**tsc EXIT 0 e 123/123 testes**. As únicas pendências são de **configuração externa** (variáveis,
App Review Meta/TikTok, provider de e-mail, `prisma db push` local, commit/push pela DONA) —
nenhuma delas é bloqueador de código.

**Próximo passo**: FASE FINAL — documentos de handoff (`CHECKLIST-PRODUCAO-INST-ACESSOR.md`,
`STATUS-FINAL-INST-ACESSOR.md`, `RELATORIO-HANDOFF-PRODUCAO.md`).
