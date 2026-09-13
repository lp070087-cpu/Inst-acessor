"use strict";
/**
 * Camada genérica de provider de IA — desacoplada.
 * Suporta OpenAI e Gemini. Sem mock: se nenhuma API key estiver configurada,
 * `aiConfigured()` retorna false e a UI mostra "IA ainda não configurada".
 *
 * A configuração é CENTRAL (área admin, Fase 10): o DONO grava a chave via
 * `/api/admin/ia`, ela é persistida encriptada no banco (SystemSetting) e
 * passa a valer para o runtime. Se não houver chave no banco, cai para as
 * variáveis de ambiente (OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY).
 *
 * ⚠️ Estas funções rodam APENAS no servidor (route handlers / lib).
 * NUNCA importar este módulo em componentes client com API keys.
 * NUNCA expor chave no frontend.
 */
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
exports.aiConfigured = aiConfigured;
/**
 * Estado global "IA configurada?" — consulta a configuração admin (DB) e,
 * como fallback, as env vars. Server-only.
 */
async function aiConfigured() {
    const { resolveRuntimeAI } = await Promise.resolve().then(() => __importStar(require("@/lib/admin/ai-config")));
    const resolved = await resolveRuntimeAI();
    if (resolved)
        return true;
    return Boolean(process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY);
}
