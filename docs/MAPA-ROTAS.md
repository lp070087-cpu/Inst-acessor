# Mapa de Rotas — Inst Acessor

> Documento vivo (Fase 9). Lista todas as rotas de página e de API do SaaS,
> com autenticação, método HTTP e finalidade. Atualize sempre que criar uma rota.

## Páginas públicas

| Rota | Arquivo | Finalidade |
|---|---|---|
| `/` | `src/app/page.tsx` | Porta de entrada pública (logo + CTA) |
| `/login` | `src/app/(auth)/login/page.tsx` | Autenticação |
| `/cadastro` | `src/app/(auth)/cadastro/page.tsx` | Criação de conta |
| `/onboarding` | `src/app/(auth)/onboarding/page.tsx` | Wizard first-run (pós-login) |

## Páginas autenticadas — grupo `(app)`

| Rota | Arquivo | Menu | Finalidade |
|---|---|---|---|
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | Dashboard | Visão geral |
| `/ia-acessor` | `src/app/(app)/ia-acessor/page.tsx` | IA Acessor | Mentoria com IA |
| `/gerador-de-copy` | `src/app/(app)/gerador-de-copy/page.tsx` | Gerador de Copy | Legendas |
| `/ideias` | `src/app/(app)/ideias/page.tsx` | Ideias | Inspiração de conteúdo |
| `/preview-social` | `src/app/(app)/preview-social/page.tsx` | Preview Social | Visualização do perfil |
| `/rank` | `src/app/(app)/rank/page.tsx` | Rank | Ranking + XP |
| `/calendario` | `src/app/(app)/calendario/page.tsx` | Calendário | Planejamento/pipeline |
| `/publishing` | `src/app/(app)/publishing/page.tsx` | Central de Publicação | Fila de publicação |
| `/growth` | `src/app/(app)/growth/page.tsx` | Automações Inteligentes | Motor de crescimento |
| `/mentoria` | `src/app/(app)/mentoria/page.tsx` | Mentoria | Acompanhamento |
| `/score` | `src/app/(app)/score/page.tsx` | Score Inteligente | Score 0–100 |
| `/perfil-de-inteligencia` | `src/app/(app)/perfil-de-inteligencia/page.tsx` | Perfil de Inteligência | Perfil aprendido pela IA |
| `/automacoes` | `src/app/(app)/automacoes/page.tsx` | Automações | Regras de resposta |
| `/redes-sociais` | `src/app/(app)/redes-sociais/page.tsx` | Redes Sociais | Contas conectadas |
| `/analise-de-desempenho` | `src/app/(app)/analise-de-desempenho/page.tsx` | Análise de Desempenho | Métricas/comparativos |
| `/assinatura` | `src/app/(app)/assinatura/page.tsx` | Minha Assinatura | Planos e cobrança |
| `/perfil` | `src/app/(app)/perfil/page.tsx` | Perfil | Dados do usuário |
| `/configuracoes` | `src/app/(app)/configuracoes/page.tsx` | Configurações | Preferências |
| `/sobre` | `src/app/(app)/sobre/page.tsx` | Sobre | Conheça o produto |

O grupo `(app)` exige sessão + onboarding concluído (`src/app/(app)/layout.tsx`).

## Componentes globais de estado

| Arquivo | Finalidade |
|---|---|
| `src/app/(app)/loading.tsx` | Skeleton de carregamento do app |
| `src/app/(app)/error.tsx` | Error boundary do app |
| `src/app/(app)/not-found.tsx` | 404 dentro do app |
| `src/app/not-found.tsx` | 404 global (rotas públicas inexistentes) |
| `src/middleware.ts` | Middleware global (auth) |

## Health check

| Rota | Método | Finalidade |
|---|---|---|
| `/api/health` | `GET` | Health check público (uptime/probes) — sem segredos |

## APIs de autenticação

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/auth/[...nextauth]` | `GET/POST` | NextAuth (login/sessão/signout) |
| `/api/auth/register` | `POST` | Cadastro (rate-limited) |
| `/api/onboarding` | `PUT` | Salva perfil first-run + XP |

## APIs de integrações

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/integrations/instagram/connect` | `POST` | Inicia OAuth Instagram |
| `/api/integrations/instagram/callback` | `GET` | Callback OAuth Instagram |
| `/api/integrations/instagram/refresh` | `POST` | Refresca token Instagram |
| `/api/integrations/instagram/disconnect` | `POST` | Desconecta Instagram |
| `/api/integrations/instagram/sync` | `POST` | Sincroniza métricas Instagram (rate-limited) |
| `/api/integrations/tiktok/connect` | `POST` | Inicia OAuth TikTok |
| `/api/integrations/tiktok/callback` | `GET` | Callback OAuth TikTok |
| `/api/integrations/tiktok/refresh` | `POST` | Refresca token TikTok |
| `/api/integrations/tiktok/disconnect` | `POST` | Desconecta TikTok |
| `/api/integrations/tiktok/sync` | `POST` | Sincroniza métricas TikTok (rate-limited) |

## APIs de webhooks

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/webhooks/instagram` | `GET/POST` | Webhook Instagram (challenge + eventos) |
| `/api/webhooks/tiktok` | `GET/POST` | Webhook TikTok |
| `/api/webhooks/publishing` | `GET/POST` | Webhook de publicação (idempotente) |

Todas com rate-limit + payload sanitizado (sem tokens/secrets).

## APIs de publicação

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/publishing` | `GET/POST` | Central de publicação (fila) |
| `/api/publishing/logs` | `GET` | Logs de publicação |

## APIs de IA

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/ai/chat` | `POST` | Chat IA (rate-limited) |
| `/api/ai/conversations` | `GET/POST` | Conversas IA |
| `/api/ai/conversations/[id]` | `GET/PATCH/DELETE` | Conversa IA individual |
| `/api/ai/generate-copy` | `POST` | Geração de copy (rate-limited) |
| `/api/ai/generate-ideas` | `POST` | Geração de ideias (rate-limited) |

## APIs de conteúdo e planejamento

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/ideas` | `GET/POST` | Central de ideias |
| `/api/copy` | `GET/POST` | Geração de copy |
| `/api/drafts` | `GET/POST` | Rascunhos |
| `/api/calendar` | `GET/POST` | Calendário |
| `/api/calendar/detail` | `GET` | Detalhe de item |
| `/api/calendar/duplicate` | `POST` | Duplicar item |
| `/api/calendar/experiments` | `GET` | Experimentos no calendário |
| `/api/calendar/schedule-from-draft` | `POST` | Agendar a partir de rascunho |
| `/api/calendar/weekly-plan` | `GET/POST` | Plano semanal |
| `/api/calendar/copy-versions` | `GET/POST` | Versões de copy |
| `/api/calendar/copy-versions/restore` | `POST` | Restaurar versão |

## APIs do Growth Engine

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/growth/engine` | `GET` | Pipeline completo do motor |
| `/api/growth/actions` | `GET/PATCH` | Ações de crescimento |
| `/api/growth/alertas` | `GET` | Alertas |

## APIs de análise, score e rank

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/analise` | `GET` | Análise de desempenho |
| `/api/diagnostico` | `GET` | Diagnóstico |
| `/api/score` | `GET` | Score inteligente |
| `/api/rank` | `GET` | Ranking |
| `/api/rank/acoes` | `GET` | Ações de rank |
| `/api/rank/conquistas` | `GET` | Conquistas |
| `/api/rank/metas` | `GET/POST` | Metas |

## APIs do Knowledge Engine

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/alertas` | `GET` | Alertas do knowledge engine |
| `/api/experimentos` | `GET/POST` | Experimentos |
| `/api/padroes` | `GET` | Padrões/baseline |
| `/api/baseline` | `GET/POST` | Baseline individual |

## APIs de automações

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/automations` | `GET/POST` | Regras de automação |
| `/api/mentoria` | `GET/POST` | Mentoria |
| `/api/analise` | `GET` | Análise |

## APIs de billing

| Rota | Métodos | Finalidade |
|---|---|---|
| `/api/billing/plans` | `GET` | Planos oficiais |
| `/api/billing/checkout` | `POST` | Checkout (Asaas — fase futura) |
| `/api/billing/subscription` | `GET/PATCH` | Assinatura do usuário |

## Convenções de segurança

- Rotas mutáveis (`POST/PATCH/PUT/DELETE`) exigem sessão + `requireSession()`.
- Toda consulta por recurso é owner-checked (`userId` da sessão).
- Validações de corpo usam Zod (`src/lib/validators/`).
- Rate-limit aplicado em auth/register, sincronizações, IA, webhooks.
- Nenhuma rota de webhook/health expõe tokens ou segredos.
