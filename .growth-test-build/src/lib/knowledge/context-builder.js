"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveRelevantRules = retrieveRelevantRules;
exports.listProfileInsights = listProfileInsights;
exports.listUserExperiments = listUserExperiments;
exports.buildKnowledgeContext = buildKnowledgeContext;
exports.knowledgeContextToPrompt = knowledgeContextToPrompt;
const context_1 = require("@/lib/ai/context");
const repository_1 = require("./repository");
const registry_1 = require("./rules/registry");
const registry_2 = require("./rules/registry");
// ------------------------------------------------------------
// Recuperação contextual determinística
// ------------------------------------------------------------
/** Palavras-chave → categorias/tags da base oficial. */
const QUERY_MAP = [
    {
        keywords: ["reel", "reels", "video", "reproducao", "play"],
        tags: ["reels"],
        categories: ["conteudo", "alcance"],
    },
    {
        keywords: ["story", "stories", "relacionamento"],
        tags: ["stories"],
        categories: ["conteudo"],
    },
    {
        keywords: ["gancho", "abertura", "hook", "primeiros segundos"],
        tags: ["gancho"],
        categories: ["retencao"],
    },
    {
        keywords: ["retencao", "consumo", "progressao"],
        tags: ["retencao"],
        categories: ["retencao"],
    },
    {
        keywords: ["engajamento", "curtida", "comentario", "interacao"],
        tags: ["engajamento"],
        categories: ["engajamento"],
    },
    {
        keywords: ["alcance", "distribuicao", "visualizacao", "views"],
        tags: ["alcance", "distribuicao"],
        categories: ["alcance"],
    },
    {
        keywords: ["crescimento", "seguidor", "ganho", "desacelera"],
        tags: ["crescimento"],
        categories: ["crescimento"],
    },
    {
        keywords: ["frequencia", "consistencia", "postar", "publicar", "regularidade"],
        tags: ["frequencia", "consistencia"],
        categories: ["consistencia"],
    },
    {
        keywords: ["bio", "posicionamento", "perfil", "nicho", "proposta"],
        tags: ["bio", "posicionamento"],
        categories: ["bio", "posicionamento", "conversao"],
    },
    {
        keywords: ["conteudo", "tema", "formato", "legenda", "carrossel", "post"],
        tags: ["conteudo"],
        categories: ["conteudo"],
    },
    {
        keywords: ["estrategia", "plano", "que fazer", "melhorar"],
        tags: ["estrategia"],
        categories: ["estrategia"],
    },
    {
        keywords: ["ideia", "ideias", "criar", "produzir"],
        tags: ["ideias"],
        categories: ["ideias"],
    },
    {
        keywords: ["copy", "legenda", "cta", "chamada"],
        tags: ["copy"],
        categories: ["copy"],
    },
    {
        keywords: ["metrica", "metricas", "indicador", "kpi", "numero"],
        tags: ["metricas"],
        categories: ["metricas"],
    },
    {
        keywords: ["score", "nota", "pontuacao", "saude"],
        tags: ["score"],
        categories: ["score"],
    },
    {
        keywords: ["experimento", "teste", "hipotese", "a/b"],
        tags: ["experimento"],
        categories: ["experimentacao"],
    },
    {
        keywords: ["alertas", "alerta", "queda", "caiu", "atencao"],
        tags: ["alertas"],
        categories: ["alertas"],
    },
    {
        keywords: ["comparar", "comparacao", "periodo", "evolucao", "historico", "7d", "30d", "90d"],
        tags: ["comparacao", "historico", "snapshots"],
        categories: ["historico"],
    },
    {
        keywords: ["publico", "audiencia", "seguidores", "quem"],
        tags: ["publico"],
        categories: ["publico"],
    },
];
function normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}
function retrieveRelevantRules(query) {
    const q = normalize(query);
    const matchedTags = new Set();
    const matchedCategories = new Set();
    for (const entry of QUERY_MAP) {
        if (entry.keywords.some((k) => q.includes(normalize(k)))) {
            entry.tags.forEach((t) => matchedTags.add(t));
            entry.categories.forEach((c) => matchedCategories.add(c));
        }
    }
    // Regras mais específicas primeiro, limite para não estourar o prompt.
    const byTags = (0, registry_1.getRulesByTags)([...matchedTags]);
    const byCategory = matchedCategories.size > 0
        ? registry_2.KNOWLEDGE_MODULES.flatMap((m) => m.rules.filter((r) => matchedCategories.has(r.category)))
        : [];
    const seen = new Set();
    const merged = [];
    for (const rule of [...byTags, ...byCategory]) {
        if (seen.has(rule.slug))
            continue;
        seen.add(rule.slug);
        merged.push(rule);
    }
    // Se nada específico casou, devolve um conjunto mínimo de princípios
    // (NUNCA os 30 módulos inteiros).
    if (merged.length === 0) {
        return ["ciclo-principal", "nunca-inventar-metricas", "toda-resposta-tem-base"]
            .map((slug) => (0, registry_1.getRuleBySlug)(slug))
            .filter((r) => Boolean(r));
    }
    return merged.slice(0, 12);
}
// ------------------------------------------------------------
// Leitura de aprendizado individual e experimentos
// ------------------------------------------------------------
async function listProfileInsights(userId, platform) {
    const rows = await repository_1.kb.insight.findMany({
        where: { userId, platform },
        orderBy: { createdAt: "desc" },
        take: 30,
    });
    return rows.map((r) => ({
        type: r.type,
        summary: r.summary,
        detail: r.detail ?? null,
        ruleSlug: r.ruleSlug ?? null,
        confidence: r.confidence ?? null,
    }));
}
async function listUserExperiments(userId) {
    const rows = await repository_1.kb.experiment.findMany({
        where: { userId, status: { in: ["RUNNING", "ENOUGH_DATA", "CONFIRMED", "REJECTED", "INCONCLUSIVE"] } },
        orderBy: { createdAt: "desc" },
        take: 15,
    });
    return rows.map((r) => ({
        id: r.id,
        hypothesis: r.hypothesis,
        variable: r.variable,
        status: r.status,
        conclusion: r.conclusion ?? null,
    }));
}
// ------------------------------------------------------------
// Montagem final do contexto
// ------------------------------------------------------------
async function buildKnowledgeContext(userId, opts) {
    const [userContext, insights, experiments] = await Promise.all([
        (0, context_1.buildUserContext)(userId),
        listProfileInsights(userId, opts.platform ?? "instagram"),
        listUserExperiments(userId),
    ]);
    const rules = retrieveRelevantRules(opts.query);
    const historyNote = userContext.instagram.snapshotCount > 0 || userContext.tiktok.snapshotCount > 0
        ? `Histórico disponível: ${userContext.instagram.snapshotCount} snapshots Instagram, ${userContext.tiktok.snapshotCount} snapshots TikTok.`
        : "Histórico indisponível (sem snapshots suficientes).";
    return {
        relevantRules: rules,
        userContext,
        insights,
        experiments,
        historyNote,
    };
}
/** Converte o contexto em texto para o prompt (categorias explicitas). */
function knowledgeContextToPrompt(ctx) {
    const lines = [];
    lines.push("--- DADOS REAIS DO USUÁRIO (API/snapshot/banco) ---");
    lines.push((0, context_1.contextToPrompt)(ctx.userContext));
    if (ctx.historyNote) {
        lines.push("");
        lines.push("--- HISTÓRICO ---");
        lines.push(ctx.historyNote);
    }
    if (ctx.relevantRules.length > 0) {
        lines.push("");
        lines.push("--- CONHECIMENTO OFICIAL APLICÁVEL (somente regras relevantes) ---");
        for (const rule of ctx.relevantRules) {
            lines.push(`• [Módulo ${String(rule.module).padStart(2, "0")}] ${rule.title} (${rule.type}): ${rule.content}`);
        }
        lines.push("Regra: este conhecimento é oficial e NÃO deve ser complementado com dicas genéricas externas.");
    }
    if (ctx.insights.length > 0) {
        lines.push("");
        lines.push("--- APRENDIZADO DO PERFIL (padrões observados) ---");
        for (const ins of ctx.insights) {
            lines.push(`• [${ins.type}] ${ins.summary}${ins.confidence ? ` (confiança: ${ins.confidence})` : ""}`);
        }
        lines.push("Regra: aprendizado OBSERVADO/INFERIDO não é fato comprovado. Apenas CONFIRMED_BY_EXPERIMENT pode ser tratado como validado.");
    }
    if (ctx.experiments.length > 0) {
        lines.push("");
        lines.push("--- EXPERIMENTOS DO PERFIL ---");
        for (const exp of ctx.experiments) {
            lines.push(`• [${exp.status}] ${exp.hypothesis} (variável: ${exp.variable})${exp.conclusion ? ` → ${exp.conclusion}` : ""}`);
        }
    }
    lines.push("");
    lines.push("FORMATO DE RESPOSTA ESTRATÉGICA quando apropriado: DIAGNÓSTICO / EVIDÊNCIA / CONHECIMENTO APLICADO / HIPÓTESE / AÇÃO / TESTE / MÉTRICA DE SUCESSO / NÍVEL DE CONFIANÇA (Baixo/Médio/Alto). Nunca use confiança numérica falsa.");
    lines.push("Categorias de confiabilidade: DADO REAL (API/snapshot/banco), CONHECIMENTO (regra oficial da DONA), INFERÊNCIA (interpretação), HIPÓTESE (a validar), RECOMENDAÇÃO (ação). NUNCA misture — se um dado não foi fornecido, diga que está indisponível e não invente.");
    return lines.join("\n");
}
