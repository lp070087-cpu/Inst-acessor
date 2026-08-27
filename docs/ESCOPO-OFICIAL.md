# INST ACESSOR — ESCOPO OFICIAL DO PRODUTO

> **Documento normativo.** Estas decisões são **regras permanentes** do projeto.
> Nada aqui substitui a identidade visual aprovada nem autoriza configuração externa (Meta/TikTok).
> Data de registro: **2026-08-26** · Versão: **1.0** · Status: **VIGENTE**

---

## ÍNDICE DAS DECISÕES

1. [Base de conhecimento / crescimento no Instagram](#1-base-de-conhecimento--crescimento-no-instagram)
2. [Automações sociais](#2-automações-sociais)
3. [Central de Automações (`/automacoes`)](#3-central-de-automações-automacoes)
4. [Métricas das automações](#4-métricas-das-automações)
5. [Prevenção de duplicidade](#5-prevenção-de-duplicidade)
6. [Mensagens](#6-mensagens)
7. [Agendamento e publicação](#7-agendamento-e-publicação)
8. [Arquitetura (camada genérica de plataformas)](#8-arquitetura-camada-genérica-de-plataformas)
9. [IMPORTANTE — Meta/TikTok](#9-importante--metatiktok)
10. [Identidade visual](#10-identidade-visual)
11. [Ordem do projeto](#11-ordem-do-projeto)

---

## 1. BASE DE CONHECIMENTO / CRESCIMENTO NO INSTAGRAM

**NÃO criar agora uma metodologia genérica de crescimento no Instagram.**

A DONA do projeto fornecerá **posteriormente** os conteúdos, materiais, estratégias e conhecimento que deverão alimentar a IA Acessor.

Regras permanentes:

- não inventar regras de crescimento;
- não preencher banco com dicas genéricas;
- não afirmar estratégias como metodologia oficial;
- não criar seed fictício de conhecimento;
- não usar conteúdo externo como se fosse conhecimento proprietário do Inst Acessor.

**O que fazer por enquanto:** preparar apenas a **ARQUITETURA** necessária para, no futuro, receber uma base de conhecimento própria. Essa arquitetura deverá futuramente suportar:

- documentos;
- categorias;
- módulos;
- tags;
- conteúdos;
- estratégias;
- versões;
- busca semântica / RAG;
- vínculo do conhecimento com a IA Acessor;
- administração do conteúdo pelo dono.

> ⚠️ **NÃO preencher essa base agora.**

---

## 2. AUTOMAÇÕES SOCIAIS

Área **oficialmente adicionada ao roadmap** do produto, antes da finalização:

**AUTOMAÇÕES**

A principal automação será:

```
COMENTÁRIO → PALAVRA-CHAVE → DIRECT
```

**Fluxo conceitual:**

1. usuário escolhe uma publicação / Reel;
2. define palavra-chave;
3. define mensagem;
4. ativa automação;
5. comentário chega pelo webhook oficial;
6. sistema identifica mídia;
7. verifica palavra-chave;
8. verifica regras;
9. evita duplicidade;
10. envia resposta privada permitida pela plataforma;
11. registra resultado no Neon.

**IMPORTANTE:** por enquanto, construir **apenas a arquitetura e a interface** conforme a fase correspondente. A **ativação real com Meta** será realizada **posteriormente**, depois que o SaaS estiver finalizado e o aplicativo Meta estiver configurado em produção.

---

## 3. CENTRAL DE AUTOMAÇÕES (`/automacoes`)

Página **`/automacoes`** a ser adicionada ao **menu principal** do Inst Acessor.

A página deverá futuramente permitir:

- criar automação;
- editar automação;
- ativar / desativar;
- duplicar;
- excluir;
- escolher rede;
- escolher conta;
- escolher publicação;
- escolher Reel;
- palavra-chave;
- várias palavras-chave;
- correspondência exata;
- contém palavra;
- case-insensitive;
- resposta pública opcional;
- mensagem privada;
- delay configurável quando permitido;
- validade da campanha;
- horário ativo;
- limite / regras de segurança;
- histórico;
- analytics.

**Estados da automação:**

| Estado | Significado |
| --- | --- |
| `RASCUNHO` | Criada, ainda não ativa |
| `ATIVA` | Em execução |
| `PAUSADA` | Interrompida temporariamente |
| `CONCLUIDA` | Campanha encerrada / objetivo atingido |
| `ERRO` | Falha registrada |

---

## 4. MÉTRICAS DAS AUTOMAÇÕES

Preparar arquitetura para registrar:

- comentários detectados;
- palavras-chave detectadas;
- respostas públicas enviadas;
- directs enviados;
- falhas;
- duplicidades evitadas;
- conversões quando mensuráveis;
- última execução.

> 📌 **Não inventar dados.** Métricas ausentes ficam `null`/indisponível (mesma filosofia do schema atual: "NUNCA inventar métricas").

---

## 5. PREVENÇÃO DE DUPLICIDADE

Uma pessoa comentando várias vezes **não deve provocar spam**.

Criar arquitetura para registrar:

```
automationId
commentId
mediaId
socialUserId
keywordMatched
action
status
executedAt
```

Deve existir **proteção idempotente**: o mesmo evento de webhook **não pode executar a ação duas vezes**.

---

## 6. MENSAGENS

O usuário deverá poder **escrever a mensagem manualmente**.

Futuramente a IA Acessor também poderá **sugerir** uma mensagem.

**Exemplo conceitual:**

- Palavra-chave: `QUERO`
- Resposta pública (opcional): "Te enviei no direct 🚀"
- Mensagem privada: "Oi! Vi que você comentou QUERO. Aqui estão os detalhes que prometi..."

> ⚠️ **Não implementar mensagens que violem as regras das plataformas.**

---

## 7. AGENDAMENTO E PUBLICAÇÃO

Adicionar ao roadmap uma **CENTRAL DE PUBLICAÇÕES**.

**Fluxo futuro:**

```
Conteúdo
→ Preview Social
→ Calendário
→ Programar
→ Instagram/TikTok
→ Publicar
→ acompanhar status
→ métricas
```

Preparar suporte para:

- imagem;
- vídeo;
- Reel;
- TikTok;
- legenda;
- hashtags;
- data;
- horário;
- plataforma;
- status;
- tentativas;
- erros;
- histórico.

**Estados da publicação:**

| Estado | Significado |
| --- | --- |
| `RASCUNHO` | Conteúdo criado, não programado |
| `AGENDADO` | Programado para data/horário |
| `PUBLICANDO` | Em processo de envio |
| `PUBLICADO` | No ar |
| `FALHOU` | Erro ao publicar |
| `CANCELADO` | Cancelado pelo usuário |

---

## 8. ARQUITETURA (CAMADA GENÉRICA DE PLATAFORMAS)

**Não acoplar automações diretamente à Meta.**

Criar camada genérica, por exemplo:

```
src/lib/automations/
src/lib/publishing/
```

com adapters específicos:

```
src/lib/automations/instagram/
src/lib/automations/tiktok/
src/lib/publishing/instagram/
src/lib/publishing/tiktok/
```

Assim o domínio do Inst Acessor **não fica preso a uma única plataforma**.

---

## 9. IMPORTANTE — META / TIKTOK

**NÃO fazer agora:**

- NÃO configurar credenciais novas;
- NÃO alterar App Review;
- NÃO solicitar scopes adicionais agora;
- NÃO alterar tokens atuais;
- NÃO tentar publicar conteúdo real ainda.

Quando o sistema estiver finalizado, faremos, **nesta ordem**:

```
GitHub
→ Vercel
→ domínio
→ Meta
→ TikTok
→ callbacks
→ webhooks
→ permissões
→ App Review
→ produção
```

---

## 10. IDENTIDADE VISUAL

A identidade aprovada **continua intocável**.

Não mudar:

- fundo branco gelo;
- gradiente;
- magenta;
- roxo;
- tipografia;
- cards;
- sombras;
- visual da apresentação (`apresentacao/`).

---

## 11. ORDEM DO PROJETO

Manter esta ordem:

```
FASE ATUAL
→ concluir e validar

DEPOIS (nesta ordem):
→ IA e inteligência
→ Rank / XP / metas
→ Automações
→ Agendamento / publicação
→ Segurança / 2FA
→ Admin / assinatura
→ Testes finais
→ GitHub / Vercel
→ Meta / TikTok reais
→ Base de conhecimento proprietária
```

> ⚠️ **NÃO pular para automações agora** se a fase atual ainda tiver pendências.

---

## REGRAS TRANSVERSAIS (aplicam-se a todas as decisões)

1. **Nada de dados fictícios** — nenhum seed, nenhuma métrica, nenhum conteúdo inventado.
2. **Nada de conteúdo externo como proprietário** — só o que a DONA fornecer.
3. **Identidade visual aprovada é lei** — branco gelo, gradiente, magenta, roxo, tipografia, cards, sombras.
4. **Nada de configuração externa real** (Meta/TikTok) até o fluxo oficial: GitHub → Vercel → domínio → Meta → TikTok → callbacks → webhooks → permissões → App Review → produção.
5. **Arquitetura desacoplada de plataforma** — camada genérica + adapters (`instagram/`, `tiktok/`).
6. **Fase atual primeiro** — só avançar para a próxima etapa quando a atual estiver concluída e validada.
7. **Idempotência** — eventos de webhook nunca executam ação duas vezes.
8. **Docs são vivos** — este documento deve ser atualizado a cada nova decisão oficial.
