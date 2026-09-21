# Inst Acessor — App Review Meta (Instagram)

> Documento de submissão para a revisão de aplicativo (App Review) da **Meta for Developers**
> (Graph API do Instagram). Mantenha este arquivo atualizado.

---

## 1. Informações do aplicativo

| Campo | Valor |
| --- | --- |
| Nome do app | Inst Acessor |
| Plataforma | Web (SaaS) |
| Domínio oficial | `https://unitrixapp.com.br` (`OFFICIAL_SITE_URL` em `src/lib/config/site.ts`) |
| URL de login | `https://unitrixapp.com.br/login` |
| URL de callback | `https://unitrixapp.com.br/api/integrations/instagram/callback` |
| URL de privacidade | `https://unitrixapp.com.br/privacidade` — **página a criar** (ver 7) |
| Termos de serviço | `https://unitrixapp.com.br/termos` — **página a criar** (ver 7) |
| Modelo de negócio | SaaS de análise e crescimento de perfis no Instagram e TikTok |

## 2. Permissões solicitadas

Os escopos efetivamente pedidos no OAuth estão declarados em
`src/lib/integrations/instagram/oauth.ts` (`INSTAGRAM_DEFAULT_SCOPES`) e podem
ser sobrescritos por `INSTAGRAM_SCOPES`.

| Permissão | Uso no produto | Chamada real que a justifica |
| --- | --- | --- |
| `instagram_business_basic` | Ler o perfil profissional e a lista de publicações | `GET /me`, `GET /{ig-user-id}`, `GET /{ig-user-id}/media` |
| `instagram_business_manage_insights` | Métricas de conta e de cada publicação exibidas no Dashboard e nos Insights da publicação | `GET /{ig-user-id}/insights`, `GET /{ig-media-id}/insights` |
| `instagram_business_manage_comments` | Ler os comentários recebidos e responder publicamente (Respostas Inteligentes) | `GET /{ig-media-id}/comments`, `POST /{ig-comment-id}/replies` |
| `instagram_business_content_publish` | Publicar o conteúdo que o próprio usuário montou e confirmou na Central de Publicação | `POST /{ig-user-id}/media`, `POST /{ig-user-id}/media_publish`, `GET /{container-id}` |
| `instagram_business_manage_messages` | **Não usado. Este escopo NÃO deve ser solicitado.** (ver 2.1) | — |

### 2.1 Por que `instagram_business_manage_messages` deve ser REMOVIDO do pedido

O escopo continua declarado em `INSTAGRAM_DEFAULT_SCOPES`, mas **não existe
nenhuma chamada** de mensagem direta no código. A varredura por
`conversations`, `/{ig-user-id}/messages`, `private_replies`, `messaging_*` e
`recipient` não encontra nenhuma requisição à Graph API.

A Meta recusa permissões sem caso de uso demonstrável. Pedir
`instagram_business_manage_messages` sem uso é motivo de rejeição **e** amplia
desnecessariamente o escopo de dados pedidos ao usuário. A recomendação é
remover a linha de `INSTAGRAM_DEFAULT_SCOPES` antes de submeter. O recurso
"Comentário → Direct" existe como núcleo puro (`src/lib/comment-direct/`), mas
está deliberadamente **desligado** e não importado por nenhum módulo — não
serve como justificativa de escopo.

### Produtos da Meta usados

- **Instagram Graph API** (perfis profissionais Business/Creator).
- **Instagram Business Login** (OAuth 2.0) — hosts `api.instagram.com`
  (troca de `code`) e `graph.instagram.com` (dados, insights, comentários,
  publicação). O app **não** usa Facebook Login nem `graph.facebook.com`.
- **Webhooks do Instagram** (`comments`) com callback assinado
  (`X-Hub-Signature-256`), em `src/app/api/webhooks/instagram/route.ts`.

## 3. Caso de uso

### 3.1 O que o produto faz

O Inst Acessor conecta o perfil profissional do usuário no Instagram e apresenta métricas de
crescimento em um dashboard:

- **Visão geral** — seguidores, engajamento, alcance, impressões, visitas ao perfil, publicações.
- **Evolução** — histórico 7/30/90 dias a partir de snapshots temporais.
- **Comparação de períodos** — crescimento semanal e mensal de seguidores.
- **Score Inteligente** — pontuação derivada apenas de dados reais.
- **Melhores momentos** — melhor dia de alcance, maior ganho diário, pico de seguidores.

### 3.2 Fluxo do usuário

1. O usuário clica em **"Conectar Instagram"** na página *Redes Sociais*.
2. É redirecionado ao fluxo OAuth oficial da Meta.
3. Conecta com uma conta **profissional** (Business ou Creator).
4. Autoriza as permissões de leitura de métricas.
5. Retorna ao app; o Inst Acessor armazena o token **criptografado** no servidor.
6. O usuário sincroniza as métricas e acompanha no dashboard.

### 3.3 Por que a permissão é necessária

- `instagram_business_basic` — **obrigatória** para qualquer leitura de dados do perfil profissional
  via Instagram Graph API (seguidores, mídia, alcance, impressões).

### 3.4 O que o app NÃO faz

- Não segue nem deixa de seguir contas.
- Não acessa dados de outras contas — toda consulta é filtrada pelo `userId`
  da sessão autenticada.
- Não envia mensagens diretas (DMs). Nenhuma chamada de mensagem existe no
  código.
- Não define preço, promoção ou mídia sem confirmação explícita do usuário.

### 3.5 Publicação e comentários — o que o app FAZ

A versão anterior deste documento afirmava que o app não publicava e não
comentava. Isso deixou de ser verdade: os dois módulos existem e fazem
chamadas reais.

**Publicação** (`src/lib/publishing/instagram/index.ts`) — sempre iniciada por
uma ação humana:

1. O usuário monta e confirma o conteúdo na Central de Publicação.
2. `POST /{ig-user-id}/media` cria o container; `GET /{container-id}` acompanha
   o processamento.
3. `POST /{ig-user-id}/media_publish` publica.
4. O app **nunca** publica por tempo sem confirmação — a própria tela informa
   isso ("Nada é publicado por tempo — sempre com confirmação real").

**Comentários** (`src/lib/comment-replies/instagram-comments.ts`):

- `GET /{ig-media-id}/comments` — leitura. Roda no sync manual ("Sincronizar
  agora") e no webhook assinado.
- `POST /{ig-comment-id}/replies` — resposta pública. Só é enviada **depois de
  aprovação humana** na tela de Respostas Inteligentes
  (`/api/comment-replies/approve`). Não há resposta automática sem aprovação.

## 4. Fluxo de dados

```
Instagram (Graph API — Meta)
   │
   │  OAuth 2.0 (Login da Meta)
   ▼
Inst Acessor (servidor)
   │
   ├── Token criptografado (AES-256-GCM)  → banco (Neon)
   ├── Métricas normalizadas              → banco (snapshots)
   │
   ▼
Dashboard (somente leitura, dados do próprio usuário)
```

### 4.1 Segurança de credenciais

| Item | Garantia |
| --- | --- |
| App Secret | **Somente no servidor**. Nunca `NEXT_PUBLIC_*`. Nunca enviado ao frontend. |
| Access token | Criptografado com AES-256-GCM (`TOKEN_ENCRYPTION_KEY`). Nunca em texto puro. |
| Logs | Nenhum token ou secret é logado. |
| URLs finais | Nenhum token aparece na URL de retorno. |
| Acesso a dados | Toda consulta é limitada ao `userId` da sessão autenticada. |

## 5. Capturas de tela (sugeridas para submissão)

Ao submeter no painel da Meta, inclua uma captura para **cada** permissão
pedida — é o que a revisão procura:

1. Página **Redes Sociais** — botão "Conectar Instagram".
2. Tela de autorização do Login da Meta (com as permissões listadas).
3. **Dashboard** com métricas reais do Instagram conectado → *manage_insights*.
4. **Insights da publicação** (modal aberto a partir da lista de publicações em
   Respostas Inteligentes) → *manage_insights* + *basic*.
5. **Respostas Inteligentes** — lista de comentários recebidos e o botão de
   aprovar resposta → *manage_comments*.
6. **Central de Publicação** — conteúdo com confirmação de publicação →
   *content_publish*.
7. Fluxo de **desconexão** (botão "Desconectar").

> As capturas devem usar dados reais, com conta de teste do próprio
> desenvolvedor. Nunca envie capturas com dados fictícios para a revisão.

## 6. Conta de teste (sugestão)

Crie uma **conta profissional de teste** no Instagram (Business/Creator) para a equipe de revisão:

- E-mail de teste dedicado (ex.: `review@instacessor.com`).
- Perfil público com algumas publicações.
- Sem dados pessoais sensíveis no perfil.

## 7. Checklist antes de submeter

**Bloqueadores confirmados no código (resolver antes de submeter):**

- [ ] **Criar `/termos`** — a landing já linka `/termos` em
      `src/components/landing/sections-d.tsx`, mas a rota **não existe**.
- [ ] **Criar `/privacidade`** — mesma situação: linkada, rota inexistente.
- [ ] **Criar `/data-deletion`** — linkada no rodapé como "Exclusão de dados".
- [ ] **Remover `instagram_business_manage_messages`** de
      `INSTAGRAM_DEFAULT_SCOPES` (`src/lib/integrations/instagram/oauth.ts`) —
      escopo pedido sem nenhuma chamada correspondente.

**Itens já corretos no código:**

- [x] App Secret apenas no servidor (`getMetaCredentials`; nunca
      `NEXT_PUBLIC_*`).
- [x] Token criptografado no banco (AES-256-GCM).
- [x] URL de callback funcional:
      `/api/integrations/instagram/callback`.
- [x] Webhook com verificação de assinatura (`X-Hub-Signature-256`).
- [x] Consultas limitadas ao `userId` da sessão.
- [x] Ausência de métrica é `null` na origem — nunca `0` inventado.

**Itens que dependem de configuração no painel da Meta (não do código):**

- [ ] Permissões `basic`, `manage_insights`, `manage_comments` e
      `content_publish` concedidas/habilitadas no painel.
- [ ] URL de callback e de webhook cadastradas no painel.
- [ ] Capturas de tela reais (seção 5).
- [ ] Conta de teste profissional pronta (seção 6).
- [ ] Página de privacidade e termos publicados **e** informados no painel.

## 8. Anexo — ponto exato de cada chamada

Referência para preencher o formulário de App Review. Host único de dados:
`https://graph.instagram.com/{versão}` (`INSTAGRAM_GRAPH_BASE`).

| Chamada | Onde está no código | O que o usuário faz para disparar |
| --- | --- | --- |
| `GET /me` | `integrations/instagram/metrics.ts:47` | Clicar em **Sincronizar agora** (Redes Sociais) ou conectar a conta |
| `GET /{ig-user-id}` | `metrics.ts:87` | idem |
| `GET /{ig-user-id}/insights` | `metrics.ts:140` | idem — alimenta o Dashboard |
| `GET /{ig-user-id}/media` (paginado) | `metrics.ts:192` | idem |
| `GET /{ig-media-id}/insights` | `metrics.ts:249` | idem — últimas 25 publicações |
| `GET /{ig-media-id}/comments` | `metrics.ts:320`, `instagram-comments.ts:230` | Sincronizar agora, ou receber o webhook de comentário |
| `POST /{ig-comment-id}/replies` | `instagram-comments.ts:286` | Clicar em **Aprovar** em Respostas Inteligentes |
| `POST /{ig-user-id}/media` | `publishing/instagram/index.ts:63,74` | Confirmar publicação na Central de Publicação |
| `GET /{container-id}` | `publishing/instagram/index.ts:65` | idem (acompanha o processamento) |
| `POST /{ig-user-id}/media_publish` | `publishing/instagram/index.ts:64,79` | idem |
| `GET access_token` / `refresh_access_token` | `integrations/instagram/oauth.ts:39,47` | Conectar a conta / renovação de token |

Nenhum token ou secret aparece em URL de retorno, log ou resposta ao cliente
(seção 4.1). O `X-App-Usage` é lido apenas para diagnóstico e não é persistido.
