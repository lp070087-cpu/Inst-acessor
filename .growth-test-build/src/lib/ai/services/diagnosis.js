"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosticStateLabel = diagnosticStateLabel;
exports.runDiagnosis = runDiagnosis;
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
const STATE_LABEL = {
    "ponto-forte": "Ponto forte",
    oportunidade: "Oportunidade",
    atencao: "Atenção",
    "ponto-fraco": "Ponto fraco",
    "dados-insuficientes": "Dados insuficientes",
};
function diagnosticStateLabel(state) {
    return STATE_LABEL[state];
}
function classify(value, thresholdStrong, thresholdWeak) {
    if (value == null)
        return "dados-insuficientes";
    if (value >= thresholdStrong)
        return "ponto-forte";
    if (value <= thresholdWeak)
        return "ponto-fraco";
    return "oportunidade";
}
async function runDiagnosis(userId, platform) {
    if (platform === "instagram") {
        const d = await (0, instagram_data_1.getDashboardInstagramData)(userId);
        const items = [];
        // Crescimento
        const growth = d.comparison.monthlyGrowth;
        items.push({
            category: "crescimento",
            label: "Crescimento",
            state: classify(growth, 10, -2),
            detail: growth != null
                ? `Crescimento mensal: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`
                : "Sem dados de crescimento no período.",
        });
        // Engajamento
        const engagement = d.cards.engagement.value;
        items.push({
            category: "engajamento",
            label: "Engajamento",
            state: classify(engagement, 500, 50),
            detail: engagement != null
                ? `Engajamento: ${engagement}`
                : "Sem dados de engajamento.",
        });
        // Alcance
        const reach = d.cards.reach.value;
        items.push({
            category: "alcance",
            label: "Alcance",
            state: classify(reach, 1000, 100),
            detail: reach != null ? `Alcance: ${reach}` : "Sem dados de alcance.",
        });
        // Frequência / publicações
        const media = d.mediaCount ?? null;
        items.push({
            category: "frequencia",
            label: "Frequência",
            state: classify(media, 30, 5),
            detail: media != null ? `Publicações: ${media}` : "Sem dados de publicações.",
        });
        // Consistência (snapshots)
        const snap = d.snapshotCount;
        items.push({
            category: "consistencia",
            label: "Consistência",
            state: snap >= 5 ? "ponto-forte" : snap >= 2 ? "oportunidade" : "dados-insuficientes",
            detail: `${snap} sincronizações registradas.`,
        });
        // Conteúdo (melhores conteúdos quando houver)
        const hasContent = (d.timeline.bestReachDay || d.timeline.bestEngagementDay) != null;
        items.push({
            category: "conteudo",
            label: "Conteúdo",
            state: hasContent ? "ponto-forte" : "dados-insuficientes",
            detail: hasContent
                ? "Há conteúdo com bom desempenho registrado."
                : "Sem histórico de conteúdo suficiente.",
        });
        // Perfil (conexão + dados básicos)
        items.push({
            category: "perfil",
            label: "Perfil",
            state: d.connected ? "ponto-forte" : "dados-insuficientes",
            detail: d.connected
                ? `Instagram conectado${d.username ? ` (@${d.username})` : ""}.`
                : "Instagram não conectado.",
        });
        return items;
    }
    // TikTok
    const d = await (0, tiktok_data_1.getTikTokDashboardData)(userId);
    const items = [];
    const growth = d.comparison.monthlyGrowth;
    items.push({
        category: "crescimento",
        label: "Crescimento",
        state: classify(growth, 10, -2),
        detail: growth != null
            ? `Crescimento mensal: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`
            : "Sem dados de crescimento no período.",
    });
    const likes = d.cards.likes.value;
    items.push({
        category: "engajamento",
        label: "Engajamento",
        state: classify(likes, 500, 50),
        detail: likes != null ? `Curtidas: ${likes}` : "Sem dados de curtidas.",
    });
    const videos = d.videoCount ?? null;
    items.push({
        category: "frequencia",
        label: "Frequência",
        state: classify(videos, 30, 5),
        detail: videos != null ? `Vídeos: ${videos}` : "Sem dados de vídeos.",
    });
    const snap = d.snapshotCount;
    items.push({
        category: "consistencia",
        label: "Consistência",
        state: snap >= 5 ? "ponto-forte" : snap >= 2 ? "oportunidade" : "dados-insuficientes",
        detail: `${snap} sincronizações registradas.`,
    });
    items.push({
        category: "conteudo",
        label: "Conteúdo",
        state: d.timeline.biggestFollowerPeak ? "ponto-forte" : "dados-insuficientes",
        detail: d.timeline.biggestFollowerPeak
            ? "Há pico de seguidores registrado."
            : "Sem histórico de conteúdo suficiente.",
    });
    items.push({
        category: "perfil",
        label: "Perfil",
        state: d.connected ? "ponto-forte" : "dados-insuficientes",
        detail: d.connected
            ? `TikTok conectado${d.username ? ` (@${d.username})` : ""}.`
            : "TikTok não conectado.",
    });
    return items;
}
