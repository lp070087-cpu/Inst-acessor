"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAnalysis = runAnalysis;
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
function iso(d) {
    return d.toISOString();
}
async function runAnalysis(userId, platform, period) {
    if (platform === "instagram") {
        const d = await (0, instagram_data_1.getDashboardInstagramData)(userId);
        const metrics = [
            {
                key: "followers",
                label: "Seguidores",
                value: d.followersCount ?? null,
                changePercent: d.cards.followers.changePercent,
                available: d.cards.followers.available,
            },
            {
                key: "growth",
                label: "Crescimento",
                value: d.comparison.monthlyGrowth != null ? Math.round(d.comparison.monthlyGrowth * 100) / 100 : null,
                changePercent: null,
                available: d.comparison.monthlyGrowth != null,
            },
            {
                key: "engagement",
                label: "Engajamento",
                value: d.cards.engagement.value ?? null,
                changePercent: d.cards.engagement.changePercent,
                available: d.cards.engagement.available,
            },
            {
                key: "reach",
                label: "Alcance",
                value: d.cards.reach.value ?? null,
                changePercent: d.cards.reach.changePercent,
                available: d.cards.reach.available,
            },
            {
                key: "impressions",
                label: "Impressões",
                value: d.cards.impressions.value ?? null,
                changePercent: d.cards.impressions.changePercent,
                available: d.cards.impressions.available,
            },
            {
                key: "frequency",
                label: "Publicações",
                value: d.mediaCount ?? null,
                changePercent: d.cards.media.changePercent,
                available: d.cards.media.available,
            },
        ];
        const bestItems = [];
        if (d.timeline.bestReachDay) {
            bestItems.push({
                label: "Melhor dia de alcance",
                date: iso(new Date(d.timeline.bestReachDay.date)),
                value: d.timeline.bestReachDay.value,
            });
        }
        if (d.timeline.bestEngagementDay) {
            bestItems.push({
                label: "Melhor dia de engajamento",
                date: iso(new Date(d.timeline.bestEngagementDay.date)),
                value: d.timeline.bestEngagementDay.value,
            });
        }
        if (d.timeline.biggestFollowerPeak) {
            bestItems.push({
                label: "Pico de seguidores",
                date: iso(new Date(d.timeline.biggestFollowerPeak.date)),
                value: d.timeline.biggestFollowerPeak.value,
            });
        }
        if (d.timeline.biggestDailyGain) {
            bestItems.push({
                label: "Maior ganho diário",
                date: iso(new Date(d.timeline.biggestDailyGain.date)),
                value: d.timeline.biggestDailyGain.value,
            });
        }
        if (d.timeline.biggestDailyLoss) {
            bestItems.push({
                label: "Maior perda diária",
                date: iso(new Date(d.timeline.biggestDailyLoss.date)),
                value: d.timeline.biggestDailyLoss.value,
            });
        }
        return {
            platform,
            connected: d.connected,
            username: d.username ?? null,
            snapshotCount: d.snapshotCount,
            lastSyncAt: d.lastSyncAt ? iso(d.lastSyncAt) : null,
            metrics,
            bestItems,
            evolution: d.evolution[period],
            periods: ["7d", "30d", "90d"],
        };
    }
    // TikTok
    const d = await (0, tiktok_data_1.getTikTokDashboardData)(userId);
    const metrics = [
        {
            key: "followers",
            label: "Seguidores",
            value: d.followersCount ?? null,
            changePercent: d.cards.followers.changePercent,
            available: d.cards.followers.available,
        },
        {
            key: "growth",
            label: "Crescimento",
            value: d.comparison.monthlyGrowth != null ? Math.round(d.comparison.monthlyGrowth * 100) / 100 : null,
            changePercent: null,
            available: d.comparison.monthlyGrowth != null,
        },
        {
            key: "engagement",
            label: "Curtidas",
            value: d.cards.likes.value ?? null,
            changePercent: d.cards.likes.changePercent,
            available: d.cards.likes.available,
        },
        {
            key: "frequency",
            label: "Vídeos",
            value: d.videoCount ?? null,
            changePercent: d.cards.videos.changePercent,
            available: d.cards.videos.available,
        },
    ];
    const bestItems = [];
    if (d.timeline.biggestFollowerPeak) {
        bestItems.push({
            label: "Pico de seguidores",
            date: iso(new Date(d.timeline.biggestFollowerPeak.date)),
            value: d.timeline.biggestFollowerPeak.value,
        });
    }
    if (d.timeline.biggestDailyGain) {
        bestItems.push({
            label: "Maior ganho diário",
            date: iso(new Date(d.timeline.biggestDailyGain.date)),
            value: d.timeline.biggestDailyGain.value,
        });
    }
    if (d.timeline.biggestDailyLoss) {
        bestItems.push({
            label: "Maior perda diária",
            date: iso(new Date(d.timeline.biggestDailyLoss.date)),
            value: d.timeline.biggestDailyLoss.value,
        });
    }
    return {
        platform,
        connected: d.connected,
        username: d.username ?? null,
        snapshotCount: d.snapshotCount,
        lastSyncAt: d.lastSyncAt ? iso(d.lastSyncAt) : null,
        metrics,
        bestItems,
        evolution: d.evolution[period],
        periods: ["7d", "30d", "90d"],
    };
}
