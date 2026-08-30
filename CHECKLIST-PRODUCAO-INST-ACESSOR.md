# CHECKLIST DE PRODUÇÃO — INST ACESSOR

> **Versão final (2026-08-30)** · Branch `checkpoint-fase8-fase9` · HEAD `d1c0ba4`
> Substitui `docs/CHECKLIST-VERCEL.md` (desatualizado desde a Fase 9).
> Execute **localmente no Windows** (a sandbox bloqueia rede para binários Prisma/SWC).

---

## 1. Pré-requisitos locais (ordem rígida)

```bash
# 1. Instalar dependências
npm install

# 2. Gerar o client Prisma e validar o schema
npx prisma generate
npx prisma validate

# 3. Aplicar o schema no banco Neon (NÃO-destrutivo)
npx prisma db push

# 4. Seeds oficiais (idempotentes — não duplicam)
npx prisma db seed

# 5. Type-check autoritativo
npx tsc --noEmit

# 6. Todas as suítes de teste
npm run growth:test        # 28/28
npm run billing:test       # 31/31
npm run publishing:test    # 25/25
npm run first-access:test  # 39/39

# 7. Build de produção (deve listar ~37 páginas)
npm run build
```

> **NUNCA** use `npx prisma db push --accept-data-loss` nem `npm audit fix --force`.

## 2. Banco de dados — aplicação segura no Neon

O projeto usa `prisma db push` (sem migrations versionadas). O schema local (`prisma/schema.prisma`, 54 models) contém models/campos que podem ainda **não existir no Neon** — sobretudo os criados nas fases finais:

- `AccessGrant`, `FirstAccessToken`, `PasskeyCredential` (Primeiro Acesso)
- Campos em `User`: `firstAccessCompleted`, `firstAccessCompletedAt`, `tourCompleted`, `tourCompletedAt`
- Relações de `BillingEvent` com `Subscription`/`Payment` (commit `d1c0ba4`)
- Models das Fases 5–8 (`UserLevel`, `XpLog`, `UserGoal`, `Achievement`, `UserAchievement`, `PlannedContent`, `PublishQueue`, `PublishLog`, `AutomationRule`, `AutomationEvent`, `AutomationExecution`, `GrowthAction`, `SystemSetting`, etc.)

**Procedimento seguro (não-destrutivo):**

1. Faça backup/snapshot da base no painel Neon (Settings → Branches/Backups) antes de aplicar.
2. Rode `npx prisma db push` SEM flags destrutivas. O Prisma reporta o que será adicionado antes de aplicar.
3. Revise o plano proposto: deve conter **apenas `CREATE TABLE`/`ADD COLUMN`** (nada de `DROP`/alterações de tipo de coluna existente).
4. Se houver qualquer aviso de "data loss", **PARE** e avalie com a DONA.
5. Confirme com um `SELECT` em cada tabela nova (ex.: `SELECT COUNT(*) FROM "AccessGrant";`).

> A maioria das alterações é **aditiva** (tabelas/campos novos), portanto o `db push` deve ser seguro. Nenhuma coluna existente precisa ser renomeada ou ter tipo alterado.

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

**NUNCA suba `.env*` para o repositório.** NUNCA crie `NEXT_PUBLIC_*` para secrets. A matriz completa está em `RELATORIO-HANDOFF-PRODUCAO.md` (seção Matriz). Resumo por prioridade:

### Obrigatórias (app não sobe sem elas)
| Variável | Finalidade | Quem fornece |
|---|---|---|
| `DATABASE_URL` | Prisma (pooled) Neon | Neon |
| `DIRECT_URL` | Prisma (direct) Neon | Neon |
| `AUTH_SECRET` | Assinatura JWT (NextAuth/Auth.js) | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Alias compatível next-auth v4 | idem |
| `AUTH_URL` | URL canônica do app | Vercel (domínio) |
| `NEXTAUTH_URL` | Alias compatível next-auth v4 | idem |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM p/ tokens OAuth (32 bytes hex) | `openssl rand -hex 32` |

> ⚠️ `TOKEN_ENCRYPTION_KEY` **NUNCA deve mudar depois de salvar tokens** — os tokens OAuth ficam ilegíveis.

### Integrações (feature ativa só se preenchidas — fail-closed)
| Grupo | Variáveis | Observação |
|---|---|---|
| **Asaas** | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL`, `ASAAS_ENV` (`sandbox`/`production`), `ASAAS_BILLING_TYPE` | Vazio = checkout controlado (não cobra) |
| **Meta/Instagram** | `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_SCOPES`, `INSTAGRAM_GRAPH_VERSION` | Redirect/verification no painel Meta |
| **TikTok** | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_VERIFY_TOKEN` | Redirect no portal TikTok |
| **IA** | `OPENAI_API_KEY` **ou** `GEMINI_API_KEY`/`GOOGLE_API_KEY` | Pelo menos 1; vazio = IA em estado controlado |
| **E-mail** | `EMAIL_PROVIDER` (`resend`/`sendgrid`/`ses`/`mailgun`/`brevo`) + chave do provider | Vazio = link de primeiro acesso **não é enviado** (nunca finge) |

> Em **Preview** (deploy da Vercel), use `AUTH_URL`/`NEXTAUTH_URL` apontando para o domínio de Preview, e redirect URIs de teste. Em **Production**, aponte para o domínio final e atualize os apps Meta/TikTok.

## 4. Deploy na Vercel

```text
Framework preset: Next.js
Build command:    npm run build
Output:           .next (padrão)
Node:             >= 18 (Next 14.2.35)
```

1. Importe o repositório `lp070087-cpu/Inst-acessor` no painel Vercel.
2. Configure as variáveis da seção 3 em **Preview** e **Production** separadamente.
3. Deploy do branch `checkpoint-fase8-fase9` (ou a branch que a DONA escolher como principal).
4. Após o deploy, confirme o health check:

```bash
curl -s https://SEU-DOMINIO/api/health
# → {"status":"ok","database":"ok","timestamp":"..."}
```

## 5. Verificação pós-deploy (manual)

- [ ] `/` landing oficial carrega (36 seções)
- [ ] `/login` autentica; `/cadastro` cria conta
- [ ] `/onboarding` wizard funciona
- [ ] `/dashboard` abre após onboarding
- [ ] `/primeiro-acesso` — com e-mail de compra → token → senha → boas-vindas → tour
- [ ] `/expirado` mostra "acesso expirado" com renovação
- [ ] `/admin/*` bloqueia usuário CLIENT (redirect `/dashboard`)
- [ ] `/api/admin/access-grant` libera manualmente 7/30/90/custom dias
- [ ] `/api/health` responde 200 com `database: "ok"`
- [ ] 404 global com identidade visual
- [ ] Rota inexistente da API não vaza stack/versão
- [ ] Webhooks: `POST /api/webhooks/asaas` sem token → **503**; `GET /api/webhooks/tiktok` challenge responde

## 6. Antes de cobrar clientes (bloqueadores de negócio)

- [ ] **Asaas em produção**: API key real + `ASAAS_ENV=production` + webhook token registrado no painel Asaas. Testar um pagamento real de R$1 e confirmar que `PAYMENT_CONFIRMED` cria o `AccessGrant`.
- [ ] **E-mail**: escolher e configurar provider. Sem isso, **nenhum cliente receberá o link de primeiro acesso** (o fluxo falha na prova de posse).
- [ ] **Meta App Review**: aprovar permissões `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages` + produto de publicação. Ver `docs/APP-REVIEW-INSTAGRAM.md`.
- [ ] **TikTok App Review / Direct Post**: liberar Content Posting API. Ver `docs/APP-REVIEW-TIKTOK.md`.
- [ ] **Passkey/WebAuthn**: pendência controlada — habilitar apenas com HTTPS estável + lib `@simplewebauthn/*` (ver `docs/PASSKEY-PENDENCIA.md`). Senha é sempre o fallback.

## 7. Não fazer (regras permanentes)

- NÃO commit/push/merge na sandbox — a DONA executa local.
- NÃO promover Vercel Production sem validação da DONA.
- NÃO usar `prisma db push --accept-data-loss` nem `npm audit fix --force`.
- NÃO fazer upgrade major de dependências.
- NÃO expor secrets (nenhum `NEXT_PUBLIC_*` para secrets).
- NÃO fingir envio de e-mail nem afirmar sucesso de integração sem credencial/aprovação externa.
- NÃO alterar a identidade visual aprovada / paleta (regra do escopo oficial).

## 8. Commit e push

```bash
# Local (Windows), após validar os passos da seção 1:
git add -A
git commit -m "Fase final: QA, primeiro acesso, handoff de produção"
git push origin checkpoint-fase8-fase9
```
