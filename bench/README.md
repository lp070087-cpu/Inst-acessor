# Bancada de verificação — Inst Acessor

Scripts e testes locais. **Nada aqui deve tocar produção.**

## ⚠️ Regra de ouro para testes que importam `src/`

`@prisma/client` carrega o `.env` do projeto **automaticamente** quando
`DATABASE_URL` não está definida — e esse `.env` aponta para **PRODUÇÃO**. O Node
**não** carrega `.env.local` sozinho. Isso já causou um incidente (uma linha
sintética gravada em produção em 2026-10-08).

**Todo teste que importa código de `src/` deve começar com:**

```js
import "./db-guard.mjs";   // PRIMEIRA linha — trava o banco antes de tudo
```

A trava define um banco inalcançável (`127.0.0.1:1`), então qualquer acesso
FALHA FECHADO em vez de ir para produção.

## Testes (todos puros / offline)

| Arquivo | O que verifica |
|---|---|
| `test-planos.mjs` | Os 6 preços, ativação pendente, legados preservados |
| `test-promo-landing.mjs` | Preços/textos anunciados na landing não mudam |
| `test-quotas.mjs` | Franquias, modo medição, virada do dia (Brasília) |
| `test-usage-windows.mjs` | Janelas de ciclo, expiração do semanal, concorrência |
| `test-capacity.mjs` / `test-capacity-module.mjs` | Última vaga, renovação, convite |
| `test-asaas-flows.mjs` | Preços, promo, webhook, idempotência (simulado) |
| `test-gemini-models.mjs` | Allow-list do Gemini, nunca envia id inválido |
| `test-repetition.mjs` | Deduplicação de respostas repetidas |
| `direct-core.mjs` / `direct-webhook.mjs` | Núcleo do Direct e parser do webhook |

Rode os que importam `src/` com o loader de alias:

```bash
node --import ./bench/register-ts-alias.mjs bench/test-planos.mjs
node --import ./bench/register-asaas-tests.mjs bench/test-asaas-flows.mjs
```

## Ferramentas de staging (com guarda própria)

`prisma-staging.mjs`, `staging-guard.mjs`, `staging-inspect.mjs`,
`staging-cleanup.mjs`, `staging-snapshot.mjs` — todos validam o alvo e **abortam**
se ele não for a staging. Nunca rode o Prisma CLI direto neste projeto.
