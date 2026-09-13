"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.settings = void 0;
const db_1 = require("@/lib/db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
const p = db_1.prisma;
exports.settings = {
    systemSetting: p.systemSetting,
};
