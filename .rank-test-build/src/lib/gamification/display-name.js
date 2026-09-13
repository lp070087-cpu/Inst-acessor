"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDisplayNameInfo = getDisplayNameInfo;
exports.setDisplayNameSource = setDisplayNameSource;
exports.applySelfDisplayName = applySelfDisplayName;
const db_1 = require("@/lib/db");
/**
 * NOME EXIBIDO — rodada #274
 * ===========================
 * O usuário escolhe como aparece no Rank/ranking/perfil:
 *   1) "Nome do perfil do Inst Acessor" (padrão — fallback "Usuário")
 *   2) "Nome/@username da conta Instagram conectada"
 *
 * Este arquivo concentra o acesso ao banco. A lógica pura de resolução vive em
 * `display-name-core.ts` (re-exportada daqui) — o barrel `gamification/index.ts`
 * continua expondo o MESMO contrato.
 *
 * SEM mudança de schema: a preferência vive no JSON `UserPreferences.dashboard`
 * sob a chave `displayNameSource` ("profile" | "instagram"). A resolução sempre
 * tem fallback honesto — se escolheu Instagram mas não há conta conectada
 * (ou sem nome/@username), cai para o nome do perfil.
 */
__exportStar(require("./display-name-core"), exports);
const display_name_core_1 = require("./display-name-core");
/** Lê o estado de nome exibido do usuário com fallback honesto. */
async function getDisplayNameInfo(userId) {
    const [profile, prefs, ig] = await Promise.all([
        db_1.prisma.userProfile.findUnique({
            where: { userId },
            select: { displayName: true, username: true },
        }),
        db_1.prisma.userPreferences.findUnique({
            where: { userId },
            select: { dashboard: true },
        }),
        db_1.prisma.instagramProfile.findFirst({
            where: { userId, OR: [{ name: { not: null } }, { username: { not: null } }] },
            orderBy: { createdAt: "desc" },
            select: { name: true, username: true },
        }),
    ]);
    const stored = (0, display_name_core_1.readStoredSource)(prefs?.dashboard);
    const resolved = (0, display_name_core_1.resolveDisplayName)(stored, profile?.displayName ?? null, ig);
    const igValue = ig?.name || (ig?.username ? `@${ig.username}` : null) || null;
    return {
        source: resolved.source,
        value: resolved.value,
        storedSource: stored,
        profileName: profile?.displayName ?? null,
        profileUsername: profile?.username ?? null,
        igName: ig?.name ?? null,
        igUsername: ig?.username ?? null,
        hasInstagram: Boolean(igValue),
    };
}
/** Define a preferência de nome exibido (merge no JSON dashboard). */
async function setDisplayNameSource(userId, source) {
    const prefs = await db_1.prisma.userPreferences.findUnique({
        where: { userId },
        select: { dashboard: true },
    });
    const base = prefs?.dashboard && typeof prefs.dashboard === "object"
        ? prefs.dashboard
        : {};
    // JSON.parse(JSON.stringify(...)): mesmo padrão da Fase 4 (score.ts) para
    // valores compatíveis com o tipo Json do Prisma.
    const dashboard = JSON.parse(JSON.stringify({ ...base, displayNameSource: source }));
    await db_1.prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, dashboard },
        update: { dashboard },
    });
}
/** Aplica o nome resolvido à entrada "me" de um ranking (self-only). */
function applySelfDisplayName(entries, info) {
    return entries.map((e) => (e.isMe ? { ...e, name: info.value } : e));
}
