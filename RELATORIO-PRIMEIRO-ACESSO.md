# RELATÓRIO — PRIMEIRO ACESSO (pós-pagamento / pós-liberação)

> Fase: **IDEIA DO PRIMEIRO ACESSO** · Data: **2026-08-30**
> Branch: `checkpoint-fase8-fase9` · **SEM commit / SEM push** (a DONA executa local)

---

## 1. Objetivo

Entregar o fluxo profissional **pós-pagamento / pós-liberação**: PAGAMENTO CONFIRMADO →
libera acesso → o cliente usa o **MESMO e-mail da compra** → cria a **própria senha**
(nunca automática) → entra → boas-vindas/parabéns → tour guiado (5 passos) → onboarding →
Dashboard. Expiração respeitada e admin único.

## 2. Identidade = e-mail da compra

- O direito de acesso é vinculado ao **e-mail** (`AccessGrant.email`), origem `ASAAS`
  (pagamento confirmado via webhook) ou `ADMIN_MANUAL` (liberação manual do admin).
- No primeiro acesso o cliente informa exatamente esse e-mail. Não existe fluxo em que um
  e-mail arbitrário/diferente libere acesso.
- Anti-enumeração: a resposta é **sempre a mesma mensagem genérica**, independentemente de o
  e-mail ter acesso.

## 3. Nunca senha automática

- Em nenhum ponto o sistema gera senha fixa, temporária ou previsível.
- O cliente **cria a própria senha** no primeiro acesso; ela é salva com **bcrypt**
  (`SALT_ROUNDS=12`) via `hashPassword`.
- Conta órfã criada por webhook (sem senha) recebe senha **apenas** quando o cliente a cria.

## 4. Estados de acesso

`AccessGrant.status`: `PENDING_FIRST_ACCESS` (aguardando ativação), `ACTIVE`, `EXPIRED`,
`CANCELED`. Efetividade calculada em tempo real por `effectiveGrantStatus` (CANCELED
permanece; expiração passada → EXPIRED). `User` ganhou `firstAccessCompleted` +
`firstAccessCompletedAt`; `tourCompleted` + `tourCompletedAt`.

## 5. Fluxo de ativação em `/primeiro-acesso`

1. **E-mail** → informa o e-mail da compra.
2. **Prova de posse** → token de uso único gerado, com hash no banco.
3. **Senha** → cria a própria senha (mín. 8, confirmação, bcrypt).
4. **Boas-vindas/parabéns** → mostra plano, origem, início, validade + CTA "Conhecer o Inst Acessor".
5. **Tour guiado** (5 passos) → concluir ou pular; registra `tourCompleted`.
6. **Onboarding** → redireciona para o wizard existente (sem duplicar).

## 6. Duas origens

- **ASAAS**: webhook de pagamento confirmado cria o `AccessGrant` (`upsertAsaasAccessGrant`),
  com referência externa real (`externalPaymentId`/`externalSubscriptionId`), nunca inventada.
- **ADMIN_MANUAL**: liberação manual do admin, sem cobrança e sem chamar o Asaas. Para e-mail
  sem conta, cria apenas o `AccessGrant` (CENÁRIO D) — o cliente conclui o primeiro acesso depois.

## 7. Criação de conta sem duplicação (casos A–D)

- **A)** User não existe → cria com a senha escolhida; grant vira `ACTIVE`.
- **B)** User existe com senha → **vincula** o grant ao user (sem duplicar).
- **C)** User existe sem senha (órfã de webhook) → define a senha agora.
- **D)** e-mail sem conta na liberação manual → apenas `AccessGrant` (a conta nasce no primeiro acesso).

## 8. Prova de posse do e-mail (tokens)

- Token **aleatório** (`crypto.randomBytes(32)` → base64url, ~43 chars), com **expiração de 60
  minutos**, **uso único**, **hash SHA-256** armazenado (`FirstAccessToken.tokenHash`).
- **Nunca em logs**; apenas o hash é comparado. **Não é JWT eterno** — é token opaco de banco.
- Replay-safe: consumido (`consumed=true`) antes de prosseguir; tentar reutilizar falha.
- Requisições anteriores não usadas são invalidadas ao gerar nova.
- Provider de e-mail **desacoplado** (`src/lib/email`): sem provider configurado, o envio real
  **NÃO acontece** (nunca fingimos envio). Em dev o link aparece na tela para teste.

## 9. Checkout — aviso do e-mail

No checkout (`/assinatura`) foi adicionado o aviso:

> "Use um e-mail que você tenha acesso. Este mesmo e-mail será utilizado para liberar seu acesso ao Inst Acessor."

## 10. Tela de boas-vindas / congratulações

Exibe: plano, origem (Compra / Liberação manual), início, validade e o CTA **"Conhecer o Inst Acessor"**,
que conduz ao tour (e ao onboarding em seguida). Também há o atalho "ir direto ao painel".

## 11. Tour guiado (4–7 passos)

5 passos com ícones (Compass, Zap, BarChart3, CalendarClock, BellRing): visão geral do
dashboard, planos/ações, análise de desempenho, calendário de conteúdo e alertas/insights.
Botões **Próximo / Voltar / Pular tour**, registro de conclusão (`completeTour`) e **não
reexibido** nos próximos logins.

## 12. Onboarding integrado

Após o tour, o usuário é direcionado ao **onboarding step-by-step existente** — sem duplicar
fluxo. O gate do app (`(app)/layout.tsx`) redireciona para `/onboarding` enquanto
`onboardingCompleted` não estiver marcado.

## 13. Passkey / Face ID — pendência controlada

- **Decisão**: implementar APENAS via WebAuthn; nunca fingir biometria. Como exige HTTPS estável,
  RP ID e lib de validação em produção, ficou **pendência controlada**.
- **Pronto**: model `PasskeyCredential` no schema e shim; camada `src/lib/webauthn/index.ts`
  honesta (status `enabled=false`; registro/verificação retornam erro, nunca credencial falsa);
  documentação em `docs/PASSKEY-PENDENCIA.md`.
- Senha continua sendo **sempre o fallback obrigatório**.

## 14. Expiração

- `getActiveAccessForUser` (owner-check) calcula o status efetivo; se não estiver `ACTIVE`, o
  layout do app redireciona para `/expirado`.
- A tela mostra **"Seu acesso expirou"** com botão **Renovar acesso** (`/assinatura`).
- **Nunca deleta o User**; apenas bloqueia recursos pagos e oferece renovação.

## 15. Admin — painel "Acessos liberados"

- Página `/admin/usuarios` ganhou a seção **"Acessos liberados"** (origem, e-mail, plano,
  período, status, 1º acesso feito/pendente).
- Endpoint `GET /api/admin/access-grants` protegido por `requireAdminSession()` (role no banco).
- **Nunca expõe tokens/passwordHash**. Admin único: `requireAdminSession` só libera `role=ADMIN`
  e `status=ACTIVE`; não há promoção pública nem multi-admin.

## 16. Segurança

- **Anti-enumeração**: resposta idêntica para e-mail sem/ com acesso.
- **Rate limit** em todas as rotas: `request` (5/min/IP), `verify` (15/min/IP), `complete`
  (10/min/IP), `tour` (20/min/IP), `lookup` (30/min/user).
- **Token**: aleatório, expirante, uso único, hash, fora de logs; sem JWT eterno.
- **Brute force**: senha validada no servidor (mín. 8); token comparado por hash.
- **Ownership**: todas as operações do usuário são owner-checked (session + userId).
- **CSRF**: rotas são POST server-side com sessão Auth.js; não há estado mutável via GET.
- **Sem vazamento**: respostas nunca incluem `passwordHash`, tokens crus (exceto dev/uma vez na
  criação para envio) nem secrets.

## 17. Arquivos criados/modificados

| Arquivo | Papel |
| --- | --- |
| `prisma/schema.prisma` | `AccessGrant`, `FirstAccessToken`, `PasskeyCredential` + campos em `User` |
| `src/types/prisma-shim.d.ts` | Tipos dos novos models (sem `prisma generate`) |
| `src/lib/first-access/core.ts` | Núcleo puro (normalização, força de senha, status, token) |
| `src/lib/first-access/index.ts` | Serviço (request/verify/create/complete/tour + acesso ativo) |
| `src/lib/email/index.ts` | Provider desacoplado (nunca finge envio) |
| `src/lib/webauthn/index.ts` | Passkey pendência controlada |
| `src/lib/validators/first-access.ts` | Zod (e-mail, token, senha, confirmação) |
| `src/app/(auth)/primeiro-acesso/` | Página + formulário (5 estágios + tour) |
| `src/app/(auth)/expirado/` | Tela de expiração + renovação |
| `src/app/api/first-access/*` | 5 rotas (request/verify/complete/tour/lookup) + rate limit |
| `src/app/api/admin/access-grants/` | Lista de acessos (admin) |
| `src/components/admin/admin-access-grants.tsx` | Tabela de acessos (admin) |
| `src/app/admin/usuarios/page.tsx` | Seção "Acessos liberados" |
| `src/app/(app)/layout.tsx` | Gates: primeiro acesso + onboarding + expiração |
| `src/middleware.ts` | Públicas: `/primeiro-acesso`, `/expirado` |
| `src/components/billing/assinatura-client.tsx` | Aviso do e-mail no checkout |
| `src/lib/billing/manual-access.ts` | Liberação manual (CENÁRIO D) |
| `scripts/first-access-tests.ts` + `tsconfig.first-access-test.json` | Testes |
| `docs/PASSKEY-PENDENCIA.md` | Passkey pendência controlada |
| `.env.example` | Variáveis `EMAIL_*` (provider desacoplado) |
| `package.json` | Script `first-access:test` |

## 18. Validação executada (nesta sandbox)

- `npx tsc --noEmit` → **EXIT 0** (com `NODE_OPTIONS=--max-old-space-size=4096`).
- `npm run first-access:test` → **39/39**.
- `npm run growth:test` → **28/28**.
- `npm run billing:test` → **31/31**.
- `npm run publishing:test` → **25/25**.

> Bloqueado na sandbox (a DONA executa local): `prisma generate`, `prisma db push`,
> `next build`, commit/push.

## 19. Pendências externas / decisões da DONA

- **Provider de e-mail** (Resend/SendGrid/SES/Mailgun/Brevo): decisão + variáveis no painel.
  Sem isso, o link de primeiro acesso é registrado, mas **não enviado** (em dev aparece na tela).
- **Prisma**: `npx prisma generate` + `prisma db push` (não-destrutivo) antes do build local.
- **Passkey/WebAuthn**: habilitar apenas com HTTPS estável + lib de validação (ver
  `docs/PASSKEY-PENDENCIA.md`).
- **Commit/push**: deixados para a DONA (constraint: sem commit/push/merge/deploy).

## 20. Checklist do fluxo (cenários)

- [x] Pagamento confirmado (ASAAS) cria AccessGrant PENDING_FIRST_ACCESS.
- [x] Liberação manual (ADMIN_MANUAL) cria AccessGrant PENDING_FIRST_ACCESS.
- [x] E-mail com acesso → token criado; e-mail sem acesso → mensagem genérica.
- [x] Link válido → e-mail + grant exibidos; link usado/expirado → erro.
- [x] Criação de senha (bcrypt) → grant ACTIVE + firstAccessCompleted.
- [x] Conta já existente → vínculo sem duplicação; órfã → senha definida.
- [x] Auto-login → tela de boas-vindas com plano/período/validade.
- [x] Tour 5 passos → onboarding → dashboard.
- [x] Acesso expirado/cancelado → tela `/expirado` com renovação (User preservado).
- [x] Admin vê "Acessos liberados" (sem tokens/passwordHash).
- [x] Passkey: pendência controlada (nada falso).

**Conclusão**: Primeiro Acesso **COMPLETO** (código + testes). Pendências restantes são de
configuração externa (e-mail, Prisma local, commit/push) — não de código.
