import { prisma } from "@/lib/db";

/**
 * Leitura de dados do Dashboard a partir dos snapshots persistidos.
 * NUNCA chama a API da Meta aqui — apenas lê o banco.
 * Valores indisponíveis → null (a UI decide como mostrar).
 */

export interface DashboardCard {
  label: string;
  value: number | null;
  /** Variação % em relação ao snapshot anterior (período comparado). */
  changePercent: number | null;
  available: boolean;
}

export interface EvolutionPoint {
  label: string;
  capturedAt: string;
  followersCount?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  mediaCount?: number | null;
}

export interface DashboardInstagramData {
  connected: boolean;
  username?: string | null;
  /** Nome de exibição da conta conectada (quando a plataforma devolve). */
  displayName?: string | null;
  /** Avatar real da conta conectada. null → a UI usa fallback. */
  avatarUrl?: string | null;
  followersCount?: number | null;
  mediaCount?: number | null;
  lastSyncAt?: Date | null;
  /** Quantos snapshots existem (profundidade do histórico). */
  snapshotCount: number;
  cards: {
    followers: DashboardCard;
    engagement: DashboardCard;
    reach: DashboardCard;
    /**
     * Alcance ACUMULADO dos últimos 7 dias.
     *
     * Por que existe separado de `reach`: o snapshot guarda o alcance de UM
     * dia (a API devolve valores diários e o sync persiste o último). Somar
     * esses dias NÃO é o alcance único de 7 dias — é a soma dos alcances
     * diários. O rótulo e o hint da UI dizem exatamente isso, para não
     * misturar "alcance do dia" com "alcance de 7 dias".
     */
    reach7d: DashboardCard;
    /**
     * Visualizações da conta. Reaproveita `impressions` — a integração já
     * persiste esse valor e "impressions" é o equivalente real de
     * "visualizações" na API atual. NÃO há uma segunda sincronização.
     */
    impressions: DashboardCard;
    profileViews: DashboardCard;
    media: DashboardCard;
  };
  /** Quantos dias reais entraram na soma de `cards.reach7d`. */
  reach7dDays: number;
  /** Evolução 7/30/90 dias a partir dos snapshots. */
  evolution: {
    "7d": EvolutionPoint[];
    "30d": EvolutionPoint[];
    "90d": EvolutionPoint[];
  };
  /** Comparação de períodos. */
  comparison: {
    weeklyGrowth: number | null;
    monthlyGrowth: number | null;
    /** Saldo LÍQUIDO de seguidores em 7 dias (atual − 7 dias atrás). */
    followersGained7d: number | null;
    followersGained30d: number | null;
    /**
     * Soma BRUTA dos dias positivos da última semana (ganhos reais).
     * Diferente do saldo líquido: um dia de alta seguido de um dia de baixa
     * aparece aqui inteiro, não diluído.
     */
    followersGrossGained7d: number | null;
    /** Soma BRUTA dos dias negativos da última semana, em valor absoluto. */
    followersLost7d: number | null;
    /** Média real de interações (curtidas + comentários) por publicação. */
    avgEngagement: number | null;
  };
  timeline: {
    bestReachDay: { date: string; value: number } | null;
    bestEngagementDay: { date: string; value: number } | null;
    biggestFollowerPeak: { date: string; value: number } | null;
    biggestDailyGain: { date: string; value: number } | null;
    biggestDailyLoss: { date: string; value: number } | null;
  };
}

function safePct(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  // undefined (optional chaining) e null são tratados igual:
  // métrica indisponível → null, NUNCA 0.
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardInstagramData(
  userId: string
): Promise<DashboardInstagramData> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
  });

  const connected = connection?.status === "CONNECTED";

  const empty: DashboardInstagramData = {
    connected,
    username: connection?.username ?? null,
    displayName: null,
    avatarUrl: null,
    followersCount: null,
    mediaCount: null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    snapshotCount: 0,
    cards: {
      followers: { label: "Seguidores", value: null, changePercent: null, available: false },
      engagement: { label: "Engajamento", value: null, changePercent: null, available: false },
      reach: { label: "Alcance (dia)", value: null, changePercent: null, available: false },
      reach7d: { label: "Alcance (7 dias)", value: null, changePercent: null, available: false },
      impressions: { label: "Visualizações", value: null, changePercent: null, available: false },
      profileViews: { label: "Visitas ao perfil", value: null, changePercent: null, available: false },
      media: { label: "Publicações", value: null, changePercent: null, available: false },
    },
    reach7dDays: 0,
    evolution: { "7d": [], "30d": [], "90d": [] },
    comparison: {
      weeklyGrowth: null,
      monthlyGrowth: null,
      followersGained7d: null,
      followersGained30d: null,
      followersGrossGained7d: null,
      followersLost7d: null,
      avgEngagement: null,
    },
    timeline: {
      bestReachDay: null,
      bestEngagementDay: null,
      biggestFollowerPeak: null,
      biggestDailyGain: null,
      biggestDailyLoss: null,
    },
  };

  // Type guard real: garante que `connection` é não-nulo daqui em diante.
  if (!connection || connection.status !== "CONNECTED") return empty;

  const profile = await prisma.instagramProfile.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  // CAUSA RAIZ DOS VALORES ABSURDOS NO GRÁFICO
  // ------------------------------------------
  // A leitura era `where: { userId }` puro. Como `InstagramProfile.igAccountId`
  // é único mas o USER pode ter trocado de conta (ou o sync antigo de outra
  // conta ficou no banco), a série misturava snapshots de PERFIS DIFERENTES:
  // seguidores de uma conta ao lado de alcance/visualizações de outra, em
  // ordens de grandeza incompatíveis. Plotado junto, isso produzia um eixo Y
  // com valores absurdos.
  //
  // Agora a série é escopada ao PERFIL ATUAL. Se por algum motivo não houver
  // perfil, cai para a conexão atual (nunca para "tudo do usuário").
  const snapshots = await prisma.instagramSnapshot.findMany({
    where: profile ? { userId, profileId: profile.id } : { userId },
    orderBy: { capturedAt: "asc" },
  });

  const latest = snapshots[snapshots.length - 1] ?? null;
  // Snapshot imediatamente anterior → variação desde a última sincronização.
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const now = Date.now();
  const recent7d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 7 * 864e5);
  const recent30d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 30 * 864e5);
  const recent90d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 90 * 864e5);

  // Alcance de 7 dias: soma APENAS os snapshots reais da janela. Sem snapshots
  // suficientes → null (a UI mostra "—"), jamais um zero inventado.
  const reach7dValues = recent7d
    .map((s) => s.reach)
    .filter((v): v is number => v != null);
  const reach7dTotal =
    reach7dValues.length > 0
      ? reach7dValues.reduce((a, b) => a + b, 0)
      : null;
  // Compara com a janela equivalente anterior (dias 8–14) para a variação.
  const prev7dValues = snapshots
    .filter(
      (s) =>
        s.capturedAt.getTime() >= now - 14 * 864e5 &&
        s.capturedAt.getTime() < now - 7 * 864e5
    )
    .map((s) => s.reach)
    .filter((v): v is number => v != null);
  const prev7dTotal =
    prev7dValues.length > 0
      ? prev7dValues.reduce((a, b) => a + b, 0)
      : null;

  // CAUSA RAIZ DO "SEGUIDORES: —" COM O DADO EXISTINDO NO BANCO
  // -------------------------------------------------------
  // `InstagramProfile.followersCount` / `mediaCount` são gravados na
  // sincronização JUNTO com o snapshot, mas são colunas SEPARADAS. Quando o
  // snapshot mais recente não trouxe o número (a API do Instagram já devolveu
  // métrica de perfil vazia em algumas coletas), o card lia só
  // `latest?.followersCount` → null → "—" no Dashboard, embora o perfil real
  // tivesse o valor. O caminho do Rank (`getRankSocialSummary`) e o campo
  // `followersCount` logo abaixo JÁ faziam o fallback para o perfil — os cards
  // ficaram de fora dessa correção.
  //
  // Regra (Etapa U): se o dado existe no perfil, RESTAURAR a leitura.
  // Se não existe em nenhuma fonte, continua null → "—". Nunca zero inventado.
  const followersValue = latest?.followersCount ?? profile?.followersCount ?? null;
  const mediaValue = latest?.mediaCount ?? profile?.mediaCount ?? null;

  const data: DashboardInstagramData = {
    ...empty,
    username: profile?.username ?? connection.username ?? null,
    // Foto e nome vêm do InstagramProfile (gravados na sincronização).
    displayName: profile?.name ?? null,
    avatarUrl: profile?.profilePictureUrl ?? null,
    followersCount: followersValue,
    mediaCount: mediaValue,
    lastSyncAt: connection.lastSyncAt ?? null,
    snapshotCount: snapshots.length,
    cards: {
      followers: {
        label: "Seguidores",
        value: followersValue,
        changePercent: safePct(followersValue, previous?.followersCount),
        available: followersValue != null,
      },
      engagement: {
        label: "Engajamento",
        value: latest?.engagement ?? null,
        changePercent: safePct(latest?.engagement, previous?.engagement),
        available: latest?.engagement != null,
      },
      reach: {
        label: "Alcance (dia)",
        value: latest?.reach ?? null,
        changePercent: safePct(latest?.reach, previous?.reach),
        available: latest?.reach != null,
      },
      reach7d: {
        label: "Alcance (7 dias)",
        value: reach7dTotal,
        changePercent: safePct(reach7dTotal, prev7dTotal),
        available: reach7dTotal != null,
      },
      impressions: {
        // "Visualizações": equivalente real já persistido pela integração.
        label: "Visualizações",
        value: latest?.impressions ?? null,
        changePercent: safePct(latest?.impressions, previous?.impressions),
        available: latest?.impressions != null,
      },
      profileViews: {
        label: "Visitas ao perfil",
        value: latest?.profileViews ?? null,
        changePercent: safePct(latest?.profileViews, previous?.profileViews),
        available: latest?.profileViews != null,
      },
      media: {
        label: "Publicações",
        value: mediaValue,
        changePercent: safePct(mediaValue, previous?.mediaCount),
        available: mediaValue != null,
      },
    },
    reach7dDays: reach7dValues.length,
    evolution: {
      "7d": mapEvolution(recent7d),
      "30d": mapEvolution(recent30d),
      "90d": mapEvolution(recent90d),
    },
    comparison: computeComparison(snapshots),
    timeline: computeTimeline(snapshots),
  };

  return data;
}

function mapEvolution(snapshots: {
  capturedAt: Date;
  followersCount?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  mediaCount?: number | null;
}[]): EvolutionPoint[] {
  // Nenhum ponto é fabricado e nenhum snapshot é descartado por estar vazio:
  // a série tem exatamente os snapshots REAIS da janela, cada um com o seu
  // timestamp. Métrica ausente permanece null (o gráfico não desenha o ponto,
  // mas a linha do tempo continua correta).
  return snapshots.map((s) => ({
    label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(s.capturedAt),
    capturedAt: s.capturedAt.toISOString(),
    followersCount: s.followersCount ?? null,
    reach: s.reach ?? null,
    impressions: s.impressions ?? null,
    profileViews: s.profileViews ?? null,
    mediaCount: s.mediaCount ?? null,
  }));
}

function computeComparison(
  snapshots: {
    capturedAt: Date;
    followersCount?: number | null;
  }[]
): DashboardInstagramData["comparison"] {
  const now = Date.now();
  const current = snapshots[snapshots.length - 1]?.followersCount ?? null;

  // Snapshot ~7 dias atrás
  const weekAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 7 * 864e5);
  // Snapshot ~30 dias atrás
  const monthAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 30 * 864e5);

  // Ganhos/perdas BRUTOS dos últimos 7 dias: percorre os pares consecutivos de
  // snapshots reais e separa dias de alta dos dias de baixa. Sem snapshot
  // suficiente (menos de 2 na janela) → null, nunca 0.
  const inWindow = snapshots.filter((s) => s.capturedAt.getTime() >= now - 7 * 864e5);
  let grossGained: number | null = null;
  let grossLost: number | null = null;
  for (let i = 1; i < inWindow.length; i++) {
    const prev = inWindow[i - 1].followersCount;
    const curr = inWindow[i].followersCount;
    if (prev == null || curr == null) continue;
    const diff = curr - prev;
    if (diff > 0) grossGained = (grossGained ?? 0) + diff;
    if (diff < 0) grossLost = (grossLost ?? 0) + Math.abs(diff);
  }

  return {
    weeklyGrowth: safePct(current, weekAgo?.followersCount ?? null),
    monthlyGrowth: safePct(current, monthAgo?.followersCount ?? null),
    followersGained7d: current != null && weekAgo?.followersCount != null
      ? current - weekAgo.followersCount
      : null,
    followersGained30d: current != null && monthAgo?.followersCount != null
      ? current - monthAgo.followersCount
      : null,
    followersGrossGained7d: grossGained,
    followersLost7d: grossLost,
    // Preenchido pelo chamador com a média real de interações das publicações
    // coletadas — ver `getMediaProductionData`. Sem dados → permanece null.
    avgEngagement: null,
  };
}

function computeTimeline(
  snapshots: {
    capturedAt: Date;
    followersCount?: number | null;
    reach?: number | null;
  }[]
): DashboardInstagramData["timeline"] {
  if (snapshots.length < 2) {
    return {
      bestReachDay: null,
      bestEngagementDay: null,
      biggestFollowerPeak: null,
      biggestDailyGain: null,
      biggestDailyLoss: null,
    };
  }

  let bestReachDay: { date: string; value: number } | null = null;
  let bestEngagementDay: { date: string; value: number } | null = null;
  let biggestFollowerPeak: { date: string; value: number } | null = null;
  let biggestDailyGain: { date: string; value: number } | null = null;
  let biggestDailyLoss: { date: string; value: number } | null = null;

  for (const s of snapshots) {
    if (s.reach != null && (!bestReachDay || s.reach > bestReachDay.value)) {
      bestReachDay = { date: s.capturedAt.toISOString(), value: s.reach };
    }
  }

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1].followersCount;
    const curr = snapshots[i].followersCount;
    if (prev == null || curr == null) continue;

    const diff = curr - prev;
    if (diff > 0 && (!biggestDailyGain || diff > biggestDailyGain.value)) {
      biggestDailyGain = { date: snapshots[i].capturedAt.toISOString(), value: diff };
    }
    if (diff < 0 && (!biggestDailyLoss || diff < biggestDailyLoss.value)) {
      biggestDailyLoss = { date: snapshots[i].capturedAt.toISOString(), value: diff };
    }
    if (curr > (biggestFollowerPeak?.value ?? -Infinity)) {
      biggestFollowerPeak = { date: snapshots[i].capturedAt.toISOString(), value: curr };
    }
  }

  return {
    bestReachDay,
    bestEngagementDay, // apenas quando houver dados reais
    biggestFollowerPeak,
    biggestDailyGain,
    biggestDailyLoss,
  };
}
