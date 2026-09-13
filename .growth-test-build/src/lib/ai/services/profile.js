"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIProfile = getAIProfile;
const db_1 = require("@/lib/ai/db");
/** Retorna o perfil de inteligência do usuário, se existir. */
async function getAIProfile(userId) {
    const row = await db_1.ai.profile.findUnique({ where: { userId } });
    if (!row)
        return null;
    return row;
}
