# Checklist de Produção — Vercel (Inst Acessor)

> Documento operacional (Fase 9). Passos para publicar o SaaS na Vercel com
> segurança. Execute localmente no Windows (ou onde o CLI tiver acesso à rede).

## 1. Pré-requisitos locais (antes do deploy)

```bash
# 1. Gerar o client Prisma e validar o schema
npx prisma generate
npx prisma validate

# 2. Aplicar o schema no banco (Neon)
npx prisma db push

# 3. Seeds oficiais (idempotentes)
npx prisma db seed

# 4. Type-check e testes
npx tsc --noEmit
npm run growth:test

# 5. Build de produção
npm run build
```

> No sandbox da assistente os comandos Prisma/build podem falhar por rede/binários.
> Eles NÃO devem ser contornados de forma destrutiva — rode localmente.

## 2. Variáveis de ambiente (Vercel → Settings → Environment Variables)

Copie de `.env.local` / `.env.example`. **NUNCA suba `.env*` para o repositório.**

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | Connection string Neon |
| `DIRECT_URL` | sim | Neon (pool vs. direct) |
| `NEXTAUTH_SECRET` | sim | Gere com `openssl rand -base64 32` |
| `NEXTAUTH_URL` | sim | URL do domínio de produção |
| `INSTAGRAM_APP_ID` | integração | App Meta (Instagram Business Login) — par **prioritário** |
| `INSTAGRAM_APP_SECRET` | integração | App Secret do mesmo app — par **prioritário** |
| `META_APP_ID` / `META_APP_SECRET` | não | Compatibilidade temporária (usados só se `INSTAGRAM_APP_*` estiver vazio) |
| `INSTAGRAM_REDIRECT_URI` | integração | **Obrigatória e explícita** (ex.: `https://unitrixapp.com.br/api/integrations/instagram/callback`). O código NÃO usa valor padrão. |
| `INSTAGRAM_GRAPH_VERSION` | não | default `v21.0` |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | webhook | Token de verificação |
| `INSTAGRAM_SCOPES` | não | override opcional. Default: `instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages,instagram_business_manage_insights,instagram_business_content_publish` |
| `TIKTOK_CLIENT_KEY` | integração | App TikTok |
| `TIKTOK_CLIENT_SECRET` | integração | App TikTok |
| `TIKTOK_WEBHOOK_VERIFY_TOKEN` | webhook | Token de verificação |
| `OPENAI_API_KEY` | opcional | IA (OpenAI) |
| `GEMINI_API_KEY` | opcional | IA (Gemini) |
| `GOOGLE_API_KEY` | opcional | IA (Google) |
| `ASAAS_API_KEY` | fase futura | Billing — ainda NÃO integrado |

> Tokens OAuth das contas Instagram/TikTok NUNCA devem ir para o cliente.
> Ficam somente no banco (criptografados) ou nas variáveis do servidor.

## 3. Build

```bash
# Projeto detectado automaticamente como Next.js.
# Framework preset: Next.js
# Build command: npm run build
# Output directory: (padrão — .next)
```

## 4. Health check

Após o deploy, confirme:

```bash
curl -s https://SEU-DOMINIO/api/health
# → {"status":"ok","database":"ok","timestamp":"..."}
```

## 5. Pós-deploy (verificação manual)

- [ ] `/` carrega (página pública)
- [ ] `/login` autentica
- [ ] `/cadastro` cria conta (recebe e-mail/confirmação se configurado)
- [ ] `/onboarding` wizard funciona
- [ ] `/dashboard` abre após onboarding
- [ ] `/api/health` responde 200
- [ ] Rota inexistente exibe 404 global com identidade visual
- [ ] Todas as variáveis de ambiente listadas acima estão preenchidas
- [ ] `npm run build` passou localmente
- [ ] `npx tsc --noEmit` passou localmente
- [ ] `npm run growth:test` passou localmente

## 6. Não fazer

- **NÃO** fazer deploy com `.env` no repositório.
- **NÃO** usar `--force` em comandos de dependência.
- **NÃO** integrar Asaas/checkout falso ainda (fase futura).
- **NÃO** configurar webhook de publicação em produção sem adapter real confirmado.
- **NÃO** alterar a identidade visual aprovada / paleta.

## 7. Pós-merge com a DONA

- Commit e push são feitos pela DONA no Windows (sandbox sem permissão de push).
- Após push, a Vercel faz deploy automático do branch principal.
