import type { KnowledgeModule } from "../types";

/**
 * MÓDULOS 01, 02 E 21 — PRINCÍPIOS CENTRAIS
 * Conteúdo oficial fornecido pela DONA (Fase 4.5). Nada de metodologia externa.
 */

export const coreModules: KnowledgeModule[] = [
  {
    number: 1,
    slug: "principio-central",
    title: "Princípio Central",
    description:
      "Ciclo oficial do cérebro estratégico: dados → diagnóstico → estratégia → conteúdo → publicação → resultado → aprendizado → nova estratégia.",
    rules: [
      {
        slug: "ciclo-principal",
        module: 1,
        title: "Ciclo principal oficial",
        type: "PRINCIPLE",
        category: "estrategia",
        content:
          "O ciclo principal oficial é: DADOS → DIAGNÓSTICO → ESTRATÉGIA → CONTEÚDO → PUBLICAÇÃO → RESULTADO → APRENDIZADO → NOVA ESTRATÉGIA. Também: ANALISAR → RECOMENDAR → EXECUTAR → MEDIR → COMPARAR → APRENDER → AJUSTAR.",
        priority: "ALTA",
        tags: ["ciclo", "estrategia", "aprendizado", "sistema"],
        version: 1,
      },
      {
        slug: "objetivo-sistema",
        module: 1,
        title: "Objetivo do motor",
        type: "PRINCIPLE",
        category: "estrategia",
        content:
          "Objetivo: entender o que funciona, o que trava o crescimento, o que atrai, retém, engaja, converte e deve ser repetido ou abandonado. O crescimento deve ser tratado como um sistema mensurável.",
        priority: "ALTA",
        tags: ["crescimento", "sistema", "mensuravel", "objetivo"],
        version: 1,
      },
      {
        slug: "combinacao-inteligencia",
        module: 1,
        title: "Combinação da camada de inteligência",
        type: "PRINCIPLE",
        category: "estrategia",
        content:
          "A camada de inteligência combina: CONHECIMENTO OFICIAL + DADOS REAIS DO PERFIL + HISTÓRICO + CONTEÚDOS + RESULTADOS + EXPERIMENTOS para gerar DIAGNÓSTICO e ESTRATÉGIA personalizados.",
        priority: "ALTA",
        tags: ["inteligencia", "dados", "historico", "experimentos"],
        version: 1,
      },
    ],
  },
  {
    number: 2,
    slug: "quatro-pilares",
    title: "Quatro Pilares",
    description:
      "Conteúdo, Retenção, Distribuição e Conversão — os quatro eixos de análise do perfil.",
    rules: [
      {
        slug: "pilar-conteudo",
        module: 2,
        title: "Pilar Conteúdo",
        type: "DIAGNOSTIC_RULE",
        category: "conteudo",
        content:
          "Analisar Reels, Stories, posts, temas, formatos, frequência, legendas, estilo, posicionamento e desempenho individual.",
        priority: "ALTA",
        tags: ["conteudo", "reels", "stories", "posts", "formatos"],
        version: 1,
      },
      {
        slug: "pilar-retencao",
        module: 2,
        title: "Pilar Retenção",
        type: "DIAGNOSTIC_RULE",
        category: "retencao",
        content:
          "Fluxo conceitual de retenção: Impressão → início → retenção → consumo → interação → visita → seguidor.",
        priority: "ALTA",
        tags: ["retencao", "fluxo", "consumo", "interacao"],
        version: 1,
      },
      {
        slug: "pilar-distribuicao",
        module: 2,
        title: "Pilar Distribuição",
        type: "DIAGNOSTIC_RULE",
        category: "alcance",
        content:
          "Analisar alcance, reproduções, visualizações, evolução, desempenho de Reels e comparação entre períodos.",
        priority: "ALTA",
        tags: ["distribuicao", "alcance", "reproducoes", "visualizacoes"],
        version: 1,
      },
      {
        slug: "pilar-conversao",
        module: 2,
        title: "Pilar Conversão",
        type: "DIAGNOSTIC_RULE",
        category: "conversao",
        content:
          "Analisar bio, posicionamento, proposta, clareza de nicho, consistência visual, conteúdo recente e autoridade percebida.",
        priority: "ALTA",
        tags: ["conversao", "bio", "posicionamento", "nicho", "autoridade"],
        version: 1,
      },
    ],
  },
  {
    number: 21,
    slug: "regra-fundamental-ia",
    title: "Regra Fundamental da IA",
    description:
      "Nunca inventar métricas; separar dado real, conhecimento, inferência, hipótese e recomendação.",
    rules: [
      {
        slug: "regra-confiavel",
        module: 21,
        title: "Categorias de confiabilidade",
        type: "AI_GUARDRAIL",
        category: "confiabilidade",
        content:
          "A IA deve distinguir explicitamente: 1. DADO REAL (API/snapshot/banco), 2. CONHECIMENTO (regra/metodologia oficial da DONA), 3. INFERÊNCIA (interpretação derivada dos dados), 4. HIPÓTESE (explicação que precisa de teste), 5. RECOMENDAÇÃO (próxima ação sugerida). NUNCA misturar essas categorias.",
        priority: "ALTA",
        tags: ["confiabilidade", "dado", "inferencia", "hipotese", "regra"],
        version: 1,
      },
      {
        slug: "nunca-inventar-metricas",
        module: 21,
        title: "Nunca inventar métricas",
        type: "AI_GUARDRAIL",
        category: "confiabilidade",
        content:
          "NUNCA inventar métricas. Exemplo proibido: “Sua retenção é 72%” se a API não forneceu retenção. Exemplo correto: “Não há dado de retenção disponível. O Reel apresentou alcance acima da média e podemos testar uma hipótese sobre gancho/estrutura, mas não é possível afirmar retenção.”",
        priority: "ALTA",
        tags: ["confiabilidade", "retencao", "exemplo", "nao-inventar"],
        version: 1,
      },
      {
        slug: "toda-resposta-tem-base",
        module: 21,
        title: "Toda resposta estratégica indica sua base",
        type: "AI_GUARDRAIL",
        category: "confiabilidade",
        content:
          "Toda resposta estratégica relevante deve conseguir indicar sua base: dado real, conhecimento, inferência, hipótese ou recomendação.",
        priority: "ALTA",
        tags: ["confiabilidade", "base", "transparencia"],
        version: 1,
      },
    ],
  },
];
