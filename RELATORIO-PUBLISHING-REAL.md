# RELATÓRIO — PUBLICAÇÃO REAL + META/INSTAGRAM

**Projeto:** Inst Acessor · **Data:** 2026-08-30
**Branch:** `checkpoint-fase8-fase9` · **Sem commit/push/merge/deploy (regra de parada).**

---

## 1. Estado anterior (auditoria)

O motor de publicação da Fase 7 (`src/lib/publishing/`) estava **estruturalmente completo** —
service, fila, retry, status, compatibilidade, adapters — mas os adapters reais
(`instagram/index.ts` e `tiktok/index.ts`) **sempre retornavam `INTEGRATION_NOT_CONFIGURED`**.
A infraestrutura de credenciais existia (`SocialConnection.tokenEncrypted` + `decryptToken`),
e o fluxo de confirmação (`markPublished` + `plannedContent.status = PUBLICADO`) já estava
pronto para receber `externalId` real. **O que faltava era a implementação real dos adapters.**

## 2. O que foi implementado nesta etapa

Publicação REAL via APIs oficiais, com **fail-closed** e **honestidade** (nunca inventar
`externalId`, nunca afirmar `PUBLICADO` sem confirmação):

- **`src/lib/publishing/media.ts`** (novo) — módulo puro/testável:
  - `isPublicMediaUrl` / `isDataUrl` — classificação de mídia (URL pública vs data URL local).
  - `extractMediaRefs` — normaliza mídia primária + itens de carrossel.
  - `buildCaption` / `trimToLimit` — legenda + hashtags no limite oficial (truncamento por
    **code point**, preserva emojis).
  - `buildInstagramContainers` — monta containers oficiais (post/carrossel/reel/story).
  - `buildTikTokPostBody` — corpo oficial da Content Posting API.
  - `mapTikTokStatus` / `mapInstagramStatus` — status oficial → estado interno (nunca LIVE sem
    confirmação).
- **`src/lib/publishing/http.ts`** (novo) — fetch com timeout + retries (429/5xx/network),
  erros tipados `PublishHttpError`, mensagens sanitizadas (nunca loga token).
- **`src/lib/publishing/connection.ts`** (novo) — resolve conexão ativa do usuário:
  `SocialConnection` CONNECTED + token descriptografado (AES-256-GCM) + `externalAccountId`
  (Instagram: igAccountId; TikTok: open_id). Fail-closed.
- **`src/lib/publishing/instagram/index.ts`** (substituído) — Graph API v21.0 real:
  1. `POST /{ig-user-id}/media` → container (IMAGE/REELS/STORIES/CAROUSEL);
  2. `POST /{ig-user-id}/media_publish` `{creation_id}` → media id REAL.
  Falhas: sem conexão → `INTEGRATION_NOT_CONFIGURED`; mídia local-only → `VALIDATION` honesto.
- **`src/lib/publishing/tiktok/index.ts`** (substituído) — Content Posting API real:
  1. `POST /post/publish/video/init/` → `publish_id`;
  2. poll `POST /post/publish/status/fetch/` até `PUBLISH_COMPLETE` (máx. 5× 4s).
  `PUBLICADO` **só** após confirmação; `publish_id` persistido em falha retryável p/ não duplicar.
- **`src/lib/publishing/queue.ts`** — `markFailed` agora aceita `externalId` (persiste id de
  processo em retry).
- **`src/lib/publishing/service.ts`** — `logAttempt`/`markFailed` passam `externalId` do adapter.
- **`src/lib/publishing/errors.ts`** — mensagem padrão de `INTEGRATION_NOT_CONFIGURED`
  atualizada (reflete que a publicação real existe, basta conectar).
- **`src/lib/publishing/index.ts`** — barrel exporta os novos módulos puros + `buildInstagramPayload`.
- **`scripts/publishing-tests.ts`** + **`tsconfig.publishing-test.json`** + **`package.json`** —
  nova suíte `npm run publishing:test` (25 testes).

## 3. Decisão-chave: mídia local vs URL pública (honestidade)

`SocialDraft.mediaUrl` é uma **data URL** (upload local, "só na memória do browser" — schema).
As APIs oficiais (Graph API `image_url`/`video_url`; TikTok `PULL_FROM_URL`) **exigem URL pública**
acessível pela internet. Portanto:

- Se o conteúdo só tem mídia local → **`VALIDATION` honesto** (mensagem clara: "exige URL pública").
  **Nunca** fabrica `externalId` nem afirma publicação.
- Se houver URL pública + token válido → **publica de verdade**.
- Isso respeita a regra do ESCOPO-OFICIAL: "NUNCA inventar conhecimento / id externo".

## 4. Fluxo do Instagram (Graph API v21.0)

1. Resolve conexão (`SocialConnection` CONNECTED + token).
2. Valida mídia pública (`extractMediaRefs`).
3. Monta containers oficiais:
   - post imagem → `media_type=IMAGE`, `image_url`;
   - post vídeo / reel → `media_type=REELS`, `video_url`;
   - story → `media_type=STORIES` (sem caption);
   - carrossel → N containers `is_carousel_item=true` + pai `CAROUSEL` com `children`.
4. `POST /{ig-user-id}/media` → container id.
5. `POST /{ig-user-id}/media_publish` `{creation_id}` → media id REAL (`externalId`).
6. `markPublished` + `plannedContent.status=PUBLICADO`.

## 5. Fluxo do TikTok (Content Posting API)

1. Resolve conexão (`SocialConnection` CONNECTED + token, `externalAccountId`=open_id).
2. Valida mídia pública (1 vídeo — foto/carrossel não é afirmado).
3. `POST /post/publish/video/init/` com `post_info` + `source_info.source=PULL_FROM_URL`
   → `publish_id`.
4. Poll `POST /post/publish/status/fetch/` até `PUBLISH_COMPLETE` (máx. 5× 4s).
5. `PUBLICADO` **só** na confirmação; senão `RETRYABLE` guardando `publish_id`.

## 6. Confirmação e estados

- **PUBLICADO** = `markPublished(queueId, externalId)` + `plannedContent.update(status=PUBLICADO,
  publishedAt, externalId)` — apenas com id real da plataforma.
- **PROCESSANDO** = tentativa real em andamento.
- **FALHOU** = com erro classificado; retry controlado (máx. 3).
- **CANCELADO** = nunca publica.
- Status consultável via `getStatus` (adapter) quando há `externalId`.

## 7. Classificação de erros

| Código | Quando |
|---|---|
| `INTEGRATION_NOT_CONFIGURED` | sem conexão/config ativa |
| `AUTH` | token expirado/revogado, 401/403 |
| `RATE_LIMIT` | 429 |
| `RETRYABLE` | timeout/rede/5xx/processamento assíncrono |
| `PERMANENT` | 4xx (conteúdo rejeitado) |
| `VALIDATION` | payload inválido / mídia local-only |

## 8. Segurança

- Token descriptografado **apenas no servidor** (`decryptToken`), nunca ao cliente/logs.
- `publishHttp` sanitiza mensagens (nunca inclui `access_token`/query).
- `connection.ts` nunca expõe credenciais; resolve via `SocialConnection` + owner-check.
- Sem novos secrets; `.env.example` já cobre `INSTAGRAM_GRAPH_VERSION` e credenciais.

## 9. Compatibilidade

- Instagram: post/carrossel/reel/story.
- TikTok: vídeo apenas (foto/carrossel = capability futura a confirmar).
- `media.ts` mapeia formatos internos → `media_type` oficial.

## 10. Testes

- `npm run publishing:test` → **25/25** (URL pública vs local, limites de legenda, containers
  Instagram, corpo TikTok, mapeamento de status).
- `npm run billing:test` → **31/31** (inalterado).
- `npm run growth:test` → **28/28** (inalterado).
- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` → **EXIT 0**.

## 11. Variáveis de ambiente

Nenhuma nova obrigatória. Já existentes e relevantes:
`INSTAGRAM_GRAPH_VERSION`, `META_APP_ID/SECRET`, `INSTAGRAM_APP_ID/SECRET`,
`TIKTOK_CLIENT_KEY/SECRET`, `TOKEN_ENCRYPTION_KEY`.

## 12. O que a DONA precisa rodar localmente

Sem mudança de schema Prisma → **não requer db push/migrate**.
- `npm run publishing:test` (validação).
- `npx tsc --noEmit` (já EXIT 0 no sandbox).
- `npm run build` local (SWC bloqueado no sandbox — rotina usual).
- Commit/push local (esta etapa não commitou).

## 13. Pendências do sandbox

`npx next build` continua bloqueado no sandbox (SWC binary ausente). `prisma generate`/`db push`
não são necessários (nenhuma mudança de schema). Padrão usual: DONA valida build local.

## 14. Limite conhecido — mídia do Preview é local

Publicar a partir do Preview (data URL) retorna `VALIDATION` honesto. Para publicação real com
mídia, o fluxo futuro de "primeiro acesso/upload" ou a integração com CDN/URL pública será
necessário. **Nada é inventado; o sistema explica exatamente o que falta.**

## 15. TikTok assíncrono — sem duplicação

`publish_id` retornado pelo `init` é persistido em falha retryável (`markFailed(..., externalId)`),
então a próxima tentativa do worker NÃO cria um post duplicado — ela consulta o status do
mesmo `publish_id`.

## 16. Backward-compat preservada

`prepareInstagramPublish`, `prepareTikTokPublish`, `validatePublishPayload`, `getPublisher`
continuam exportados. `buildInstagramPayload` agora usa o fluxo real de caption/hashtags.

## 17. Arquivos criados

- `src/lib/publishing/media.ts`
- `src/lib/publishing/http.ts`
- `src/lib/publishing/connection.ts`
- `scripts/publishing-tests.ts`
- `tsconfig.publishing-test.json`

## 18. Arquivos modificados

- `src/lib/publishing/instagram/index.ts` (adapter real)
- `src/lib/publishing/tiktok/index.ts` (adapter real)
- `src/lib/publishing/queue.ts` (`markFailed` + externalId)
- `src/lib/publishing/service.ts` (externalId no retry/log)
- `src/lib/publishing/errors.ts` (mensagem NOT_CONFIGURED)
- `src/lib/publishing/index.ts` (barrel + novos exports)
- `package.json` (script `publishing:test`)

## 19. Próximos passos sugeridos (fora desta etapa)

- Upload/URL pública para mídia real (fase "primeiro acesso" ou CDN).
- App Review Meta/TikTok (não implementado — escopo proibido).
- Publicação Vercel/GitHub (fora do escopo).

## 20. REGRA DE PARADA

**Nenhum commit/push/merge/deploy.** Nenhuma alteração na `main`. Nenhum upgrade major de
dependências. Nenhum `prisma db push --accept-data-loss`. A DONA valida localmente e decide o
commit. **Etapa concluída — PARE.**
