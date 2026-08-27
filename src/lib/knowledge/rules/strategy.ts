import type { KnowledgeModule } from "../types";

/**
 * MÓDULOS 20, 22–30 — DIAGNÓSTICO IA, ESTRATÉGIA PERSONALIZADA, IDEIAS,
 * COPY, CALENDÁRIO, MENTORIA, APRENDIZADO CONTÍNUO, GAMIFICAÇÃO, MÉTRICAS,
 * MOTOR DE CRESCIMENTO.
 * Conteúdo oficial fornecido pela DONA (Fase 4.5).
 */

export const strategyModules: KnowledgeModule[] = [
  {
    number: 20,
    slug: "diagnostico-ia",
    title: "Diagnóstico IA",
    description:
      "Contexto permitido e saídas possíveis do diagnóstico por IA.",
    rules: [
      {
        slug: "contexto-permitido-diagnostico",
        module: 20,
        title: "Contexto permitido",
        type: "AI_GUARDRAIL",
        category: "diagnostico",
        content:
          "Contexto permitido: perfil, bio, seguidores, crescimento, frequência, publicações, legendas, Reels, plays, alcance, curtidas, comentários e histórico.",
        priority: "ALTA",
        tags: ["diagnostico", "contexto", "dados"],
        version: 1,
      },
      {
        slug: "saidas-possiveis-diagnostico",
        module: 20,
        title: "Saídas possíveis",
        type: "STRATEGY_RULE",
        category: "diagnostico",
        content:
          "Saídas possíveis: diagnóstico, oportunidades, recomendações, posicionamento, público provável, nicho, subnicho, tom, estilo, bio e estratégia.",
        priority: "ALTA",
        tags: ["diagnostico", "oportunidades", "recomendacoes", "estrategia"],
        version: 1,
      },
    ],
  },
  {
    number: 22,
    slug: "estrategia-personalizada",
    title: "Estratégia Personalizada",
    description:
      "A estratégia nasce do perfil, nicho, público, histórico, conteúdos e resultados.",
    rules: [
      {
        slug: "estrategia-nasce-do-perfil",
        module: 22,
        title: "Base da estratégia personalizada",
        type: "STRATEGY_RULE",
        category: "estrategia",
        content:
          "Estratégia nasce de: PERFIL + NICHO + PÚBLICO + HISTÓRICO + CONTEÚDOS + RESULTADOS. Pode recomendar: assuntos, formatos, frequência, estilo, oportunidades, melhorias e próximos testes.",
        priority: "ALTA",
        tags: ["estrategia", "perfil", "nicho", "publico", "testes"],
        version: 1,
      },
    ],
  },
  {
    number: 23,
    slug: "ideias",
    title: "Ideias",
    description:
      "Nunca gerar “10 ideias para Instagram” sem contexto. Combinar nicho, público, conteúdo anterior, desempenho e objetivo.",
    rules: [
      {
        slug: "ideias-precisam-contexto",
        module: 23,
        title: "Ideias com contexto",
        type: "CONTENT_RULE",
        category: "ideias",
        content:
          "Nunca gerar simplesmente “10 ideias para Instagram”. Contexto: NICHO + PÚBLICO + CONTEÚDO ANTERIOR + DESEMPENHO + OBJETIVO.",
        priority: "ALTA",
        tags: ["ideias", "contexto", "nicho", "desempenho"],
        version: 1,
      },
    ],
  },
  {
    number: 24,
    slug: "copy",
    title: "Copy",
    description:
      "Usar a estratégia do perfil para abertura, legenda, CTA, estrutura, linguagem, posicionamento e objetivo.",
    rules: [
      {
        slug: "copy-usa-estrategia",
        module: 24,
        title: "Copy orientado pela estratégia do perfil",
        type: "CONTENT_RULE",
        category: "copy",
        content:
          "Utilizar estratégia do perfil para: abertura, legenda, CTA, estrutura, linguagem, posicionamento e objetivo.",
        priority: "ALTA",
        tags: ["copy", "estrategia", "cta", "estrutura"],
        version: 1,
      },
    ],
  },
  {
    number: 25,
    slug: "calendario",
    title: "Calendário",
    description:
      "Transformar recomendação em execução: o que produzir, quando, como estruturar e o que medir.",
    rules: [
      {
        slug: "calendario-execucao",
        module: 25,
        title: "Calendário transforma recomendação em execução",
        type: "STRATEGY_RULE",
        category: "calendario",
        content:
          "Transformar recomendação em execução: O QUE PRODUZIR → QUANDO → COMO ESTRUTURAR → O QUE MEDIR.",
        priority: "ALTA",
        tags: ["calendario", "execucao", "producao"],
        version: 1,
      },
    ],
  },
  {
    number: 26,
    slug: "mentoria",
    title: "Mentoria",
    description:
      "Mentoria como acompanhamento contínuo, com contexto de nicho, posicionamento, desempenho e dificuldades.",
    rules: [
      {
        slug: "mentoria-contexto",
        module: 26,
        title: "Contexto da mentoria",
        type: "STRATEGY_RULE",
        category: "mentoria",
        content:
          "Contexto: nicho, posicionamento, desempenho, histórico, dificuldades, oportunidades e métricas. Mentoria deve representar acompanhamento contínuo.",
        priority: "ALTA",
        tags: ["mentoria", "acompanhamento", "continuo"],
        version: 1,
      },
    ],
  },
  {
    number: 27,
    slug: "aprendizado-continuo",
    title: "Aprendizado Contínuo",
    description:
      "Ciclo obrigatório de análise → recomendação → execução → medição → comparação → aprendizado → ajuste.",
    rules: [
      {
        slug: "ciclo-aprendizado",
        module: 27,
        title: "Ciclo obrigatório",
        type: "PRINCIPLE",
        category: "aprendizado",
        content:
          "Ciclo obrigatório: ANALISAR → RECOMENDAR → EXECUTAR → MEDIR → COMPARAR → APRENDER → AJUSTAR.",
        priority: "ALTA",
        tags: ["aprendizado", "ciclo", "medir", "ajustar"],
        version: 1,
      },
      {
        slug: "formato-ganha-importancia",
        module: 27,
        title: "Formato que funciona ganha importância",
        type: "STRATEGY_RULE",
        category: "aprendizado",
        content:
          "Formato que melhora ganha importância. Formato que deixa de funcionar perde importância. A estratégia precisa evoluir.",
        priority: "ALTA",
        tags: ["aprendizado", "formato", "evolucao"],
        version: 1,
      },
    ],
  },
  {
    number: 28,
    slug: "gamificacao",
    title: "Gamificação",
    description:
      "Metas, conquistas, XP e progresso. Valores de referência versionáveis e configuração de 70% e XP 5–100.",
    rules: [
      {
        slug: "gamificacao-elementos",
        module: 28,
        title: "Elementos de gamificação",
        type: "STRATEGY_RULE",
        category: "gamificacao",
        content:
          "Elementos: metas, conquistas, XP, progresso, seguidores, engajamento, uso das ferramentas e conteúdos. Gamificação deve incentivar comportamento útil para evolução.",
        priority: "ALTA",
        tags: ["gamificacao", "metas", "xp", "conquistas"],
        version: 1,
      },
      {
        slug: "referencia-70-porcento-xp",
        module: 28,
        title: "Referências de 70% e XP 5–100",
        type: "EXPERIMENT_RULE",
        category: "gamificacao",
        content:
          "Ao atingir aproximadamente 70% de determinado conjunto de conquistas, novos objetivos mais difíceis podem entrar. XP: aproximadamente 5–100 conforme dificuldade. Esses valores devem ser versionáveis/configuráveis.",
        priority: "MEDIA",
        tags: ["gamificacao", "70-porcento", "xp", "versionavel"],
        version: 1,
      },
    ],
  },
  {
    number: 29,
    slug: "metricas",
    title: "Métricas",
    description:
      "Métricas quando fornecidas pela integração. Nunca assumir disponibilidade.",
    rules: [
      {
        slug: "lista-metricas",
        module: 29,
        title: "Métricas quando fornecidas",
        type: "METRIC_RULE",
        category: "metricas",
        content:
          "Quando fornecidas pela integração: seguidores, novos seguidores, crescimento semanal, crescimento %, alcance, alcance 7d, visitas ao perfil, engajamento, taxa, curtidas, médias, comentários, Reels, plays, melhor Reel, retenção, Stories, visualizações, alcance Stories, frequência, publicações, legendas, melhores conteúdos e snapshots.",
        priority: "ALTA",
        tags: ["metricas", "disponibilidade", "integracoes"],
        version: 1,
      },
      {
        slug: "nunca-assumir-disponibilidade",
        module: 29,
        title: "Nunca assumir disponibilidade",
        type: "AI_GUARDRAIL",
        category: "metricas",
        content: "Nunca assumir disponibilidade de uma métrica.",
        priority: "ALTA",
        tags: ["metricas", "disponibilidade", "nao-assumir"],
        version: 1,
      },
    ],
  },
  {
    number: 30,
    slug: "motor-de-crescimento",
    title: "Motor de Crescimento",
    description:
      "Fluxo de 10 passos: atrair atenção, manter, gerar reação, descoberta, conversão, relacionamento, medir, identificar padrões, repetir/corrigir.",
    rules: [
      {
        slug: "motor-de-crescimento-passos",
        module: 30,
        title: "Passos do motor de crescimento",
        type: "STRATEGY_RULE",
        category: "crescimento",
        content:
          "1. Atrair atenção (Tema + formato + gancho). 2. Manter atenção (Retenção + desenvolvimento + ritmo + recompensa). 3. Gerar reação (Curtida + comentário + compartilhamento + interesse). 4. Gerar descoberta (Alcance + distribuição). 5. Converter descoberta (Perfil + bio + posicionamento + conteúdo). 6. Transformar visitantes em seguidores. 7. Criar relacionamento (Stories + recorrência + consistência). 8. Medir. 9. Identificar padrões. 10. Repetir o que funciona e corrigir o que não funciona.",
        priority: "ALTA",
        tags: ["crescimento", "motor", "gancho", "descoberta", "padroes"],
        version: 1,
      },
    ],
  },
];
