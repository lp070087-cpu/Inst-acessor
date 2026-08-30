# RELATÓRIO — INTEGRAÇÕES REAIS E FECHAMENTO DE PRODUÇÃO

**Data:** 2026-08-29
**Branch:** `checkpoint-fase8-fase9` (não alterada)
**HEAD:** `8cb47a0` (não alterado — nenhum commit nesta rodada)
**Escopo:** Auditoria final de todas as integrações externas (Meta/Instagram, TikTok, IA, Asaas) + documentação para fechamento de produção.
**Status:** Concluído · `tsc --noEmit` EXIT 0 · growth 28/28 · build bloqueado no sandbox (SWC EAI_AGAIN — DONA roda local)

---

## 1. Instagram/Meta — Valores EXATOS de registro (para configurar manualmente)

> **IMPORTANTE:** Nenhum domínio de produção foi inventado. Substitua `<SEU-DOMINIO>` pelo domínio real quando existir (Vercel/Preview/produção).

### 1.1 OAuth — URL de redirect (callback) para cadastrar no Meta Developers

| Ambiente | Valor exato |
|---|---|
| **Local** | `http://localhost:3000/api/integrations/instagram/callback` |
| **Vercel Preview** | `https://<SEU-DOMINIO-PREVIEW>.vercel.app/api/integrations/instagram/callback` |
| **Produção** | `https://<SEU-DOMINIO>/api/integrations/instagram/callback` |

**Path fixo (no código):** `/api/integrations/instagram/callback` — confirmado em `src/app/api/integrations/instagram/callback/route.ts`.

### 1.2 Webhook — URL para cadastrar no Meta Developers

| Ambiente | Valor exato |
|---|---|
| **Local** | `http://localhost:3000/api/webhooks/instagram` |
| **Vercel Preview** | `https://<SEU-DOMINIO-PREVIEW>.vercel.app/api/webhooks/instagram` |
| **Produção** | `https://<SEU-DOMINIO>/api/webhooks/instagram` |

**Path fixo:** `/api/webhooks/instagram` — confirmado em `src/app/api/webhooks/instagram/route.ts`.

### 1.3 Webhook — Verify Token (challenge GET)

- **Variável de ambiente:** `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- **Uso:** o GET valida `hub.verify_token` contra essa variável. **Configure o MESMO valor no painel da Meta.**

### 1.4 Variáveis de ambiente Meta (valores = presença; nunca exibir o valor)

| Variável | Necessária? | Onde o código lê |
|---|---|---|
| `META_APP_ID` (ou `INSTAGRAM_APP_ID`) | ✅ Sim | `getMetaCredentials()` em `client.ts` |
| `META_APP_SECRET` (ou `INSTAGRAM_APP_SECRET`) | ✅ Sim | `getMetaCredentials()` + assinatura do webhook |
| `INSTAGRAM_REDIRECT_URI` | ✅ Sim | `getRedirectUri()` em `client.ts` |
| `INSTAGRAM_GRAPH_VERSION` | Opcional (default `v21.0`) | `client.ts` |
| `INSTAGRAM_SCOPES` | Opcional (default definido no código) | `oauth.ts` |
| `TOKEN_ENCRYPTION_KEY` | ✅ Sim (para criptografar tokens em repouso) | `src/lib/crypto` |

**Estado local:** nenhuma dessas variáveis está definida no `.env`/`.env.local` — as integrações Meta estão **PENDENTES de configuração manual**.

### 1.5 Scopes oficiais (configuração do produto no painel da Meta)

Os scopes solicitados na URL de autorização (padrão do código):
```
instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
```
> Também documentados no `.env.example` (`INSTAGRAM_SCOPES`). **Confirmado que `business_management` foi substituído** pelos scopes corretos na Fase 10 (diff do `.env.example`).

## 2. Instagram/Meta — Status do código

**CÓDIGO PRONTO, CONFIGURAÇÃO PENDENTE.** O fluxo está completo e seguro:

- `connect` monta a URL de autorização **antes** de persistir `CONNECTING` (anti-travamento).
- `callback` valida `state` (CSRF, single-use, expiração), troca `code`→token **no servidor**, obtém dados da conta (`/me`, `instagram_business_account`), persiste token **criptografado** (AES-256-GCM) com expiração/scopes.
- `refresh` descriptografa o token **apenas no servidor** para chamar a API; nunca retorna token.
- `disconnect` e `sync` presentes.
- Webhook: challenge GET (verify token) + POST com `X-Hub-Signature-256` (HMAC-SHA256 com app secret, `timingSafeEqual`), rate limit por IP, **idempotência** (`AutomationEvent.eventId @@unique`), payload sanitizado (remove chaves `token|secret|password|access_|signature`). **Nenhuma ação automática é executada** — apenas registra.

## 3. TikTok — CODE READY vs CONFIG/APP REVIEW PENDING

**CÓDIGO 100% PRONTO. CONFIGURAÇÃO + APP REVIEW PENDENTES (ação da DONA + TikTok).**

| Aspecto | Status |
|---|---|
| OAuth (Authorization Code + **PKCE S256**) | ✅ Código completo |
| Troca de code por token no servidor (`client_secret`) | ✅ |
| Refresh token (com renovação do refresh) | ✅ |
| Scopes `user.info.basic, video.list` | ✅ |
| API `/user/info/` + `/video/list/` (com `fields` corretos) | ✅ |
| Token criptografado em repouso | ✅ |
| Connect/callback/disconnect/sync/refresh | ✅ |
| Webhook GET (challenge `echostr` + token) | ✅ |
| **Webhook POST com verificação de assinatura** | ⚠️ **PENDENTE** — o POST do TikTok **não valida assinatura** (diferente do Instagram). Registrado como pendência real. |
| App criado no TikTok Developer Portal | ❌ Pendente (ação externa) |
| App Review / permissões | ❌ Pendente (ação externa — `video.list` e dados de usuário exigem review) |

### 3.1 Valores de registro TikTok (substitua `<SEU-DOMINIO>`)

| Ambiente | Redirect URI |
|---|---|
| **Local** | `http://localhost:3000/api/integrations/tiktok/callback` |
| **Vercel Preview** | `https://<SEU-DOMINIO-PREVIEW>.vercel.app/api/webhooks/tiktok` |
| **Produção** | `https://<SEU-DOMINIO>/api/integrations/tiktok/callback` |

**Path fixo do callback:** `/api/integrations/tiktok/callback` · **Webhook path:** `/api/webhooks/tiktok`.

### 3.2 Variáveis TikTok

`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_VERIFY_TOKEN` — **nenhuma definida localmente** (pendente).

## 4. OpenAI / IA — ADMIN-only, sem vazamentos

**Configuração CENTRAL (área admin, Fase 10).** Confirmado:

- **Chaves nunca no frontend** — nenhum `NEXT_PUBLIC_*` para chaves de IA/credenciais em `src/` (grep confirmou 0 ocorrências).
- **Admin grava chave** via `/api/admin/ia` (só `requireAdminSession`), persistida **criptografada** (AES-256-GCM) em `SystemSetting`.
- **Status** devolve apenas sufixo **mascarado** (`sk-••••••••••••abcd`), nunca a chave.
- **Teste de chave** (`action: "test"`) não grava e não devolve a chave.
- **Sem chave → estado controlado** (sem mock): `aiConfigured()` retorna `false`, UI mostra "IA ainda não configurada".
- Fallback para env vars `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY` (server-only).
- **Provider server-only** (`src/lib/ai/provider.ts`) — nunca importado em client com chaves.

## 5. Asaas — Billing

| Item | Valor |
|---|---|
| **Planos** | Semanal R$ 27 (2700) · Mensal R$ 77 (7700) · Anual R$ 497 (49700) — **inalterados** |
| **Sandbox base URL** | `https://api-sandbox.asaas.com/v3` |
| **Produção base URL** | `https://api.asaas.com/v3` |
| **Autenticação** | header `access_token` |
| **Variáveis** | `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Estado** | Adapter **conceitual** — retorna `INTEGRATION_NOT_CONFIGURED`; nenhuma chamada HTTP; nenhuma URL fake |

**Confirmado:** `startCheckout` retorna o estado controlado "Pagamento online em configuração." sem gerar checkout falso. Nenhuma chave é pedida nem criada nesta fase.

## 6. Asaas — Webhook (preparação, sem implementação)

**Não existe rota de webhook Asaas ainda** (`grep` em `src/app/api/webhooks/` → só instagram/publishing/tiktok). Quando a integração for liberada, **mapear APENAS os eventos oficiais necessários** (nomes reais da API Asaas):

| Evento (oficial Asaas) | Uso no Inst Acessor |
|---|---|
| `PAYMENT_CONFIRMED` | Liberar acesso (assinatura/cobrança confirmada) |
| `PAYMENT_RECEIVED` | (Varia conforme modelo) — avaliar se necessário |
| `PAYMENT_OVERDUE` | Marcar cobrança vencida (bloquear acesso) |
| `PAYMENT_CANCELED` | Cancelar acesso |
| `PAYMENT_REFUNDED` | Reverter acesso |

> ⚠️ **Não implementar agora.** Apenas documentado. Quando liberar, validar os nomes exatos na documentação oficial do Asaas antes de codificar.

## 7. Primeiro acesso — NÃO implementado (arquitetura não impede)

- **Onboarding** existe (`/onboarding`, wizard step-by-step) e é obrigatório antes de entrar no app.
- A "**ideia do primeiro acesso**" (diferente do onboarding) **não foi implementada** — conforme instrução.
- A arquitetura atual (onboarding + redirects + `requireOnboardedSession`) **não impede** a implementação futura: é aditiva.

## 8. Admin — Painel de status das integrações

**`/admin/integracoes`** (protegido por `requireAdminSession`) mostra:
- Instagram (Meta), TikTok, IA (OpenAI/Gemini), Asaas — cada um com status **"Configurado / Não configurado"** lido das env vars do servidor.
- **NUNCA expõe segredos** — apenas presença/ausência; tokens nunca aparecem.
- Lista conexões ativas (username + status) por plataforma.

## 9. .env.example — Documentação Local/Preview/Production

Atualizado nesta rodada: adicionados `ASAAS_BASE_URL` e `ASAAS_WEBHOOK_TOKEN` (com valores oficiais de sandbox/produção). Já continha: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, variáveis Meta/Instagram/TikTok/IA/Asaas com comentários claros.

**Nota:** para **Preview/Production**, o DONA deve definir as mesmas variáveis no painel da Vercel (com os domínios corretos de `INSTAGRAM_REDIRECT_URI`/`TIKTOK_REDIRECT_URI` e `AUTH_URL`/`NEXTAUTH_URL`). Não há inventário de domínio de produção (não inventado).

## 10. Segurança — Revisão

| Item | Status |
|---|---|
| Nenhum secret hardcoded em `src/` | ✅ |
| `.env.local` gitignored (não tracked) | ✅ |
| Tokens criptografados em repouso (AES-256-GCM) | ✅ |
| Chaves IA nunca no frontend (`NEXT_PUBLIC_*` = 0) | ✅ |
| Callbacks OAuth trocam code→token no servidor | ✅ |
| Webhook Instagram com HMAC + `timingSafeEqual` | ✅ |
| Rate limit em webhooks e registro | ✅ |
| Idempotência de eventos | ✅ |
| Payload sanitizado (sem secrets) | ✅ |
| Admin sempre `requireAdminSession` no servidor | ✅ |
| **PENDÊNCIA:** webhook POST TikTok sem verificação de assinatura | ⚠️ |

## 11. Testes

| Teste | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` | ✅ **EXIT 0** |
| `npm run growth:test` | ✅ **28/28** |
| `npm run build` | ⛔ Bloqueado no sandbox (SWC EAI_AGAIN) — DONA roda local |
| `npm audit fix --force` | ⛔ Não executado (proibido) |

## 12. Arquivos alterados NESTA rodada

| Arquivo | Mudança |
|---|---|
| `.env.example` | Adicionados `ASAAS_BASE_URL` e `ASAAS_WEBHOOK_TOKEN` + comentários (o restante do diff — scopes Instagram — era de fases anteriores, já no working tree) |
| `.env.local` | `AUTH_SECRET` + `AUTH_URL` + `NEXTAUTH_URL` (rodada anterior de validação; gitignored) |
| `RELATORIO-INTEGRACOES-FINAIS.md` | Este relatório |

**Nenhum arquivo de código alterado nesta rodada de integrações.**

## 13. Estado do working tree

- Branch `checkpoint-fase8-fase9` inalterada · HEAD `8cb47a0` · **66 arquivos modificados** (65 pré-existentes das Fases 8-11 + landing + `.env.example`) · nenhum commit/push/merge.

## 14. Pendências reais (para produção)

1. **Webhook POST TikTok sem verificação de assinatura** — adicionar validação quando o webhook for ativado (estilo Instagram: HMAC/verify token).
2. **Webhook Asaas não existe** — criar quando o billing for liberado (mapear só eventos necessários da seção 6).
3. **Configuração manual externa** — Meta, TikTok (com App Review), IA, Asaas (ver seções 1-6).
4. **Build local** — DONA roda `npm run build` (bloqueado no sandbox).
5. **Primeiro acesso** — não implementado (intencional).

## 15. Ações manuais necessárias (DONA)

1. **Meta/Instagram:** criar app na Meta Developers, configurar redirect URI + webhook URL + verify token (valores na seção 1). Definir `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENCRYPTION_KEY`.
2. **TikTok:** criar app no TikTok Developer Portal, configurar redirect URI + webhook (seção 3). Solicitar App Review para `video.list`/dados de usuário.
3. **IA:** gravar chave pela área admin (`/admin/ia`) ou definir `OPENAI_API_KEY`/`GEMINI_API_KEY` no servidor.
4. **Asaas:** quando liberar, definir `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`; criar webhook na plataforma.
5. **Vercel/Preview/Production:** definir todas as variáveis no painel (com domínios reais de redirect/webhook).
6. `npm run build` local para confirmar bundle.

## 16. Não executado (conforme instruções)

- ❌ Nenhum commit/push/merge/deploy/Vercel
- ❌ Nenhuma alteração de branch
- ❌ Nenhuma chamada real à Meta/TikTok/OpenAI/Gemini/Asaas
- ❌ Nenhuma URL fake / token inventado / sucesso de API inventado
- ❌ Nenhuma chave solicitada, criada, exibida ou alterada
- ❌ Nenhuma mudança de plano (R$ 27/77/497 mantidos)
- ❌ Primeiro acesso NÃO implementado (intencional)

## 17. Observações de arquitetura (para a fase de implementação real)

- O fluxo OAuth já isola a troca de code→token no servidor; o cliente só vê "Conectar".
- A camada de billing é **abstraída** (`BillingAdapter`) — trocar o Asaas conceitual pelo real é pontual (só o adapter).
- A IA é **desacoplada** via `AIProvider` + configuração admin — adicionar provider é aditivo.
- O webhook do Instagram é o modelo a seguir para o TikTok (assinatura + idempotência + sanitização).

## 18. Próximo passo sugerido (após aprovação da DONA)

1. DONA roda `npm run build` e confirma o bundle.
2. Configura as integrações externas (seções 1-6).
3. Quando aprovar, commitar os 66 arquivos.
4. Fase futura: implementar o billing Asaas real (adapter + webhook), verificação de assinatura do webhook TikTok, e a "ideia do primeiro acesso".

---

**Fim da rodada — PARADA conforme instrução.**
