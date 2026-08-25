# Relatório — Correção dos 14 erros restantes (Fase 3 + Fase 3.5)

**Data:** 2026-08-25
**Objetivo:** Eliminar os 14 erros do `npx tsc --noEmit` e viabilizar o `npm run build`.
**Regras respeitadas:** Nenhuma nova fase iniciada. Nenhuma alteração visual/identidade/apresentação/arquitetura desnecessária. Métricas ausentes continuam `null`/indisponível (nunca `0`). Nenhum `any` adicionado. `prisma db push` **não** executado.

---

## Resultado local atual (informado pela DONA)

| Comando | Resultado |
|---|---|
| `npx prisma format` | ✅ OK |
| `npx prisma validate` | ❌ Falha APENAS por falta de `DIRECT_URL` no `.env` — não é erro de código |
| `npx prisma generate` | ✅ OK |
| `npx tsc --noEmit` | ❌ 14 erros (corrigidos nesta rodada) |
| `npm run build` | ❌ Falhava por causa do TypeScript |

> **DIRECT_URL:** confirmado que o schema mantém `datasource { url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }`. NÃO foi alterado para contornar o `validate`. A DONA configurará o Neon depois; a arquitetura continua usando `DATABASE_URL` + `DIRECT_URL`.

---

## Erros corrigidos (14)

### Grupo 1 — `safePct` com `undefined` (6 erros, todos no `instagram-data.ts`)

**Causa:** `safePct(current: number | null, previous: number | null)`, mas os call sites usam optional chaining (`latest?.followersCount`), que produz `number | null | undefined`.

**Correção:** Assinatura ampliada para `number | null | undefined` nos **dois** arquivos de dashboard, com normalização interna:
```ts
function safePct(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
```
`undefined` e `null` são tratados igual → retorna `null` (métrica indisponível), **nunca** `0`.

**Call sites cobertos:**
- `instagram-data.ts`: followers, engagement, reach, impressions, profileViews, mediaCount (6) + weeklyGrowth/monthlyGrowth (2 já usavam `?? null` — compatíveis).
- `tiktok-data.ts`: followers, following, likes, videos (4) + weeklyGrowth/monthlyGrowth.

**Arquivos:** `src/lib/dashboard/instagram-data.ts`, `src/lib/dashboard/tiktok-data.ts`

---

### Grupo 2 — Prisma TikTok casing (5 erros)

**Causa:** O Prisma Client gera os delegates como `prisma.tikTokProfile`, `prisma.tikTokSnapshot`, `prisma.tikTokVideo` (casing preservado do model `TikTokProfile`), mas o código usava `prisma.tiktokProfile`/`prisma.tiktokSnapshot`/`prisma.tiktokVideo`.

**Correção:** Alinhado o código aos delegates reais. **Nenhum model foi renomeado** (sem motivo arquitetural forte).

| Arquivo | Antes | Depois |
|---|---|---|
| `src/lib/dashboard/tiktok-data.ts` | `prisma.tiktokProfile` | `prisma.tikTokProfile` |
| `src/lib/dashboard/tiktok-data.ts` | `prisma.tiktokSnapshot` | `prisma.tikTokSnapshot` |
| `src/lib/integrations/tiktok/sync.ts` | `prisma.tiktokProfile` | `prisma.tikTokProfile` |
| `src/lib/integrations/tiktok/sync.ts` | `prisma.tiktokSnapshot` | `prisma.tikTokSnapshot` |
| `src/lib/integrations/tiktok/sync.ts` | `prisma.tiktokVideo` | `prisma.tikTokVideo` |

**Busca global:** `prisma.tiktok` em `src/` → **zero ocorrências** restantes (apenas referências em `RELATORIO-CORRECOES-FASE3-3.5.md`, documentação).

---

### Grupo 3 — implicit any nos filters do `tiktok-data.ts` (3 erros)

**Causa:** `snapshots.filter((s) => ...)` — o `s` ficava `any` porque a chamada Prisma estava com delegate inválido (`prisma.tiktokSnapshot`), quebrando a inferência.

**Correção:** Com `prisma.tikTokSnapshot.findMany(...)` corrigido, `snapshots` é tipado (`TikTokSnapshot[]`) e `s` passa a ser inferido automaticamente. **Nenhuma anotação manual/`any` adicionada.**

---

## Auditoria final

Buscas executadas em `src/`:

| Padrão | Resultado |
|---|---|
| `prisma.tiktokProfile` | ✅ zero |
| `prisma.tiktokSnapshot` | ✅ zero |
| `prisma.tiktokVideo` | ✅ zero |
| `safePct(` | ✅ todos os call sites compatíveis com a nova assinatura |
| `as any` / `@ts-ignore` / `@ts-nocheck` | ✅ zero |
| `catch (err: any)` | ✅ zero |
| Métrica ausente virando `0` | ✅ nenhuma (todas `null`/indisponível) |
| Instagram | ✅ intacto (apenas assinatura `safePct` ampliada) |
| TikTok | ✅ intacto (apenas casing dos delegates + `safePct`) |
| Apresentação | ✅ intocada |

**Observação:** o único cast global no projeto é o singleton do Prisma em `src/lib/db.ts` (`globalThis as unknown as ...`) — padrão necessário, não é `as any`.

---

## 1. Arquivos alterados

- `src/lib/dashboard/instagram-data.ts`
- `src/lib/dashboard/tiktok-data.ts`
- `src/lib/integrations/tiktok/sync.ts`

## 2. Erros corrigidos

14 erros de TypeScript: 6 × `safePct` undefined (Instagram) + 5 × casing Prisma TikTok + 3 × implicit any.

## 3. Resultado do typecheck

**Não executado por mim** — o sandbox Linux está indisponível (timeout de VM). Estaticamente, os 14 erros apontados foram endereçados; não introduzi novos. A DONA deve rodar `npx tsc --noEmit` para confirmar.

## 4. Resultado do build

**Não executado por mim** — depende do `tsc` passar. Após `tsc` limpo, `npm run build` deve completar.

## 5. Se sobrou algum erro

Nenhum erro de código restante identificado na auditoria estática. Pendências externas: `DIRECT_URL` no `.env` (configuração Neon da DONA) — não é erro de código.

## 6. Comandos locais que a DONA deve rodar

```bash
npx prisma generate          # ✅ já passou; refazer é inofensivo
npx tsc --noEmit             # deve agora passar (14 erros corrigidos)
npm run build                # deve passar após o tsc
```

> ⚠️ **NÃO executar** `npx prisma db push` / `migrate` — o schema será aplicado quando a DONA configurar o Neon (`DIRECT_URL`).

---

**Próxima fase:** NÃO iniciada. Aguardando validação local da DONA.
