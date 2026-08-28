# Diagnóstico de Produção — Inst Acessor

> Guia de troubleshooting (Fase 9). Sintomas comuns e como resolver.

## 1. `/api/health` responde `database: "unavailable"`

**Causa**: banco (Neon) inalcançável ou credenciais erradas.

1. Confirme `DATABASE_URL` e `DIRECT_URL` em produção.
2. Teste a connection string com `psql` ou pelo painel Neon.
3. Verifique se o IP/VPC permite conexão (Neon permite conexão pública).
4. Confirme `npx prisma db push` foi executado (schema aplicado).

## 2. Login não persiste / sessão cai

- `NEXTAUTH_SECRET` deve ser estável entre deploys (não regenerar a cada deploy).
- `NEXTAUTH_URL` deve ser o domínio canônico.
- Cookies: o domínio deve ser o mesmo (sem `www` duplicado).

## 3. Página mostra 404 após login

- A rota `/app/...` não existe — todas as páginas estão no group `(app)`.
- Confirme que o onboarding foi concluído (redirect em `(app)/layout.tsx`).
- Rota inexistente → `not-found.tsx` global.

## 4. Integração Instagram/TikTok não conecta

- Tokens OAuth expiram; use `/refresh` ou reconecte.
- App Review pendente no painel da Meta/TikTok (modo de teste).
- Confirme as URLs de callback/redirect (OAuth) apontam para produção.
- Tokens de conta NUNCA devem estar no código/cliente.

## 5. Publicação fica `INTEGRATION_NOT_CONFIGURED`

- Adapters de publicação exigem confirmação REAL do provider (externalId).
- Até lá, o sistema NÃO publica e NÃO envia DMs — comportamento correto.
- Configurar adapters exige integração real Meta/TikTok (fase futura).

## 6. IA não responde

- Sem `OPENAI_API_KEY`/`GEMINI_API_KEY` a IA opera em estado controlado
  (sem mock, sem inventar dados) — é o comportamento esperado.
- Rate limit de IA: aguarde 60s se receber 429.

## 7. Assinatura/checkout não funciona

- Asaas ainda NÃO está integrado (INTEGRATION_NOT_CONFIGURED).
- Planos oficiais preservados: SEMANAL R$27/7d, MENSAL R$77/mês, ANUAL R$497/ano.

## 8. Logs de produção

- Não logue tokens, secrets ou payloads de webhook completos.
- `console.error` com contexto sanitizado é aceitável.
- Revise `Vercel → Functions → Logs` se algo falhar em runtime.

## 9. Deploy sem acesso do sandbox

- Se `prisma generate`/`build` falharem por rede no ambiente da assistente,
  rode localmente no Windows na ordem do `docs/CHECKLIST-VERCEL.md`.
- Nunca use `--force` em dependências.
