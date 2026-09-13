"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAchievementModel = exports.getAchievementBySlug = exports.ACHIEVEMENT_CATALOG = void 0;
exports.computeProgress = computeProgress;
exports.seedAchievements = seedAchievements;
exports.getUserAchievements = getUserAchievements;
exports.checkAndUnlockAchievements = checkAndUnlockAchievements;
const db_1 = require("@/lib/db");
const db_2 = require("@/lib/gamification/db");
const xp_1 = require("@/lib/gamification/xp");
const achievements_1 = require("@/lib/gamification/achievements");
Object.defineProperty(exports, "ACHIEVEMENT_CATALOG", { enumerable: true, get: function () { return achievements_1.ACHIEVEMENT_CATALOG; } });
Object.defineProperty(exports, "getAchievementBySlug", { enumerable: true, get: function () { return achievements_1.getAchievementBySlug; } });
Object.defineProperty(exports, "toAchievementModel", { enumerable: true, get: function () { return achievements_1.toAchievementModel; } });
/**
 * Mede o progresso real de uma conquista para o usuário.
 * Cada `ProgressKind` lê a tabela correspondente com `userId`.
 */
async function computeProgress(userId, kind) {
    switch (kind) {
        case "copies_criadas": {
            const c = await db_1.prisma.generatedCopy.count({ where: { userId } });
            return { value: c, available: true };
        }
        case "ideias_salvas": {
            const c = await db_1.prisma.contentIdea.count({ where: { userId } });
            return { value: c, available: true };
        }
        case "drafts_criados": {
            const c = await db_1.prisma.socialDraft.count({ where: { userId } });
            return { value: c, available: true };
        }
        case "recomendacoes_aplicadas": {
            const c = await db_1.prisma.mentorshipRecommendation.count({
                where: { userId, status: { in: ["APLICADA", "CONCLUIDA"] } },
            });
            return { value: c, available: true };
        }
        case "experimentos_completados": {
            const c = await db_1.prisma.growthExperiment.count({
                where: { userId, status: { in: ["CONFIRMED", "REJECTED"] } },
            });
            return { value: c, available: true };
        }
        case "analises_rodadas": {
            const c = await db_1.prisma.profileScoreSnapshot.count({ where: { userId } });
            return { value: c, available: true };
        }
        case "snapshots_instagram": {
            const c = await db_1.prisma.instagramSnapshot.count({ where: { userId } });
            return { value: c, available: true };
        }
        case "snapshots_tiktok": {
            const c = await db_1.prisma.tikTokSnapshot.count({ where: { userId } });
            return { value: c, available: true };
        }
        case "perfil_completo": {
            const p = await db_1.prisma.aIProfile.findUnique({ where: { userId } });
            if (!p)
                return { value: 0, available: true };
            const complete = p != null && Boolean(p.niche && p.objectives);
            return { value: complete ? 1 : 0, available: true };
        }
        case "primeira_semana_ativa": {
            // Dias com qualquer XpLog — mede "uso ativo" (ações reais no app).
            // `select` mínimo + distinct (agregação no banco, evita trazer todas as linhas).
            const logs = await db_2.gp.xpLog.findMany({
                where: { userId },
                select: { createdAt: true },
            });
            const days = new Set(logs.map((l) => l.createdAt.toDateString())).size;
            return { value: days, available: true };
        }
        case "frequencia_consistente": {
            // Dias distintos com snapshots Instagram na mesma semana (seg-dom).
            const snapshots = await db_1.prisma.instagramSnapshot.findMany({
                where: { userId },
                select: { capturedAt: true },
            });
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setHours(0, 0, 0, 0);
            const day = startOfWeek.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
            const days = new Set(snapshots
                .map((s) => s.capturedAt)
                .filter((d) => d.getTime() >= startOfWeek.getTime())
                .map((d) => d.toDateString())).size;
            return { value: days, available: true };
        }
        case "desafio_primeiro_nivel": {
            const lvl = await db_2.gp.level.findUnique({ where: { userId } });
            return { value: lvl ? lvl.level : 0, available: true };
        }
        case "desafio_maestria_xp": {
            const lvl = await db_2.gp.level.findUnique({ where: { userId } });
            return { value: lvl ? lvl.xp : 0, available: true };
        }
        case "desafio_metas_concluidas": {
            const c = await db_2.gp.goal.count({ where: { userId, status: "CONCLUIDA" } });
            return { value: c, available: true };
        }
        case "desafio_10_conquistas": {
            const c = await db_2.gp.userAchievement.count({ where: { userId, unlocked: true } });
            return { value: c, available: true };
        }
        default: {
            return { value: 0, available: false };
        }
    }
}
// ------------------------------------------------------------
// Seed idempotente do catálogo (executado quando autorizado)
// ------------------------------------------------------------
/**
 * Upsert do catálogo de conquistas na tabela Achievement (global).
 * Idempotente por slug. Chamado pelo seed oficial da Fase 5.
 */
async function seedAchievements() {
    let count = 0;
    for (const def of achievements_1.ACHIEVEMENT_CATALOG) {
        const data = {
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
        await db_2.gp.achievement.upsert({
            where: { slug: def.slug },
            update: data,
            create: { slug: def.slug, ...data },
        });
        count += 1;
    }
    return count;
}
/**
 * Garante que o usuário tenha uma linha UserAchievement para cada conquista
 * do catálogo (criando o registro global Achievement se necessário).
 */
async function ensureUserAchievements(userId) {
    const rows = await db_2.gp.userAchievement.findMany({ where: { userId } });
    const existingSlugs = [];
    for (const row of rows) {
        const r = row;
        const ach = await db_2.gp.achievement.findUnique({ where: { id: r.achievementId } });
        if (ach)
            existingSlugs.push(ach.slug);
    }
    const have = new Set(existingSlugs);
    for (const def of achievements_1.ACHIEVEMENT_CATALOG) {
        if (have.has(def.slug))
            continue;
        const ach = await db_2.gp.achievement.upsert({
            where: { slug: def.slug },
            update: {},
            create: { ...(0, achievements_1.toAchievementModel)(def), slug: def.slug },
        });
        const achievementId = ach.id;
        await db_2.gp.userAchievement.upsert({
            where: { userId_achievementId: { userId, achievementId } },
            update: {},
            create: { userId, achievementId, progress: 0, unlocked: false, xpGranted: false },
        });
    }
}
/**
 * Retorna a visão completa das conquistas do usuário com progresso real.
 * Opcionalmente só as visíveis (não-desafio).
 */
async function getUserAchievements(userId, opts) {
    await ensureUserAchievements(userId);
    const userRows = await db_2.gp.userAchievement.findMany({
        where: { userId },
        orderBy: { unlockedAt: "desc" },
    });
    const out = [];
    for (const row of userRows) {
        const r = row;
        const ach = await db_2.gp.achievement.findUnique({ where: { id: r.achievementId } });
        if (!ach)
            continue;
        const a = ach;
        if (opts?.onlyVisible && a.hidden)
            continue;
        // Recalcula o progresso a partir dos dados reais (fonte de verdade).
        const def = (0, achievements_1.getAchievementBySlug)(a.slug);
        let progress = r.progress;
        if (def) {
            const measured = await computeProgress(userId, def.progressKind);
            progress = measured.available ? Math.min(measured.value, a.threshold) : r.progress;
        }
        out.push({
            slug: a.slug,
            title: a.title,
            description: a.description,
            category: a.category,
            tier: a.tier,
            xpReward: a.xpReward,
            threshold: a.threshold,
            unit: a.unit,
            hidden: a.hidden,
            progress,
            unlocked: r.unlocked,
            unlockedAt: r.unlockedAt ? r.unlockedAt.toISOString() : null,
            xpGranted: r.xpGranted,
        });
    }
    // Ordena: desbloqueadas primeiro, depois por categoria/título.
    out.sort((x, y) => x.unlocked === y.unlocked
        ? x.category.localeCompare(y.category) || x.title.localeCompare(y.title)
        : x.unlocked
            ? -1
            : 1);
    return out;
}
/**
 * Verifica todas as conquistas do usuário e desbloqueia as que atingiram o
 * threshold. Ao desbloquear, concede o XP da recompensa UMA vez
 * (idempotente por source+refId em XpLog).
 */
async function checkAndUnlockAchievements(userId) {
    const views = await getUserAchievements(userId);
    let unlockedNow = false;
    let xpGrantedNow = false;
    let totalAmount = 0;
    for (const v of views) {
        if (v.unlocked || v.progress < v.threshold)
            continue;
        const ach = await db_2.gp.achievement.findUnique({ where: { slug: v.slug } });
        if (!ach)
            continue;
        const achId = ach.id;
        const row = await db_2.gp.userAchievement.findFirst({
            where: { userId, achievementId: achId },
        });
        if (!row)
            continue;
        await db_2.gp.userAchievement.update({
            where: { id: row.id },
            data: { unlocked: true, unlockedAt: new Date(), xpGranted: true },
        });
        unlockedNow = true;
        xpGrantedNow = true;
        totalAmount += v.xpReward;
        // Concede o XP da conquista (idempotente por source+refId).
        // amount = xpReward real (5–100 conforme a dificuldade da conquista).
        await (0, xp_1.grantXpAmount)(userId, "conquista-desbloqueada", v.slug, v.xpReward);
    }
    return { unlockedNow, xpGrantedNow, amount: totalAmount };
}
