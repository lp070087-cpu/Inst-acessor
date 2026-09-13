"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.ai = void 0;
const db_1 = require("@/lib/db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
const p = db_1.prisma;
exports.ai = {
    conversation: p.aIConversation,
    message: p.aIMessage,
    profile: p.aIProfile,
    copy: p.generatedCopy,
    idea: p.contentIdea,
    draft: p.socialDraft,
    recommendation: p.mentorshipRecommendation,
    score: p.profileScore,
    scoreSnapshot: p.profileScoreSnapshot,
};
