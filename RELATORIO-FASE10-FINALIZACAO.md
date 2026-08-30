# RELATÓRIO FASE 10 — FINALIZAÇÃO TOTAL + PÁGINA DE VENDA + ADMIN + CORREÇÕES FINAIS

> **Produto:** Inst Acessor (SaaS Next.js 14.2.35 + TypeScript strict + Tailwind + Prisma/Neon + Auth.js)
> **Data:** 2026-08-29
> **Branch:** `checkpoint-fase8-fase9` (preservada — **sem commit/push/merge**)
> **Validações:** `tsc --noEmit` EXIT 0 · `growth:test` **28/28** ✅

---

## 1. Resumo executivo

A Fase 10 finalizou o produto em todas as frentes: **página de venda oficial**, **área administrativa completa**, **páginas do cliente sem placeholders**, **configuração central de IA**, **correção do bug crítico de conexão Instagram/TikTok** e **arquitetura segura do webhook da Meta**. Nenhuma integração real é iniciada sem confirmação externa; nenhum secret vaza; a identidade visual aprovada foi preservada.

---

## 2. Entregas da Fase 10 (requisitos 1–32)

| # | Entrega | Status |
| --- | --- | --- |
| 1 | Auditoria inicial obrigatória (relatórios + código) | ✅ |
| 2 | BUG crítico "Conectar Instagram/TikTok" travado em CONNECTING — corrigido em 4 camadas | ✅ |
| 3 | Página de venda oficial (`/` — 24+ seções, `landing.css` `lnd-`) | ✅ |
| 4 | Área administrativa (`/admin/*` — dashboard, usuários, IA, integrações, assinaturas) | ✅ |
| 5 | Config central de IA (`src/lib/admin/ai-config.ts` — DB-first criptografado + env fallback) | ✅ |
| 6 | API admin protegida (`requireAdminSession` em todas as rotas, rate limit, máscara de chaves) | ✅ |
| 7 | Páginas do cliente finalizadas (Perfil, Configurações, Sobre — sem placeholders) | ✅ |
| 8 | Assinatura (`/assinatura` — planos R$27/77/497 preservados, SEM Asaas/checkout falso) | ✅ |
| 9 | TikTok + Instagram loading/INP/estados de erro | ✅ |
| 10 | **Webhook Instagram seguro** (GET verify + POST assinado X-Hub-Signature-256 + idempotência) | ✅ |
| 11 | Testes determinísticos ampliados (23 → **28**) | ✅ |
| 12 | Relatório desta fase | ✅ |

---

## 3. Correção do bug crítico de conexão (Instagram/TikTok)

**Sintoma:** o botão "Conectar Instagram/TikTok" ficava preso em "Conectando..." para sempre.

**Causa raiz:** o status `CONNECTING` era persistido antes de validar a configuração; em qualquer falha a conexão ficava órfã em `CONNECTING` e a página nunca saía daquele estado.

**Solução — 4 camadas:**

1. **Connect antes do upsert** — `connect/route.ts` monta e valida a URL OAuth (`buildAuthUrl`) **antes** de gravar `CONNECTING`; `IntegrationConfigError` reseta para `DISCONNECTED`.
2. **Callback reseta/restaura** — `callback/route.ts` em **todos** os caminhos de erro chama `resetOrRestore()` (restaura `CONNECTED` se token já existia, senão `DISCONNECTED`) e redireciona com código controlado (`error=denied|missing_code|invalid_state|state_expired|config|token_exchange|not_compatible|account_fetch|server`).
3. **Página detecta CONNECTING órfão** — `redes-sociais/page.tsx` usa `effectiveStatus()`: se `status === "CONNECTING"` e **não** há `OAuthState` válido ativo, trata como `DISCONNECTED`.
4. **Timeout de segurança no cliente** — `instagram-actions.tsx`/`tiktok-actions.tsx`: botão libera sozinho após 10s; feedback imediato "Redirecionando...".

**Arquivos:** `connect/route.ts` (Instagram e TikTok), `callback/route.ts` (ambos), `redes-sociais/page.tsx`, `instagram-actions.tsx`, `tiktok-actions.tsx`.

---

## 4. Arquitetura segura do webhook Instagram

> Instrução da DONA: *"Se ainda não existir implementação completa para webhook Instagram, implementar arquitetura segura conforme a documentação oficial."*

Implementado em `src/app/api/webhooks/instagram/route.ts` + helper `src/lib/webhooks/signature.ts`:

- **GET (verificação da Meta):** valida `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. Se o webhook não estiver configurado, responde **503** — não finge sucesso.
- **POST (eventos):**
  - **Assinatura `X-Hub-Signature-256`** — HMAC-SHA256 do body com `META_APP_SECRET`; comparação com `timingSafeEqual`; rejeita (403) sem assinatura válida.
  - **Idempotência** — `AutomationEvent.eventId @@unique`; eventos repetidos respondem `{ duplicate: true }` sem reprocessar.
  - **Sanitização de payload** — remove `token|secret|password|access_|signature` antes de persistir.
  - **Rate limit por IP** — `webhookRateLimiter` (120/min).
  - **Nenhuma ação automática executada** — apenas registro; resposta 200 para a Meta não reenviar.
- **Webhook genérico** `src/app/api/webhooks/publishing/route.ts` — mesmo padrão (verificação de origem quando `META_APP_SECRET` configurado; idempotência; sanitização).

---

## 5. Configuração oficial Meta — documentação para registro no painel

### 5.1 Rotas exatas a registrar

| Finalidade | Rota | Host (base) |
| --- | --- | --- |
| Login/redirect OAuth | `/api/integrations/instagram/callback` | `INSTAGRAM_REDIRECT_URI` |
| Webhook (verificação + eventos) | `/api/webhooks/instagram` | domínio do app |
| Início da conexão | `/api/integrations/instagram/connect` | interno (servidor) |
| Webhook genérico (Fase 7) | `/api/webhooks/publishing` | interno (servidor) |

### 5.2 Variáveis de ambiente exatas

| Variável | Descrição |
| --- | --- |
| `META_APP_ID` | App ID da Meta (mesmo valor usado como `INSTAGRAM_APP_ID`). |
| `META_APP_SECRET` | App Secret — **nunca** no frontend, nunca em logs. Usado no webhook (assinatura) e no exchange de token. |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Aliases (opcional). Se o app da Meta for a única fonte, deixe iguais aos `META_*`. |
| `INSTAGRAM_REDIRECT_URI` | `http://localhost:3000/api/integrations/instagram/callback` (dev) → `https://<dominio>/api/integrations/instagram/callback` (prod). |
| `INSTAGRAM_GRAPH_VERSION` | `v21.0` (default no código). |
| `INSTAGRAM_SCOPES` | `instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages` (config oficial). |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Token de verificação do challenge (GET). Configure o **mesmo** valor no painel da Meta. |
| `TOKEN_ENCRYPTION_KEY` | Chave AES-256-GCM (gerar `openssl rand -hex 32`). |

### 5.3 Hosts da API

- **Autorização (OAuth):** `https://www.facebook.com/<version>/dialog/oauth`
- **Troca de token:** `https://graph.facebook.com/<version>/oauth/access_token`
- **Leitura de métricas:** `https://graph.facebook.com/<version>/<path>` (via `graphGet`)

> Nota: a integração usa **"Instagram API with Instagram Login"** (não Facebook Login). A autenticação usa o app da Meta como infraestrutura, mas a UI do SaaS mostra apenas "Conectar Instagram".

### 5.4 Escopos (permissões)

| Permissão | Uso |
| --- | --- |
| `instagram_business_basic` | Ler perfil profissional (nome, seguidores, mídia, métricas de alcance/impressões). |
| `instagram_business_manage_comments` | Gerenciar comentários (fundação Comentário→DM). |
| `instagram_business_manage_messages` | Gerenciar mensagens (DM) — integrações futuras. |

### 5.5 Configuração local/Preview/Produção

| Ambiente | Base URL (`AUTH_URL`) | Redirect URI |
| --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:3000/api/integrations/instagram/callback` |
| Preview (Vercel) | `https://<preview>.vercel.app` | `https://<preview>.vercel.app/api/integrations/instagram/callback` |
| Produção | `https://<dominio>` | `https://<dominio>/api/integrations/instagram/callback` |

No painel da Meta (App → **Configurações** → **Básico**):
- Adicionar o **Redirect URI** em "Login da empresa" (ETAPA 4).
- Configurar o **Webhook** (URL + Verify Token) em "Webhooks" (ETAPA 3).
- **Não** submeter App Review ainda (ETAPA 5).

---

## 6. Área administrativa (`/admin/*`)

- **Guard:** `requireAdminSession()` em `src/lib/auth/guard.ts` — valida sessão + `role === "ADMIN"` + status ativo no banco; redireciona para `/dashboard` se não autorizado.
- **Middleware:** `/admin/:path*` e `/api/admin/:path*` no matcher.
- **Páginas:** Dashboard (overview), Usuários (listar/demover/promover com autoproteção), IA (config central), Integrações (status sem segredos), Assinaturas.
- **API admin:** `overview`, `users` (autoproteção + não rebaixa outro ADMIN), `ia` (save/remove/test com rate limit 20/min), `ia/status`.
- **Segredos nunca exibidos:** a página de Integrações mostra apenas "Configurado/Não configurado"; as chaves de IA são mascaradas (`sk-••••••••••••abcd`).

---

## 7. Config central de IA (`src/lib/admin/ai-config.ts`)

- Chaves em `SystemSetting` criptografadas (AES-256-GCM) no banco, com fallback para env.
- `aiConfigured()` / `getAIProvider()` agora **assíncronos**; 7 chamadores atualizados.
- `testAIProvider()` testa OpenAI (`/v1/models`) e Gemini (`generateContent`) — **sem simular sucesso**.
- Corrigido `gemini.ts` (passava `model` faltando no construtor).

---

## 8. Páginas do cliente finalizadas

- **Perfil** (`/perfil`): nome de exibição, username, nicho, sub-nicho, objetivo — PATCH `/api/perfil` com owner-check.
- **Configurações** (`/configuracoes`): locale e timezone — PATCH `/api/configuracoes` com owner-check + Zod.
- **Sobre** (`/sobre`): 12 módulos + 6 pilares com copy real da landing aprovada.

Nenhuma página restante exibe placeholder; todos os dados são reais do banco.

---

## 9. Segurança auditada (verificação estática)

- ✅ Sem secrets hardcoded em `src/` (grep por `sk-`, `META_APP_SECRET="..."`, etc.).
- ✅ Nenhum `NEXT_PUBLIC_*` com KEY/SECRET/TOKEN/PASSWORD.
- ✅ Owner-check em `/api/perfil` e `/api/configuracoes` via `session.user.id`.
- ✅ Todas as rotas/páginas admin usam `requireAdminSession`.
- ✅ Tokens Meta/TikTok criptografados em repouso (AES-256-GCM) — nunca em logs/UI.
- ✅ Webhook assinado (HMAC) com rejeição de payload adulterado.

---

## 10. Testes

```bash
NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit      # EXIT 0
npm run growth:test                                          # 28/28 ✅
```

Novos testes (webhook):
- Assinatura `X-Hub-Signature-256` válida é aceita.
- Segredo errado é rejeitado.
- Payload adulterado é rejeitado.
- Ausência de assinatura é rejeitada.
- Formato `sha256=` e sem prefixo são aceitos.

---

## 11. Arquivos alterados

**Modificados (37):** `.env.example`, `package-lock.json`, `package.json`, `prisma/schema.prisma`, `scripts/growth-engine-tests.ts`, `tsconfig.growth-test.json`, `src/app/(app)/configuracoes/page.tsx`, `src/app/(app)/gerador-de-copy/page.tsx`, `src/app/(app)/ia-acessor/page.tsx`, `src/app/(app)/ideias/page.tsx`, `src/app/(app)/perfil/page.tsx`, `src/app/(app)/redes-sociais/page.tsx`, `src/app/(app)/sobre/page.tsx`, `src/app/api/integrations/instagram/callback/route.ts`, `src/app/api/integrations/instagram/connect/route.ts`, `src/app/api/integrations/tiktok/callback/route.ts`, `src/app/api/integrations/tiktok/connect/route.ts`, `src/app/api/webhooks/instagram/route.ts`, `src/app/api/webhooks/publishing/route.ts`, `src/app/page.tsx`, `src/components/integrations/instagram-actions.tsx`, `src/components/integrations/tiktok-actions.tsx`, `src/components/ui/badge.tsx`, `src/lib/ai/gemini.ts`, `src/lib/ai/index.ts`, `src/lib/ai/provider.ts`, `src/lib/ai/services/chat.ts`, `src/lib/ai/services/copy.ts`, `src/lib/ai/services/ideas.ts`, `src/lib/auth/config.ts`, `src/lib/auth/guard.ts`, `src/lib/integrations/instagram/oauth.ts`, `src/lib/planning/weekly-plan.ts`, `src/lib/validators/index.ts`, `src/middleware.ts`, `src/types/next-auth.d.ts`, `src/types/prisma-shim.d.ts`

**Novos (14):** `src/app/admin/` (6 arquivos), `src/app/api/admin/` (4), `src/app/api/configuracoes/`, `src/app/api/perfil/`, `src/app/landing.css`, `src/components/admin/` (3), `src/components/configuracoes/`, `src/components/landing/` (4), `src/components/perfil/`, `src/lib/admin/` (3), `src/lib/validators/admin.ts`, `configuracoes.ts`, `perfil.ts`, `src/lib/webhooks/signature.ts`

---

## 12. Pendências externas (DONA executa localmente)

1. `npx prisma generate` (client com models novos — `SystemSetting` e demais).
2. `npx prisma db push` (Neon).
3. `npm run build` (SWC bloqueado no sandbox — DONA roda localmente).
4. Preencher `.env.local` com: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_ID/SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_SCOPES`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `TIKTOK_CLIENT_KEY/SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_VERIFY_TOKEN`, chaves de IA.
5. **Meta Dashboard:** registrar Redirect URI (ETAPA 4) e Webhook (ETAPA 3); NÃO submeter App Review ainda (ETAPA 5).
6. **Asaas:** NÃO integrado ainda — billing conceitual (planos R$27/77/497 preservados).

---

## 13. Não feito (por regra)

- ❌ Nenhum commit/push/merge — branch `checkpoint-fase8-fase9` preservada.
- ❌ Nenhuma troca para `main`.
- ❌ Nenhuma publicação real/Vercel.
- ❌ Nenhuma integração Asaas real; nenhum checkout falso.
- ❌ Nenhum secret hardcoded; tokens Meta/TikTok nunca para o cliente.
- ❌ Nenhuma alteração na identidade visual aprovada nem na paleta.
- ❌ Nenhuma reconstrução de módulos que já funcionam; nenhuma remoção de funcionalidade correta.
- ❌ Nenhuma simulação de sucesso de APIs externas.
