# Relatório — Bloco 1: Instagram, Publicações e Comentários

**Data:** 2026-09-15
**Escopo:** sincronização real do Instagram, publicações, comentários e Respostas Inteligentes.
**Status:** Edições aplicadas. NENHUM commit/push/deploy. Nenhuma ação destrutiva.

---

## 1. Causa da publicação não aparecer

Havia **seis** falhas somadas, não uma só.

**(a) O sync nunca era automático.** `syncInstagram()` só era chamado por `POST /api/integrations/instagram/sync`, disparado apenas pelo botão manual "Atualizar métricas" do Dashboard. O callback do OAuth criava a conexão mas não sincronizava nada. Sem clicar no botão, `InstagramMedia` e `InstagramSnapshot` ficavam permanentemente vazios — e a tela de Respostas Inteligentes lê publicações **exclusivamente do banco**.

**(b) O OAuth marcava `lastSyncAt` sem sincronizar.** `callback/route.ts` gravava `lastSyncAt: new Date()` ao conectar. Isso tinha dois efeitos: mostrava "sincronizado agora" sem nenhum dado existir, e **bloqueava o primeiro sync real** pelo cooldown de 60s de `sync.ts` caso o botão fosse clicado logo depois.

**(c) O sync truncava em 20 e não paginava.** `getRecentMedia()` fazia uma única chamada com `limit=50` e ignorava `paging.next`; depois `collectInstagramData()` cortava em `mediaNodes.slice(0, 20)`. Contas com mais de 50 publicações perdiam silenciosamente todo o histórico anterior.

**(d) Insights de conta lidos no formato errado.** `getAccountInsights()` fazia `values[values.length - 1]?.value`. A API devolve `total_value` para os totais agregados — o caminho usado devolvia `null` em muitos casos, deixando `reach`/`impressions`/`profileViews` do snapshot vazios.

**(e) Insights de mídia lidos em um objeto que não existe.** `getMediaMetrics()` fazia `data.reached ?? null`, `data.shares ?? null` etc. direto na raiz da resposta. O endpoint `/{media}/insights` devolve `{ data: [{ name, values[] | total_value }] }` — os campos **nunca existiram na raiz**. Resultado: **toda** linha de `InstagramMediaMetric` era gravada `null`, zerando a produção de Reels no Dashboard. Havia ainda um erro de nome: a métrica de alcance chama-se `reach`, e o código procurava `reached`.

**(f) O Dashboard ignora `InstagramMedia`.** Os cards principais leem apenas `InstagramSnapshot`. Mesmo com publicações no banco, o Dashboard ficava vazio se o snapshot não existisse.

## 2. Causa dos comentários não aparecerem

**A tabela não existia.** O projeto só tinha `CommentReplyLog` — que guarda **a nossa resposta**, não o comentário recebido. Não havia onde persistir comentários reais.

Consequência direta: `listComments()` chamava a API do Instagram **ao vivo**, na hora em que a tela abria. Se a Meta não tivesse aprovado o escopo `instagram_business_manage_comments`, a chamada falhava, a lista vinha vazia e não havia nada no banco para mostrar depois. O resultado visível era "nenhum comentário", indistinguível de "não existem comentários".

## 3. Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `prisma/schema.prisma` | Novo model `InstagramComment` (comentário real). `InstagramMedia.mediaProductType`. `InstagramMediaMetric.mediaId` agora `@unique`. `SocialConnection` ganhou `lastSyncAttemptAt`, `lastSyncErrorCode`, `commentsAvailable`, `commentsErrorCode`. |
| `prisma/migrations/20260915120000_instagram_media_produto_comentarios/migration.sql` | Migration **aditiva** (nova). |
| `src/lib/integrations/instagram/metrics.ts` | Insights nos formatos corretos (`values[]` + `total_value`, mapeamento por `name`); paginação real de mídia; tetos separados de insights/comentários; `getMediaComments()` + `normalizeComment()`. |
| `src/lib/integrations/instagram/types.ts` | `media_product_type`, `InstagramCommentData`, `commentsAvailable` (tristate), `commentsSynced`. |
| `src/lib/integrations/instagram/sync.ts` | Upsert de métricas por `mediaId`; persistência idempotente de comentários; gravação do estado real do sync. |
| `src/app/api/integrations/instagram/callback/route.ts` | Parou de marcar `lastSyncAt` no OAuth. |
| `src/app/api/integrations/instagram/refresh/route.ts` | Renovação de token não marca mais `lastSyncAt`. |
| `src/lib/comment-replies/instagram-comments.ts` | `listEligibleMedia()` lê `mediaProductType` real e conta comentários sincronizados; novos `listStoredComments()` e `countStoredComments()`. |
| `src/lib/comment-replies/types.ts` | `EligibleMedia.syncedCommentsCount`. |
| `src/app/api/comment-replies/media/route.ts` | `?mediaId=` devolve comentários reais; devolve `commentsAvailable` e `lastSyncAt`. |
| `src/components/comment-replies/comment-replies-client.tsx` | Botão "Sincronizar agora", aviso honesto quando a Meta recusa comentários, data da última sincronização, estado vazio com a causa real. |
| `src/components/comment-replies/media-list.tsx` | Contagem real de comentários; "—" em vez de "0" quando o dado não existe. |

## 4. Como ficou o fluxo de sincronização

```
Meta/Instagram → OAuth (token encriptado AES-256-GCM)
      ↓
GET /me                                    → conta autorizada
GET /{ig-user-id}                          → perfil (seguidores, mídias, bio)
GET /{ig-user-id}/insights                 → reach, impressions, profile_views
GET /{ig-user-id}/media (+ paging.next)    → LISTA COMPLETA de publicações
      ↓ por publicação (mais recentes primeiro)
GET /{media-id}/insights                   → métricas por publicação (máx. 25)
GET /{media-id}/comments (+ paging.next)   → COMENTÁRIOS REAIS (máx. 10 publicações)
      ↓
UPSERT InstagramProfile   (chave: socialConnectionId)
INSERT InstagramSnapshot  (histórico — 1 linha por sincronização)
UPSERT InstagramMedia     (chave: igMediaId)
UPSERT InstagramMediaMetric (chave: mediaId)
UPSERT InstagramComment   (chave: igCommentId)
UPDATE SocialConnection   (lastSyncAt, lastSyncAttemptAt, commentsAvailable)
INSERT SyncLog
      ↓
Respostas Inteligentes / Dashboard leem do BANCO
```

Comentários seguem em **modo somente leitura**: `getMediaComments` nunca publica. Nada foi respondido durante os testes.

## 5. Como ficou a idempotência

| Dado | Chave | Operação | Efeito de sincronizar 2× |
|---|---|---|---|
| Publicação | `InstagramMedia.igMediaId` (unique) | `upsert` | Atualiza a mesma linha |
| Métrica de mídia | `InstagramMediaMetric.mediaId` (unique) | `upsert` | Atualiza a mesma linha (antes: inseria duplicata) |
| Comentário | `InstagramComment.igCommentId` (unique) | `upsert` | Atualiza a mesma linha |
| Perfil | `InstagramProfile.socialConnectionId` (unique) | `upsert` | Atualiza a mesma linha |
| Snapshot | — | `create` | **Intencional**: é série temporal, cada sync = 1 ponto |

O snapshot é a única exceção deliberada: ele existe para formar a linha do tempo dos seguidores.

## 6. Quais dados a Meta realmente disponibilizou

Esta seção descreve o que o **código** pede e como trata a ausência — o que a conta real devolveu só será visível após a sincronização rodar (ver seção 9).

Solicitado e persistido quando a API informar: `id`, `username`, `name`, `account_type`, `profile_picture_url`, `followers_count`, `follows_count`, `media_count`, `biography`; por publicação: `media_type`, `media_product_type`, `permalink`, `caption`, `timestamp`, `like_count`, `comments_count`, `media_url`, `thumbnail_url`, `reach`, `impressions`, `shares`, `saves`, `comments`, `likes`, `video_views`, `video_view_time`; por comentário: `id`, `text`, `username`, `timestamp`, `from`, `replies`.

**Regra aplicada:** campo ausente → `null`. Nunca `0`. O card do Dashboard mostra "—" quando o valor é `null`.

## 7. Limitações e permissões encontradas

1. **`instagram_business_manage_comments` depende de aprovação da Meta.** Enquanto o app não tiver acesso avançado, a leitura de comentários é recusada. O código **não contorna isso**: marca `commentsAvailable = false` e a tela informa o motivo real em vez de exibir "0 comentários".
2. **`engagement` do snapshot continua `null`** — o sync não deriva engajamento porque a API não fornece todos os componentes necessários. Isso é ausência, não zero.
3. **Insights são limitados por rate limit.** Insights detalhados nas 25 publicações mais recentes; comentários nas 10 mais recentes. A **listagem** de publicações é completa e paginada — o corte é só nas chamadas custosas.
4. **A documentação do Instagram está bloqueada** no ambiente (egress allowlist). Os formatos usados foram corrigidos com base na estrutura real que o código já recebia; recomendo confirmar na documentação oficial na primeira execução em produção.

## 8. Migration criada

`prisma/migrations/20260915120000_instagram_media_produto_comentarios/migration.sql`

Aditiva e idempotente: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, índices e FKs condicionais. **Um ponto de atenção**: o índice único em `InstagramMediaMetric.mediaId` exige remover linhas duplicadas antigas — o script faz isso automaticamente, preservando a métrica **mais recente** de cada publicação.

## 9. Comandos para executar no Windows

O shell desta sessão está indisponível, então **nada foi validado em execução**. Rode, na pasta do projeto:

```bash
npx prisma generate
npx prisma migrate deploy
npx tsc --noEmit
npm run build
```

Depois, para verificar o fluxo real (com a conta conectada):

1. Abra **/respostas-inteligentes**.
2. Clique em **"Sincronizar agora"**.
3. Confirme que as publicações aparecem com thumbnail, tipo e data.
4. Verifique se aparece o aviso de comentários indisponíveis ou a contagem real.

Se preferir conferir o banco diretamente:

```bash
npx prisma studio
```

Tabelas a observar: `InstagramMedia`, `InstagramMediaMetric`, `InstagramComment`.

---

**Não iniciado neste bloco** (conforme instruído): gráfico, Score, IA Acessor, Preview Social, Gerador de Copy, Perfil, Configurações, mobile, landing e cards de preços.
