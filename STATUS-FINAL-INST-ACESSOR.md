# STATUS FINAL — INST ACESSOR

> **Data: 2026-08-30** · Branch `checkpoint-fase8-fase9` · HEAD `d1c0ba4` · GitHub `lp070087-cpu/Inst-acessor`
> Este documento separa o que está **PRONTO NO CÓDIGO** do que depende de **configuração externa**, **App Review**, **banco**, e os **bloqueadores reais**.

---

## ✅ PRONTO NO CÓDIGO (nada a implementar)

| Área | Estado | Evidência |
|---|---|---|
| Primeiro Acesso (pós-pagamento/liberação) | **Completo** | `/primeiro-acesso` (e-mail → token único → senha própria → boas-vindas → tour → onboarding); `AccessGrant`/`FirstAccessToken`/`PasskeyCredential`; anti-enumeração; tokens hash; expiração `/expirado` |
| Admin único (regra absoluta) | **Completo** | `requireAdminSession` (role+status no banco) em `admin/layout.tsx` + **todas** as 6 APIs `/api/admin/*`; CLIENT por URL direta → `/dashboard` |
| Liberação manual | **Completo** | 7/30/90/custom dias; origem `ADMIN_MANUAL`; CENÁRIO D (e-mail sem conta → só AccessGrant, sem senha falsa); sem tocar Asaas |
| Asaas billing | **Completo** | Checkout não ativa; `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` é o gatilho real; webhook autenticado + idempotente; `AccessGrant` origem `ASAAS` com externalIds reais |
| Publicação real | **Completo** | Instagram `media`→`media_publish` (id real); TikTok `init`→polling até `PUBLISH_COMPLETE` (nunca LIVE falso); mídia local → `VALIDATION` honesto; owner-check |
| IA | **Completo** | Provider desacoplado (OpenAI/Gemini); admin-only; sem chave → estado controlado, sem mock |
| Growth Engine | **Completo** | 30/30 módulos, XP, metas, conquistas, ranking |
| QA | **Completo** | `tsc --noEmit` **EXIT 0**; **123/123 testes** (growth 28, billing 31, publishing 25, first-access 39) |
| Infra | **Completo** | `/api/health`, 404 global, MAPA-ROTAS, rate limits, webhooks seguros |

## 🟢 PRONTO COM CONFIGURAÇÃO EXTERNA (código OK — falta valor/credencial)

| Item | O que falta |
|---|---|
| Variáveis no Vercel | Preencher `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `TOKEN_ENCRYPTION_KEY` etc. (ver Matriz no HANDOFF) |
| Asaas (produção) | `ASAAS_API_KEY` real, `ASAAS_ENV=production`, `ASAAS_WEBHOOK_TOKEN` no painel Asaas |
| E-mail (primeiro acesso) | Escolher e configurar `EMAIL_PROVIDER` + chave (Resend/SendGrid/SES/Mailgun/Brevo) — **sem isso o link não é enviado** (fail-closed honesto) |
| IA | `OPENAI_API_KEY` **ou** `GEMINI_API_KEY`/`GOOGLE_API_KEY` |
| Neon | Rodar `npx prisma db push` (não-destrutivo) para criar as tabelas novas; opcional `npx prisma db seed` |
| Build/deploy local | `npx prisma generate` + `npm run build` na máquina da DONA (sandbox sem binários) |

## 🟡 PENDENTE APP REVIEW (integrações Meta/TikTok)

| Plataforma | O que aprovar | Docs |
|---|---|---|
| **Instagram (Meta)** | Permissões `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages` + produto de publicação; URLs de redirect/webhook no painel | `docs/APP-REVIEW-INSTAGRAM.md` |
| **TikTok** | Content Posting API (Direct Post) + scopes; URLs de redirect no portal | `docs/APP-REVIEW-TIKTOK.md` |

> Enquanto não aprovado, as conexões **não funcionam de verdade** — o código retorna `INTEGRATION_NOT_CONFIGURED`/erro de autenticação honesto (nunca finge sucesso).

## 🟠 PENDENTE BANCO (Neon)

- **Aplicar schema**: o `db push` deve criar tabelas/campos novos (AccessGrant, FirstAccessToken, PasskeyCredential, campos `firstAccess*`/`tour*` em User, relações de BillingEvent, models das Fases 5–8). Procedimento seguro + backup descrito no `CHECKLIST-PRODUCAO-INST-ACESSOR.md` seção 2.
- **Não-destrutivo**: sem `--accept-data-loss`; as alterações são aditivas.

## 🔴 BLOQUEADORES REAIS DE PRODUÇÃO

**Nenhum bloqueador de código.** Tudo o que depende de código local está feito, tipado (`tsc` EXIT 0) e testado (123/123).

Os únicos bloqueadores são **operacionais/externos** e todos têm caminho de ação documentado:
1. **Provider de e-mail** — sem ele, o fluxo de primeiro acesso não envia o link (não há ativação real de clientes).
2. **Asaas em produção** — sem API key/webhook reais, não há cobrança nem ativação por pagamento.
3. **App Review Meta/TikTok** — sem aprovação, a publicação real fica indisponível.
4. **`prisma db push` + build locais** — precisam ser executados pela DONA na máquina local (sandbox sem binários).

## ⚪ NÃO BLOQUEADORES (comportamentos seguros/fail-closed)

- `EMAIL_PROVIDER` vazio → **não envia** (honesto, nunca finge)
- `ASAAS_API_KEY` vazio → checkout **controlado** (não cobra)
- IA sem chave → **estado controlado** (sem mock)
- Passkey → **pendência controlada** (`enabled=false`, senha é o fallback)
- Mídia local-only no publishing → `VALIDATION` honesto
- `INTEGRATION_NOT_CONFIGURED` (48 ocorrências) → fail-closed em billing/publishing

---

## Resumo executivo

O Inst Acessor está **pronto para produção no código**: todas as fases (1–11), Primeiro Acesso, Asaas, Publishing Real e QA final completos com `tsc` limpo e **123 testes passando**. Para **entrar no ar de verdade**, a DONA precisa: (1) rodar `prisma db push`/`build` local, (2) preencher as variáveis no Vercel, (3) escolher provider de e-mail, (4) colocar Asaas em produção, e (5) concluir App Reviews Meta/TikTok. Nenhum passo de código resta.

**Próximo passo**: ler `RELATORIO-HANDOFF-PRODUCAO.md` (guia técnico completo) e executar o `CHECKLIST-PRODUCAO-INST-ACESSOR.md`.
