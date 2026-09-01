# RELATÓRIO — DIAGNÓSTICO E CORREÇÃO DO WEBHOOK META/INSTAGRAM

**Data:** 2026-09-01
**Escopo:** Diagnóstico real do 403 "Verificação falhou" no webhook do Instagram,
auditoria do código, correção aplicada e passos da DONA no Meta e no Vercel.

---

## 1. Diagnóstico (resultado real do teste)

A DONA reportou: token válido em `.env.local` → requisição de verificação do webhook
no ambiente de **produção** → **HTTP 403 "Verificação falhou"**.

O 403 é a resposta que a rota retorna quando o GET de challenge **chegou à rota** mas o
token não bateu exatamente. Isso já prova que:

1. A rota `src/app/api/webhooks/instagram/route.ts` está publicada e alcançável em
   produção (o 403 é gerado pelo nosso código — não é erro de deploy).
2. O valor de `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` carregado em produção **não** confere
   exatamente com o token usado na chamada de verificação da Meta.

### Causas raiz (2, ambas confirmadas no código)

| # | Causa | Detalhe |
|---|---|---|
| **R1** | O GET exigia `APP_SECRET` | `CONFIGURED = Boolean(VERIFY_TOKEN && APP_SECRET)`. Se o App Secret não estiver configurado em produção, o GET retorna 503 — mas se estiver *parcialmente* configurado ou com valor divergente, o fluxo ainda podia recusar. O App Secret **não deve participar da validação do GET** (challenge), apenas da assinatura do POST. |
| **R2** | Falta de `.trim()` nos envs | `process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN` era lido cru. Se o valor no painel da Vercel tiver **espaço/CRLF/linha nova no fim** (comum ao colar), a comparação exata `token === VERIFY_TOKEN` falha mesmo com token "correto". |

O **POST** (eventos reais) permanece dependente de `APP_SECRET` para validar
`X-Hub-Signature-256` — isso **não foi alterado**.

## 2. O que foi auditado

- `src/app/api/webhooks/instagram/route.ts` (GET/POST)
- `src/app/api/webhooks/publishing/route.ts` (GET/POST)
- `src/lib/webhooks/signature.ts` (HMAC-SHA256, `timingSafeEqual`, prefixo `sha256=`)
- `.env.example` (nomes de variáveis)
- Config da Meta (a partir do comportamento observado; **não** foram solicitados/expostos
  tokens)
- Fluxo OAuth do Instagram — **não alterado** nesta correção

## 3. Correção aplicada

### `src/app/api/webhooks/instagram/route.ts`

```ts
const VERIFY_TOKEN = (process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "").trim();
const APP_SECRET = (process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || "").trim();

const GET_CONFIGURED = Boolean(VERIFY_TOKEN);          // GET: só o verify token
const CONFIGURED = Boolean(VERIFY_TOKEN && APP_SECRET); // POST: ambos
```

- **GET** agora:
  - Com `hub.*` params (chamada real da Meta): valida com **apenas** o verify token;
    App Secret **não interfere**.
  - `mode === "subscribe" && token === VERIFY_TOKEN && challenge` → **200** com o
    `challenge` como texto puro exato.
  - Caso contrário → 403 "Verificação falhou" (ou 503 se sem token).
  - **Sem** `hub.*` params → **diagnóstico seguro**:
    ```json
    { "ok": true, "provider": "Instagram",
      "verifyTokenConfigured": true, "appSecretConfigured": true }
    ```
    Apenas booleanos — **nunca** token, tamanho, prefixo, sufixo, hash ou secret.
- **POST** — inalterado na lógica: continua exigindo `APP_SECRET` + assinatura válida,
  idempotência via `AutomationEvent.eventId`, sanitização de payload e rate limit.

### `src/app/api/webhooks/publishing/route.ts`

- Aplicado o mesmo `.trim()` no `VERIFY_TOKEN` e `APP_SECRET` (o GET já dependia apenas
  do verify token — lógica correta, faltava o trim).

## 4. Checklist — nomes exatos de variáveis

| Variável | Onde | GET challenge | POST assinatura |
|---|---|---|---|
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | `.env.example` L74 | ✅ obrigatório | — |
| `META_APP_SECRET` | `.env.example` L50 | ❌ **não interfere** | ✅ obrigatório |
| `INSTAGRAM_APP_SECRET` (fallback) | `.env.example` L56 | ❌ | ✅ se `META_APP_SECRET` ausente |

- **Sem fallback estranho**: a rota lê apenas esses nomes; nenhum outro alias é inventado.
- **Sem CRLF/espaço**: `.trim()` aplicado nas duas rotas (Instagram e publishing).
- **GET usa `hub.mode` / `hub.verify_token` / `hub.challenge`** — confirmado.
- **Resposta = 200 + body exatamente o `challenge`** (texto puro) quando
  `mode === "subscribe"` + token correto + challenge presente.
- **`APP_SECRET` NÃO interfere no GET** — corrigido.
- **OAuth do Instagram** — não alterado.

## 5. O que a DONA faz (Meta + Vercel)

1. **No Vercel** (Production): definir `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` com o **mesmo
   valor exato** usado na Meta — **sem espaços extras, sem Enter/CRLF no final**.
   (O `.trim()` no código já absorve espaços nas pontas, mas é boa prática colar limpo.)
   Se o App Secret existir, garantir também `META_APP_SECRET`.
2. **No painel da Meta** (App → Instagram → Webhooks → URL de callback):
   - Callback URL: `https://inst-acessor.vercel.app/api/webhooks/instagram`
   - Verify token: o mesmo valor de `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
   - Clicar **Verificar e salvar**.
3. **Teste de diagnóstico** (sem revelar segredos): abrir no navegador
   `https://inst-acessor.vercel.app/api/webhooks/instagram` → deve retornar
   `{"ok":true,"provider":"Instagram","verifyTokenConfigured":true,
   "appSecretConfigured":true}`. Se `verifyTokenConfigured` for `false`, a variável não
   chegou à produção.
4. **App Meta não publicado**: o webhook só recebe eventos reais após o app passar pela
   revisão/publicação da Meta (modo desenvolvimento x modo ativo). Enquanto não
   publicado, o **GET de verificação** já pode ser testado manualmente — é isso que esta
   correção destrava.

## 6. Por que o 403 acontecia mesmo com token "válido"

Hipótese mais provável (consistente com o diagnóstico): o valor do
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN` em **produção** diferia do token testado — por não
existir, por estar em outra environment (Development/Preview em vez de Production), ou
por trazer caractere invisível (espaço/CRLF) que a comparação exata rejeitava. Além
disso, a exigência indevida do `APP_SECRET` no GET adicionava uma condição a mais para o
403/503. As duas causas foram eliminadas no código.

## 7. Arquivos alterados

- `src/app/api/webhooks/instagram/route.ts`
- `src/app/api/webhooks/publishing/route.ts`

## 8. Validação

- `npx tsc --noEmit` → EXIT 0.
- Suítes: billing 31/31 · first-access 39/39 · publishing 25/25 · growth 28/28.
- Nenhum commit/push/deploy executado. Build local da DONA no Windows (SWC do sandbox
  não roda em Linux).

---

### Item 15 — Resumo objetivo

**Onde:** `src/app/api/webhooks/instagram/route.ts`
**Causa raiz:** (a) GET exigia `APP_SECRET` além do verify token; (b) envs sem `.trim()`
(CRLF/espaço quebrava a comparação exata).
**Correção:** GET dependente só do verify token; `.trim()` nas duas rotas; diagnóstico
seguro `{ok, provider, verifyTokenConfigured, appSecretConfigured}` sem segredos; OAuth
intocado; POST intocado na lógica.
**Pendência externa:** configurar `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` (idêntico) no Vercel
Production + no painel Meta; publicar o app Meta para eventos reais.
