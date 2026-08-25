# Relatório — Correção e Validação da Fase 3 + Fase 3.5 (Inst Acessor)

**Data:** 2026-08-25
**Escopo:** Corrigir completamente os 10 grupos de erro apontados na validação local da Fase 3 (Instagram) e Fase 3.5 (TikTok).
**Validação local pendente (DONA):** `npx prisma generate` → `npx tsc --noEmit` → `npm run build`

---

## 1. Causa de cada grupo de erro e correção aplicada

### E1 — Prisma P1012: `User.igMediaMetrics` sem relação inversa
**Causa:** O model `InstagramMediaMetric` não tinha campo `userId` nem relação `user`. O lado `User.igMediaMetrics InstagramMediaMetric[]` apontava para um model que não possuía o campo de relação inverso → Prisma P1012.
**Correção:** Adicionados `userId String` + `user User @relation(... onDelete: Cascade)` ao `InstagramMediaMetric`, e `@@index([userId])`. A relação não foi removida (conforme instrução). **Revisadas todas as relações da Fase 3/3.5** — User, SocialConnection, InstagramProfile/Snapshot/Media/MediaMetric, TikTokProfile/Snapshot/Video, SyncLog, OAuthState — todas com os dois lados definidos.

**Arquivos:** `prisma/schema.prisma`, `src/lib/integrations/instagram/sync.ts`

### E2 — Exports do Instagram quebrados (file-vs-directory shadowing)
**Causa:** `src/lib/integrations/instagram.ts` fazia `export * from "./instagram"`. Com `instagram.ts` e `instagram/` coexistindo, `"./instagram"` resolve para o **arquivo** (shadowing), criando self-import circular que esvaziava os exports — `exchangeCodeForToken`, `getInstagramAccountInfo`, `encryptAccessToken`, `InstagramApiError`, `buildAuthUrl`, `IntegrationConfigError`, `syncInstagram` ficavam indisponíveis.
**Correção:** Compat layer agora re-exporta explicitamente do diretório: `export * from "./instagram/index"`. O barrel `instagram/index.ts` re-exporta `types`, `errors`, `client`, `oauth`, `metrics`, `sync` sem duplicação (`InstagramApiError` vem apenas de `./errors`). Nenhuma duplicação de implementação.
**Arquivos:** `src/lib/integrations/instagram.ts`, `src/lib/integrations/instagram/index.ts`

### E3 — TS18046/TS18048: `err.code`/`err.message` em `unknown`
**Causa:** `let tokenData;` e `let account;` sem tipo em callbacks → `unknown` no catch e acessos `err.*` possivelmente inválidos.
**Correção:**
- `src/app/api/integrations/instagram/callback/route.ts`: `tokenData: InstagramTokenPayload` e `account: InstagramAccountInfo`. Todos `err.code` estão dentro de `if (err instanceof InstagramApiError)`.
- `src/app/api/integrations/tiktok/callback/route.ts`: `oauthState: OAuthState | null` e `tokenData: Awaited<ReturnType<typeof exchangeCodeForToken>>`.
- Verificados TODOS os demais `err.*`/`error.*` do projeto — todos protegidos por `instanceof` (InstagramApiError, IntegrationConfigError, Prisma.PrismaClientKnownRequestError, TikTokApiError, Error). **Nenhum `catch (err: any)` existe no projeto.**

**Arquivos:** `src/app/api/integrations/instagram/callback/route.ts`, `src/app/api/integrations/tiktok/callback/route.ts`, `src/app/api/integrations/instagram/refresh/route.ts`, `src/app/api/integrations/tiktok/refresh/route.ts`

### E4 — OAuthState TikTok `codeVerifier`
**Causa:** O PKCE exige armazenar o `code_verifier` entre connect e callback; o campo não existia no model.
**Correção:** `codeVerifier String?` adicionado ao `OAuthState`. Verificado o ciclo completo:
- **connect** gera `createPkce()` e persiste `state` + `codeVerifier` (10 min de validade);
- **callback** valida `state` (provider `tiktok`, não consumido, não expirado), consome single-use, lê `codeVerifier`, troca `code` por token usando-o;
- state expirado/consumido redireciona com código controlado; nunca expõe secret.
**Arquivos:** `prisma/schema.prisma`, `src/lib/integrations/tiktok/connect/route.ts`, `src/lib/integrations/tiktok/callback/route.ts`

### E5 — Prisma client sem os novos models
**Causa:** `prisma.instagramProfile`, `prisma.tiktokProfile`, `prisma.syncLog`, etc. ficavam desconhecidos porque `npx prisma generate` não rodou/atualizou após a adição dos models.
**Correção:** Schema corrigido (E1/E4) e verificados todos os acessos — todos usam os nomes corretos dos models (`prisma.instagramProfile`, `prisma.tiktokSnapshot`, `prisma.syncLog`, `prisma.instagramMediaMetric`, etc.). Nenhum `prisma.instagram`/`prisma.tiktok` genérico. A regeneração do client fica a cargo da DONA (comando abaixo).
**Arquivo:** `prisma/schema.prisma` (+ auditoria de `prisma.*` em `src/`)

### E6 — Métricas null vs undefined (Instagram)
**Causa:** `InstagramMediaMetricNode` usava `?: number` (undefined). O `getMediaMetrics` normaliza com `?? null`, mas o tipo não aceitava `null` → `Type 'number | null' is not assignable to type 'number | undefined'`.
**Correção:** Convenção unificada — **campos ausentes/normalizados = `null`** (nunca `0`). `InstagramMediaMetricNode` agora tem `?: number | null` em `reached`, `impressions`, `shares`, `saves`, `comments`, `likes`, `video_views`, `video_view_time`. Corrigido também o retorno de `getMediaMetrics` para usar `video_views`/`video_view_time` (snake_case, correspondente ao tipo e ao schema `videoViews`/`videoViewTime` do Prisma).
**Arquivos:** `src/lib/integrations/instagram/types.ts`, `src/lib/integrations/instagram/metrics.ts`

### E7 — TikTok user node: não devolver `{}`
**Causa:** `getTikTokUser` retornava `data.data ?? {}` — `{}` não é atribuível a `TikTokUserNode` (que exige `open_id`) e escondia payload inválido.
**Correção:** A resposta agora é validada: se `data.data` ausente ou `open_id` não-string → `throw new TikTokApiError("...open_id...", "INVALID_USER_RESPONSE")`. O sync não degrada com dados falsos (perfil é obrigatório).
**Arquivo:** `src/lib/integrations/tiktok/metrics.ts`

### E8 — Evolution chart: cast inseguro
**Causa:** `(p as Record<string, unknown>)[metric]` — TS2352 (conversão entre tipos insuficientemente sobrepostos).
**Correção:** Criado `ChartEvolutionPoint` (estrutura mínima com os campos numéricos opcionais comuns aos pontos IG/TikTok) e `ChartMetricKey = Exclude<keyof ChartEvolutionPoint, "label" | "capturedAt">`. O prop `points` virou `ChartEvolutionPoint[]` e o acesso `p[metric]` é tipado. **Removido o cast por completo** (não há mais `as` no arquivo).
**Arquivo:** `src/components/dashboard/evolution-chart.tsx`

### E9 — Implicit any nos filtros de snapshot
**Causa:** `snapshots.filter((s) => ...)` — `s` ficava `any` apenas com o Prisma client desatualizado (E5).
**Correção:** Após o schema correto + regenerate, `snapshots` é tipado (`InstagramSnapshot[]`/`TikTokSnapshot[]`) e `s` é inferido. Verificado nos dois arquivos — nenhuma anotação manual necessária.
**Arquivos:** `src/lib/dashboard/instagram-data.ts`, `src/lib/dashboard/tiktok-data.ts`

### E10 — Auditoria completa
Executada varredura em `src/`:
- **Zero** `as any`, `catch (err: any)`, `@ts-ignore`, `@ts-nocheck`.
- Único cast global é o padrão de singleton do Prisma em `src/lib/db.ts` (`globalThis as unknown as ...`) — necessário e aceitável.
- Todos os imports `@/lib/integrations/instagram` e `@/lib/integrations/tiktok` resolvem no barrel corrigido.
- Nenhum `prisma.instagram`/`prisma.tiktok` genérico.
- Fluxo `codeVerifier` verificado ponta-a-ponta.
- **Fase 2 intacta**: connect/callback/refresh/disconnect/sync IG e TikTok usam os barrels — nenhum símbolo quebrado.
- **Isolamento plataformas**: tipos/erros/clientes separados (`instagram/` e `tiktok/`), sem acoplamento.
- **TODOs restantes** são intencionais de Fase 2/3 (assinatura webhook, enfileiramento) — não bloqueiam build.
- **Segurança**: tokens só no servidor, encriptados (AES-256-GCM), nunca logados/retornados; secret nunca no frontend; `NEXT_PUBLIC_TIKTOK_CLIENT_SECRET` inexistente; dados limitados ao `session.userId`.

---

## 2. Arquivos alterados nesta rodada

| Arquivo | Correção |
|---|---|
| `prisma/schema.prisma` | +`InstagramMediaMetric.userId`/`user`; `OAuthState.codeVerifier` |
| `src/lib/integrations/instagram.ts` | Compat layer → `export * from "./instagram/index"` |
| `src/lib/integrations/instagram/index.ts` | Barrel sem duplicação de exports |
| `src/lib/integrations/instagram/types.ts` | `InstagramMediaMetricNode` → `?: number \| null` |
| `src/lib/integrations/instagram/metrics.ts` | Retorno `video_views`/`video_view_time` |
| `src/lib/integrations/instagram/sync.ts` | +`userId` no `instagramMediaMetric.create` |
| `src/lib/integrations/instagram/client.ts` | Removido cast `as number` redundante |
| `src/lib/integrations/tiktok/metrics.ts` | `getTikTokUser` valida e lança `TikTokApiError` |
| `src/app/api/integrations/instagram/callback/route.ts` | Tipos explícitos + guards |
| `src/app/api/integrations/tiktok/callback/route.ts` | Tipos explícitos + `OAuthState`/PKCE |
| `src/components/dashboard/evolution-chart.tsx` | `ChartEvolutionPoint` tipado, sem cast |

---

## 3. Schema corrigido (resumo das relações)

```
User 1—N SocialConnection / OAuthState / InstagramProfile / InstagramSnapshot /
         InstagramMedia / InstagramMediaMetric / TikTokProfile / TikTokSnapshot /
         TikTokVideo / SyncLog
InstagramProfile 1—N InstagramSnapshot / InstagramMedia
InstagramMedia 1—N InstagramMediaMetric
TikTokProfile 1—N TikTokSnapshot / TikTokVideo
OAuthState.codeVerifier String?   (PKCE TikTok)
```

---

## 4. Comandos exatos para validar localmente (DONA)

```bash
npx prisma generate          # regenera o Prisma Client (novos models + relações)
npx prisma db push           # aplica o schema no Neon (apenas se autorizado)
npx tsc --noEmit             # checagem de tipos estrita
npm run build                # build completo (Next.js + TS)
```

> A Fase 3 + 3.5 só é considerada **validada** quando os três comandos passarem sem erro.
> Nenhuma alteração em cores, gradientes, tipografia, sombras ou identidade visual foi feita. A pasta `/apresentacao` não foi tocada. **Nenhuma fase nova foi iniciada.**
