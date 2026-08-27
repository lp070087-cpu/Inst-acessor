import type { KnowledgeModule } from "../types";

/**
 * MÓDULOS 03–09 — PERFIL, PÚBLICO, CONTEÚDO, GANCHOS, RETENÇÃO, REELS, STORIES
 * Conteúdo oficial fornecido pela DONA (Fase 4.5).
 */

export const contentModules: KnowledgeModule[] = [
  {
    number: 3,
    slug: "bio-posicionamento",
    title: "Bio e Posicionamento",
    description:
      "Diagnóstico de bio e posicionamento do perfil com base em sinais reais.",
    rules: [
      {
        slug: "diagnostico-bio",
        module: 3,
        title: "Diagnóstico de bio",
        type: "DIAGNOSTIC_RULE",
        category: "bio",
        content:
          "Diagnosticar bio por: clareza, proposta, motivo para acompanhar, coerência e alinhamento bio/conteúdo.",
        priority: "ALTA",
        tags: ["bio", "clareza", "proposta", "coerencia"],
        version: 1,
      },
      {
        slug: "diagnostico-posicionamento",
        module: 3,
        title: "Diagnóstico de posicionamento",
        type: "DIAGNOSTIC_RULE",
        category: "posicionamento",
        content:
          "Avaliar posicionamento por: nicho, subnicho, estilo, tom, proposta percebida, público provável e estratégia atual.",
        priority: "ALTA",
        tags: ["posicionamento", "nicho", "tom", "publico"],
        version: 1,
      },
      {
        slug: "sugestao-bio-ia",
        module: 3,
        title: "Sugestão de bio pela IA",
        type: "STRATEGY_RULE",
        category: "bio",
        content:
          "A IA pode sugerir melhoria de bio com base no perfil real — nunca com base em invento.",
        priority: "MEDIA",
        tags: ["bio", "sugestao", "ia"],
        version: 1,
      },
    ],
  },
  {
    number: 4,
    slug: "publico",
    title: "Público",
    description:
      "Hipótese de público que evolui conforme novos resultados reais.",
    rules: [
      {
        slug: "hipotese-publico",
        module: 4,
        title: "Criar e evoluir hipótese de público",
        type: "STRATEGY_RULE",
        category: "publico",
        content:
          "Criar e evoluir hipótese sobre: para quem fala, problemas, desejos, linguagem, identificação, autoridade, curiosidade e tipos de conteúdo que geram resposta. A hipótese deve mudar conforme novos resultados.",
        priority: "ALTA",
        tags: ["publico", "hipotese", "linguagem", "identificacao"],
        version: 1,
      },
    ],
  },
  {
    number: 5,
    slug: "conteudo",
    title: "Conteúdo",
    description:
      "Unidade de análise: tema + formato + gancho + estrutura + resultado.",
    rules: [
      {
        slug: "unidade-conteudo",
        module: 5,
        title: "Unidade de análise de conteúdo",
        type: "CONTENT_RULE",
        category: "conteudo",
        content:
          "A unidade de análise é TEMA + FORMATO + GANCHO + ESTRUTURA + RESULTADO. Nunca concluir apenas “Reels funcionam”. Buscar padrões específicos como: “Reels sobre X, com abertura Y e estrutura Z, performaram acima do padrão deste perfil.”",
        priority: "ALTA",
        tags: ["conteudo", "padrao", "tema", "formato", "gancho", "estrutura"],
        version: 1,
      },
    ],
  },
  {
    number: 6,
    slug: "ganchos",
    title: "Ganchos",
    description:
      "Como trabalhar o gancho e a pergunta central de retenção.",
    rules: [
      {
        slug: "tipos-de-gancho",
        module: 6,
        title: "O que o gancho pode trabalhar",
        type: "CONTENT_RULE",
        category: "conteudo",
        content:
          "O gancho pode trabalhar: curiosidade, identificação, tensão, surpresa, benefício, problema, desejo, quebra de expectativa, promessa e contraste.",
        priority: "ALTA",
        tags: ["gancho", "curiosidade", "tensao", "promessa"],
        version: 1,
      },
      {
        slug: "pergunta-central-gancho",
        module: 6,
        title: "Pergunta central do gancho",
        type: "CONTENT_RULE",
        category: "conteudo",
        content:
          "Pergunta central: “Por que alguém que não conhece esse criador continuaria assistindo?” O gancho deve ser avaliado junto com a entrega. Gancho forte + conteúdo fraco não garante retenção.",
        priority: "ALTA",
        tags: ["gancho", "retencao", "entrega"],
        version: 1,
      },
    ],
  },
  {
    number: 7,
    slug: "retencao",
    title: "Retenção",
    description:
      "Estrutura e elementos de retenção dentro do conteúdo.",
    rules: [
      {
        slug: "estrutura-retencao",
        module: 7,
        title: "Estrutura de retenção",
        type: "CONTENT_RULE",
        category: "retencao",
        content:
          "Estrutura: GANCHO → DESENVOLVIMENTO → TENSÃO/CURIOSIDADE → PROGRESSÃO → RECOMPENSA.",
        priority: "ALTA",
        tags: ["retencao", "estrutura", "gancho", "recompensa"],
        version: 1,
      },
      {
        slug: "elementos-retencao",
        module: 7,
        title: "Elementos de retenção",
        type: "CONTENT_RULE",
        category: "retencao",
        content:
          "Elementos: abertura rápida, retirada de introduções desnecessárias, mudança visual, progressão, antecipação, perguntas implícitas, informação incompleta resolvida depois, recompensa, ritmo e clareza. Cada parte deve justificar consumir a próxima.",
        priority: "ALTA",
        tags: ["retencao", "ritmo", "abertura", "progressao"],
        version: 1,
      },
    ],
  },
  {
    number: 8,
    slug: "reels",
    title: "Reels",
    description:
      "Análise de Reels quando disponível e alerta para Reels fracos.",
    rules: [
      {
        slug: "analise-reels",
        module: 8,
        title: "Análise de Reels",
        type: "DIAGNOSTIC_RULE",
        category: "conteudo",
        content:
          "Analisar quando disponível: reproduções, alcance, melhores Reels, retenção, curtidas, comentários, frequência, evolução e diferença entre forte/fraco.",
        priority: "ALTA",
        tags: ["reels", "reproducoes", "alcance", "retencao"],
        version: 1,
      },
      {
        slug: "alerta-reel-fraco",
        module: 8,
        title: "Alerta para Reels fracos",
        type: "METRIC_RULE",
        category: "conteudo",
        content: "Criar alerta para Reels fracos.",
        priority: "MEDIA",
        tags: ["reels", "alerta", "fraco"],
        version: 1,
      },
    ],
  },
  {
    number: 9,
    slug: "stories",
    title: "Stories",
    description:
      "Função estratégica dos Stories: relacionamento e recorrência.",
    rules: [
      {
        slug: "funcao-stories",
        module: 9,
        title: "Função estratégica dos Stories",
        type: "STRATEGY_RULE",
        category: "conteudo",
        content:
          "Função estratégica dos Stories: relacionamento e recorrência. Analisar: visualizações, alcance, média, evolução e frequência.",
        priority: "ALTA",
        tags: ["stories", "relacionamento", "recorrencia"],
        version: 1,
      },
      {
        slug: "leitura-reels-stories",
        module: 9,
        title: "Leitura Reels × Stories",
        type: "STRATEGY_RULE",
        category: "conteudo",
        content:
          "Permitir leitura: Reels podem atuar em aquisição, Stories em relacionamento.",
        priority: "MEDIA",
        tags: ["reels", "stories", "aquisicao", "relacionamento"],
        version: 1,
      },
    ],
  },
];
