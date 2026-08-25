# Relatório — Fase 3.5 · TikTok / Integração Multiplataforma

> **Projeto:** Inst Acessor — SaaS de crescimento para Instagram e TikTok
> **Data:** 2026-08-25
> **Status:** Implementação completa · Pendente validação local (sandbox indisponível)

---

## 1. Resumo

A Fase 3.5 adicionou o **TikTok** como segunda plataforma conectável, com o mesmo padrão
arquitetural do Instagram (camada de serviço isolada, OAuth seguro, sync com cooldown,
dashboard orientado a dados reais). O dashboard agora possui um **seletor de plataforma**
(Instagram | TikTok) e a página **Redes Sociais** exibe os dois cartões de conexão.

**Regra preservada:** nenhum número é inventado. Valores indisponíveis → `null`/`—`.
**Identidade visual:** nenhuma cor, gradiente, tipografia ou sombra alterada.
**Segurança:** tokens criptografados; Client Secret só no servidor; nenhum token em logs/URLs.

---

## 2. O que foi entregue

### 2.1 Modelos (Prisma)

| Modelo | Finalidade |
| --- | --- |
| `TikTokProfile` | Perfil da conta conectada (username, displayName, avatar, followers, following, likes, videos, bio) |
| `TikTokSnapshot` | Estado temporal por sincronização (followers, following, videos, likes, views, profileViews) |
| `TikTokVideo` | Vídeos autorizados com métricas (likes, comments, shares, playCount) |
| `OAuthState.codeVerifier` | Suporte a PKCE (obrigatório no OAuth do TikTok) |

### 2.2 Camada de serviço — `src/lib/integrations/tiktok/`

| Arquivo | Responsabilidade |
| --- | --- |
| `types.ts` | Tipos refletindo APENAS os campos reais da API |
| `client.ts` | HTTP com timeout, retries (429/5xx/network), credenciais server-only |
| `errors.ts` | Classificação central de erros + mensagens amigáveis (sem segredos) |
| `oauth.ts` | PKCE (createPkce), URL de autorização, troca de code por token, refresh |
| `metrics.ts` | `getTikTokUser`, `getTikTokVideos`, `collectTikTokData` (degradação graciosa) |
| `sync.ts` | `syncTikTok` — upsert perfil, snapshot, vídeos, SyncLog, cooldown 60s |
| `index.ts` | Barrel — exporta types, errors, oauth, client, metrics, sync |

### 2.3 API routes — `src/app/api/integrations/tiktok/`

| Rota | Método | Descrição |
| --- | --- | --- |
| `/connect` | GET | Inicia OAuth (state + PKCE), persiste `OAuthState`, redireciona |
| `/callback` | GET | Valida state + codeVerifier, troca code por token, persiste encriptado |
| `/sync` | POST | Sincroniza métricas (cooldown 60s) |
| `/disconnect` | POST | Desconecta (invalida token, mantém histórico) |
| `/refresh` | POST | Renova token via refresh token |

### 2.4 Webhook — `src/app/api/webhooks/tiktok/route.ts`

- `GET` → valida desafio (`echostr` + `token`).
- `POST` → valida estrutura (`event` presente) e responde `200`.
- **Não habilitar URL no portal até estar pronto para receber eventos reais.**

### 2.5 Dashboard multiplataforma

| Arquivo | Descrição |
| --- | --- |
| `src/lib/dashboard/tiktok-data.ts` | Leitura server-side de snapshots TikTok (nunca chama API) |
| `src/components/dashboard/platform-selector.tsx` | Seletor Instagram/TikTok (pill, visual da apresentação) |
| `src/components/dashboard/dashboard-client.tsx` | Gerencia o seletor e renderiza a grade ativa |
| `src/components/dashboard/tiktok-metric-grid.tsx` | Cards, comparação, timeline e evolução TikTok |
| `src/components/dashboard/evolution-chart.tsx` | Gráfico SVG nativo, agora genérico (IG + TikTok) |
| `src/components/dashboard/sync-metrics-button.tsx` | Botão de sync parametrizado por plataforma |

### 2.6 Página Redes Sociais — `src/app/(app)/redes-sociais/page.tsx`

- Dois cartões (Instagram e TikTok) com status, dados e ações.
- Ações TikTok: Conectar / Atualizar conexão / Atualizar métricas / Trocar conta / Desconectar.
- Texto e tratamento de erros específicos por plataforma.

---

## 3. Decisões técnicas

1. **Token no formato `access|||refresh`** encriptado junto — suporta renovação sem novo
   schema (o refresh route separa no `|||`).
2. **PKCE obrigatório** — o TikTok exige `code_challenge`/`code_verifier`; persistido em
   `OAuthState.codeVerifier` e consumido no callback.
3. **Cooldown de 60s** — evita snapshots duplicados e respeita limites da API.
4. **Degradação graciosa nos vídeos** — se `video.list` falhar, o sync de perfil continua
   (vídeos ficam vazios, não derrubam o perfil).
5. **Dashboard nunca chama a API** — lê apenas snapshots do banco (rápido, sem rate-limit).
6. **Gráfico genérico** — `EvolutionChart` aceita pontos IG e TikTok com chave de métrica comum.

---

## 4. Segurança

| Regra | Status |
| --- | --- |
| Token criptografado (AES-256-GCM) | ✅ |
| Client Secret nunca no frontend | ✅ |
| Nenhum `NEXT_PUBLIC_TIKTOK_CLIENT_SECRET` | ✅ |
| Nenhum token em logs | ✅ |
| Nenhum token na URL final | ✅ |
| Dados sempre limitados ao `userId` da sessão | ✅ |
| State single-use + expiração (10 min) | ✅ |
| `SyncLog` sem dados sensíveis | ✅ |

---

## 5. Arquivos criados/modificados

### Criados
- `prisma/schema.prisma` (modelos TikTok + `OAuthState.codeVerifier`)
- `.env.example` (variáveis TikTok)
- `src/lib/integrations/tiktok/` (types, client, errors, oauth, metrics, sync, index)
- `src/app/api/integrations/tiktok/` (connect, callback, sync, disconnect, refresh)
- `src/app/api/webhooks/tiktok/route.ts`
- `src/lib/dashboard/tiktok-data.ts`
- `src/components/dashboard/platform-selector.tsx`
- `src/components/dashboard/dashboard-client.tsx`
- `src/components/dashboard/tiktok-metric-grid.tsx`
- `src/components/integrations/tiktok-actions.tsx`
- `docs/APP-REVIEW-TIKTOK.md`
- `docs/APP-REVIEW-INSTAGRAM.md`

### Modificados
- `src/app/(app)/dashboard/page.tsx` — busca dados IG + TikTok, badges, ações, `DashboardClient`
- `src/app/(app)/redes-sociais/page.tsx` — dois cartões de conexão
- `src/components/dashboard/evolution-chart.tsx` — suporte a dois tipos de ponto
- `src/components/dashboard/sync-metrics-button.tsx` — parametrizado por plataforma
- `src/components/ui/metric-card.tsx` — `emptyMessage` configurável
- `src/lib/dashboard/instagram-data.ts` — type guard real (`connection` não-nulo)

---

## 6. Validação pendente (executar localmente)

> O sandbox (VM Linux) esteve indisponível durante a sessão. A DONA deve rodar:

```bash
npm install
npx prisma generate          # gera o client com os novos modelos TikTok
npx prisma db push           # aplica schema no Neon
npx tsc --noEmit             # typecheck
npm run build                # build de produção
```

### Checklist
- [ ] `npx prisma generate` sem erros
- [ ] `npx tsc --noEmit` limpo
- [ ] `npm run build` OK
- [ ] Fluxo OAuth TikTok (connect → authorize → callback)
- [ ] Sync TikTok gera snapshot + perfil + vídeos
- [ ] Dashboard alterna entre Instagram e TikTok
- [ ] Desconexão TikTok limpa token, mantém histórico

---

## 7. Documentos de App Review

| Documento | Finalidade |
| --- | --- |
| `docs/APP-REVIEW-TIKTOK.md` | Submissão TikTok for Developers (escopos, caso de uso, segurança) |
| `docs/APP-REVIEW-INSTAGRAM.md` | Submissão Meta for Developers (permissões, caso de uso) |

Ambos cobrem: escopos/permissões, o que o app faz e NÃO faz, fluxo de dados, segurança
de credenciais, capturas sugeridas, conta de teste e checklist pré-submissão.

---

## 8. Próximos passos (quando autorizado)

> **Instrução do usuário:** "NÃO avance para Fase 4."

Após validação local e push da DONA, a Fase 3.5 estará completa. Nenhuma nova fase deve
ser iniciada sem autorização explícita.
