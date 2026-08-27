import type { KnowledgeModule } from "../types";

/**
 * MÓDULOS 10–19 — FREQUÊNCIA, ENGAJAMENTO, ALCANCE, CRESCIMENTO, VISITAS,
 * SNAPSHOTS, COMPARAÇÃO, ALERTAS, DIAGNÓSTICO, GROWTH SCORE.
 * Conteúdo oficial fornecido pela DONA (Fase 4.5).
 */

export const metricsModules: KnowledgeModule[] = [
  {
    number: 10,
    slug: "frequencia-consistencia",
    title: "Frequência e Consistência",
    description:
      "Monitorar frequência, dias sem publicar e regularidade sem forçar qualidade para baixo.",
    rules: [
      {
        slug: "monitorar-frequencia",
        module: 10,
        title: "Monitorar frequência",
        type: "METRIC_RULE",
        category: "consistencia",
        content:
          "Monitorar: frequência, dias sem publicar, regularidade, histórico, mudança de frequência e relação frequência/desempenho. Alerta de dias sem postagem.",
        priority: "ALTA",
        tags: ["frequencia", "consistencia", "alerta"],
        version: 1,
      },
      {
        slug: "regra-consistencia-sustentavel",
        module: 10,
        title: "Regra de consistência sustentável",
        type: "STRATEGY_RULE",
        category: "consistencia",
        content:
          "Consistência NÃO significa publicar todos os dias independentemente da qualidade. Buscar frequência sustentável que produza aprendizado e mantenha atividade.",
        priority: "ALTA",
        tags: ["consistencia", "frequencia", "qualidade", "sustentavel"],
        version: 1,
      },
    ],
  },
  {
    number: 11,
    slug: "engajamento",
    title: "Engajamento",
    description:
      "Análise de curtidas, comentários e taxa de engajamento com detecção de queda, aumento e acima da média.",
    rules: [
      {
        slug: "monitorar-engajamento",
        module: 11,
        title: "Monitorar engajamento",
        type: "METRIC_RULE",
        category: "engajamento",
        content:
          "Analisar: curtidas, comentários, taxa de engajamento, média de curtidas, média de comentários, evolução e comparação. Detectar: queda, aumento e acima da média.",
        priority: "ALTA",
        tags: ["engajamento", "curtidas", "comentarios", "taxa"],
        version: 1,
      },
      {
        slug: "conteudo-excepcional-candidato-padrao",
        module: 11,
        title: "Conteúdo excepcional entra como candidato a padrão",
        type: "DIAGNOSTIC_RULE",
        category: "engajamento",
        content:
          "Conteúdo excepcional deve entrar como candidato a padrão a estudar.",
        priority: "MEDIA",
        tags: ["engajamento", "padrao", "excepcional"],
        version: 1,
      },
    ],
  },
  {
    number: 12,
    slug: "alcance",
    title: "Alcance",
    description:
      "Análise de alcance recente, evolução e relações com seguidores, frequência e conteúdos.",
    rules: [
      {
        slug: "monitorar-alcance",
        module: 12,
        title: "Monitorar alcance",
        type: "METRIC_RULE",
        category: "alcance",
        content:
          "Analisar: alcance recente, alcance 7d, evolução, comparação, relação com seguidores, relação com frequência e relação com conteúdos. Queda pode gerar alerta.",
        priority: "ALTA",
        tags: ["alcance", "7d", "evolucao", "alerta"],
        version: 1,
      },
    ],
  },
  {
    number: 13,
    slug: "crescimento",
    title: "Crescimento",
    description:
      "Monitoramento de seguidores, ganho semanal e desaceleração. 0,5% é referência contextual, não regra universal.",
    rules: [
      {
        slug: "monitorar-crescimento",
        module: 13,
        title: "Monitorar crescimento",
        type: "METRIC_RULE",
        category: "crescimento",
        content:
          "Monitorar: seguidores, ganho semanal, evolução, crescimento %, histórico, desaceleração e períodos.",
        priority: "ALTA",
        tags: ["crescimento", "seguidores", "semanal", "desaceleracao"],
        version: 1,
      },
      {
        slug: "referencia-0-5",
        module: 13,
        title: "Referência contextual de 0,5%",
        type: "METRIC_RULE",
        category: "crescimento",
        content:
          "O conhecimento fornecido cita crescimento superior a aproximadamente 0,5% como possível sinal relevante EM DETERMINADAS COMPARAÇÕES. Não transformar 0,5% em regra universal rígida. Usar como referência contextual conforme especificado.",
        priority: "MEDIA",
        tags: ["crescimento", "0-5", "contextual", "referencia"],
        version: 1,
      },
    ],
  },
  {
    number: 14,
    slug: "visitas-ao-perfil",
    title: "Visitas ao Perfil",
    description:
      "Usar visitas para separar distribuição (poucos chegam) de conversão (chegam, mas não seguem).",
    rules: [
      {
        slug: "separar-distribuicao-conversao",
        module: 14,
        title: "Visitas separam distribuição de conversão",
        type: "DIAGNOSTIC_RULE",
        category: "conversao",
        content:
          "Usar visitas ao perfil para separar: DISTRIBUIÇÃO (poucas pessoas chegam) de CONVERSÃO (pessoas chegam, mas não seguem). Utilizar janela recente/7 dias quando a API disponibilizar.",
        priority: "ALTA",
        tags: ["visitas", "distribuicao", "conversao", "perfil"],
        version: 1,
      },
    ],
  },
  {
    number: 15,
    slug: "snapshots",
    title: "Snapshots",
    description:
      "Histórico obrigatório: análise de 7, 30, 90 dias e personalizado. Estado atual isolado não basta.",
    rules: [
      {
        slug: "historico-obrigatorio",
        module: 15,
        title: "Histórico é obrigatório",
        type: "DIAGNOSTIC_RULE",
        category: "historico",
        content:
          "Histórico é obrigatório. Permitir análises: 7 dias, 30 dias, 90 dias e personalizado. Métricas possíveis: seguidores, alcance, engajamento, Reels e Stories. Estado atual isolado não basta.",
        priority: "ALTA",
        tags: ["snapshots", "historico", "7d", "30d", "90d"],
        version: 1,
      },
    ],
  },
  {
    number: 16,
    slug: "comparacao-periodos",
    title: "Comparação entre Períodos",
    description:
      "Comparar período atual com o anterior equivalente. 1% é referência contextual, não regra universal.",
    rules: [
      {
        slug: "comparar-periodo-anterior",
        module: 16,
        title: "Comparar com período anterior equivalente",
        type: "DIAGNOSTIC_RULE",
        category: "historico",
        content:
          "Comparar: período atual × período imediatamente anterior equivalente. Detectar: crescimento, queda, estabilidade, aceleração e desaceleração.",
        priority: "ALTA",
        tags: ["comparacao", "periodos", "crescimento", "queda"],
        version: 1,
      },
      {
        slug: "referencia-1-porcento",
        module: 16,
        title: "Referência contextual de 1%",
        type: "METRIC_RULE",
        category: "historico",
        content:
          "Variações próximas/acima de aproximadamente 1% PODEM alimentar insight de mudança relevante dependendo da métrica. Não tornar 1% uma regra universal para tudo.",
        priority: "MEDIA",
        tags: ["comparacao", "1-porcento", "contextual"],
        version: 1,
      },
    ],
  },
  {
    number: 17,
    slug: "alertas",
    title: "Alertas",
    description:
      "Alertas oficiais com severidade ALTA/MÉDIA/BAIXA para mostrar o que merece atenção.",
    rules: [
      {
        slug: "alertas-oficiais",
        module: 17,
        title: "Alertas oficiais",
        type: "METRIC_RULE",
        category: "alertas",
        content:
          "Alertas oficiais: queda de alcance, aumento de alcance, queda de engajamento, aumento de engajamento, crescimento desacelerando, excesso de dias sem postagem, Reel fraco e conteúdo acima da média.",
        priority: "ALTA",
        tags: ["alertas", "alcance", "engajamento", "dias-sem-postar"],
        version: 1,
      },
      {
        slug: "severidade-alertas",
        module: 17,
        title: "Severidade dos alertas",
        type: "METRIC_RULE",
        category: "alertas",
        content:
          "Severidade: ALTA, MÉDIA, BAIXA. Objetivo: mostrar o que merece atenção, não despejar números.",
        priority: "MEDIA",
        tags: ["alertas", "severidade"],
        version: 1,
      },
    ],
  },
  {
    number: 18,
    slug: "categorias-diagnostico",
    title: "Categorias de Diagnóstico",
    description:
      "Categorias de diagnóstico e o princípio de que mesmo número de seguidores pode ter diagnósticos diferentes.",
    rules: [
      {
        slug: "categorias-diagnostico-lista",
        module: 18,
        title: "Categorias de diagnóstico",
        type: "DIAGNOSTIC_RULE",
        category: "diagnostico",
        content:
          "Categorias de diagnóstico: Bio, Consistência, Crescimento, Engajamento, Posicionamento e Atividade.",
        priority: "ALTA",
        tags: ["diagnostico", "bio", "consistencia", "crescimento", "engajamento"],
        version: 1,
      },
      {
        slug: "mesmos-seguidores-diagnosticos-diferentes",
        module: 18,
        title: "Número de seguidores não define diagnóstico",
        type: "DIAGNOSTIC_RULE",
        category: "diagnostico",
        content:
          "Perfis com mesmo número de seguidores podem ter diagnósticos diferentes.",
        priority: "ALTA",
        tags: ["diagnostico", "seguidores", "contexto"],
        version: 1,
      },
    ],
  },
  {
    number: 19,
    slug: "growth-score",
    title: "Growth Score",
    description:
      "Estrutura de referência inicial do Score (30/25/25/20), explicável e sem zerar dados indisponíveis.",
    rules: [
      {
        slug: "ponderacao-score-oficial",
        module: 19,
        title: "Ponderação inicial do Score",
        type: "METRIC_RULE",
        category: "score",
        content:
          "Estrutura de referência: 30% Engajamento, 25% Crescimento, 25% Alcance, 20% Consistência. Esta ponderação é a regra inicial oficial, mas o motor deve ser versionável.",
        priority: "ALTA",
        tags: ["score", "ponderacao", "30", "25", "20", "versionavel"],
        version: 1,
      },
      {
        slug: "score-explicavel",
        module: 19,
        title: "Score explicável e sem zero para indisponível",
        type: "METRIC_RULE",
        category: "score",
        content:
          "O Score deve: ser explicável, lidar com métrica indisponível, não transformar indisponível em zero e mostrar fatores que contribuíram. O backend também pode considerar: taxa de engajamento, escala de seguidores, alcance e crescimento semanal.",
        priority: "ALTA",
        tags: ["score", "explicavel", "indisponivel", "fatores"],
        version: 1,
      },
      {
        slug: "score-resumo-saude",
        module: 19,
        title: "Score como resumo de saúde",
        type: "PRINCIPLE",
        category: "score",
        content:
          "A nota serve como resumo da saúde, não como gamificação vazia.",
        priority: "MEDIA",
        tags: ["score", "saude", "nao-gamificacao-vazia"],
        version: 1,
      },
    ],
  },
];
