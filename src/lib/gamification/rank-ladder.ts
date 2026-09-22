/**
 * ESCADA DO RANK — DUAS CAMADAS (5 ranks × 5 níveis internos)
 * ============================================================
 * Módulo PURO (sem banco, sem React, sem HTTP). É a FONTE ÚNICA da progressão
 * de Rank do Inst Acessor, e existe porque a implementação anterior confundia
 * duas coisas diferentes:
 *
 *   CAMADA 1 — RANK GERAL: Bronze, Prata, Ouro, Diamante, Lendário.
 *   CAMADA 2 — NÍVEL INTERNO: cada Rank tem 5 níveis (1..5 estrelas).
 *
 * São 5 × 5 = 25 estágios. "Nível 3" sozinho NÃO identifica ninguém: o que
 * identifica é o PAR (Rank, Nível) — ex.: "Bronze • Nível 3". Toda superfície
 * (Rank, Ranking, Perfil Público) deve exibir o par, nunca só o nível.
 *
 * ---------------------------------------------------------------------------
 * MODELO DE XP (definido pelo produto)
 * ---------------------------------------------------------------------------
 * Os limiares são XP ABSOLUTO (sobre `totalXpEarned`), não um offset dentro do
 * Rank. O primeiro Rank, Bronze, começa em 0 XP:
 *
 *   Bronze  Nível 1 → 0        (início do Rank)
 *   Bronze  Nível 2 → 200
 *   Bronze  Nível 3 → 450
 *   Bronze  Nível 4 → 700
 *   Bronze  Nível 5 → 1.000    ← AINDA É BRONZE
 *
 * O Bronze TERMINA em 2.500 XP. Ou seja: os 1.000 XP do 5º limiar NÃO promovem
 * ninguém para o Prata — eles ABREM o Bronze Nível 5, que é um estado real e
 * duradouro (o usuário permanece nele de 1.000 a 2.499 XP). A promoção para
 * Prata Nível 1 só acontece aos 2.500 XP, depois de concluir o Bronze Nível 5.
 *
 * Isso é o que dá sentido às estrelas: com 1.000 XP o usuário vê
 * "Bronze • Nível 5 ★★★★★" e tem um trecho de progresso até a promoção. A
 * versão anterior deste módulo tratava o 5º limiar como fim do Rank, e por isso
 * o Nível 5 nascia já promovido — nunca era exibido como estado atual.
 *
 * Os números já anunciados na landing (1.000 / 2.500 / 5.000 / 10.000 / 20.000)
 * continuam sendo os marcos da escada: 1.000 é o topo do Bronze, e 2.500 /
 * 5.000 / 10.000 / 20.000 são onde Prata / Ouro / Diamante / Lendário COMEÇAM.
 *
 * Fora daqui, NENHUM arquivo deve repetir esses números: a landing lê daqui, o
 * servidor lê daqui, o cliente lê daqui.
 *
 * ---------------------------------------------------------------------------
 * LIMIARES INTERNOS AINDA NÃO DEFINIDOS PELO PRODUTO (leia antes de mexer)
 * ---------------------------------------------------------------------------
 * O produto definiu APENAS os 5 limiares internos do Bronze. Prata, Ouro,
 * Diamante e Lendário ainda não têm os níveis internos especificados.
 *
 * Para esses quatro, este módulo aplica uma DIVISÃO PROVISÓRIA: o intervalo de
 * XP do Rank é partido em 5 níveis de tamanho igual, e cada Rank fica marcado
 * com `provisional: true`. É uma decisão EXPLÍCITA e auditável — está nesta
 * tabela, não espalhada em `if`s — e a UI avisa que os limiares são
 * provisórios. Substituir pelos números reais é editar UMA tabela.
 *
 * O Lendário é o topo da escada e também não tem teto definido; para que o
 * Nível 5 dele não seja "infinito" (e o progresso continue calculável), usamos
 * `PROVISIONAL_TOP_END_XP`, pelo mesmo padrão de dobra dos Ranks anteriores
 * (2.500 → 5.000 → 10.000 → 20.000 → 40.000). Também é provisório.
 */

/** Quantidade de níveis internos que TODO Rank possui. */
export const RANK_LEVELS = 5;

/**
 * Teto PROVISÓRIO do Lendário. O produto não definiu onde a escada termina;
 * este valor continua a dobra dos Ranks anteriores (…10.000 → 20.000 → 40.000)
 * e existe só para o Nível 5 do Lendário ter um trecho real de permanência.
 * Substituir quando o produto definir o topo definitivo.
 */
export const PROVISIONAL_TOP_END_XP = 40000;

/**
 * FAIXAS GERAIS DE RANK — a tabela oficial.
 *
 * `maxXp` é o XP em que o Rank TERMINA (não onde começa). A ordem do array é a
 * ordem de progressão; `startXp` de um Rank é o `maxXp` do anterior (o Bronze
 * começa em 0), então NÃO existe campo `startXp` aqui para os dois valores não
 * poderem divergir.
 *
 * Atenção: estes números são usados pela landing e por todo o app. Alterá-los
 * move a progressão inteira, não apenas a exibição.
 */
export const RANK_TIERS = [
  { key: "BRONZE", label: "Bronze", maxXp: 2500 },
  { key: "PRATA", label: "Prata", maxXp: 5000 },
  { key: "OURO", label: "Ouro", maxXp: 10000 },
  { key: "DIAMANTE", label: "Diamante", maxXp: 20000 },
  { key: "LENDARIO", label: "Lendário", maxXp: PROVISIONAL_TOP_END_XP },
] as const;

export type RankTierKey = (typeof RANK_TIERS)[number]["key"];

export interface RankLadderDef {
  key: RankTierKey;
  /** Rótulo exibido ("Bronze"). */
  label: string;
  /** Índice 0–4 na ordem da escada. */
  index: number;
  /** XP em que o Rank começa (Bronze = 0; demais = fim do anterior). */
  startXp: number;
  /** XP em que o Rank termina (aqui o usuário já é promovido ao próximo). */
  endXp: number;
  /** XP de ENTRADA de cada nível (estrelas 1..5) — 5 posições crescentes. */
  levelThresholds: readonly [number, number, number, number, number];
  /** `true` = limiares internos ainda NÃO definidos pelo produto. */
  provisional: boolean;
}

/**
 * Bronze — os ÚNICOS limiares internos definidos pelo produto.
 *
 * Todos os 5 ficam ABAIXO do fim do Rank (2.500), então cada um abre um estado
 * real: em 1.000 XP o usuário está em Bronze Nível 5 e permanece nele até os
 * 2.500 XP, quando vira Prata Nível 1.
 */
const BRONZE_THRESHOLDS = [0, 200, 450, 700, 1000] as const;

/**
 * Divisão PROVISÓRIA de um intervalo em 5 níveis de tamanho igual.
 *
 * Só nos Ranks sem definição do produto. `Math.floor` garante que o 5º limiar
 * fique ESTRITAMENTE abaixo de `endXp`, deixando um trecho real de permanência
 * no Nível 5 antes da promoção — o mesmo formato que o Bronze tem por definição
 * do produto.
 */
function provisionalThresholds(
  startXp: number,
  endXp: number
): [number, number, number, number, number] {
  const step = Math.floor((endXp - startXp) / RANK_LEVELS);
  return [
    startXp,
    startXp + step,
    startXp + step * 2,
    startXp + step * 3,
    startXp + step * 4,
  ];
}

/** A ESCADA COMPLETA, na ordem de progressão. Derivada de `RANK_TIERS`. */
export const RANK_LADDER: readonly RankLadderDef[] = RANK_TIERS.map((tier, index) => {
  const startXp = index === 0 ? 0 : RANK_TIERS[index - 1].maxXp;
  const isBronze = tier.key === "BRONZE";
  return {
    key: tier.key,
    label: tier.label,
    index,
    startXp,
    endXp: tier.maxXp,
    levelThresholds: (isBronze
      ? BRONZE_THRESHOLDS
      : provisionalThresholds(startXp, tier.maxXp)) as RankLadderDef["levelThresholds"],
    provisional: !isBronze,
  };
});

/** Ranks cujos limiares internos ainda dependem de definição do produto. */
export const PROVISIONAL_RANKS: RankTierKey[] = RANK_LADDER.filter((r) => r.provisional).map(
  (r) => r.key
);

/** Um estágio da escada: o PAR (Rank, Nível) que identifica a progressão. */
export interface RankStage {
  rankKey: RankTierKey;
  rankLabel: string;
  /** 1..5 — estrelas do nível interno. */
  level: number;
  /** XP de entrada deste estágio. */
  minXp: number;
  /** XP de entrada do próximo estágio (`null` no último dos 25). */
  nextMinXp: number | null;
  /** `true` quando o Rank deste estágio tem limiares provisórios. */
  provisional: boolean;
}

/** Os 25 estágios, na ordem de progressão. */
export const RANK_STAGES: readonly RankStage[] = RANK_LADDER.flatMap((rank) =>
  rank.levelThresholds.map((minXp, i) => {
    const isLastLevelOfRank = i === RANK_LEVELS - 1;
    const nextRank = RANK_LADDER[rank.index + 1] ?? null;
    return {
      rankKey: rank.key,
      rankLabel: rank.label,
      level: i + 1,
      minXp,
      // No último nível de um Rank, o próximo estágio é o Nível 1 do Rank
      // seguinte (que começa exatamente em `endXp`), não outro nível interno.
      nextMinXp: isLastLevelOfRank
        ? nextRank
          ? nextRank.startXp
          : null
        : rank.levelThresholds[i + 1],
      provisional: rank.provisional,
    };
  })
);

export interface RankLadderState {
  /** XP acumulado (entrada). */
  xp: number;
  rankKey: RankTierKey;
  rankLabel: string;
  rankIndex: number;
  /** 1..5 — nível interno ATUAL (estrelas preenchidas). */
  level: number;
  /** `true` = limiares do Rank atual são provisórios. */
  provisional: boolean;
  /** Rótulo pronto para exibição: "Bronze • Nível 3". */
  label: string;
  /** XP em que o RANK atual começa (Bronze = 0; Prata = 2.500; …). */
  rankStartXp: number;
  /** XP em que o RANK atual termina (= entrada do próximo). */
  rankEndXp: number;
  /** XP de entrada do nível atual. */
  levelMinXp: number;
  /** XP de entrada do próximo nível interno (`null` no último do Rank). */
  nextLevelMinXp: number | null;
  /** XP que falta para o próximo nível interno (`null` no último do Rank). */
  xpToNextLevel: number | null;
  /** Progresso 0–100 DENTRO do nível atual. `null` no último nível do Rank. */
  progressToNextLevel: number | null;
  nextRankKey: RankTierKey | null;
  nextRankLabel: string | null;
  /** XP em que o próximo Rank começa (= fim do atual). `null` no Lendário. */
  nextRankStartXp: number | null;
  /** XP que falta para o próximo Rank (`null` no Lendário). */
  xpToNextRank: number | null;
  /** Progresso 0–100 DENTRO do Rank atual. `null` no Lendário (topo). */
  progressToNextRank: number | null;
  /** `true` quando o XP alcançou o fim do Rank ATUAL (só possível no topo). */
  rankCompleted: boolean;
}

const clampXp = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Resolve o estágio (Rank + Nível) a partir do XP ACUMULADO.
 *
 * Regra do limite: o limiar pertence ao estágio que ele ABRE, e a promoção de
 * Rank só ocorre no `endXp` — que é sempre ESTRITAMENTE MAIOR que o 5º limiar.
 * Com 1.000 XP o usuário está em Bronze Nível 5 (5 estrelas); com 2.500 XP, em
 * Prata Nível 1.
 */
export function rankLadderFromXp(totalXp: number): RankLadderState {
  const xp = clampXp(totalXp);

  // Rank que contém o XP: o último cujo início já foi alcançado. O Lendário não
  // tem teto — acima do fim dele o usuário permanece no topo.
  let rank = RANK_LADDER[0];
  for (const candidate of RANK_LADDER) {
    if (xp >= candidate.startXp) rank = candidate;
  }

  // Nível interno: o maior limiar já alcançado. Todos os 5 limiares de um Rank
  // ficam abaixo do `endXp` dele (no Bronze por definição do produto, nos
  // demais pela divisão provisória com `Math.floor`), então o Nível 5 é um
  // estado alcançável de verdade — não um instante.
  let level = 1;
  for (let i = 0; i < RANK_LEVELS; i++) {
    if (xp >= rank.levelThresholds[i]) level = i + 1;
  }

  const levelMinXp = rank.levelThresholds[level - 1];
  const isLastLevelOfRank = level === RANK_LEVELS;
  const nextLevelMinXp = isLastLevelOfRank ? null : rank.levelThresholds[level];

  const nextRank = RANK_LADDER[rank.index + 1] ?? null;
  const levelSpan = nextLevelMinXp != null ? nextLevelMinXp - levelMinXp : 0;
  const rankSpan = rank.endXp - rank.startXp;

  return {
    xp,
    rankKey: rank.key,
    rankLabel: rank.label,
    rankIndex: rank.index,
    level,
    provisional: rank.provisional,
    label: `${rank.label} • Nível ${level}`,
    rankStartXp: rank.startXp,
    rankEndXp: rank.endXp,
    levelMinXp,
    nextLevelMinXp,
    xpToNextLevel: nextLevelMinXp != null ? Math.max(0, nextLevelMinXp - xp) : null,
    progressToNextLevel:
      nextLevelMinXp != null && levelSpan > 0
        ? Math.min(100, Math.round(((xp - levelMinXp) / levelSpan) * 10000) / 100)
        : null,
    nextRankKey: nextRank?.key ?? null,
    nextRankLabel: nextRank?.label ?? null,
    nextRankStartXp: nextRank ? rank.endXp : null,
    xpToNextRank: nextRank ? Math.max(0, rank.endXp - xp) : null,
    progressToNextRank:
      nextRank && rankSpan > 0
        ? Math.min(100, Math.round(((xp - rank.startXp) / rankSpan) * 10000) / 100)
        : null,
    rankCompleted: xp >= rank.endXp,
  };
}

/** Estado de UM Rank na jornada, para a aba "Ranks". */
export interface RankJourneyEntry {
  key: RankTierKey;
  label: string;
  index: number;
  startXp: number;
  endXp: number;
  levelThresholds: readonly number[];
  /** `true` = limiares internos ainda provisórios (aguardando o produto). */
  provisional: boolean;
  /** Estrelas conquistadas dentro deste Rank (0..5). */
  starsEarned: number;
  /** Estrelas totais deste Rank (sempre 5). */
  starsTotal: number;
  /** `true` = Rank já concluído. */
  completed: boolean;
  /** `true` = Rank atual do usuário. */
  current: boolean;
  /** `true` = ainda não alcançado. */
  locked: boolean;
  /** Progresso 0–100 dentro deste Rank. */
  progressPercent: number;
}

/**
 * Jornada COMPLETA: os 5 Ranks com o estado real de cada um, para a aba
 * "Ranks" (concluído / atual / bloqueado). Derivada do MESMO cálculo que
 * posiciona o usuário — não há uma segunda contagem de estrelas.
 */
export function rankJourneyFromXp(totalXp: number): RankJourneyEntry[] {
  const state = rankLadderFromXp(totalXp);
  const xp = state.xp;

  return RANK_LADDER.map((rank) => {
    const current = rank.key === state.rankKey;
    const completed = rank.index < state.rankIndex;
    const locked = rank.index > state.rankIndex;

    const starsEarned = completed ? RANK_LEVELS : current ? state.level : 0;

    const span = rank.endXp - rank.startXp;
    const progressPercent = completed
      ? 100
      : locked || span <= 0
        ? 0
        : Math.min(100, Math.round(((xp - rank.startXp) / span) * 10000) / 100);

    return {
      key: rank.key,
      label: rank.label,
      index: rank.index,
      startXp: rank.startXp,
      endXp: rank.endXp,
      levelThresholds: rank.levelThresholds,
      provisional: rank.provisional,
      starsEarned,
      starsTotal: RANK_LEVELS,
      completed,
      current,
      locked,
      progressPercent,
    };
  });
}
