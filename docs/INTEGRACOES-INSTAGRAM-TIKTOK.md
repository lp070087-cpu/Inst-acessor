# Integrações Instagram e TikTok — estado, correções e dependências externas

Documento de auditoria das integrações do Inst Acessor. Descreve o que está
implementado, o que foi corrigido, o que está genuinamente incompleto e o que
depende de aprovação externa (Meta App Review / TikTok). Não substitui os
relatórios existentes em `docs/` (ex.: `APP-REVIEW-INSTAGRAM.md`,
`APP-REVIEW-TIKTOK.md`, `RELATORIO-*`).

---

## 1. Hosts e versões

### Instagram — Instagram Business Login (sem Página do Facebook)
| Uso | Host |
| --- | --- |
| Autorização (navegador) | `https://www.instagram.com/oauth/authorize` |
| Code → token curto | `https://api.instagram.com/oauth/access_token` (POST form) |
| Curto → longo (~60d) | `https://graph.instagram.com/access_token` |
| Renovação | `https://graph.instagram.com/refresh_access_token` |
| Dados / insights / publicação | `https://graph.instagram.com` |

Versão da Graph API: `process.env.INSTAGRAM_GRAPH_VERSION || "v21.0"`
(`src/lib/integrations/instagram/client.ts:22`). **Ação externa:** confirmar no
painel da Meta a versão mais recente suportada e planejar o bump (a v21 tem
prazo de validade; aposentadorias de versão da Graph API são anunciadas pela
Meta). Nenhum campo/model aposentado é usado no código hoje.

### TikTok — Login Kit + Display API + Content Posting API (v2)
| Uso | Host |
| --- | --- |
| Autorização | `https://www.tiktok.com/v2/auth/authorize` |
| Token / refresh | `https://open.tiktokapis.com/v2/oauth/token/` |
| Perfil | `https://open.tiktokapis.com/v2/user/info/` (GET) |
| Lista de vídeos | `https://open.tiktokapis.com/v2/video/list/` (**POST**) |
| Publicar vídeo | `https://open.tiktokapis.com/v2/post/publish/video/init/` (POST) |
| Status de publicação | `https://open.tiktokapis.com/v2/post/publish/status/fetch/` (POST) |

A API v2 responde **sempre HTTP 200** e sinaliza o resultado no corpo
(`{"data":...,"error":{"code":"ok"|"<erro>",...}}`).

---

## 2. Correções aplicadas nesta auditoria

### TikTok
1. **`client.ts` — envelope de erro v2 mal interpretado (bug crítico).**
   O cliente tratava a mera PRESENÇA de `error` como falha
   (`if (!res.ok || data.error)`) sem olhar `error.code`. Como TODO sucesso v2
   traz `error: { code: "ok" }`, o efeito era duplo: (a) toda chamada
   bem-sucedida (perfil e lista de vídeos) era lançada como erro; (b) um erro
   real devolvido com HTTP 200 (`invalid_token`, `scope_not_authorized`) passava
   como sucesso. Corrigido com `readTikTokError()` (trata `code:"ok"` como
   sucesso; reconhece também o formato string do endpoint de token) e
   `tiktokRequestWithRetry()`.
2. **`client.ts` — rate limit/erros transitórios com HTTP 200.** Adicionada a
   lista `TRANSIENT_TIKTOK_CODES` (`rate_limit_exceeded`, `internal_error`,
   `server_error`) para re-tentar o que antes era tratado como permanente.
3. **`client.ts` — corpo de erro ilegível.** `await res.json()` sem try/catch
   lançava exceção crua em resposta não-JSON de gateway. Agora é tolerante.
4. **`metrics.ts` — `video/list/` chamado com o método errado (bug crítico).**
   O endpoint exige **POST** (a TikTok recusa GET com 403) e a `max_count` vai
   no CORPO JSON, com `fields` na query. Corrigido com o novo
   `tiktokApiPostJson`; a versão anterior nunca devolvia vídeo algum.
5. **`oauth.ts` — erros de troca/refresh agora são `TikTokApiError` tipados**
   (antes eram `Error` cru, o que impedia o callback/refresh de mapear o código
   real).
6. **`callback/route.ts` — `lastSyncAt` preenchido no OAuth (bug).** Conectar
   não é sincronizar: o valor (a) mostrava "sincronizado agora" sem dados e
   (b) bloqueava o PRIMEIRO sync real pelo cooldown de 60s. Removido (mesma
   correção já aplicada ao callback do Instagram).
7. **`refresh/route.ts` — falha transitória marcava a conexão como `ERROR`.**
   Agora só marca `ERROR`/`reconnect` quando o refresh token é de fato
   inválido/expirado (`invalid_grant`, `invalid_token`, `token_expired`, ...);
   erro de rede/5xx preserva a credencial e devolve 502.

### Instagram
8. **`src/lib/publishing/instagram/index.ts` — `getStatus` sem autenticação
   (bug).** `containerStatusUrl(externalId)` era consultado com `{ method: "GET" }`
   sem header de autorização; a Graph API responde erro de token (code 190) e
   todo poll caía no `catch` genérico devolvendo `PROCESSING` para sempre.
   Agora envia `Authorization: Bearer` (mesmo padrão de `waitForContainer`).
9. **`oauth.ts` — comentários com dupla codificação (mojibake) normalizados
   para UTF-8.** Sem mudança de comportamento.
10. **`oauth.ts.bak` — arquivo morto identificado.** O `.bak` é uma cópia
    ANTIGA do `oauth.ts`: a única diferença funcional é que `oauth.ts` tem uma
    linha de diagnóstico a mais (`console.error("[instagram-oauth] long-lived
    exchange recusado", ...)`); o resto é ruído de comentário/codificação.
    Não é importado por nada e fica fora do `tsconfig` (termina em `.bak`, não
    casa com `**/*.ts`). **Pendência para o usuário:** remover o arquivo
    (`git rm`). A remoção foi deixada para o usuário por ser destrutiva.

### Verificado e SEM alteração (já correto)
- `instagram/metrics.ts`: `plays` não é mais pedido em `MEDIA_METRICS_VIDEO_LIST`
  (`video_views, video_view_time, ig_reels_avg_watch_time`), `pick("video_views","plays")`
  e o cache `rejectedMediaMetrics` para recusa permanente estão consistentes.
  Insights de CONTA usam `views` (aliasado internamente a `impressions`) em
  chamada própria e degradante — preservado.
- `instagram/client.ts`: retry 5xx/rede (2, backoff exponencial), timeout 20s e
  `isRetryableStatus` (429 / >=500) corretos; erros não-retentáveis são
  propagados com `code`/`subcode`/`type`/`fbtrace_id`. **Atualizado nesta rodada**
  (ver §2.2) para separar 429 de 5xx e agir sobre `X-App-Usage`.
- Webhook do Instagram: assinatura HMAC-SHA256 validada sobre o corpo bruto,
  FAIL-CLOSED sem App Secret, challenge fail-closed sem verify token.

### 2.2 Redução de risco de 429 (`instagram/client.ts`)

1. **Orçamentos de retry SEPARADOS por classe.** 5xx/rede: até 2, backoff de
   500ms exponencial (igual antes). 429: teto próprio `MAX_RATE_LIMIT_RETRIES=1`
   e **backoff maior** (`RATE_LIMIT_BASE_DELAY_MS=2000`), respeitando
   `Retry-After` (segundos) quando presente, com teto de 60s. Um 429 não consome
   o orçamento do 5xx — e não é re-tentado com a mesma agressividade do 5xx.
   429 é reconhecido por HTTP 429 **ou** pelos `code` da Meta 4/17/32/613.
2. **`X-App-Usage` / `X-Business-Use-Case-Usage` passam a ser LIDOS.** O maior
   percentual é extraído (sem logar o valor bruto). Com uso ≥ 85%
   (`APP_USAGE_SLOWDOWN_PERCENT`), as retentativas de rate limit **param (stop
   early)** — insiste-se menos justamente quando a cota está no limite. O
   percentual sozinho pode subestimar o problema (o excesso pode ser de
   `call_count`), por isso o teto baixo de retentativas é a proteção principal e
   o sinal de uso apenas a encurta.
3. **Chamadas por mídia usam `maxRateLimitRetries: 0`** (`metrics.ts`): num pico
   de 429 o sync degrada cada mídia (insights → `null`; comentários → INDISPONÍVEL)
   em vez de multiplicar as chamadas por dezenas de publicações. A
   `rejectedMediaMetrics` e o comportamento de timeout ficaram intactos.

### 2.3 Automações: dois subsistemas → um motor único + ponte

Havia DOIS subsistemas de automação disjuntos:
- `/automacoes` + `AutomationRule`/`AutomationEvent`/`AutomationExecution` — regras
  com `keywords[]` que **nenhum avaliador** consumia (o usuário configurava e nada
  acontecia). O webhook `api/webhooks/publishing` ainda gravava
  `AutomationExecution` com status `EVALUATED` e detalhe placeholder — um log
  FICTÍCIO que insinuava avaliação.
- `CommentDirectRule` + `evaluateComment` — o motor REAL (webhook de comentários,
  idempotência, perUser, limite diário, permissão).

**Resolução (sem duplicar motor, sem apagar dado):**
- `/automacoes` virou **PONTE somente-leitura**: mostra as regras do motor real
  (`CommentDirectRule`), o histórico real (`CommentDirectLog`) e o material legado
  como ARQUIVO (marcado como não-dispara). Criar/editar/ativar → Respostas
  Inteligentes → Automações (`?section=automacoes`).
- `POST /api/automations` responde **410 SUPERSEDED** (não recria regras mortas);
  `GET`/`DELETE` seguem para leitura e limpeza. Nenhum `AutomationRule`/
  `AutomationEvent`/`AutomationExecution` foi apagado — histórico preservado.
- `api/webhooks/publishing` grava status **`RECEIVED`** honesto (não `EVALUATED`)
  e o `eventId` deixou de usar `Date.now()`/`Math.random()`: deriva de campos
  estáveis (`entry.id` + `time`) ou de um **hash SHA-256 determinístico** do
  payload. Reentrega do MESMO corpo → mesmo id → barrado pela unique (idempotência
  real).

### 2.4 Rate limit em serverless (limitação documentada + contador persistente)

`src/lib/publishing/rate-limit.ts` é in-memory por instância — NÃO é um limite
global no Vercel (documentado no cabeçalho do arquivo). Decisão sem dependência
nova (sem Redis, sem migração):
- Cada caminho crítico foi conferido para NÃO depender só dele: **webhooks** têm a
  assinatura HMAC como defesa real (fail-closed); **IA/primeiro acesso** têm
  permissão/intervalo persistido/resposta genérica como defesa primária.
- Adicionado **`dbRateLimiter`**: contador PERSISTENTE em `VerificationToken`
  (`identifier` prefixado `dbrl:`, uma ficha por chamada, com `expires` no fim da
  janela), compartilhado por todas as instâncias — sem model novo nem migração e
  SEM criar usuário-sentinela (a tabela não tem FK para `User`, ao contrário de
  `AutomationEvent`/`UsageCounter`). Usado no webhook genérico em **fail-open
  deliberado** (indisponibilidade do banco não pode virar bloqueio; a assinatura
  continua sendo a defesa). Trade-off honesto: janela fixa tem uma corrida TOCTOU
  leve (admite um punhado a mais sob concorrência, nunca bloqueia a menos — o lado
  seguro do erro). A varredura de tokens expirados do NextAuth limpa as nossas
  fichas junto com as dela.

---

## 3. O que está implementado e completo

| Área | Instagram | TikTok |
| --- | --- | --- |
| OAuth (state/CSRF) | ✅ single-use, expiração, reset de estado | ✅ + PKCE (S256), `code_verifier` persistido |
| Token persistido | ✅ AES-256-GCM, long-lived ~60d | ✅ AES-256-GCM, formato `access|||refresh` |
| Renovação de token | ✅ `refresh` + `token-policy` (margem 5d, idade mínima 24h) | ✅ `refresh` (refresh_token) |
| Sync de métricas | ✅ perfil, insights (janela 7d), mídias paginadas, comentários (tristate) | ✅ perfil + vídeos (Display API) |
| Publicação real | ✅ container + espera de status + `media_publish`; IMDb, Reels, Stories, carrossel | ✅ `video/init` (PULL_FROM_URL) + poll de status |
| Status de publicação | ✅ `status_code` (com auth) | ✅ `status/fetch/` |
| Desconectar | ✅ limpa credencial, preserva histórico | ✅ idem |
| Webhook | ✅ comentários assinados + motor de resposta | ⚠️ estrutural (ver §5) |

**Testes:** não há suíte de testes automatizados para as integrações neste
repositório. A verificação é feita por `npx tsc --noEmit` (typecheck) e revisão
estática. Nenhuma chamada REAL de escrita foi feita às APIs nesta auditoria
(regra read-only).

---

## 4. Depende de App Review da Meta (Instagram)

Scopes solicitados no OAuth (`INSTAGRAM_DEFAULT_SCOPES`) e o que cada um exige
para operar com contas de TERCEIROS (não apenas testadores do app):

| Scope | Para quê | Aprovação |
| --- | --- | --- |
| `instagram_business_basic` | Perfil, mídias, leitura básica | **Advanced Access → App Review** para contas públicas |
| `instagram_business_manage_comments` | Ler/responder comentários (sync + webhook + Respostas Inteligentes) | **App Review** |
| `instagram_business_manage_messages` | Mensagens/Direct | **App Review** (mensageria) |
| `instagram_business_manage_insights` | Insights de conta e mídia | **App Review** |
| `instagram_business_content_publish` | Publicar (feed/Reels/Stories/carrossel) | **App Review** |

Observações:
- Até a aprovação, o app funciona apenas para as contas de teste adicionadas no
  painel. O código NÃO contorna isso: quando a Meta recusa por permissão, o
  sync marca a capacidade como indisponível (`commentsAvailable=false` +
  `commentsErrorCode`) e a UI mostra o motivo real, sem inventar "0 comentários".
- O webhook de comentários exige assinar o campo `comments` (e `live_comments`)
  e configurar `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` + App Secret.
- **Não alterar** campos sujeitos a aposentadoria sem conferir no painel da
  Meta (ver §1).

---

## 5. Depende de aprovação do TikTok

Scopes solicitados hoje (`DEFAULT_SCOPES` em `oauth.ts`):
`user.info.basic`, `video.list`.

| Scope / produto | Para quê | Aprovação |
| --- | --- | --- |
| `user.info.basic` | Open ID, avatar, display name | Disponível (produção após revisão do app) |
| `user.info.profile` | `bio_description`, `is_verified`, etc. | Revisão (avançado) |
| `user.info.stats` | `follower_count`, `likes_count`, `video_count` | **Revisão (avançado)** |
| `video.list` | Ler os vídeos do usuário (Display API) | **Revisão do app / produto Display API** |
| `video.publish` (ou `video.upload`) | Publicar vídeo (Content Posting API) | **Aprovação da Content Posting API + auditoria de Direct Post** |

Pontos que dependem de ação externa:
- **Publicação (`publish/tiktok/index.ts`)**: usa `video.publish` (Direct Post via
  `PULL_FROM_URL`). Esse scope **não está** na lista solicitada hoje — a
  publicação no TikTok não funciona até o scope ser adicionado e aprovado, e
  até o domínio que hospeda o vídeo ser **verificado** no portal do TikTok
  (`PULL_FROM_URL` só aceita URL de domínio verificado). O código já é
  fail-closed e não inventa publicação.
- **`user.info.stats`** também não está na lista atual: por isso o sync grava
  `followersCount`/`likesCount` apenas quando a API os fornece (hoje
  normalmente `null`), enquanto `video_count`/`display_name` podem vir de
  `user.info.basic`.
- **Webhook (`api/webhooks/tiktok/route.ts`)**: handler estrutural. O `GET` de
  challenge é fail-closed (exige `TIKTOK_WEBHOOK_VERIFY_TOKEN`). O `POST` agora
  **verifica a assinatura** `TikTok-Signature` sobre o corpo bruto ANTES de fazer
  `JSON.parse` (ver §2.1). Ainda NÃO processa/enfileira o evento (responde 200
  após validar a origem) — Fase 3.5 para o enfileiramento.

### 2.1 Assinatura do webhook do TikTok (implementada — inclui uma ASSUNÇÃO)

`src/lib/webhooks/signature.ts` → `verifyTikTokSignature(rawBody, header, secret)`.

Header `TikTok-Signature` no formato `t=<ts>,s=<sig>`. A verificação:

1. **Secret**: `TIKTOK_WEBHOOK_SECRET` → fallback `TIKTOK_CLIENT_SECRET` (lido de
   env, nunca impresso). Ausente → **fail-closed** (HTTP 503).
2. **Header ausente/malformado** → fail-closed (403).
3. **Timestamp (`t`)**: janela de ±5 min. Fora dela → **replay recusado** (403).
   O `t` é Unix timestamp; a unidade (segundos ou milissegundos) é inferida pela
   magnitude — a mensagem assinada usa sempre o texto CRU do `t`.
4. **HMAC-SHA256** sobre `${t}.${rawBody}` com a chave = secret, em hex, comparada
   com `timingSafeEqual` (constante no tempo). Divergente → 403.

**ASSUNÇÃO DECLARADA** (não confirmável neste ambiente, sem acesso a
`developers.tiktok.com`): a mensagem assinada é a concatenação `` `${t}.${corpo}` ``.
É o esquema documentado pelo TikTok, mas NÃO foi validada contra uma entrega real.
Como não dá para confirmar o esquema sem docs, a escolha é **fail-closed**: se o
corpo for real e a assinatura não bater, o evento é recusado (não "passa por
padrão"). Se a validação real revelar outro esquema, ajuste em um único lugar
(`verifyTikTokSignature`). Nenhuma chamada real foi feita nesta auditoria.
- **App review geral**: app em sandbox só opera com testadores adicionados. Não
  foi assumido nenhum status de revisão.

---

## 6. Variáveis de ambiente

Instagram: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` (fallback
`META_APP_ID`/`META_APP_SECRET`), `INSTAGRAM_REDIRECT_URI`,
`INSTAGRAM_GRAPH_VERSION` (opcional), `INSTAGRAM_SCOPES` (opcional),
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.

TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`,
`TIKTOK_WEBHOOK_VERIFY_TOKEN` (obrigatório para habilitar o webhook).

Nunca imprimir/commitar esses valores.

---

## 7. Verificação

```
npx tsc --noEmit
```

Typecheck limpo para todos os arquivos de integração. (Existe 1 erro de tipo
pré-existente e não relacionado, em
`src/app/(app)/calendario-inteligente/page.tsx`, fora do escopo desta
auditoria.)
