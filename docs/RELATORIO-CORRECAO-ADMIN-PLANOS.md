# RELATÓRIO — CORREÇÃO ADMIN + MINHA ASSINATURA (ETAPA B)

Data: 2026-08-31
Branch: `checkpoint-fase8-fase9`
Base: Preview Vercel do commit `73e9ee5` (relato de dois bugs reais)
Escopo: corrigir **apenas** os 2 problemas relatados. Nenhuma alteração em Prisma/Neon, autenticação geral, primeiro acesso, Instagram, TikTok, Publishing, Growth Engine, Asaas webhook, preços ou identidade visual global. Sem commit/push/deploy.

---

## 1. PROBLEMAS RELATADOS

| # | Problema | Onde | Impacto |
|---|---|---|---|
| P1 | Opção "Admin" **não aparece** no menu lateral | `src/components/layout/app-sidebar.tsx` + `src/lib/navigation.ts` | Admin exclusivo não encontra o painel pelo menu |
| P2 | `/assinatura` mostra "Minha assinatura atual" e "Planos disponíveis", mas **os cards dos planos NÃO aparecem**; botão "Ver planos disponíveis" não funciona | `src/app/(app)/assinatura/page.tsx` + `src/components/billing/assinatura-client.tsx` + `src/lib/billing/plans/index.ts` | Cliente não consegue ver nem contratar planos |

---

## 2. CAUSA RAIZ — P1 (Admin não aparece no menu)

O `AppSidebar` renderiza `mainNav` + `bottomNav` **incondicionalmente** e **nunca recebeu** informação de autorização:

- `src/lib/navigation.ts` **não contém** nenhum item "Admin" (nem no `mainNav` nem no `bottomNav`).
- `src/components/layout/app-sidebar.tsx` não tem prop `isAdmin`, não importa `isOfficialAdminEmail` e não renderiza item administrativo.
- `src/app/(app)/layout.tsx` passava apenas `user={session.user}` ao `AppSidebar`, sem calcular autorização.

A regra de autorização **já existia e estava correta** em `src/lib/auth/admin-access.ts` (`OFFICIAL_ADMIN_EMAIL = "lp070087@gmail.com"`, `normalizeAdminEmail`, `isOfficialAdminEmail`) e em `guard.ts` (`requireAdminSession`) — mas ela nunca era usada para decidir o **item de menu**.

**Falha de camada:** a proteção server-side (`/admin`, `/admin/*`, `/api/admin/*`) sempre existiu e permanece intacta; o que faltava era a **camada de apresentação** (menu condicional).

---

## 3. CAUSA RAIZ — P2 (Cards dos planos não aparecem)

`listPlans()` lia **apenas** da tabela `Plan` do banco:

```ts
const rows = await bll.plan.findMany({ where: { active: true }, orderBy: [...] });
return rows.map(toPlanView);
```

Como `seedPlanCatalog()` foi documentado como "NÃO é executado nesta fase" (regra: sem seed), a tabela `Plan` no Neon está **vazia** → `listPlans()` devolve `[]` → `plans.map(...)` não renderiza nenhum card. No checkout, `getPlanById()` também retornava `null` → "Plano não encontrado".

**Conflito com a regra oficial** (escopo permanente): *"NÃO depender de seed/tabela de planos — catálogo oficial em código/backend é a fonte de verdade."* O catálogo oficial **existia** em `src/lib/billing/plans/catalog.ts`, mas o serviço não o usava como fallback.

O botão "Ver planos disponíveis" (na área 1) não "funcionava" apenas porque os cards da área 2 estavam vazios — o scroll em si usava `scrollIntoView({ behavior: "smooth" })` sem respeitar `prefers-reduced-motion`.

---

## 4. CORREÇÕES APLICADAS — P1 (Admin)

### 4.1 `src/lib/navigation.ts`
- Adicionado import `ShieldCheck` e o item exportado `adminNavItem`:
  ```ts
  export const adminNavItem: NavItem = {
    label: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    description: "Painel administrativo (exclusivo)",
  };
  ```
- Comentário explicando que é **condicional** (renderizado só para o admin exclusivo, decidido no servidor).

### 4.2 `src/components/layout/app-sidebar.tsx`
- Nova prop `isAdmin?: boolean` (default `false`) — **nunca** decide por conta própria; recebe do servidor.
- Desktop: no bloco inferior (após o divider), renderiza `adminNavItem` **se `isAdmin`**.
- Mobile drawer: mesma lógica, renderiza `adminNavItem` **se `isAdmin`**.

### 4.3 `src/app/(app)/layout.tsx`
- No server component, busca `email` do usuário no banco (junto com o select existente):
  ```ts
  select: { id: true, email: true, firstAccessCompleted: true, passwordHash: true }
  ```
- Calcula a autorização **no servidor** pela mesma regra oficial usada pelo `requireAdminSession`:
  ```ts
  const isAdmin = isOfficialAdminEmail(user?.email ?? null);
  ```
- Passa ao `AppSidebar`: `<AppSidebar user={session.user} isAdmin={isAdmin} />`.

**Por que usar o e-mail do banco em vez de `session.user.email`:** o callback de sessão (`src/lib/auth/config.ts`) preenche `session.user.id` e `role`, mas **não** garante `session.user.email` em todas as estratégias de sessão. O `requireAdminSession` também lê do banco (fonte da verdade). Usar a mesma origem elimina divergência e mantém a regra consistente em todas as camadas.

---

## 5. CORREÇÕES APLICADAS — P2 (Planos)

### 5.1 `src/lib/billing/plans/index.ts` (núcleo da correção)
- **`ensureCatalogPlans()`** — self-heal idempotente: garante que os 3 planos do catálogo oficial existam no banco (cria por slug quando ausentes). Não altera planos existentes. Mantém a FK de `Subscription` válida sem depender de seed manual.
- **`listPlans()`** — agora:
  1. chama `ensureCatalogPlans()`;
  2. lê do banco (se houver linhas, retorna);
  3. em caso de banco indisponível **ou** tabela ainda vazia, devolve o **catálogo oficial** (`PLAN_CATALOG`) como fallback de exibição.
  → **Os cards SEMPRE aparecem.**
- **`getPlanById()`** — fallback no catálogo: resolve `plan:<slug>` (ou slug cru) pelo catálogo; se o banco estiver disponível, garante a linha existir (para manter FK no checkout) antes de retornar.
- **`getPlanBySlug()`** — mesmo fallback no catálogo.
- **`seedPlanCatalog()`** — mantido como utilitário; agora delega em `ensureCatalogPlans()`.
- Documentação do módulo atualizada com a regra oficial.

### 5.2 `src/components/billing/assinatura-client.tsx`
- `scrollToPlans()` agora respeita `prefers-reduced-motion`:
  ```ts
  const reduced = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  ```

### 5.3 Nenhuma alteração de preço nesta etapa
- Os preços oficiais do catálogo **não foram alterados** (ETAPA B é correção de bugs): Semanal R$ 27,00 / Mensal R$ 77,00 / Anual R$ 497,00. A atualização comercial para InfinitePay é **tarefa separada** (relatório próprio).

---

## 6. ARQUIVOS MODIFICADOS

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/lib/navigation.ts` | TS | +`adminNavItem` (item Admin condicional) |
| `src/components/layout/app-sidebar.tsx` | TSX (client) | Prop `isAdmin` + render do item Admin no desktop e mobile |
| `src/app/(app)/layout.tsx` | TSX (server) | `isAdmin` calculado no servidor via `isOfficialAdminEmail(user.email)` e passado ao sidebar |
| `src/lib/billing/plans/index.ts` | TS | `ensureCatalogPlans` + fallback do catálogo em `listPlans`/`getPlanById`/`getPlanBySlug` |
| `src/components/billing/assinatura-client.tsx` | TSX (client) | `scrollToPlans` respeita `prefers-reduced-motion` |

**Não tocados:** Prisma schema, Neon, `admin-access.ts`, `guard.ts`, `config.ts`, webhooks, publishing, growth, primeiro acesso, landing (ETAPA A), `.env*`, `package.json`.

---

## 7. TESTES EXECUTADOS

| Validação | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` | **EXIT 0** |
| `npm run billing:test` | **31/31** |
| `npm run first-access:test` | **39/39** |
| `npm run publishing:test` | **25/25** |
| `npm run growth:test` | **28/28** |
| `git diff --check` | **EXIT 0** (sem whitespace/conflito) |
| `npm run build` | **EXIT 1** — limitação conhecida do sandbox Linux: `@next/swc-linux-x64-gnu` não instalado. Não é erro de código; a DONA valida localmente (Windows). |

---

## 8. BUSCAS DE SEGURANÇA / REGRESSÃO

| Busca | Resultado |
|---|---|
| `lp070087@gmail.com` | Apenas em `src/lib/auth/admin-access.ts` + comentários — **fonte única** |
| `ADMIN_EMAIL` | Apenas em `admin-access.ts` (leitura de env) — sem duplicação |
| `role === "ADMIN"` | Apenas em `guard.ts` como caso de teste/comentário — **nenhuma** dependência de `role` para autorização |
| `requireAdminSession` | `guard.ts` (definição) + `admin/layout.tsx` e páginas `/admin` — proteção server-side intacta |
| `listPlans` / `getPlanById` | `plans/index.ts` (definição), `page.tsx`, `route.ts`, `checkout.ts`, `subscriptions/index.ts`, `asaas/service.ts` — fluxo coerente |
| CTA de checkout | Continua no fluxo real `/api/billing/checkout` (Asaas) — **nada** de ativação por clique; nenhum pagamento falso |

---

## 9. VALIDAÇÃO MANUAL NECESSÁRIA (DONA, local)

1. `npm run build` + `npm run dev` (Windows).
2. **P1:** logar como `lp070087@gmail.com` → menu inferior deve mostrar **Admin** (desktop + drawer mobile). Logar como outro usuário → **não** deve aparecer. Tentar acessar `/admin` sem ser admin → redireciona para `/dashboard` (proteção server-side já existente).
3. **P2:** abrir `/assinatura` → "Planos disponíveis" deve mostrar **3 cards** (Semanal R$ 27,00 / Mensal R$ 77,00 / Anual R$ 497,00). Botão "Ver planos disponíveis" rola suavemente até a área 2 (sem smooth em `prefers-reduced-motion`).
4. Confirmar que o checkout segue o fluxo real (estado controlado sem `ASAAS_API_KEY`; sem URL fake).
5. Confirmar que a tabela `Plan` foi criada automaticamente no Neon após o primeiro `listPlans()` (self-heal).

---

## 10. RISCOS / OBSERVAÇÕES

- **Self-heal é idempotente e não-destrutivo**: cria apenas os slugs ausentes; nunca sobrescreve preço/nome/features de planos existentes.
- **Fallback de exibição** (`PLAN_CATALOG`) usa IDs `plan:<slug>` apenas para exibição; o `getPlanById` resolve a linha real do banco sempre que disponível, preservando a FK de `Subscription`.
- **Menu Admin** não concede acesso por si só: `/admin` continua protegido por `requireAdminSession`. O item é só conveniência para o admin legítimo.
- **Build** continua bloqueado no sandbox (SWC); nenhuma tentativa de atualizar Next.js/dependências.

---

## 11. NÃO FEITO (conforme escopo)

- Nenhum commit, push, merge ou deploy.
- Nenhuma alteração em Prisma schema / Neon (o self-heal usa o schema existente, sem migração).
- Nenhuma alteração em preços, autenticação geral, primeiro acesso, Instagram, TikTok, Publishing, Growth Engine, Asaas webhook, identidade visual.
- Nenhum `npm audit fix --force`.
- Nenhuma credencial logada/exibida.
