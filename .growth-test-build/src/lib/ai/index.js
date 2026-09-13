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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIProvider = getAIProvider;
const openai_1 = require("./openai");
const gemini_1 = require("./gemini");
__exportStar(require("./provider"), exports);
__exportStar(require("./openai"), exports);
__exportStar(require("./gemini"), exports);
/**
 * Retorna o provider ativo, ou `null` se nenhuma API key estiver configurada.
 *
 * Consulta primeiro a configuração central (admin, persistida encriptada no
 * banco); se nada estiver gravado, usa as env vars. Nunca é chamado no client.
 */
async function getAIProvider() {
    const { resolveRuntimeAI } = await Promise.resolve().then(() => __importStar(require("@/lib/admin/ai-config")));
    const resolved = await resolveRuntimeAI();
    if (resolved) {
        if (resolved.provider === "openai") {
            return new openai_1.OpenAIProvider(resolved.apiKey);
        }
        return new gemini_1.GeminiProvider(resolved.apiKey);
    }
    if (process.env.OPENAI_API_KEY)
        return new openai_1.OpenAIProvider();
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
        return new gemini_1.GeminiProvider();
    return null;
}
