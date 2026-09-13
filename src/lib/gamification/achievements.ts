import type { Achievement } from "@prisma/client";

/**
 * CATÁLOGO OFICIAL DE CONQUISTAS — Fase 5
 * =========================================
 * Definições GLOBAIS (sem userId). Baseadas exclusivamente em ações reais do
 * aplicativo e comportamentos que contribuem para crescimento (Módulo 28 do
 * Knowledge Engine). Nenhuma conquista inventada ou baseada em métricas que
 * ainda não existem.
 *
 * Regras:
 * - XP ~5–100 conforme dificuldade (referência oficial, versionável).
 * - Ao atingir ~70% de um conjunto, entram desafios mais difíceis (hidden).
 * - Cada conquista tem `threshold` (progresso necessário) e `unit`.
 *
 * Este catálogo é o SEED oficial. A persistência (`Achievement` table) é feita
 * de forma idempotente em `seed-achievements` (executado junto ao seed da
 * Fase 4.5 quando autorizado). As definições abaixo são a fonte de verdade.
 */

export interface AchievementDefinition {
  slug: string;
  title: string;
  description: string;
  category: string;
  xpReward: number;
  threshold: number;
  unit: string | null;
  tier: "BRONZE" | "PRATA" | "OURO" | "DESAFIO";
  hidden: boolean;
  version: number;
  active: boolean;
}

/**
 * Progresso "como medir" por conquista. O motor de progresso lê esta lista
 * para calcular o progresso atual de cada usuário a partir de DADOS REAIS
 * (tabelas existentes) — nunca inventa números.
 */
export type ProgressKind =
  | "copies_criadas" // GeneratedCopy count
  | "ideias_salvas" // ContentIdea count
  | "drafts_criados" // SocialDraft count
  | "recomendacoes_aplicadas" // MentorshipRecommendation APLICADA/CONCLUIDA
  | "experimentos_completados" // GrowthExperiment CONFIRMED/REJECTED
  | "analises_rodadas" // ProfileScoreSnapshot count
  | "snapshots_instagram" // InstagramSnapshot count
  | "snapshots_tiktok" // TikTokSnapshot count
  | "perfil_completo" // AIProfile preenchido (niche, objectives)
  | "primeira_semana_ativa" // uso do app em 7 dias (XpLog com fontes variadas)
  | "frequencia_consistente" // 3+ dias com snapshots numa semana (consistência)
  | "desafio_primeiro_nivel" // atingir nível 5
  | "desafio_maestria_xp" // acumular 1000 XP
  | "desafio_metas_concluidas" // UserGoal CONCLUIDA count
  | "desafio_10_conquistas"; // desbloquear 10 conquistas

export interface AchievementCatalogEntry extends AchievementDefinition {
  progressKind: ProgressKind;
}

export const ACHIEVEMENT_CATALOG: AchievementCatalogEntry[] = [
  // ------------------------------------------------
  // USO — ferramentas (XP baixo)
  // ------------------------------------------------
  {
    slug: "primeira-copy",
    title: "Primeira Copy",
    description: "Gerou e salvou sua primeira copy.",
    category: "uso",
    xpReward: 10,
    threshold: 1,
    unit: "copy",
    tier: "BRONZE",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "copies_criadas",
  },
  {
    slug: "primeira-ideia",
    title: "Primeira Ideia",
    description: "Salvou a primeira ideia de conteúdo.",
    category: "uso",
    xpReward: 10,
    threshold: 1,
    unit: "ideia",
    tier: "BRONZE",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "ideias_salvas",
  },
  {
    slug: "primeiro-rascunho",
    title: "Primeiro Rascunho",
    description: "Montou o primeiro preview/rascunho.",
    category: "uso",
    xpReward: 10,
    threshold: 1,
    unit: "rascunho",
    tier: "BRONZE",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "drafts_criados",
  },
  {
    slug: "analista-em-acao",
    title: "Analista em Ação",
    description: "Rodou a análise de desempenho pela primeira vez.",
    category: "uso",
    xpReward: 10,
    threshold: 1,
    unit: "análise",
    tier: "BRONZE",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "analises_rodadas",
  },
  // ------------------------------------------------
  // CONSISTÊNCIA — acompanhar resultados
  // ------------------------------------------------
  {
    slug: "primeira-semana-ativa",
    title: "Primeira Semana Ativa",
    description: "Usou o Inst Acessor com consistência durante uma semana.",
    category: "consistencia",
    xpReward: 20,
    threshold: 7,
    unit: "dias",
    tier: "BRONZE",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "primeira_semana_ativa",
  },
  {
    slug: "frequencia-consistente",
    title: "Frequência Consistente",
    description: "Registrou métricas em 3+ dias na mesma semana.",
    category: "consistencia",
    xpReward: 25,
    threshold: 3,
    unit: "dias",
    tier: "PRATA",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "frequencia_consistente",
  },
  {
    slug: "snapshots-instagram",
    title: "Olho no Instagram",
    description: "Acumulou 5 sincronizações do Instagram.",
    category: "consistencia",
    xpReward: 30,
    threshold: 5,
    unit: "sincronizações",
    tier: "PRATA",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "snapshots_instagram",
  },
  {
    slug: "snapshots-tiktok",
    title: "Olho no TikTok",
    description: "Acumulou 5 sincronizações do TikTok.",
    category: "consistencia",
    xpReward: 30,
    threshold: 5,
    unit: "sincronizações",
    tier: "PRATA",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "snapshots_tiktok",
  },
  // ------------------------------------------------
  // ESTRATÉGIA — executar recomendações, testar, completar
  // ------------------------------------------------
  {
    slug: "recomendacao-executada",
    title: "Recomendação Executada",
    description: "Executou uma recomendação da Mentoria.",
    category: "estrategia",
    xpReward: 40,
    threshold: 1,
    unit: "recomendação",
    tier: "PRATA",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "recomendacoes_aplicadas",
  },
  {
    slug: "experimento-completado",
    title: "Cientista do Crescimento",
    description: "Completou um experimento (confirmado ou rejeitado).",
    category: "estrategia",
    xpReward: 50,
    threshold: 1,
    unit: "experimento",
    tier: "PRATA",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "experimentos_completados",
  },
  {
    slug: "perfil-completo",
    title: "Perfil Afiado",
    description: "Preencheu seu perfil de inteligência (nicho e objetivos).",
    category: "estrategia",
    xpReward: 15,
    threshold: 1,
    unit: "perfil",
    tier: "BRONZE",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "perfil_completo",
  },
  {
    slug: "metas-concluidas",
    title: "Meta Batida",
    description: "Concluiu sua primeira meta estratégica.",
    category: "estrategia",
    xpReward: 35,
    threshold: 1,
    unit: "meta",
    tier: "PRATA",
    hidden: false,
    version: 1,
    active: true,
    progressKind: "desafio_metas_concluidas",
  },
  // ------------------------------------------------
  // DESAFIOS — entram quando ~70% do conjunto for alcançado
  // ------------------------------------------------
  {
    slug: "desafio-nivel-5",
    title: "Desafio: Nível 5",
    description: "Alcançou o nível 5 de progressão.",
    category: "estrategia",
    xpReward: 60,
    threshold: 5,
    unit: "níveis",
    tier: "DESAFIO",
    hidden: true,
    version: 1,
    active: true,
    progressKind: "desafio_primeiro_nivel",
  },
  {
    slug: "desafio-maestria-xp",
    title: "Desafio: Mestre do XP",
    description: "Acumulou 1000 XP de progressão.",
    category: "estrategia",
    xpReward: 80,
    threshold: 1000,
    unit: "xp",
    tier: "DESAFIO",
    hidden: true,
    version: 1,
    active: true,
    progressKind: "desafio_maestria_xp",
  },
  {
    slug: "desafio-10-conquistas",
    title: "Desafio: Colecionador",
    description: "Desbloqueou 10 conquistas diferentes.",
    category: "estrategia",
    xpReward: 100,
    threshold: 10,
    unit: "conquistas",
    tier: "DESAFIO",
    hidden: true,
    version: 1,
    active: true,
    progressKind: "desafio_10_conquistas",
  },
];

/** Converte a definição para o model Prisma Achievement (sem progressKind). */
export function toAchievementModel(def: AchievementCatalogEntry): Omit<
  Achievement,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    slug: def.slug,
    title: def.title,
    description: def.description,
    category: def.category,
    xpReward: def.xpReward,
    threshold: def.threshold,
    unit: def.unit,
    tier: def.tier,
    hidden: def.hidden,
    version: def.version,
    active: def.active,
  };
}

/** Busca uma definição por slug. */
export function getAchievementBySlug(slug: string): AchievementCatalogEntry | undefined {
  return ACHIEVEMENT_CATALOG.find((a) => a.slug === slug);
}

/** Retorna as conquistas visíveis (não-hidden) — os desafios entram pós-70%. */
export function visibleAchievements(): AchievementCatalogEntry[] {
  return ACHIEVEMENT_CATALOG.filter((a) => !a.hidden);
}
