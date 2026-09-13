# Respostas Inteligentes a Comentários do Instagram

Documentação técnica das Fases 1, 2 e 3 — fundação, leitura/inteligência e envio/automação.

---

## 1. Princípio central

O sistema **reutiliza a conexão do Instagram que já existe** em Redes Sociais. Não existe segundo
OAuth, segundo fluxo de autorização, nem segundo armazenamento de token.

O motor nunca envia sozinho por padrão. Toda resposta automática precisa passar por quatro travas
simultâneas: modo, ativação, limites e segurança de conteúdo. Na dúvida, **não envia**.

---

## 2. Fluxo de um comentário

```
ler (graph.instagram.com)
  → classificar (regras determinísticas + IA opcional)
  → resolver prioridade (perfil → template → categoria → IA)
  → gerar resposta (IA com contexto real)
  → decidir envio (segurança + limites)
  → registrar (CommentReplyLog)
  → enviar (somente se aprovado ou se todas as travas permitirem)
```

Cada etapa é um módulo separado em `src/lib/comment-replies/`:

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Tipos e catálogos (modos, categorias, status) |
| `emoji.ts` | Detecção de comentário só-emoji e resposta curta |
| `safety.ts` | Filtros determinísticos — o que nunca automatiza |
| `priority.ts` | Ordem de prioridade 1→5 (núcleo puro) |
| `classify.ts` | Classificação em 11 categorias |
| `generator.ts` | Geração com contexto e anti-repetição |
| `limits.ts` | Limites de envio (por execução/hora/dia/intervalo) |
| `limits-config.ts` | Faixas seguras (arquivo folha, client-safe) |
| `db.ts` | Repositório dos 4 modelos |
| `instagram-comments.ts` | Leitura e envio pela API do Instagram |
| `engine.ts` | Orquestração |

---

## 3. Escopos e o bloqueio externo (importante)

O OAuth atual (`src/lib/integrations/instagram/oauth.ts`) já solicita os cinco escopos do Instagram
Business Login, incluindo **`instagram_business_manage_comments`** — que é exatamente o necessário
para ler e responder comentários.

Os endpoints usados são os do host `graph.instagram.com`, os mesmos da integração existente:

| Operação | Endpoint |
|---|---|
| Ler comentários | `GET /{media-id}/comments?fields=id,text,username,timestamp,from` |
| Responder | `POST /{comment-id}/replies` (corpo `application/x-www-form-urlencoded`) |

**Não foi restaurado o Facebook Login antigo.** Não foi alterado o OAuth. Não há contorno.

Se a Meta ainda não tiver concedido **Acesso Avançado** a `instagram_business_manage_comments` para
o app, a chamada devolve erro de permissão. Nesse caso o sistema:

1. devolve um erro **tipado** (`code: "capability"`) com a mensagem real da Meta;
2. **pausa a automação** (`pauseForError`) para não repetir o erro em laço;
3. mantém todo o histórico e toda a configuração intactos.

A verificação é feita por `checkCommentCapability()`, que tenta ler até 3 publicações e informa
exatamente o que está bloqueado — em vez de presumir.

---

## 4. Prioridade de resposta

Ordem exata, implementada em `priority.ts`:

| Nível | Condição | Resultado |
|---|---|---|
| 1 | Perfil específico cadastrado | Usa instruções (ou resposta fixa) do perfil |
| 2 | Template que casa com palavra/frase/emoji | Resposta fixa ou exemplo de estilo |
| 3 | Template da categoria | Exemplo de estilo |
| 4 | IA geral | Geração livre com contexto |
| 5 | Conteúdo sensível | **Curto-circuito: revisão obrigatória** |

O nível 5 não é um degrau — é um bloqueio. Um comentário sensível para na revisão mesmo que os
níveis 1 a 4 encontrassem uma resposta.

### Comentários só de emoji

Tratamento próprio: nunca recebem parágrafo. O fallback local é curtíssimo:

| Emoji | Resposta |
|---|---|
| ❤️ | ❤️❤️ |
| 😍 | Amei! 🥰 |
| 🔥 | Valeu demais 🔥 |
| 👏 | Obrigada! 👏 |
| 😂 | 😂 |
| outro | espelha o próprio emoji |

Se houver template de estilo, a IA escreve — mas com a instrução de que o comentário contém apenas
emoji e a resposta deve ter **no máximo 4 palavras**.

---

## 5. Segurança — o que nunca é automatizado

`detectReviewTrigger()` roda **antes e independentemente** da classificação por IA. Se o texto contém
"preço" mas a IA classificou como "elogio", a revisão acontece mesmo assim.

Motivos de revisão obrigatória:

- `preco_ou_pagamento` — preço, valor, PIX, boleto, desconto, frete, reembolso, nota fiscal
- `pedido_ou_entrega` — pedido, entrega, rastreio, atraso, cancelamento, troca
- `saude` — saúde, médico, dor, remédio, tratamento, cirurgia
- `juridico` — advogado, processo, PROCON, contrato, LGPD
- `politica_ou_religiao`
- `ofensa_ou_agressao`
- `sorteio_ou_promessa` — sorteio, prêmio, garantia de resultado, cura
- `spam_ou_link` — links, "clique aqui", WhatsApp, Telegram

Categorias que podem ser automáticas apenas no modo Automático: **emoji, elogio, agradecimento**.

---

## 6. Idempotência

`CommentReplyLog` tem `@@unique([mediaId, commentId])`. Além disso, `sendApprovedReply()` verifica o
status antes de chamar a API: um registro já `SENT` devolve o id existente **sem** uma segunda
publicação.

Consequência prática: aprovar duas vezes, ou rodar a automação repetidas vezes, nunca gera resposta
duplicada no Instagram.

---

## 7. Limites

Faixas seguras (`limits-config.ts`), revalidadas no servidor por `sanitizeLimits()`:

| Limite | Mín | Máx | Padrão |
|---|---|---|---|
| Por execução | 1 | 50 | 10 |
| Por hora | 1 | 100 | 20 |
| Por dia (24h) | 1 | 300 | 60 |
| Intervalo mínimo | 10s | 3600s | 30s |

Coerências aplicadas automaticamente: por hora nunca maior que por dia; por execução nunca maior que
por hora.

O limite é checado **no momento do envio**, não no da sugestão — o estado pode ter mudado entre as
duas etapas.

### Reação a erros

| Erro | Ação |
|---|---|
| Rate limit | Pausa temporária |
| Token expirado (190) | Pausa definitiva — exige reconexão |
| Permissão ausente (10/200/3) | Pausa definitiva com erro claro |
| Outros | Registra erro pontual, sem pausar |

Nunca há laço infinito: um erro fatal encerra o ciclo na hora.

**Desconectar o Instagram pausa a automação** e **não apaga o histórico**.

---

## 8. Estrutura de execução (sem polling)

`POST /api/comment-replies/run` é o ponto de execução. Ele **não** se auto-agenda e **não** faz
polling. Quem chama é:

- o botão **"Executar agora"** da tela, ou
- um agendador/cron externo, quando configurado.

Não existe `setInterval`, timer ou laço de espera no código.

---

## 9. Interface

Quatro áreas em `/respostas-inteligentes`:

1. **Publicações** — posts, carrosséis e Reels com thumbnail, legenda, data, tipo e comentários
2. **Aprovações** — sugestão + Aprovar / Editar / Ignorar / Regenerar
3. **Regras e limites** — modo, limites, respostas próprias, pessoas especiais
4. **Histórico** — filtros: todos, enviados, pendentes, ignorados, com erro, manuais, automáticos

Métricas exibidas (todas derivadas de registros reais, nenhuma inventada): comentários analisados,
respostas enviadas, aguardando aprovação e taxa de aprovação. Quando não há decisões registradas, a
taxa aparece como "—", não como 0%.

Sem Instagram conectado, a tela mostra um **CTA para /redes-sociais**.

### Pessoas especiais

Não existe campo de gênero. O sistema **não infere** relação, intimidade ou gênero a partir do @.
Tudo o que a IA sabe vem de `customInstructions` e, opcionalmente, `fixedReply` — ambos escritos
pelo usuário.

---

## 10. Configuração de IA

A geração usa a **configuração central do Admin** (`resolveRuntimeAI()`), a mesma da IA Acessor,
Gerador de Copy e Ideias. Não existe segunda configuração.

Se a IA não estiver configurada, a tela avisa e a funcionalidade continua parcialmente utilizável:
respostas fixas, templates e o tratamento de emoji funcionam sem IA. A sugestão fica indisponível e
o usuário pode escrever manualmente.

---

## 11. Modelos de dados

Todos **aditivos** — nenhum modelo existente foi alterado, exceto pelas relações inversas em `User`
e `SocialConnection`.

- `CommentAutomationRule` → `comment_automation_rule`
- `ReplyTemplate` → `reply_template`
- `SpecialProfileRule` → `special_profile_rule`
- `CommentReplyLog` → `comment_reply_log`

---

## 12. O que ainda depende de ação externa

Para que o envio real funcione em produção, é necessário que o app Meta tenha **Acesso Avançado**
aprovado para `instagram_business_manage_comments`. Isso é uma aprovação da Meta, feita no painel
do app — não é configurável por código.

Toda a arquitetura interna está pronta. Quando a permissão estiver ativa, nenhuma alteração de código
será necessária.
