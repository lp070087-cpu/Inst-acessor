"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCalendarView = buildCalendarView;
exports.computePipelineCounts = computePipelineCounts;
exports.attachExperimentToContent = attachExperimentToContent;
exports.detachExperimentFromContent = detachExperimentFromContent;
const db_1 = require("@/lib/planning/db");
const repository_1 = require("@/lib/knowledge/repository");
function pad(n) {
    return String(n).padStart(2, "0");
}
function toDayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
/**
 * Monta a visão de calendário a partir dos conteúdos já filtrados.
 * `anchor` = data âncora (ISO) para o mês/semana; sem âncora usa hoje.
 */
function buildCalendarView(contents, view, anchorIso) {
    const anchor = anchorIso ? new Date(anchorIso) : new Date();
    const unscheduled = [];
    const byDay = new Map();
    for (const c of contents) {
        if (!c.scheduledAt) {
            unscheduled.push(c);
            continue;
        }
        const key = toDayKey(new Date(c.scheduledAt));
        const list = byDay.get(key) ?? [];
        list.push(c);
        byDay.set(key, list);
    }
    // Determina o conjunto de dias visíveis (mês ou semana da âncora).
    const visibleDays = new Set();
    if (view === "month") {
        const year = anchor.getFullYear();
        const month = anchor.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
            visibleDays.add(toDayKey(d));
        }
    }
    else if (view === "week") {
        const start = new Date(anchor);
        const day = start.getDay();
        start.setDate(start.getDate() - day); // domingo como início
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            visibleDays.add(toDayKey(d));
        }
    }
    const days = [];
    if (view === "list") {
        // Lista: agrupa por data, incluindo itens fora do período (agrupados).
        const keys = [...byDay.keys()].sort();
        for (const key of keys) {
            days.push({ date: key, items: byDay.get(key) ?? [] });
        }
    }
    else {
        for (const key of [...visibleDays]) {
            days.push({ date: key, items: byDay.get(key) ?? [] });
        }
        days.sort((a, b) => (a.date < b.date ? -1 : 1));
    }
    return { view, unscheduled, days, total: contents.length };
}
function computePipelineCounts(contents) {
    const counts = {
        total: contents.length,
        rascunho: 0,
        ideia: 0,
        emProducao: 0,
        pronto: 0,
        agendado: 0,
        publicado: 0,
        cancelado: 0,
        falhou: 0,
    };
    for (const c of contents) {
        switch (c.status) {
            case "RASCUNHO":
                counts.rascunho++;
                break;
            case "IDEIA":
                counts.ideia++;
                break;
            case "EM_PRODUCAO":
                counts.emProducao++;
                break;
            case "PRONTO":
                counts.pronto++;
                break;
            case "AGENDADO":
                counts.agendado++;
                break;
            case "PUBLICADO":
                counts.publicado++;
                break;
            case "CANCELADO":
                counts.cancelado++;
                break;
            case "FALHOU":
                counts.falhou++;
                break;
        }
    }
    return counts;
}
/**
 * Associação conteúdo ↔ experimento (N:N).
 * Idempotente via @@unique([contentId, experimentId]).
 * NUNCA inventa resultados — apenas prepara a associação para medição futura.
 */
async function attachExperimentToContent(userId, contentId, experimentId) {
    const content = (await db_1.pl.content.findUnique({ where: { id: contentId } }));
    if (!content || content.userId !== userId)
        return false;
    const experiment = (await repository_1.kb.experiment.findUnique({
        where: { id: experimentId },
    }));
    if (!experiment || experiment.userId !== userId)
        return false;
    try {
        await db_1.pl.contentExperiment.create({
            data: { contentId, experimentId },
        });
    }
    catch {
        // Já associado (constraint única) — não é erro.
    }
    return true;
}
/** Remove a associação conteúdo ↔ experimento. */
async function detachExperimentFromContent(userId, contentId, experimentId) {
    const content = (await db_1.pl.content.findUnique({ where: { id: contentId } }));
    if (!content || content.userId !== userId)
        return false;
    await db_1.pl.contentExperiment.deleteMany({
        where: { contentId, experimentId },
    });
    return true;
}
