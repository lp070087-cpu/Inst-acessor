"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardInstagramData = getDashboardInstagramData;
const db_1 = require("@/lib/db");
function safePct(current, previous) {
    // undefined (optional chaining) e null são tratados igual:
    // métrica indisponível → null, NUNCA 0.
    if (current == null || previous == null || previous === 0)
        return null;
    return ((current - previous) / previous) * 100;
}
async function getDashboardInstagramData(userId) {
    const connection = await db_1.prisma.socialConnection.findFirst({
        where: { userId, platform: "instagram" },
    });
    const connected = connection?.status === "CONNECTED";
    const empty = {
        connected,
        username: connection?.username ?? null,
        followersCount: null,
        mediaCount: null,
        lastSyncAt: connection?.lastSyncAt ?? null,
        snapshotCount: 0,
        cards: {
            followers: { label: "Seguidores", value: null, changePercent: null, available: false },
            engagement: { label: "Engajamento", value: null, changePercent: null, available: false },
            reach: { label: "Alcance", value: null, changePercent: null, available: false },
            impressions: { label: "Impressões", value: null, changePercent: null, available: false },
            profileViews: { label: "Visitas ao perfil", value: null, changePercent: null, available: false },
            media: { label: "Publicações", value: null, changePercent: null, available: false },
        },
        evolution: { "7d": [], "30d": [], "90d": [] },
        comparison: {
            weeklyGrowth: null,
            monthlyGrowth: null,
            followersGained7d: null,
            followersGained30d: null,
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
    if (!connection || connection.status !== "CONNECTED")
        return empty;
    const profile = await db_1.prisma.instagramProfile.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
    });
    const snapshots = await db_1.prisma.instagramSnapshot.findMany({
        where: { userId },
        orderBy: { capturedAt: "asc" },
    });
    const latest = snapshots[snapshots.length - 1] ?? null;
    // Snapshot imediatamente anterior → variação desde a última sincronização.
    const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
    const now = Date.now();
    const recent7d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 7 * 864e5);
    const recent30d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 30 * 864e5);
    const recent90d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 90 * 864e5);
    const data = {
        ...empty,
        username: profile?.username ?? connection.username ?? null,
        followersCount: latest?.followersCount ?? profile?.followersCount ?? null,
        mediaCount: latest?.mediaCount ?? profile?.mediaCount ?? null,
        lastSyncAt: connection.lastSyncAt ?? null,
        snapshotCount: snapshots.length,
        cards: {
            followers: {
                label: "Seguidores",
                value: latest?.followersCount ?? null,
                changePercent: safePct(latest?.followersCount, previous?.followersCount),
                available: latest?.followersCount != null,
            },
            engagement: {
                label: "Engajamento",
                value: latest?.engagement ?? null,
                changePercent: safePct(latest?.engagement, previous?.engagement),
                available: latest?.engagement != null,
            },
            reach: {
                label: "Alcance",
                value: latest?.reach ?? null,
                changePercent: safePct(latest?.reach, previous?.reach),
                available: latest?.reach != null,
            },
            impressions: {
                label: "Impressões",
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
                value: latest?.mediaCount ?? null,
                changePercent: safePct(latest?.mediaCount, previous?.mediaCount),
                available: latest?.mediaCount != null,
            },
        },
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
function mapEvolution(snapshots) {
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
function computeComparison(snapshots) {
    const now = Date.now();
    const current = snapshots[snapshots.length - 1]?.followersCount ?? null;
    // Snapshot ~7 dias atrás
    const weekAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 7 * 864e5);
    // Snapshot ~30 dias atrás
    const monthAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 30 * 864e5);
    return {
        weeklyGrowth: safePct(current, weekAgo?.followersCount ?? null),
        monthlyGrowth: safePct(current, monthAgo?.followersCount ?? null),
        followersGained7d: current != null && weekAgo?.followersCount != null
            ? current - weekAgo.followersCount
            : null,
        followersGained30d: current != null && monthAgo?.followersCount != null
            ? current - monthAgo.followersCount
            : null,
        avgEngagement: null, // apenas quando houver dados reais de engajamento
    };
}
function computeTimeline(snapshots) {
    if (snapshots.length < 2) {
        return {
            bestReachDay: null,
            bestEngagementDay: null,
            biggestFollowerPeak: null,
            biggestDailyGain: null,
            biggestDailyLoss: null,
        };
    }
    let bestReachDay = null;
    let bestEngagementDay = null;
    let biggestFollowerPeak = null;
    let biggestDailyGain = null;
    let biggestDailyLoss = null;
    for (const s of snapshots) {
        if (s.reach != null && (!bestReachDay || s.reach > bestReachDay.value)) {
            bestReachDay = { date: s.capturedAt.toISOString(), value: s.reach };
        }
    }
    for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1].followersCount;
        const curr = snapshots[i].followersCount;
        if (prev == null || curr == null)
            continue;
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
