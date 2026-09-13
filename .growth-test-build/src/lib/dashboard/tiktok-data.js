"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTikTokDashboardData = getTikTokDashboardData;
const db_1 = require("@/lib/db");
function safePct(current, previous) {
    // undefined (optional chaining) e null são tratados igual:
    // métrica indisponível → null, NUNCA 0.
    if (current == null || previous == null || previous === 0)
        return null;
    return ((current - previous) / previous) * 100;
}
async function getTikTokDashboardData(userId) {
    const connection = await db_1.prisma.socialConnection.findFirst({
        where: { userId, platform: "tiktok" },
    });
    const connected = connection?.status === "CONNECTED";
    const empty = {
        connected,
        username: connection?.username ?? null,
        followersCount: null,
        videoCount: null,
        lastSyncAt: connection?.lastSyncAt ?? null,
        snapshotCount: 0,
        cards: {
            followers: { label: "Seguidores", value: null, changePercent: null, available: false },
            following: { label: "Seguindo", value: null, changePercent: null, available: false },
            likes: { label: "Curtidas", value: null, changePercent: null, available: false },
            videos: { label: "Vídeos", value: null, changePercent: null, available: false },
        },
        evolution: { "7d": [], "30d": [], "90d": [] },
        comparison: {
            weeklyGrowth: null,
            monthlyGrowth: null,
            followersGained7d: null,
            followersGained30d: null,
        },
        timeline: {
            biggestFollowerPeak: null,
            biggestDailyGain: null,
            biggestDailyLoss: null,
        },
    };
    // Type guard real: garante que `connection` é não-nulo daqui em diante.
    if (!connection || connection.status !== "CONNECTED")
        return empty;
    const profile = await db_1.prisma.tikTokProfile.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
    });
    const snapshots = await db_1.prisma.tikTokSnapshot.findMany({
        where: { userId },
        orderBy: { capturedAt: "asc" },
    });
    const latest = snapshots[snapshots.length - 1] ?? null;
    const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
    const now = Date.now();
    const recent7d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 7 * 864e5);
    const recent30d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 30 * 864e5);
    const recent90d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 90 * 864e5);
    const data = {
        ...empty,
        username: profile?.username ?? connection.username ?? null,
        followersCount: latest?.followersCount ?? profile?.followersCount ?? null,
        videoCount: latest?.videoCount ?? profile?.videoCount ?? null,
        lastSyncAt: connection.lastSyncAt ?? null,
        snapshotCount: snapshots.length,
        cards: {
            followers: {
                label: "Seguidores",
                value: latest?.followersCount ?? null,
                changePercent: safePct(latest?.followersCount, previous?.followersCount),
                available: latest?.followersCount != null,
            },
            following: {
                label: "Seguindo",
                value: latest?.followingCount ?? null,
                changePercent: safePct(latest?.followingCount, previous?.followingCount),
                available: latest?.followingCount != null,
            },
            likes: {
                label: "Curtidas",
                value: latest?.likesCount ?? null,
                changePercent: safePct(latest?.likesCount, previous?.likesCount),
                available: latest?.likesCount != null,
            },
            videos: {
                label: "Vídeos",
                value: latest?.videoCount ?? null,
                changePercent: safePct(latest?.videoCount, previous?.videoCount),
                available: latest?.videoCount != null,
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
        videoCount: s.videoCount ?? null,
        likesCount: s.likesCount ?? null,
    }));
}
function computeComparison(snapshots) {
    const now = Date.now();
    const current = snapshots[snapshots.length - 1]?.followersCount ?? null;
    const weekAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 7 * 864e5);
    const monthAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 30 * 864e5);
    return {
        weeklyGrowth: safePct(current, weekAgo?.followersCount ?? null),
        monthlyGrowth: safePct(current, monthAgo?.followersCount ?? null),
        followersGained7d: current != null && weekAgo?.followersCount != null ? current - weekAgo.followersCount : null,
        followersGained30d: current != null && monthAgo?.followersCount != null ? current - monthAgo.followersCount : null,
    };
}
function computeTimeline(snapshots) {
    if (snapshots.length < 2) {
        return { biggestFollowerPeak: null, biggestDailyGain: null, biggestDailyLoss: null };
    }
    let biggestFollowerPeak = null;
    let biggestDailyGain = null;
    let biggestDailyLoss = null;
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
    return { biggestFollowerPeak, biggestDailyGain, biggestDailyLoss };
}
