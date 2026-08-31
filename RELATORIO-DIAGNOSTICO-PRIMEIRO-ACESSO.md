# RELATÓRIO — DIAGNÓSTICO E CORREÇÃO DO LOOP NO /primeiro-acesso

**Data:** 2026-08-31
**Branch:** `checkpoint-fase8-fase9`
**Base:** commit `abe1448` (deployment READY na Vercel Preview)
**Escopo:** Exclusivamente o fluxo de autenticação/primeiro acesso. NÃO mexi na landing finalizada, NÃO alterei Prisma/schema/Neon, NÃO alterei variáveis da Vercel, NÃO fiz commit/push/deploy.

---

## 1. Causa raiz (exata)

**Ciclo de redirecionamento infinito entre `/dashboard` e `/primeiro-acesso`** — um ping-pong entre dois redirecionamentos server-side:

| Camada | Arquivo | Comportamento |
|--------|---------|---------------|
| Layout do app | `src/app/(app)/layout.tsx` | Se `user.firstAccessCompleted === false` → `redirect("/primeiro-acesso")` |
| Página | `src/app/(auth)/primeiro-acesso/page.tsx` | Se `session?.user` existe → `redirect("/dashboard")` |

**Por que o usuário real caiu nisso:** o usuário tem senha própria (login aceitou e-mail + senha) mas `firstAccessCompleted === false` no banco. Esse é o estado típico de:
- contas criadas por `/cadastro` (a API `register` NÃO seta `firstAccessCompleted`);
- usuários legados criados antes da fase "Primeiro Acesso";
- usuários com grant `PENDING_FIRST_ACCESS` cuja conta foi ativada antes da introdução do campo.

Ao logar → `/dashboard` → layout vê `firstAccessCompleted=false` → `/primeiro-acesso` → a página vê sessão → `/dashboard` → **loop infinito** (a página fica "piscando/recarregando", exatamente o sintoma reportado). F5 não resolve porque o ciclo é determinístico no servidor.

**Erro conceitual:** `firstAccessCompleted` tem `@default(false)` para TODA conta. O fluxo de ativação (`/primeiro-acesso`) só deveria aplicar-se a quem **NÃO tem senha** (comprou e precisa criar a própria). Usar `!firstAccessCompleted` como gate pega usuários legítimos com senha e cria o ciclo.

---

## 2. Arquivos alterados (2, mínimos)

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/layout.tsx` | Gate de primeiro acesso agora exige grant `PENDING_FIRST_ACCESS` **e** usuário **sem senha**; bloco de expiração usa `EXPIRED`/`CANCELED` (não mais `!active`). |
| `src/app/(auth)/primeiro-acesso/page.tsx` | Redireciona para `/dashboard` apenas se o usuário **já tem senha**; sem senha permanece na página (não redireciona de volta). |

---

## 3. Lógica antiga (causadora)

```ts
// (app)/layout.tsx
const user = await prisma.user.findUnique({ where: { id }, select: { firstAccessCompleted: true } });
if (user && !user.firstAccessCompleted) redirect("/primeiro-acesso");
...
const access = await getActiveAccessForUser(id);
if (!access.active) redirect("/expirado");
```

```ts
// (auth)/primeiro-acesso/page.tsx
if (session?.user) redirect("/dashboard");
```

---

## 4. Lógica nova

```ts
// (app)/layout.tsx
const user = await prisma.user.findUnique({
  where: { id }, select: { id: true, firstAccessCompleted: true, passwordHash: true },
});
const access = await getActiveAccessForUser(id);

// Só exige ativação se há grant PENDENTE e o usuário AINDA NÃO tem senha.
const needsActivation = access.status === "PENDING_FIRST_ACCESS" && !user?.passwordHash;
if (needsActivation) redirect("/primeiro-acesso");
...
// Expiração real: EXPIRED / CANCELED (PENDING_FIRST_ACCESS ≠ expirado).
if (access.status === "EXPIRED" || access.status === "CANCELED") redirect("/expirado");
```

```ts
// (auth)/primeiro-acesso/page.tsx
if (session?.user) {
  const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (user?.passwordHash) redirect("/dashboard"); // conta pronta → app
  // sem senha → permanece (ativação)
}
```

---

## 5. Comportamento — ADMIN

O admin usa `src/app/admin/layout.tsx` (grupo `/admin`, separado do grupo `(app)`). Ele passa apenas por `requireAdminSession()` (sessão + role ADMIN + status ACTIVE no banco). **Não passa pelo gate de primeiro-acesso/onboarding/expiração do layout `(app)`.** Logo, um admin com senha válida nunca ficará preso no ciclo — o loop não o afetava e continua não afetando.

---

## 6. Comportamento — CLIENT

| Cenário | Antes | Depois |
|---------|-------|--------|
| Cliente com senha (cadastro/legado), `firstAccessCompleted=false` | **LOOP** `/dashboard ↔ /primeiro-acesso` | ✅ Vai para `/dashboard` → onboarding (se faltar) → dashboard |
| Cliente que comprou, sem senha (grant `PENDING_FIRST_ACCESS`) | `/primeiro-acesso` mostra o form (fluxo correto) | ✅ Mantém o form; ao concluir cria senha → congrats → tour → onboarding → dashboard |
| Cliente com onboarding incompleto | Vai para `/onboarding` | ✅ Inalterado (`redirect("/onboarding")`) |
| Cliente com acesso EXPIRED/CANCELED | `!active` → `/expirado` | ✅ `EXPIRED`/`CANCELED` → `/expirado` (inalterado na prática) |
| Sessão órfã (grant pendente + sem senha) acessa `/primeiro-acesso` | `redirect("/dashboard")` → volta → loop | ✅ Permanece na página e conclui a ativação |

---

## 7. Resultado do TypeScript

`NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` → **EXIT 0**

## 8. Resultado do build

`npm run build` → **EXIT 1** — limitação do sandbox: `@next/swc-linux-x64-gnu` não instalado no ambiente Linux isolado (`Failed to load SWC binary`). Não é erro de código; idêntico a todas as fases anteriores. **A DONA deve rodar `npm run build` localmente para validar.**

## 9. Configuração da Vercel (nada a ajustar para este bug)

O loop **não** depende das variáveis de ambiente. Causa é 100% lógica de código. As variáveis relatadas comportam-se assim:
- `AUTH_URL` (Production + Preview): usada como base da URL de ativação em `/api/first-access/request`. Se estiver correta para cada ambiente, o link gerado é válido. **Não participa do loop.**
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET` (apenas Production): sem elas, em ambientes que as exigem, o NextAuth pode falhar ao decodificar a sessão JWT e o `withAuth` do middleware pode tratar como deslogado — mas o sintoma relatado (login aceito + loop na página) é consistente com o bug de código, não com essas variáveis. **Recomendação:** como boa prática, garantir `NEXTAUTH_URL` e `NEXTAUTH_SECRET` também em Preview quando forem fazer testes de login em Preview (não é obrigatório para este fix).
- `AUTH_SECRET` / `DATABASE_URL` / `DIRECT_URL`: corretas em ambos ambientes, não participam.

## 10. Testes manuais recomendados (pós-build local)

1. **Cliente com senha + `firstAccessCompleted=false`** (o caso do bug): logar → deve ir direto ao dashboard (ou onboarding se faltar). Sem piscar.
2. **Cliente que comprou (sem senha, grant pendente)**: `/primeiro-acesso` deve mostrar o form; concluir fluxo → tour → onboarding → dashboard.
3. **Admin**: logar com admin → deve ir direto ao `/admin` sem passar pelo primeiro acesso.
4. **Cliente com acesso expirado**: logar → deve ir para `/expirado` com botão de renovação.
5. **F5 na `/primeiro-acesso`** com token válido na URL: deve mostrar o form de criação de senha, sem recarregar em loop.
6. **F5 no `/dashboard`** logado: deve carregar o dashboard sem redirecionar.

---

## Validações executadas

- `npx tsc --noEmit` → **EXIT 0**
- `npm run build` → **EXIT 1** (SWC sandbox — limitação conhecida, não erro de código)
- `git diff --check` → **OK**
- Buscas por `router.push`/`router.replace`/`redirect(`/`window.location` para `primeiro-acesso` → **nenhum outro redirecionamento para a rota** além do gate corrigido
- Único `redirect("/primeiro-acesso")` restante: `(app)/layout.tsx:37` (gate condicional correto)

**Git:** `M src/app/(app)/layout.tsx`, `M src/app/(auth)/primeiro-acesso/page.tsx`. SEM commit / SEM push.
