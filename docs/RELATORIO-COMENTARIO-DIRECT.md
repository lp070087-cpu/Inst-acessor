# Inst Acessor — Automação Comentário → Direct

> **Status desta rodada: ANÁLISE + ARQUITETURA + FUNDAÇÃO MÍNIMA.**
> Nada de envio automático real para o Direct foi habilitado.
> Nenhum segundo OAuth foi criado. Nenhuma migração de banco foi aplicada.

---

## 0. Por que este documento existe

O Inst Acessor já tem **Respostas Inteligentes** (comentário → resposta **pública** no
comentário) e agora precisa de uma função **diferente**: comentário → **mensagem privada
no Direct**.

São dois produtos distintos, com permissões, endpoints e riscos distintos. Este
documento separa os dois de forma explícita para que ninguém tente implementar um
reaproveitando o outro por engano.

---

## 1. Respostas Inteligentes ≠ Comentário → Direct

| | **Respostas Inteligentes** (existe hoje) | **Comentário → Direct** (esta proposta) |
| --- | --- | --- |
| Gatilho | Qualquer comentário elegível | Comentário que **casa com um gatilho** configurado |
| Interpretação | IA classifica o comentário (emoji, elogio, dúvida…) e gera uma resposta | **Não usa IA para decidir.** Compara o texto com uma regra determinística |
| Resultado | Texto **público** no próprio comentário | **Mensagem privada** no Direct da pessoa |
| Endpoint Meta | `POST /{comment-id}/replies` | `POST /{ig-user-id}/messages` com `recipient.comment_id` |
| Permissão | `instagram_business_manage_comments` | `instagram_business_manage_messages` |
| Idempotência | `CommentReplyLog` `@@unique([mediaId, commentId])` | `CommentDirectLog` `@@unique([mediaId, commentId])` (proposto) |
| Objetivo de negócio | Conversa pública, reputação, atendimento visível | **Captura de lead** — leva a conversa para o privado |

Os dois **coexistem**: um mesmo comentário pode receber a resposta pública e,
em paralelo, disparar a mensagem privada. Nada do que existe hoje é substituído.

---

## 2. O que NÃO será feito (limites desta rodada)

- **Nenhum segundo OAuth.** A automação reutiliza a `SocialConnection` do Instagram já
  existente e o token criptografado atual (`decryptToken` / `TOKEN_ENCRYPTION_KEY`).
- **Nenhum pedido para reconectar o Instagram.** Se faltar permissão, o sistema informa
  a pendência — não altera o OAuth silenciosamente.
- **Nenhum envio real para o Direct em produção nesta rodada.**
- **Nenhuma migração de banco aplicada.** Os models abaixo são proposta; a migração é
  aditiva e só entra depois de aprovada (mesmo padrão das Fases 2–6 do Hub).
- **Nenhuma alteração** em `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
  `INSTAGRAM_REDIRECT_URI`, callback, refresh, `SocialConnection`, `TOKEN_ENCRYPTION_KEY`
  ou nos helpers do Instagram.

---

## 3. Gatilhos suportados (determinísticos)

Os quatro gatilhos pedidos, na ordem de precisão:

| # | Tipo | Regra | Exemplo |
| --- | --- | --- | --- |
| 1 | `EXACT_WORD` | O comentário, normalizado, é **exatamente** a palavra | `"QUERO"` → casa com `quero` |
| 2 | `ANY_OF_LIST` | O comentário **é uma** de uma lista de palavras | `QUERO` · `LINK` · `MANDA` |
| 3 | `CONTAINS_TEXT` | O comentário **contém** a expressão em qualquer posição | `"quero saber mais"` |
| 4 | `ANY_COMMENT` | Qualquer comentário elegível (sem filtro de texto) | — |

**Normalização** (aplicada ao comentário e ao termo configurado, sempre nos dois lados):
minúsculas, remoção de acentos, colapso de espaços, remoção de pontuação de borda.
Assim `QUERO!`, `quero` e `Quero.` casam entre si.

> **Decisão de engenharia:** o casamento é **determinístico e auditável**, não
> probabilístico. A IA pode gerar o **texto** da mensagem, mas **nunca** decide se um
> comentário dispara ou não. Isso mantém a automação previsível e defensável perante a
> Meta e perante o usuário.

Fundação já implementada nesta rodada: `src/lib/comment-direct/triggers.ts`
(funções puras, sem I/O, sem Prisma, sem dependência de permissão da Meta).

---

## 4. Fluxo completo (arquitetura)

```
Comentário feito no Instagram
        │
        ▼
Webhook da Meta  →  POST /api/webhooks/instagram
        │           (campo "comments" assinado no painel da Meta)
        │
        ▼  1. valida assinatura X-Hub-Signature-256 (App Secret, só no servidor)
        │  2. extrai { igUserId, mediaId, commentId, commenterId, text }
        ▼
Resolve a conta  →  SocialConnection (platform="instagram", externalAccountId = igUserId)
        │           NENHUM OAuth novo; a conexão existente é a chave de correlação
        ▼
Busca regras ativas  →  CommentDirectRule (userId + mediaId ou "todas as publicações")
        │
        ▼
Casa o gatilho  →  matchesTrigger(rule, commentText)   [função pura]
        │
        ├── não casou → registra SKIPPED e encerra (sem custo de API)
        ▼
Confere idempotência  →  CommentDirectLog @@unique([mediaId, commentId])
        │                   já existe? → DUPLICATE, encerra
        │                   limite diário da regra atingido? → SKIPPED (LIMIT)
        ▼
Confere permissão  →  token atual tem instagram_business_manage_messages?
        │               não tem → registra BLOCKED + informa a pendência (NÃO envia)
        ▼
Envia a mensagem privada  →  POST /{ig-user-id}/messages
        │                       { recipient: { comment_id }, message: { text } }
        ▼
Registra o resultado  →  CommentDirectLog (SENT | ERROR | BLOCKED) + resposta JSON
        │
        ▼
Responde 200 à Meta (sempre, para não gerar reentrega em cascata)
```

### 4.1 Regra de ouro (mesma do billing)

Um evento de webhook **não é prova de nada por si só**. O envio só acontece depois de:
(a) a regra existir e estar ativa; (b) o gatilho casar; (c) a idempotência liberar;
(d) a permissão existir. Falhando qualquer etapa, **nada é enviado** e o motivo fica
registrado.

---

## 5. Models necessários (proposta — NÃO aplicada)

Dois models, **100% aditivos**, sem tocar em nenhum model existente.

### 5.1 `CommentDirectRule` — a configuração

| Campo | Tipo | Papel |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | — |
| `userId` | `String` | Dono (FK → `User`, `onDelete: Cascade`) |
| `name` | `String` | Nome dado pelo usuário à automação |
| `enabled` | `Boolean @default(false)` | **Nasce desligada** — nunca dispara sem o usuário ativar |
| `platform` | `String @default("instagram")` | Reserva para futuro |
| `mediaId` | `String?` | Publicação/Reel alvo. `null` = todas as publicações |
| `mediaCaption` | `String?` | Só para exibir na UI (evita chamar a API) |
| `triggerType` | `String` | `EXACT_WORD` · `ANY_OF_LIST` · `CONTAINS_TEXT` · `ANY_COMMENT` |
| `triggerTerms` | `String[]` | Termos do gatilho (vazio quando `ANY_COMMENT`) |
| `messageText` | `String` | Texto enviado no Direct |
| `dailyLimit` | `Int @default(50)` | Teto de envios/dia por regra |
| `pausedUntil` | `DateTime?` | Pausa temporária sem desligar a regra |
| `onePerUser` | `Boolean @default(true)` | No máximo uma mensagem por pessoa |
| `createdAt` / `updatedAt` | `DateTime` | — |

Índice: `@@index([userId, enabled])`.

### 5.2 `CommentDirectLog` — histórico + idempotência

| Campo | Tipo | Papel |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | — |
| `userId` | `String` | FK → `User` |
| `ruleId` | `String?` | FK → `CommentDirectRule`, `onDelete: SetNull` |
| `socialConnectionId` | `String` | FK → `SocialConnection` (mesma conexão, sem OAuth novo) |
| `mediaId` | `String` | Publicação |
| `commentId` | `String` | **Unique junto com `mediaId`** — o coração da idempotência |
| `commenterId` | `String?` | ID do autor do comentário (para o `onePerUser`) |
| `commenterUsername` | `String?` | Só exibição |
| `originalComment` | `String` | Texto que disparou |
| `matchedTrigger` | `String?` | Qual termo casou (auditoria) |
| `sentMessage` | `String?` | Texto efetivamente enviado |
| `status` | `String @default("PENDING")` | `PENDING` · `SENT` · `SKIPPED` · `BLOCKED` · `DUPLICATE` · `ERROR` |
| `reason` | `String?` | Motivo exato quando não é `SENT` |
| `externalMessageId` | `String?` | ID da mensagem no Instagram |
| `createdAt` | `DateTime @default(now())` | — |
| `sentAt` | `DateTime?` | — |

Índices/constraints:
`@@unique([mediaId, commentId])` · `@@index([userId, status])` · `@@index([userId, createdAt])`.

> `@@unique([mediaId, commentId])` é o que garante **uma mensagem por comentário** mesmo
> com reentrega do webhook pela Meta (que é o comportamento normal dela).

---

## 6. Endpoints necessários (proposta)

| Método | Rota | Papel |
| --- | --- | --- |
| `GET` | `/api/webhooks/instagram` | **Já existe.** Verificação do challenge da Meta |
| `POST` | `/api/webhooks/instagram` | **Já existe** (estrutural). Passaria a interpretar eventos de comentário |
| `GET` | `/api/ai/comment-direct/rules` | Lista as regras do usuário |
| `POST` | `/api/ai/comment-direct/rules` | Cria regra (nasce `enabled:false`) |
| `PATCH` | `/api/ai/comment-direct/rules/[id]` | Edita / ativa / pausa |
| `DELETE` | `/api/ai/comment-direct/rules/[id]` | Remove (owner-check) |
| `GET` | `/api/ai/comment-direct/logs` | Histórico de disparos com motivo |
| `POST` | `/api/ai/comment-direct/test` | **Simulação**: casa o gatilho contra um texto e devolve o que aconteceria — **sem enviar nada** |
| `GET` | `/api/ai/comment-direct/status` | Permissões reais da conexão + se o webhook está assinado |

Todas as rotas de configuração usam `withAuth`/sessão e **owner-check** por `userId`,
seguindo o padrão já usado no resto do app. Nenhuma rota expõe token.

---

## 7. Permissões da Meta — o que falta

### 7.1 Situação das permissões já pedidas no OAuth atual

O OAuth atual (`src/lib/integrations/instagram/oauth.ts`) **já solicita** as duas
permissões necessárias:

```
instagram_business_basic
instagram_business_manage_comments   ← ler/receber comentários
instagram_business_manage_messages   ← enviar mensagem privada (Direct)
instagram_business_manage_insights
instagram_business_content_publish
```

Ou seja: **não é preciso um segundo OAuth nem pedir para o usuário reconectar** para que
o *pedido* de permissão já esteja correto. O que falta é a **concessão efetiva** pela Meta.

### 7.2 Tabela de pendências (formato solicitado)

| Permissão | Finalidade | Onde habilitar | Precisa de Advanced Access / App Review? |
| --- | --- | --- | --- |
| `instagram_business_manage_messages` | Enviar a **mensagem privada** no Direct em resposta a um comentário (`POST /{ig-user-id}/messages` com `recipient.comment_id`). Sem ela, a Meta recusa o envio. | Meta for Developers → **App Dashboard** → *App Review* → *Permissions and Features* → localizar a permissão e solicitar. | **Sim.** Standard Access só funciona para contas com papel no app (admins/testadores). Para atender clientes reais é obrigatório **Advanced Access**, via **App Review** com vídeo de demonstração e justificativa de uso. |
| `instagram_business_manage_comments` | **Receber** o evento de comentário pelo webhook e ler o texto que dispara o gatilho. Já usado pelas Respostas Inteligentes. | Meta for Developers → **App Dashboard** → *App Review* → *Permissions and Features*. | **Sim.** Mesma regra: Advanced Access para uso com o público em geral. |
| Assinatura de webhook: campo `comments` | Fazer a Meta **entregar** os eventos de comentário para `POST /api/webhooks/instagram`. Sem essa assinatura o sistema nunca é avisado de que houve comentário. | Meta for Developers → **App Dashboard** → *Webhooks* → objeto *Instagram* → assinar o campo **`comments`**. | Não é App Review, mas **exige o webhook publicado e validado** (challenge respondido e assinatura `X-Hub-Signature-256` conferida). |
| Assinatura de webhook: campo `messages` | Receber eventos de mensagem (útil para parar de responder quando a pessoa já respondeu no privado). Opcional para o gatilho, recomendado para não incomodar. | Mesma tela (*Webhooks* → objeto *Instagram* → campo **`messages`**). | Idem acima. |

### 7.3 Detalhe operacional que muda o comportamento do produto

A Meta permite **uma única resposta privada por comentário**, dentro de uma janela de
tempo limitada após o comentário (a janela de 7 dias é a prática documentada para
`private_replies`). Consequências de projeto:

- **É uma tacada só por comentário.** Por isso a idempotência é obrigatória, não opcional.
- A mensagem privada deve ser autoexplicativa, porque não haverá segunda chance naquele comentário.
- Depois que a pessoa responde no Direct, a conversa passa a seguir as regras normais de
  messaging (janela de 24 h), que são **outro** produto — fora do escopo desta rodada.

> **Ressalva honesta:** o nome exato dos campos do endpoint de resposta privada e o valor
> atual da janela **não puderam ser conferidos na documentação oficial** nesta rodada (o
> ambiente de execução estava indisponível). A arquitetura acima está correta nos
> fundamentos, mas os **nomes de campo devem ser confirmados contra a versão da Graph API
> em uso** antes de ligar o envio real — exatamente o mesmo cuidado que já foi tomado no
> `types.ts` do Asaas.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação adotada no desenho |
| --- | --- | --- |
| Enviar duas vezes para o mesmo comentário | O usuário parece spam; a Meta pode penalizar | `@@unique([mediaId, commentId])` + status `DUPLICATE`. A unicidade é do **banco**, não da aplicação |
| Reentrega do webhook pela Meta | Disparo repetido | Mesma constraint; o webhook sempre devolve 200 |
| Webhook sem validação de assinatura | Qualquer um poderia forjar um comentário | Exigir `X-Hub-Signature-256` com o App Secret (só no servidor) **antes** de processar |
| Gatilho frouxo (`ANY_COMMENT`) em conta grande | Volume alto, Direct lotado, risco de bloqueio | `dailyLimit` por regra + `pausedUntil` + `onePerUser` + regra nasce **desligada** |
| Permissão ausente ou revogada | Falha silenciosa ou erro genérico | Erro **tipado** com motivo real (padrão já usado em `CommentCapabilityError`) e status `BLOCKED` |
| Confundir com Respostas Inteligentes | Usuário acha que respondeu em público quando respondeu no privado | São telas, models e logs **separados**; a UI deixa explícito "mensagem privada no Direct" |
| Descumprir política da Meta (mensagem não solicitada) | App reprovado / restrito | Só responde a **comentário** (a pessoa interagiu primeiro); nada de disparo frio |
| Token expirado | Automação para de funcionar | Reutiliza o mesmo `loadCommentCredentials` já existente, que devolve `not_connected` |

---

## 9. Plano de execução sugerido (quando aprovado)

1. **Confirmar na documentação da Meta** os nomes de campo exatos do endpoint de resposta
   privada e a janela vigente.
2. **Solicitar Advanced Access** para `instagram_business_manage_messages` e
   `instagram_business_manage_comments` (App Review).
3. **Assinar os campos** `comments` (e opcionalmente `messages`) no painel de Webhooks.
4. **Migração aditiva** com os dois models (`CommentDirectRule`, `CommentDirectLog`) —
   sem tocar em models existentes.
5. **Implementar** o provedor de envio (`private-reply.ts`) reutilizando
   `loadCommentCredentials` e o mesmo par `INSTAGRAM_GRAPH_BASE`/`INSTAGRAM_GRAPH_VERSION`.
6. **Implementar** o processador do webhook com validação de assinatura + idempotência.
7. **UI** em página própria (não dentro de Respostas Inteligentes): criar regra, escolher
   publicação, gatilho, mensagem, limite, pausa e ver histórico com motivo.
8. **Ligar o envio real** só depois de 1–3 confirmados, e apenas com uma regra de teste.

---

## 10. Fundação já preparada nesta rodada

Arquivo novo, **funções puras, sem I/O, sem Prisma, sem permissão da Meta**:

- `src/lib/comment-direct/triggers.ts` — normalização de texto, os quatro tipos de gatilho
  e `matchesTrigger()` com o termo que casou (para auditoria).
- `src/lib/comment-direct/index.ts` — reexporta a camada.

Nenhum model foi criado no `schema.prisma`. Nenhuma migração foi gerada. Nenhuma rota de
envio existe. O que foi preparado é só a **lógica de decisão**, que é a parte que precisa
estar certa antes de qualquer coisa tocar a API da Meta.
