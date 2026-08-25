# RELATÓRIO — FASE 3 · INSTAGRAM REAL (MÉTRICAS + DASHBOARD INTELIGENTE)

**Data:** 2026-08-25
**Projeto:** Inst Acessor — SaaS de crescimento de Instagram
**Escopo:** Fase 3 completa (Instagram primeiro — sequência aprovada pela DONA)
**Sandbox:** indisponível (timeout/403) durante a execução → validação local pendente

---

## 1. Resumo

A Fase 3 conectou o dashboard a **dados reais** do Instagram, persistidos em Neon via Prisma. Toda a integração foi feita em **camada de serviço isolada** (`src/lib/integrations/instagram/`), com sync manual, snapshots temporais, evolução em gráfico, comparação de períodos e score inteligente — **sem nunca inventar métricas**.

## 2. O que foi implementado

### 2.1 Modelos Prisma (3.1)
Novos models em `prisma/schema.prisma`:
- `InstagramProfile` — perfil da conta conectada
- `InstagramSnapshot` — estado temporal (1 por sync) com reach/impressions/profileViews
- `InstagramMedia` — posts/reels com metadados
- `InstagramMediaMetric` — métricas por mídia
- `SyncLog` — log de sincronização (auditável)

Relações adicionadas em `User` e `SocialConnection`.

### 2.2 Camada de serviço isolada (3.3)
Pasta `src/lib/integrations/instagram/`:
- `client.ts` — GET na Graph API com timeout (20s), retries (429/5xx), rate-limit awareness
- `errors.ts` — classificação central de erros (token inválido, timeout, rede, config)
- `oauth.ts` — buildAuthUrl / exchangeCodeForToken / encryptAccessToken
- `metrics.ts` — coleta normalizada (perfil, insights, até 20 mídias com métricas)
- `sync.ts` — sync completo com cooldown de 60s, upserts e SyncLog
- `types.ts` — tipos que refletem APENAS campos reais da API
- `index.ts` — barrel; `instagram.ts` raiz virou compat layer (mantém imports da Fase 2)

### 2.3 Endpoint de sincronização (3.4)
`POST /api/integrations/instagram/sync` — exige sessão, valida conexão, aplica cooldown (429), descriptografa token **no servidor**, persiste perfil + snapshot + mídias + métricas, atualiza `lastSyncAt`, cria SyncLog. Retorna resumo seguro (sem token).

### 2.4 Dashboard real (3.5–3.8)
- `src/lib/dashboard/instagram-data.ts` — leitura server-side dos snapshots (nunca chama a Meta):
  - **Cards reais** com variação % "desde o último sync"
  - **Evolução 7/30/90 dias** por métrica (segredores, alcance, impressões, visitas)
  - **Comparação** — crescimento semanal/mensal, seguidores ganhos 7d/30d
  - **Timeline** — melhor dia de alcance, maior ganho, pico de seguidores
- `src/components/dashboard/evolution-chart.tsx` — gráfico **SVG nativo** (sem recharts — sandbox bloqueia npm)
- `src/components/dashboard/metric-grid.tsx` — reescrito para receber `data` (server) e exibir score, comparação, timeline, evolução com abas 7/30/90 + seletor de métrica
- `src/app/(app)/dashboard/page.tsx` — usa `getDashboardInstagramData`, `force-dynamic`

### 2.5 Sincronização manual (3.9)
`src/components/dashboard/sync-metrics-button.tsx` — botão "Atualizar métricas" no dashboard com estados **idle → loading → success | error | cooldown**, mensagem de último sync e revalidação via `router.refresh()`.

### 2.6 Resiliência + Segurança (3.10–3.11)
- Retries controlados, timeout, cooldown, classificação de erros segura
- Token **nunca** vai ao cliente (só descriptografado no servidor)
- Nenhum `NEXT_PUBLIC` para secret; secret só no servidor
- Nenhum log de token/secret (apenas código/erro)
- Tipos `InstagramSyncData`/`InstagramSyncSummary` não carregam token

## 3. Arquivos criados/modificados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Modificado (5 models novos + relações) |
| `src/lib/integrations/instagram/{client,errors,oauth,metrics,sync,types,index}.ts` | Criados |
| `src/lib/integrations/instagram.ts` | Reescrito (compat layer) |
| `src/app/api/integrations/instagram/sync/route.ts` | Criado |
| `src/lib/dashboard/instagram-data.ts` | Criado |
| `src/components/dashboard/evolution-chart.tsx` | Criado |
| `src/components/dashboard/metric-grid.tsx` | Reescrito |
| `src/components/dashboard/sync-metrics-button.tsx` | Criado |
| `src/app/(app)/dashboard/page.tsx` | Modificado |

## 4. Validação

- **typecheck (tsc):** ⏳ NÃO executado — sandbox indisponível (VM timeout/403). A DONA deve rodar local.
- **build (next build):** ⏳ NÃO executado — idem.
- **prisma generate / db push:** ⏳ NÃO executados — DONA roda local (Neon).
- **Revisão estática:** ✅ feita manualmente (imports, tipos, `.at()` removidos, sem token no cliente, sem `.at(-1)` em código).

## 5. Pendências para a DONA executar localmente

```bash
npm install          # instala deps (se necessário)
npx prisma generate  # gera client com os novos models
npx prisma db push   # aplica schema no Neon
npm run typecheck    # valida TypeScript
npm run build        # valida build de produção
```

## 6. Observações

- O gráfico de evolução usa **SVG nativo** (sem dependência nova) — mantém o bundle enxuto e respeita a identidade visual (gradiente rosa/roxo).
- **Nenhum número fictício** é exibido: sem dado → "—" + texto neutro.
- Engajamento só aparece quando a API fornecer componente real (hoje é null).
- `apresentacao/` **não foi alterada**.

## 7. Próximo passo

**Fase 3.5 — TikTok (multiplataforma)** — conforme decisão da DONA ("Instagram 1º"), agora que a Fase 3 do Instagram está implementada, a próxima é adicionar o TikTok reusando a arquitetura multiplataforma (SocialConnection + SyncLog + dashboard seletor). **Não iniciar outra fase além dessa.**
