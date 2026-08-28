# RELATÓRIO — FASE 7 · AUTOMAÇÃO, PUBLICAÇÃO REAL E CENTRAL DE REDES SOCIAIS

> **Status: CONCLUÍDA** (aguardando validação local da DONA)
> Data: **2026-08-28** · Sandbox: sem rede para SWC/`prisma generate`/`prisma format`/`prisma validate` (limitações conhecidas, iguais às fases anteriores)
> REGRA FINAL respeitada: **FASE 8 NÃO foi iniciada. NADA foi commitado/pushado. NADA foi publicado por tempo.**

---

## 1. RESUMO EXECUTIVO

A Fase 7 entregou o **motor central de publicação** (fila em banco, retry controlado, status reais, adapters Instagram/TikTok), a **Central de Publicação** (`/publishing`), a **integração com Calendário e Preview Social** (origem de publicação + "Publicar agora"), a **camada de logs/histórico**, os **webhooks genéricos** Meta/TikTok, a **fundação de automações** (`/automacoes`, regras Comentário→DM futuras) e a **camada de segurança** (owner-check, Zod, tokens nunca logados, rate limit interno, idempotência).

**Princípios respeitados (ESCOPO-OFICIAL + comandos da Fase 7):**

- **Nada publicado por tempo.** `PUBLICADO` SÓ com confirmação real do provider (`externalId`). Nesta fase os adapters retornam `INTEGRATION_NOT_CONFIGURED` (configuração externa não habilitada) — nenhum endpoint inventado, nenhum id externo forjado.
- **Nada de Meta/TikTok real.** APENAS APIs oficiais referenciadas; OAuth e sync continuam como nas fases anteriores (Fase 2/3.5). Publicação real fica para quando a integração for liberada.
- **Nada inventado.** Sem DMs reais, sem disparo real por palavra-chave, sem webhook afirmando receber eventos reais, sem billing fake.
- **Identidade visual intocada** (mesma paleta, gradiente, cards, tipografia, responsividade e transições aprovadas).
- **Sem commit/push.** Tudo fica local para a DONA validar, rodar `db push`/generate e publicar quando autorizar.

---

## 2. CONTINUIDADE EXATA (não duplicar trabalho)

Conforme REGRA Nº 1, antes de qualquer alteração foi verificado o estado real via `git status --short` e `git diff`. Nenhum trabalho válido das fases anteriores foi refeito ou apagado; o que já estava feito foi **evoluído**.

- **Evoluídos (não refeitos):** `src/lib/publishing/` (a camada de Fase 6 virou o motor real da Parte 2 com `PublishingAdapter`), `src/components/ai/preview-social-client.tsx` (novo "Publicar agora"), `src/components/planning/calendar-client.tsx` (status PROCESSANDO), `src/lib/navigation.ts` (Central de Publicação + Automações no menu).
- **Novos (nesta fase):** `src/lib/publishing/{service,queue,retry,status,errors,types,db,rate-limit,compatibility,index}.ts` + `adapters/` + `instagram/` + `tiktok/`; `src/app/api/publishing/` + `logs/`; `src/app/api/webhooks/publishing/`; `src/app/api/automations/`; `src/app/(app)/publishing/`; `src/app/(app)/automacoes/`; `src/components/publishing/`; `src/components/automations/`.
- **Backward-compat preservada:** `prepareInstagramPublish`, `prepareTikTokPublish`, `validatePublishPayload`, `getPublisher`, `PUBLISH_PLATFORMS`, `PublishPlatform` continuam exportados no barrel — nada quebra para consumidores antigos (ex.: Preview Social importa de `@/lib/publishing/compatibility`).

---

## 3. PARTE 2 — MOTOR CENTRAL DE PUBLICAÇÃO

O serviço central em `src/lib/publishing/service.ts` expõe as funções públicas exigidas:

| Função | Papel |
|---|---|
| `publishContent` | Publica agora — enfileira + processa via adapter (validação local antes de tocar o provider). |
| `scheduleContent` | Agenda — cria item na fila (`AGENDADO`) e registra log. |
| `cancelScheduledContent` | Cancela — `CANCELADO` nunca publica; não cancela já publicado. |
| `retryPublication` | Re-tenta item `FALHOU`/`AGENDADO` vencido (owner-check + guarda de horário). |
| `getPublicationStatus` | Status real — fila local + consulta ao adapter quando há `externalId`. |
| `processQueue` / `processQueueItem` | Worker — processa itens vencidos (API manual + cron futuro). |

**Contrato de adapter (Parte 2):** `interface PublishingAdapter { validate(payload) → valid/errors; publish(payload) → ok/externalId/errorCode; getStatus(query); cancel?(query) }`. Os adapters ficam em `src/lib/publishing/adapters/` com registro central (`getAdapter(platform)`).

Fluxo real: `Preview/Calendário → scheduleContent/publishContent → fila → processQueueItem → adapter.validate → adapter.publish → confirmação real → PUBLICADO (externalId)`. **Nenhum passo é pulado silenciosamente.**

---

## 4. PARTE 3 — STATUS REAIS (nunca por tempo)

`src/lib/publishing/status.ts` define o vocabulário oficial:

- **`AGENDADO`** — na fila, aguardando `nextAttemptAt`.
- **`PROCESSANDO`** — tentativa real em andamento (`markProcessing` grava guard contra corrida/cancelamento).
- **`PUBLICADO`** — SÓ via `markPublished`, que exige `externalId` real retornado pelo provider. **Nunca promovido por relógio.**
- **`FALHOU`** — guarda motivo classificado (`errorCode` + `errorMessage` amigável).
- **`CANCELADO`** — nunca publica.

`CONTENT_STATUSES_FASE7` cobre também o pipeline do conteúdo (`RASCUNHO` → `PRONTO` → ... → `PUBLICADO`), com labels e tons para UI (`STATUS_LABELS_FASE7` / `STATUS_TONES_FASE7`).

---

## 5. PARTE 4 — FILA EM BANCO (Vercel-compatível)

`src/lib/publishing/queue.ts` implementa a fila **sem Redis/BullMQ** (tabela `PublishQueue` no Prisma/Neon). Campos: content, platform, data/hora, status, attempts, last attempt, next attempt, error message, externalId, provider, idempotencyKey, timestamps.

- **Idempotência:** `@@unique([contentId, platform])` — um item por conteúdo/plataforma; `enqueuePublication` apenas atualiza se ainda não publicado/cancelado.
- **Owner-check:** `content.userId !== userId → erro`. Todas as leituras/escritas passam por `userId` da sessão.
- **Backoff no banco:** `nextAttemptAt` é usado pelo worker para saber o que está vencido.

---

## 6. PARTE 5 — RETRY CONTROLADO

`src/lib/publishing/retry.ts` + `errors.ts`:

- **Máx. 3 tentativas automáticas** (`MAX_AUTO_ATTEMPTS = 3`).
- **Backoff exponencial simples:** 5min → 15min → 45min.
- **Sem loop infinito** — ao atingir o teto, o item permanece `FALHOU` aguardando ação manual (botão "Re-tentar").
- **Erros classificados:** `RETRYABLE` (transitório), `PERMANENT` (não re-tentar), `AUTH` (reconectar), `RATE_LIMIT` (aguardar), `VALIDATION` (corrigir), `INTEGRATION_NOT_CONFIGURED` (configuração ausente).
- **Retryável automaticamente:** apenas `RETRYABLE` e `RATE_LIMIT` (via `isRetryableCode`). `AUTH`/`VALIDATION`/`INTEGRATION_NOT_CONFIGURED`/`PERMANENT` exigem ação do usuário (`isUserActionCode`).
- Cada tentativa é registrada em `PublishLog` (`logAttempt`).

---

## 7. PARTE 6 — ADAPTER INSTAGRAM (Meta, APIs oficiais)

`src/lib/publishing/instagram/index.ts`:

- Usa **apenas** o Instagram Graph API oficial como referência (`/v21.0/{ig-user-id}/media`, `media_publish`, `{container-id}`) — **nenhum endpoint inventado**.
- `validate()` exige contentId, formato, legenda e mídia.
- `publish()` retorna **`INTEGRATION_NOT_CONFIGURED`** quando não configurado — nunca tenta chamada real, nunca inventa id.
- `getStatus()`/`cancel()` seguem o mesmo princípio (sem `externalId` real não há o que consultar).
- Comentários documentam que cada formato (post/carrossel/reel/story) tem um fluxo oficial distinto que será montado quando a integração for liberada.

---

## 8. PARTE 7 — ADAPTER TIKTOK (vídeo somente)

`src/lib/publishing/tiktok/index.ts`:

- Referência **apenas** à TikTok Content Posting API oficial (`/v2/post/publish/video/init/`, `/v2/post/publish/status/fetch/`).
- **Vídeo apenas** — `validate()` bloqueia `mediaCount > 1` ("o TikTok aceita 1 vídeo por publicação; carrossel não disponível"). **Não afirma** foto/carrossel.
- `publish()`/`getStatus()`/`cancel()` seguem o mesmo princípio de `INTEGRATION_NOT_CONFIGURED` e nenhum id inventado.

---

## 9. PARTE 8 — CAMADA DE COMPATIBILIDADE

`src/lib/publishing/compatibility.ts` (evoluída da Fase 6.5):

- `PLATFORM_FORMATS`: Instagram → post/carrossel/reel/story; TikTok → video.
- `PLATFORM_MIME_TYPES`, `PLATFORM_MEDIA_LIMITS`, `expectedMediaType`, `checkCompatibility`/`compatibilityErrors`/`isCompatible`.
- Validações: formato disponível, mídia obrigatória, limite de itens, tipo de mídia (imagem/vídeo), MIME, tamanho e proporção **quando conhecidos**. **Nunca afirma limites oficiais** que a integração real ainda não confirmou.
- `CompatibilityInput` inclui `hashtags?: string` (correção de TS2339 feita nesta fase).

---

## 10. PARTE 9 — CENTRAL DE PUBLICAÇÃO (`/publishing`)

- **Rota server** `src/app/(app)/publishing/page.tsx`: `requireOnboardedSession` → `listQueue` + `listPlannedContent` → `PublishingClient`.
- **Componente cliente** `src/components/publishing/publishing-client.tsx`:
  - **Filtros:** Instagram/TikTok (plataforma) + TODOS/AGENDADO/PROCESSANDO/PUBLICADO/FALHOU/CANCELADO (status) com contadores.
  - **Ações por item:** Re-tentar (FALHOU), Cancelar (AGENDADO/FALHOU), **Abrir no Calendário**, **Abrir no Preview Social**.
  - **"Processar vencidos"** — dispara o worker manual.
  - **Vista Fila ↔ Histórico** — histórico carrega `/api/publishing/logs` em tabela.
  - Estados de **loading / empty / erro** com EmptyState (identidade visual aprovada, `rounded-pill`, badges, tons oficiais).
  - **Sem navegação redundante** — o item já está no menu (`src/lib/navigation.ts`, após Calendário).

---

## 11. PARTE 10 — INTEGRAÇÃO COM O CALENDÁRIO

- O Calendário (`src/components/planning/calendar-client.tsx`) ganhou `PROCESSANDO` no `STATUS_LABEL` e no `STATUS_TONE` (`bg-warn-soft text-warn`) — reflete `agendado / pronto / processando / publicado / falhou / cancelado`.
- "Abrir no Calendário" na Central navega para `/calendario?content=<contentId>`.

---

## 12. PARTE 11 — PREVIEW SOCIAL COMO ORIGEM DE PUBLICAÇÃO

`src/components/ai/preview-social-client.tsx` ganhou o **"Publicar agora"** (`handlePublishNow`):

1. Garante o rascunho (cria `PlannedContent` via `/api/calendar` se não estiver editando).
2. POST `/api/publishing?action=publish` com `contentId, platform, format, caption, hashtags, mediaUrl, mediaCount, mimeType`.
3. Toast do resultado: sucesso (`AGENDADO`/`PUBLICADO`) ou info (`INTEGRATION_NOT_CONFIGURED` → "publicação real ainda não configurada").

**Nenhuma etapa é pulada silenciosamente** — o usuário monta o conteúdo, vê o preview, confirma e dispara.

---

## 13. PARTE 12 — HISTÓRICO / LOGS (sem segredos)

- **`PublishLog`** registra toda operação (`schedule`, `publish`, `retry`, `cancel`, `status`) com `status success/error/skipped`, `attempts`, `errorCode`, `errorMessage`, `externalId`, `provider`.
- **`GET /api/publishing/logs`**: session-required + owner-check, filtros `platform/status/operation/from/to`, limite máximo 200, e **reforço** com `sanitizeMessage` na resposta.
- **NUNCA armazena/loga**: access token, refresh token, client secret ou payload de mídia. `sanitizeMessage` remove padrões de token/secret/JWT e corta mensagens longas.

---

## 14. PARTE 13 — WEBHOOKS GENÉRICOS (Meta/TikTok)

`src/app/api/webhooks/publishing/route.ts`:

- **GET** valida `hub.mode`/`hub.verify_token`/`hub.challenge` **apenas se** `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` estiver configurado; sem config, responde 404 ("não configuração") — **não afirma receber eventos**.
- **POST** extrai eventos genéricos:
  - Meta: `object: "instagram"` + `entry[]` → `eventId` = entry.id.
  - TikTok: `obj.event` → `eventId` = `{event}-{timestamp}-{from_user_id}`.
- **Idempotência:** `AutomationEvent.@@unique(eventId)` — duplicados respondem `{received: true, duplicate: true}` sem reprocessar.
- **Sanitização:** `sanitizePayload` remove chaves `token|secret|password|access_` e aninhamentos `payload`.
- **Ação:** eventos `comment` apenas registram `AutomationExecution` com status `EVALUATED` — **nenhuma ação real executada**.
- Logs seguros (nunca tokens/secrets).

---

## 15. PARTE 14 — FUNDAÇÃO COMENTÁRIO→DM (somente estrutura)

- **Models:** `AutomationRule` (nome, gatilho `comment.keyword`, plataforma, `keywords String[]`, ação `dm`, `enabled`), `AutomationEvent` (eventId único, payload sanitizado), `AutomationExecution` (status `EVALUATED`).
- **`GET/POST/DELETE /api/automations`**: session-required + owner-check + Zod + rate limit (`automationRateLimiter`, 20/min).
- **Página `/automacoes`** + componente `AutomationsClient`: lista de regras, criação (nome/gatilho/plataforma/palavras-chave/ação dm/ativo), exclusão, histórico de avaliações.
- **NENHUM DM real, NENHUM disparo real por palavra-chave** — a UI informa: "Nada é enviado nesta fase."
- Item **Automações** adicionado ao menu (`src/lib/navigation.ts`, regra permanente "`/automacoes no menu`").

---

## 16. PARTE 15 — SEGURANÇA

- **userId da sessão** como fonte de verdade em todas as rotas/APIs (`requireSession`/`requireOnboardedSession`).
- **Owner-check** em fila, logs, automações e webhooks (quando o dono é conhecido).
- **Zod** em `/api/publishing` (scheduleSchema) e `/api/automations` (ruleSchema).
- **Tokens server-side encryptados** (AES-256-GCM via `src/lib/crypto.ts`, das fases anteriores) — nada novo exposto.
- **Rate limit interno** (`src/lib/publishing/rate-limit.ts`): `publishingRateLimiter` (30/min) na fila e `automationRateLimiter` (20/min) nas automações. In-memory best-effort, com limpeza periódica e `unref` — substituível por limiter persistente em produção sem quebrar contrato.
- **Idempotência:** `@@unique([contentId, platform])` na fila, `@@unique(eventId)` em eventos.

---

## 17. PARTE 16 — ACESSO A FUNCIONALIDADES PAGAS

- Verificado: `src/lib/billing/subscriptions/index.ts` → `canAccessPaidFeatures` retorna `true` (modo dev/sem billing real). **Nenhum bloqueio indevido** ao testar a Fase 7.
- **Sem fake billing** — planos inalterados (2700/7700/49700), nada de Asaas real nesta fase.

---

## 18. PARTE 17 — UX / IDENTIDADE VISUAL

- **Mesma identidade aprovada:** fundo `#F7F8FA`, cards, gradiente `#F43F8E → #A855F7 → #6366F1`, tipografia Sora/Plus Jakarta Sans, `rounded-pill`, badges oficiais.
- **Responsivo:** filtros em wrap, ações em wrap, tabela de histórico com colunas ocultas em telas menores.
- **Estados:** loading (spinner), empty (EmptyState com CTA), erro (toast), sucesso (toast), "integração não configurada" (toast info na Central/Preview).
- **Vocabulário consistente:** "Re-tentar", "Cancelar", "Publicar agora", "Processar vencidos", "Abrir no Calendário", "Abrir no Preview Social".

---

## 19. PARTE 18 — NÃO FAZER (constraints respeitadas)

- ❌ **Fase 8 não iniciada.**
- ❌ **Nenhuma publicação fake** — `PUBLICADO` só com `externalId` real; nesta fase os adapters retornam `INTEGRATION_NOT_CONFIGURED`.
- ❌ **Nenhum `PUBLICADO` por tempo.**
- ❌ **Nenhum endpoint imaginário** — apenas APIs oficiais referenciadas.
- ❌ **Nada de Asaas.**
- ❌ **Nenhum Comentário→DM real**, nenhum disparo real por palavra-chave.
- ❌ **Sem mudança de planos/cores.**
- ❌ **Sem reset de banco**, sem `--accept-data-loss`.
- ❌ **Sem commit/push.**

---

## 20. PARTE 19 — VALIDAÇÃO FINAL

Realizada no sandbox (autoritativo para código):

| Validação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ **EXIT 0** |
| Prisma schema (brace-balance, models) | ✅ 57/57 chaves OK; **48 models / 3 enums** |
| Models Fase 7 no schema + shim | ✅ `PublishQueue`, `PublishLog`, `AutomationRule`, `AutomationEvent`, `AutomationExecution` presentes nos dois |
| `npm run build` | ⚠️ **Não executa no sandbox** — SWC binary não instalado (sem rede). DONA roda local (como na REGRA 0 da Fase 6.5). |
| `prisma generate/format/validate/db push` | ⚠️ Bloqueados no sandbox (403 de rede) — DONA roda localmente. |

**Pendências da DONA (local):**
1. `npx prisma generate`
2. `npx prisma db push` (Neon) — schema Fase 7 (`PublishQueue`, `PublishLog`, `AutomationRule`, `AutomationEvent`, `AutomationExecution`) + índices.
3. `npm run build`
4. Commit/push **somente quando a DONA autorizar** (sandbox não tem permissão de push).

---

## 21. ARQUIVOS — MODIFICADOS E NOVOS

**Modificados (evoluídos):**
- `src/lib/publishing/index.ts` (barrel — backward-compat preservada)
- `src/lib/publishing/compatibility.ts` (`hashtags?: string`)
- `src/lib/publishing/service.ts` (tipo de retorno `id` no `loadContent`)
- `src/components/ai/preview-social-client.tsx` ("Publicar agora")
- `src/components/planning/calendar-client.tsx` (PROCESSANDO)
- `src/lib/navigation.ts` (Central de Publicação + Automações)
- `prisma/schema.prisma` (models Fase 7)
- `src/types/prisma-shim.d.ts` (interfaces Fase 7)

**Novos (Fase 7):**
- Motor: `src/lib/publishing/{types,errors,db,queue,retry,status,service,rate-limit}.ts`
- Adapters: `src/lib/publishing/adapters/{index,instagram,tiktok}.ts` + `instagram/index.ts` + `tiktok/index.ts`
- APIs: `src/app/api/publishing/route.ts` + `logs/route.ts` + `src/app/api/webhooks/publishing/route.ts` + `src/app/api/automations/route.ts`
- Páginas: `src/app/(app)/publishing/page.tsx` + `src/app/(app)/automacoes/page.tsx`
- Componentes: `src/components/publishing/publishing-client.tsx` + `src/components/automations/automations-client.tsx`

---

## 22. SEGURANÇA — REVISÃO ESPECÍFICA

- **Nenhum segredo em log/banco:** `PublishLog` e `AutomationEvent` guardam apenas mensagens sanitizadas; `sanitizePayload`/`sanitizeMessage` removem tokens/secrets/JWT antes de persistir e na resposta.
- **Owner-check em toda a cadeia:** fila (`getQueueItem`/`cancelQueueItem`), logs (`userId` da sessão), automações (findUnique + compara `userId`), webhooks (mapeamento para o dono quando conhecido).
- **Rate limit interno** nas mutações de fila e automações.
- **Idempotência** em fila e eventos.
- **Acesso pago:** `canAccessPaidFeatures = true` (dev) — sem bloqueio indevido.

---

## 23. POSSÍVEIS EVOLUÇÕES NA PRÓXIMA FASE (fora de escopo hoje)

- Ativar publicação real quando a integração (Meta/TikTok) for liberada — construir containers, `media_publish`, upload de vídeo, com `externalId` real.
- Verificação de assinatura `X-Hub-Signature-256` com App Secret.
- Worker/cron de fila persistente (Vercel Cron).
- Rate limit persistente (Upstash/DB) em produção.
- Disparo real de Comentário→DM quando a integração de comentários existir.
- Refrescar tokens e validar escopos de publicação no fluxo real.

---

## 24. ERROS CORRIGIDOS DURANTE A FASE 7

| Erro | Correção |
|---|---|
| Export duplicado `MAX_AUTO_ATTEMPTS` no barrel (TS2308) | Removido do bloco `./types` (fica no `./service`). |
| `hashtags` inexistente em `CompatibilityInput` (TS2339) | Adicionado `hashtags?: string` à interface. |
| `getAdapter`/`PublishPayload` não ligados no barrel (TS2552/TS2304) | `export { X } from` não liga localmente → imports explícitos. |
| `loadContent` sem campo `id` (TS2345) | Adicionado `id: string` ao tipo de retorno. |
| Import `requireSession` não usado no webhook | Removido. |

---

## 25. PENDÊNCIAS E PRÓXIMO PASSO PARA A DONA

1. Validar localmente: `prisma generate` → `db push` → `npm run build`.
2. Testar `/publishing`, `/automacoes` e o "Publicar agora" do Preview Social (esperado: toast "integração não configurada" — comportamento correto).
3. Commit/push quando autorizar (sandbox não tem permissão).
4. **Fase 8 aguardando autorização.**

---

## 26. ARQUITETURA PARA A PRÓXIMA FASE (base pronta)

- **Fila de publicação** (tabela + índices `[status, scheduledAt]`, `[status, nextAttemptAt]`) — pronta para cron/Vercel Cron.
- **Adapters** com contrato `validate/publish/getStatus/cancel` — ativar publication real = implementar `publish()` no adapter (ou um adapter Meta/TikTok real) sem tocar no motor.
- **Webhooks** com idempotência e sanitização — ativar = configurar `VERIFY_TOKEN` + App Secret.
- **Automações** com models `AutomationRule/Event/Execution` — ativar = ligar o disparo real de comentários à avaliação.
- **Barrel público** preserva compatibilidade total com consumidores antigos.

---

## REGRA FINAL

Fase 7 implementada **somente**; Fase 8 **não** iniciada. Nada commitado/pushado. Nada publicado por tempo. Relatório entregue.
