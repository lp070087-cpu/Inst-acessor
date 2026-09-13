"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.pub = void 0;
const db_1 = require("@/lib/db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
const p = db_1.prisma;
exports.pub = {
    queue: p.publishQueue,
    log: p.publishLog,
    automationRule: p.automationRule,
    automationEvent: p.automationEvent,
    automationExecution: p.automationExecution,
};
