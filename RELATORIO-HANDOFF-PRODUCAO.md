# RELATÓRIO DE HANDOFF DE PRODUÇÃO — INST ACESSOR

> **Guia técnico completo para outro desenvolvedor/IA retomar o projeto.**
> Data: **2026-08-30** · Branch: `checkpoint-fase8-fase9` · HEAD: `d1c0ba4` · GitHub: `lp070087-cpu/Inst-acessor`
> Repositório local: `C:\Users\55819\Desktop\Inst Acessor`

---

## 1. Visão geral do sistema

SaaS de gestão de conteúdo + IA para criadores de moda/acessórios. Stack:

- **Next.js 14.2.35** (App Router), **React 18.3.1**, **TypeScript strict**
- **Tailwind CSS** (identidade visual aprovada — NÃO alterar paleta)
- **Prisma 5.22** + **Neon PostgreSQL** (`DATABASE_URL` pooled + `DIRECT_URL`)
- **Auth.js/NextAuth v4.24.7** (CredentialsProvider + JWT) + **bcryptjs 2.4.3**
- **54 models** no schema (ver seção 3)
- Sem migrations versionadas — usa **`prisma db push`**

### Fases concluídas
Fases 1–11 (fundação, Meta/TikTok, IA, knowledge, growth, rank, planejamento, preview, planos/billing, publishing, automações, QA) + **Primeiro Acesso** + **Asaas billing** + **Publicação real** + **QA Final**.

### Gates de qualidade
| Gate | Estado |
|---|---|
| `npx tsc --noEmit` | EXIT 0 |
| `npm run growth:test` | 28/28 |
| `npm run billing:test` | 31/31 |
| `npm run publishing:test` | 25/25 |
| `npm run first-access:test` | 39/39 |
| `npm run build` | 37/37 páginas (local DONA) |
| `npx prisma validate/generate` | OK local (sandbox sem binários) |

## 2. Arquitetura de pastas (rotas e módulos)

### Páginas principais
| Rota | Função |
|---|---|
| `/` | Landing oficial (36 seções) |
| `/login`, `/cadastro` | Auth (olho de senha, manter conectado) |
| `/onboarding` | Wizard step-by-step |
| `/primeiro-acesso` | Prova de posse + senha + tour (pós-compra/liberação) |
| `/expirado` | Acesso expirado + renovação |
| `/dashboard`, `/ia-acessor`, `/gerador-de-copy`, `/ideias`, `/preview-social`, `/rank`, `/mentoria`, `/analise-de-desempenho`, `/score`, `/calendario`, `/publishing`, `/growth`, `/automacoes`, `/perfil-de-inteligencia`, `/assinatura`, `/perfil`, `/configuracoes`, `/sobre` | Módulos do cliente |
| `/admin` + `/admin/{usuarios,assinaturas,ia,integracoes}` | Painel administrativo (único ADMIN) |
| `/api/health` | Health check público |

### Módulos server (`src/lib`)
| Pasta | Função |
|---|---|
| `auth/` | `config.ts` (NextAuth), `guard.ts` (`requireSession`, `requireOnboardedSession`, `requireAdminSession`) |
| `first-access/` | Serviço de primeiro acesso (`core.ts` puro + `index.ts`) |
| `email/` | Provider desacoplado (fail-closed) |
| `webauthn/` | Passkey pendência controlada (enabled=false) |
| `billing/` | Asaas: `asaas/{client,webhook,events}.ts`, `checkout.ts`, `plans.ts`, `manual-access.ts` |
| `publishing/` | Motor de publicação: `service.ts`, `queue.ts`, `retry.ts`, `instagram/`, `tiktok/`, adapters |
| `ai/` | Provider IA desacoplado (OpenAI/Gemini) |
| `growth-engine/` | 30 módulos, GrowthAction, score, insights |
| `knowledge/` | Knowledge engine (30 módulos oficiais, 85 regras) |
| `gamification/` | XP, níveis, metas, conquistas, ranking |
| `planning/` | Calendário, pipeline, publishing |
| `validators/` | Zod (first-access, admin, billing, etc.) |

## 3. Schema Prisma — 54 models

### Modelos de identidade/acesso
- **User** — `role` (USER/ADMIN), `status` (ACTIVE/SUSPENDED), `firstAccessCompleted(+At)`, `tourCompleted(+At)`
- **AccessGrant** — origem `ASAAS`/`ADMIN_MANUAL`; status `PENDING_FIRST_ACCESS`/`ACTIVE`/`EXPIRED`/`CANCELED`; `externalPaymentId`/`externalSubscriptionId`; `@@unique([email, origin, externalPaymentId])`
- **FirstAccessToken** — `tokenHash @unique` (SHA-256), `expiresAt`, `consumed` (uso único)
- **PasskeyCredential** — reservado (pendência WebAuthn)
- **Account/Session/UserProfile/UserPreferences/VerificationToken** — Auth.js + perfil

### Modelos de billing
- **Plan** — planos oficiais server-side
- **Subscription** — `provider` (ASAAS/MANUAL), `accessSource`, `grantedByAdminId`, `external*Id`
- **Payment** — pagamentos PAID com `externalPaymentId`, `eventId`
- **BillingEvent** — idempotência por `eventId @unique`; relações com Subscription/Payment (commit `d1c0ba4`)

### Modelos de plataforma
- **SocialConnection** — conexões IG/TikTok com token AES-256-GCM; `ConnectionStatus` (DISCONNECTED/CONNECTING/CONNECTED/ERROR)
- **OAuthState**, **InstagramProfile/Snapshot/Media/MediaMetric**, **TikTokProfile/Snapshot/Video**, **SyncLog**
- **PlannedContent**, **PublishQueue**, **PublishLog** — agendamento/publicação
- **AutomationRule/AutomationEvent/AutomationExecution** — automações (fundação)

### Modelos de IA/crescimento
- **AIConversation/AIMessage/AIProfile/GeneratedCopy/ContentIdea/SocialDraft**
- **KnowledgeVersion/Module/Rule**, **ProfileScore(+Snapshot)**, **MentorshipRecommendation**
- **GrowthExperiment/Variant/Observation**, **ProfileInsight**, **GrowthAction**
- **UserLevel/XpLog/UserGoal/Achievement/UserAchievement**
- **ContentCopyVersion/PlannedContentExperiment/SystemSetting**

## 4. Segurança — o que foi auditado

### Autenticação
- CredentialsProvider verifica `user.status === "ACTIVE"` + bcrypt; JWT com `id/email/role`
- `requireAdminSession` consulta o **banco** (role+status) — nunca confia no frontend
- Middleware `withAuth` protege todas as rotas do app + `/admin/*` + `/api/admin/*`; públicas: login/cadastro/onboarding/primeiro-acesso/expirado

### Primeiro acesso
- Anti-enumeração: resposta genérica única
- Token `randomBytes(32)` → hash SHA-256 no banco, TTL 60 min, uso único, replay-safe
- Rate limit: request 5/min, verify 15/min, complete 10/min, tour 20/min, lookup 30/min
- Senha sempre bcrypt 12; nunca automática; respostas nunca expõem `passwordHash`
- Provider de e-mail **fail-closed** (nunca finge envio)

### Asaas
- Webhook: fail-closed 503 sem token; `timingSafeEqual`; rate limit; idempotência por `eventId` (claim-first)
- Nunca confia em `userId` do payload — resolve por external ref (customer/subscription/payment)
- **Checkout NÃO ativa**: `ACTIVE` só em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`
- `AccessGrant` origem `ASAAS` com externalIds reais; rastreabilidade completa
- Estorno → revoga; overdue → PAST_DUE; cancelado → PENDING

### Publicação real
- Instagram: `POST /{ig}/media` → `POST /{ig}/media_publish` → id real; status via `GET /{container}`
- TikTok: `init/` → `publish_id` → polling `status/fetch/` até `PUBLISH_COMPLETE` (nunca LIVE falso); `FAILED` → erro
- Mídia local-only → `VALIDATION` honesto (API exige URL pública)
- Owner-check: userId derivado do `plannedContent`; nunca do payload
- `markFailed` guarda externalId (TikTok sem duplicar)

## 5. Matriz de variáveis de ambiente (produção)

> **NUNCA mostre valores reais.** Toda secret deve ser definida no painel Vercel (Preview e Production separados). Nenhuma `NEXT_PUBLIC_*` para secrets.

| # | Variável | Obrigatória | Preview | Production | Quem fornece | Finalidade | Secret | Fail-closed se ausente | Impacto |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `DATABASE_URL` | ✅ Sim | ✅ | ✅ | Neon | Prisma pooled | Não | App não sobe | Banco |
| 2 | `DIRECT_URL` | ✅ Sim | ✅ | ✅ | Neon | Prisma direct | Não | App não sobe | Banco |
| 3 | `AUTH_SECRET` | ✅ Sim | ✅ | ✅ | `openssl rand -base64 32` | Assina JWT | **Sim** | Sessões inválidas | Auth |
| 4 | `NEXTAUTH_SECRET` | ✅ Sim | ✅ | ✅ | idem | Alias next-auth v4 | **Sim** | Sessões inválidas | Auth |
| 5 | `AUTH_URL` | ✅ Sim | ✅ (URL preview) | ✅ (URL final) | Vercel | URL canônica | Não | Fallback localhost | Callbacks/links |
| 6 | `NEXTAUTH_URL` | ✅ Sim | ✅ | ✅ | idem | Alias next-auth v4 | Não | Fallback localhost | Callbacks |
| 7 | `TOKEN_ENCRYPTION_KEY` | ✅ Sim | ✅ | ✅ | `openssl rand -hex 32` | AES-256-GCM tokens OAuth | **Sim** | Conexões não leem token | Meta/TikTok |
| 8 | `EMAIL_PROVIDER` | ⚠️ Feature | ✅ | ✅ | DONA | Provider e-mail | Não | **Não envia** (honesto) | Primeiro acesso |
| 9 | `RESEND_API_KEY`* | Condicional | ✅ | ✅ | Resend | Envio e-mail | **Sim** | Não envia | E-mail |
| 10 | `SENDGRID_API_KEY`* | Condicional | ✅ | ✅ | SendGrid | Envio e-mail | **Sim** | Não envia | E-mail |
| 11 | `AWS_SES_*`* | Condicional | ✅ | ✅ | AWS | Envio e-mail | **Sim** | Não envia | E-mail |
| 12 | `MAILGUN_API_KEY`* | Condicional | ✅ | ✅ | Mailgun | Envio e-mail | **Sim** | Não envia | E-mail |
| 13 | `BREVO_API_KEY`* | Condicional | ✅ | ✅ | Brevo | Envio e-mail | **Sim** | Não envia | E-mail |
| 14 | `META_APP_ID` | ⚠️ Integração | ✅ | ✅ | Meta Dev | App Meta | Não | `INTEGRATION_NOT_CONFIGURED` | Instagram |
| 15 | `META_APP_SECRET` | ⚠️ Integração | ✅ | ✅ | Meta Dev | Verificação webhook | **Sim** | Webhook rejeita | Instagram |
| 16 | `INSTAGRAM_APP_ID` | ⚠️ Integração | ✅ | ✅ | Meta Dev | App IG | Não | `INTEGRATION_NOT_CONFIGURED` | Instagram |
| 17 | `INSTAGRAM_APP_SECRET` | ⚠️ Integração | ✅ | ✅ | Meta Dev | Secret app IG | **Sim** | Webhook rejeita | Instagram |
| 18 | `INSTAGRAM_REDIRECT_URI` | ⚠️ Integração | ✅ | ✅ | DONA | Callback OAuth | Não | OAuth falha | Instagram |
| 19 | `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | ⚠️ Webhook | ✅ | ✅ | DONA | Challenge Meta | **Sim** | Webhook rejeita | Instagram |
| 20 | `INSTAGRAM_SCOPES` | Não | ✅ | ✅ | Meta Dev | Permissões | Não | Scopes insuficientes | Instagram |
| 21 | `INSTAGRAM_GRAPH_VERSION` | Não | ✅ | ✅ | Meta | Versão Graph API | Não | Default v21.0 | Instagram |
| 22 | `TIKTOK_CLIENT_KEY` | ⚠️ Integração | ✅ | ✅ | TikTok Dev | App TikTok | Não | `INTEGRATION_NOT_CONFIGURED` | TikTok |
| 23 | `TIKTOK_CLIENT_SECRET` | ⚠️ Integração | ✅ | ✅ | TikTok Dev | Secret app | **Sim** | Webhook rejeita | TikTok |
| 24 | `TIKTOK_REDIRECT_URI` | ⚠️ Integração | ✅ | ✅ | DONA | Callback OAuth | Não | OAuth falha | TikTok |
| 25 | `TIKTOK_WEBHOOK_VERIFY_TOKEN` | ⚠️ Webhook | ✅ | ✅ | DONA | Challenge TikTok | **Sim** | Webhook rejeita | TikTok |
| 26 | `OPENAI_API_KEY` | ⚠️ IA | ✅ | ✅ | OpenAI | IA (alternativa) | **Sim** | IA estado controlado | IA |
| 27 | `GEMINI_API_KEY` | ⚠️ IA | ✅ | ✅ | Google | IA (alternativa) | **Sim** | IA estado controlado | IA |
| 28 | `GOOGLE_API_KEY` | ⚠️ IA | ✅ | ✅ | Google | Alias Gemini | **Sim** | IA estado controlado | IA |
| 29 | `ASAAS_API_KEY` | ⚠️ Feature | ✅ | ✅ | Asaas | Billing | **Sim** | Checkout controlado | Pagamentos |
| 30 | `ASAAS_BASE_URL` | Não | ✅ | ✅ | Asaas | URL base | Não | Sandbox/Prod default | Pagamentos |
| 31 | `ASAAS_ENV` | Não | ✅ | ✅ | DONA | `sandbox`/`production` | Não | Default sandbox | Pagamentos |
| 32 | `ASAAS_BILLING_TYPE` | Não | ✅ | ✅ | DONA | PIX/BOLETO/CREDIT_CARD | Não | Default PIX | Checkout |
| 33 | `ASAAS_WEBHOOK_TOKEN` | ⚠️ Webhook | ✅ | ✅ | Asaas | Valida origem | **Sim** | Webhook 503 (fail-closed) | Pagamentos |

\* Apenas a chave do provider escolhido (decisão da DONA). `EMAIL_PROVIDER` indica qual.

**Regras de fail-closed:** ausência de `ASAAS_API_KEY` → checkout não cobra; ausência de `EMAIL_PROVIDER` → e-mail não é enviado; ausência de chave IA → estado controlado; ausência de tokens Meta/TikTok → `INTEGRATION_NOT_CONFIGURED`. **Nunca** há "sucesso falso".

## 6. Pendências externas e próximos passos (ordem recomendada)

1. **DONA roda local**: `npx prisma generate && npx prisma db push && npm run build` (validar 37 páginas) — commit `d1c0ba4` já inclui tudo, mas as mudanças finais (primeiro acesso, rate limits, `.env.example`, relatórios) ainda estão **sem commit**.
2. **Neon**: backup + `db push` não-destrutivo (ver CHECKLIST seção 2).
3. **Vercel**: importar repo, preencher variáveis (Matriz seção 5), deploy preview.
4. **E-mail**: decidir provider e configurar — **bloqueador do primeiro acesso**.
5. **Asaas**: API key produção + webhook token + `ASAAS_ENV=production`; testar pagamento real R$1.
6. **Meta App Review** (`docs/APP-REVIEW-INSTAGRAM.md`) e **TikTok Direct Post** (`docs/APP-REVIEW-TIKTOK.md`).
7. **Passkey/WebAuthn**: habilitar depois, com HTTPS estável + `@simplewebauthn/*` (ver `docs/PASSKEY-PENDENCIA.md`).

## 7. Arquivos de referência

- `RELATORIO-QA-FINAL.md` — auditoria + validação desta rodada
- `RELATORIO-PRIMEIRO-ACESSO.md` — fluxo pós-pagamento/liberação
- `RELATORIO-ASAAS-BILLING.md` — billing Asaas
- `RELATORIO-PUBLISHING-REAL.md` — publicação real IG/TikTok
- `RELATORIO-FASE11-AUDITORIA-FINAL.md` — auditoria F11
- `docs/ESCOPO-OFICIAL.md` — regras permanentes (identidade, NÃO inventar conhecimento, etc.)
- `docs/APP-REVIEW-INSTAGRAM.md`, `docs/APP-REVIEW-TIKTOK.md`, `docs/PASSKEY-PENDENCIA.md`
- `docs/MAPA-ROTAS.md`, `docs/CHECKLIST-VERCEL.md` (desatualizado — usar `CHECKLIST-PRODUCAO-INST-ACESSOR.md`)

## 8. Regras permanentes (não violar)

- NÃO commit/push/merge na sandbox; DONA executa local.
- NÃO promover Vercel Production sem validação.
- NÃO `prisma db push --accept-data-loss`; NÃO `npm audit fix --force`; NÃO upgrade major.
- NÃO expor secrets; NÃO `NEXT_PUBLIC_*` para secrets.
- NÃO fingir envio de e-mail; NÃO afirmar sucesso de integração sem credencial/aprovação externa.
- NÃO alterar identidade visual aprovada/paleta.
