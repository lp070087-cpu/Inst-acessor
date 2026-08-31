# RELATÓRIO — ADMIN ÚNICO · MINHA ASSINATURA · OPENAI (REQUEST C)

Data: 2026-08-31
Branch: `checkpoint-fase8-fase9`
Escopo: REQUEST C — CONTINUAR O PROJETO A PARTIR DO ESTADO ATUAL (3 objetivos)
Nenhum commit/push realizado (regra permanente). Build SWC bloqueado apenas pela limitação do sandbox Linux (detalhe no item 12).

---

## RESUMO DO QUE EXISTIA ANTES (auditoria obrigatória)

Antes de qualquer modificação, foram executados `git status --short` e `git diff` e lidos os arquivos de admin/auth/role/billing/plans/checkout/IA/provider/SystemSetting. O que já existia:

- **Área admin** já era protegida por `requireAdminSession()` em `admin/layout.tsx`, nas 5 páginas `/admin` e em todas as rotas `/api/admin/*`. A role no banco era o critério, o que deixava o CASO E vulnerável.
- **Menu do cliente** (`app-sidebar.tsx` / `navigation.ts`) já NÃO exibia link para `/admin` (CASO B já satisfeito no nível de menu).
- **`/assinatura`** já era server component com `listPlans()`/`getMySubscription()`/`getAccessStatus()`, e o client já chamava o checkout real — porém a ordem era "Planos primeiro, Minha assinatura depois".
- **IA** já era 100% server-only: `OPENAI_API_KEY` apenas no servidor, zero `NEXT_PUBLIC_*`, chaves encriptadas (AES-256-GCM) em `SystemSetting`, admin exibia só `keyMask`, e `aiConfigured()` retornava false sem chave (sem mock).

---

## ITENS ENTREGUES

### OBJETIVO 1 — ADMIN ÚNICO E EXCLUSIVO

1. **`src/lib/auth/admin-access.ts` (novo)** — fonte única de verdade de autorização administrativa. E-mail canônico `lp070087@gmail.com`, normalização `trim + lowercase`, `isOfficialAdminEmail()`, `authorizedAdminEmails()`. `ADMIN_EMAIL` de ambiente é aceito apenas como sobrescrita adicional — nunca cria um segundo admin por si só e nunca substitui a garantia de que só e-mails autorizados são admin.

2. **`src/lib/auth/guard.ts`** — `requireAdminSession()` agora consulta o banco (`email`, `status`) e valida `status === "ACTIVE"` **e** `isOfficialAdminEmail(email)`. Usuário não autorizado (ou suspenso) → `redirect("/dashboard")`. Um usuário com `role = ADMIN` antigo no banco, mas e-mail diferente, NÃO recebe privilégios (CASO E).

3. **`src/app/api/admin/users/route.ts`** — `make-admin` bloqueado para TODOS (mensagem explícita). `suspend`/`remove-admin` bloqueados para o admin oficial. `remove-admin` permitido apenas para rebaixar admins legados (e-mail não oficial) para `USER`.

4. **`src/components/admin/admin-users-client.tsx`** — tabela identifica o admin oficial com badge "Administrador" (ShieldCheck); ações de terceiros mostram "Você" (self) ou "Exclusivo"; botão de promover admin removido. `type Action` agora é `"suspend" | "activate" | "remove-admin"`.

5. **`src/app/admin/usuarios/page.tsx`** — passa `adminEmail` (buscado no servidor) para o client, alimentando a proteção visual e a lógica de ações.

6. **`src/lib/admin/stats.ts`** — métricas novas: `expiredSubscriptions`, `pendingPayments`, `pendingFirstAccess`, `manualGrants` (contagens reais no banco, nunca inventadas).

7. **`src/app/admin/page.tsx`** — visão central ampliada: KPIs (usuários, ativos, novos 30d, receita), assinaturas ativas/expiradas, aguardando pagamento, 1º acesso pendente, liberações manuais, Instagram/TikTok, fila/falhas de publicação, mensagens de IA; seção **Atalhos rápidos** (liberar acesso manual, assinaturas, IA, integrações); seção **Status da IA** (configurada/não configurada por provider + provider ativo — apenas status/máscara); seção **Administrador exclusivo** (lista os e-mails autorizados). Preservadas as tabelas existentes (planos, usuários recentes, pagamentos recentes).

### OBJETIVO 2 — MINHA ASSINATURA / CARDS DE PLANOS

8. **`src/components/billing/assinatura-client.tsx`** — reestruturado nas duas áreas na ordem oficial:
   - **ÁREA 1 — MINHA ASSINATURA ATUAL** (primeiro): estado real da assinatura; sem assinatura → EmptyState "Você ainda não tem uma assinatura" com CTA "Ver planos disponíveis"; com assinatura → grid de detalhes (plano, preço, status, cobrança, início, expiração, pagamento, renovação) + mensagem por status + ações (cancelar renovação futura / ver planos).
   - **ÁREA 2 — PLANOS DISPONÍVEIS** (segundo): cards gerados de `initialPlans` (vindos do servidor via `listPlans`) — preço nunca é inventado no frontend. Destaques: `MAIS_ESCOLHIDO` (badge Crown) e `MELHOR_CUSTO_BENEFICIO`. CTA "Escolher plano" → `POST /api/billing/checkout` real. Sem gateway → estado controlado "Pagamento online em configuração" (nenhuma cobrança real).
   - Aviso de e-mail mantido no topo ("Use um e-mail que você tenha acesso...").
   - Scroll suave para a área de planos (`#planos-disponiveis` + `scroll-mt-24`).
   - `initialAccess`/`history` preservados no contrato.

### OBJETIVO 3 — PREPARAR OPENAI (SERVER-ONLY)

9. **Auditoria de conformidade (zero alteração de código necessária)**:
   - `OPENAI_API_KEY` usada apenas no servidor (`src/lib/ai/*`, `src/lib/admin/ai-config.ts`); **0** ocorrências de `NEXT_PUBLIC_OPENAI|NEXT_PUBLIC_AI|NEXT_PUBLIC_GEMINI|NEXT_PUBLIC_GOOGLE` em `src/` (a única ocorrência é um comentário em `asaas/config.ts` sobre `NEXT_PUBLIC_ASAAS_*`).
   - **0** ocorrências de `console.log/info/debug` com `apiKey|secret|key` — nenhuma chave é logada.
   - Chaves no admin gravadas **encriptadas** (AES-256-GCM) em `SystemSetting`; admin exibe apenas `keyMask` (ex.: `sk-••••••••••••abcd`).
   - Sem chave → `aiConfigured()` retorna false → UI mostra "IA ainda não configurada" (nunca mocka resposta).
   - `requireAdminSession()` protege `/admin/ia` e `/api/admin/ia*`.

10. **`.env.example`** — adicionada seção `ADMIN_EMAIL` (OPCIONAL) com nota explícita: o administrador é sempre `lp070087@gmail.com`; `ADMIN_EMAIL` só adiciona um e-mail à lista de autorizados e a role no banco nunca concede privilégio.

---

## CASOS DE TESTE DE SEGURANÇA

11. **A — `lp070087@gmail.com`** → `isOfficialAdminEmail()` retorna true (canônico) → `requireAdminSession()` permite. ✅
    **B — CLIENT comum** → menu do cliente não exibe link `/admin` (nenhum `href="/admin` fora de componentes admin). ✅
    **C — CLIENT tenta `/admin` diretamente** → `requireAdminSession()` redireciona para `/dashboard` (servidor, não só UI). ✅
    **D — CLIENT chama `/api/admin/users` diretamente** → `requireAdminSession()` redireciona (não retorna dados). ✅
    **E — role ADMIN no banco, e-mail diferente** → `isOfficialAdminEmail()` false → `requireAdminSession()` redireciona; `make-admin` bloqueado; `remove-admin` permite rebaixar para `USER`. ✅

---

## VALIDAÇÃO

12. **`npx tsc --noEmit`** → **EXIT 0** (com `NODE_OPTIONS=--max-old-space-size=4096`).
    **`npm run build`** → **EXIT 1 APENAS pela limitação conhecida do sandbox Linux**: `@next/swc-linux-x64-gnu` não instalado (`Failed to load SWC binary`). Não é bug de código. O build deve ser executado localmente pela DONA (Windows) — sem atualizar Next.
    **`git diff --check`** → OK (sem whitespace errors).

13. **Buscas finais obrigatórias** (todas conforme):
    - `NEXT_PUBLIC_OPENAI|NEXT_PUBLIC_AI|NEXT_PUBLIC_GEMINI|NEXT_PUBLIC_GOOGLE|NEXT_PUBLIC_ASAAS` → apenas comentário em `asaas/config.ts`.
    - `console.(log|info|debug)(...apiKey|secret|key)` → 0 resultados.
    - `requireAdminSession` → presente em todas as páginas/rotas admin + `/api/publishing` (action=process).
    - `ADMIN_EMAIL|isOfficialAdminEmail|authorizedAdminEmails` → módulo `admin-access.ts` + usos em guard/users/page admin.
    - `make-admin|role === "ADMIN"` → `make-admin` bloqueado na rota; guard não depende mais da role.
    - `href="/admin` → apenas dentro de `admin-sidebar.tsx` e `admin/page.tsx` (links de atalho internos da área admin).
    - `/api/billing/{plans,checkout,subscription}` → 3 rotas presentes e protegidas por session.

14. **Arquivos alterados (8)** + **1 novo**: `.env.example`, `src/app/admin/page.tsx`, `src/app/admin/usuarios/page.tsx`, `src/app/api/admin/users/route.ts`, `src/components/admin/admin-users-client.tsx`, `src/components/billing/assinatura-client.tsx`, `src/lib/admin/stats.ts`, `src/lib/auth/guard.ts`, **`src/lib/auth/admin-access.ts` (novo)**.

---

### NÃO FEITO (regras permanentes respeitadas)
- Nenhum commit / push / merge / deploy. Nenhuma alteração em Prisma schema, banco, Neon, Asaas, Instagram, TikTok, primeiro acesso, publishing, planos, regras de negócio, variáveis da Vercel.
- Nenhuma chave/secreto lido, impresso ou exposto. Nenhuma alteração em `.env.local`.
- Nada de `npm audit fix --force`. Nada de `prisma db push`.
- Sem fakes de resposta de IA: sem chave → estado "não configurada".
