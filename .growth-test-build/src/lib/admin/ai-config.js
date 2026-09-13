"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_MODELS = exports.OPENAI_MODELS = exports.AI_GEMINI_MODEL = exports.AI_GEMINI_KEY = exports.AI_OPENAI_MODEL = exports.AI_OPENAI_KEY = exports.AI_PROVIDER_KEY = void 0;
exports.getAIAdminStatus = getAIAdminStatus;
exports.saveAIProvider = saveAIProvider;
exports.removeAIProvider = removeAIProvider;
exports.testAIProvider = testAIProvider;
exports.resolveRuntimeAI = resolveRuntimeAI;
const settings_db_1 = require("@/lib/admin/settings-db");
const crypto_1 = require("@/lib/crypto");
/**
 * ADMIN — Configuração central da IA (Fase 10)
 * =============================================
 *
 * A configuração da IA é feita APENAS pela área administrativa (ADMIN).
 * Clientes nunca configuram chave de API.
 *
 * Modelo de persistência:
 * - `ai.provider`        → "openai" | "gemini" | "" (vazio = sem IA)
 * - `ai.openai.key`      → chave ENCRIPITADA (AES-256-GCM) + sufixo
 * - `ai.openai.model`    → "gpt-4o-mini" (padrão oficial)
 * - `ai.gemini.key`      → chave ENCRIPITADA (AES-256-GCM) + sufixo
 * - `ai.gemini.model`    → "gemini-1.5-flash" (padrão oficial)
 *
 * Segurança:
 * - Chave NUNCA é devolvida ao frontend; apenas o sufixo mascarado
 *   (ex.: `sk-••••••••••••abcd`).
 * - Valores sensíveis são gravados encriptados; nunca em texto puro.
 * - Provider ativo para o RUNTIME continua lido das env vars
 *   (OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY). Esta camada admin
 *   é a FONTE DE VERDADE quando o DONO grava por aqui — quando o DONO salva
 *   uma chave, ela passa a valer para `aiConfigured()`/`getAIProvider()`.
 *
 * ⚠️ A DONA DEVE rodar `npx prisma generate` localmente para o client
 * reconhecer o model SystemSetting.
 */
// ------------------------------------------------------------
// Chaves oficiais
// ------------------------------------------------------------
exports.AI_PROVIDER_KEY = "ai.provider";
exports.AI_OPENAI_KEY = "ai.openai.key";
exports.AI_OPENAI_MODEL = "ai.openai.model";
exports.AI_GEMINI_KEY = "ai.gemini.key";
exports.AI_GEMINI_MODEL = "ai.gemini.model";
/** Modelos oficiais (escolha fechada — sem strings livres). */
exports.OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"];
exports.GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"];
// ------------------------------------------------------------
// Helpers de leitura (server-only)
// ------------------------------------------------------------
/** Mascara uma chave: `sk-••••••••••••abcd` — nunca expõe o valor. */
function maskKey(key) {
    if (!key)
        return "";
    const clean = key.trim();
    if (clean.length <= 8)
        return "••••••••";
    const head = clean.slice(0, 3);
    const tail = clean.slice(-4);
    return `${head}-••••••••••••${tail}`;
}
function parseModel(value, fallback, allowed) {
    if (value && allowed.includes(value))
        return value;
    return fallback;
}
async function getSetting(key) {
    const row = await settings_db_1.settings.systemSetting.findUnique({ where: { key } });
    if (!row)
        return null;
    return row.value;
}
async function setSetting(key, value) {
    const existing = await settings_db_1.settings.systemSetting.findUnique({ where: { key } });
    if (existing) {
        await settings_db_1.settings.systemSetting.update({ where: { id: existing.id }, data: { value } });
    }
    else {
        await settings_db_1.settings.systemSetting.create({ data: { key, value } });
    }
}
async function removeSetting(key) {
    await settings_db_1.settings.systemSetting.deleteMany({ where: { key } });
}
// ------------------------------------------------------------
// Estado da IA — lê DB + env (nunca expõe a chave)
// ------------------------------------------------------------
async function getAIAdminStatus() {
    const [provider, openaiKeyEnc, openaiModel, geminiKeyEnc, geminiModel] = await Promise.all([
        getSetting(exports.AI_PROVIDER_KEY),
        getSetting(exports.AI_OPENAI_KEY),
        getSetting(exports.AI_OPENAI_MODEL),
        getSetting(exports.AI_GEMINI_KEY),
        getSetting(exports.AI_GEMINI_MODEL),
    ]);
    // Se o DONO gravou uma chave no admin, ela é a fonte de verdade.
    const openaiKey = openaiKeyEnc ? (0, crypto_1.decryptToken)(openaiKeyEnc) : process.env.OPENAI_API_KEY ?? "";
    const geminiKey = geminiKeyEnc
        ? (0, crypto_1.decryptToken)(geminiKeyEnc)
        : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const openaiConfigured = Boolean(openaiKey);
    const geminiConfigured = Boolean(geminiKey);
    const openai = {
        configured: openaiConfigured,
        provider: "openai",
        model: parseModel(openaiModel ?? "", "gpt-4o-mini", exports.OPENAI_MODELS),
        keyMask: openaiConfigured ? maskKey(openaiKey) : "",
        source: openaiKeyEnc ? "db" : openaiConfigured ? "env" : "db",
    };
    const gemini = {
        configured: geminiConfigured,
        provider: "gemini",
        model: parseModel(geminiModel ?? "", "gemini-1.5-flash", exports.GEMINI_MODELS),
        keyMask: geminiConfigured ? maskKey(geminiKey) : "",
        source: geminiKeyEnc ? "db" : geminiConfigured ? "env" : "db",
    };
    // Provider ativo: preferência explícita do admin; senão primeira configurada.
    let activeProvider = "";
    if (provider === "openai" && openaiConfigured)
        activeProvider = "openai";
    else if (provider === "gemini" && geminiConfigured)
        activeProvider = "gemini";
    else if (openaiConfigured)
        activeProvider = "openai";
    else if (geminiConfigured)
        activeProvider = "gemini";
    return {
        openai,
        gemini,
        activeProvider,
        aiConfigured: Boolean(activeProvider),
    };
}
async function saveAIProvider(input) {
    const { provider, apiKey, model } = input;
    // Valida o model contra a lista oficial.
    const allowed = provider === "openai" ? exports.OPENAI_MODELS : exports.GEMINI_MODELS;
    const normalized = parseModel(model, provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash", allowed);
    if (provider === "openai") {
        if (apiKey && apiKey.trim()) {
            await setSetting(exports.AI_OPENAI_KEY, (0, crypto_1.encryptToken)(apiKey.trim()));
        }
        await setSetting(exports.AI_OPENAI_MODEL, normalized);
        // Se era o provider ativo e há chave gravada, garante que continua.
        if (input.apiKey?.trim() || (await getSetting(exports.AI_OPENAI_KEY))) {
            await setSetting(exports.AI_PROVIDER_KEY, "openai");
        }
    }
    else {
        if (apiKey && apiKey.trim()) {
            await setSetting(exports.AI_GEMINI_KEY, (0, crypto_1.encryptToken)(apiKey.trim()));
        }
        await setSetting(exports.AI_GEMINI_MODEL, normalized);
        if (input.apiKey?.trim() || (await getSetting(exports.AI_GEMINI_KEY))) {
            await setSetting(exports.AI_PROVIDER_KEY, "gemini");
        }
    }
}
async function removeAIProvider(provider) {
    if (provider === "openai") {
        await removeSetting(exports.AI_OPENAI_KEY);
        await removeSetting(exports.AI_OPENAI_MODEL);
    }
    else {
        await removeSetting(exports.AI_GEMINI_KEY);
        await removeSetting(exports.AI_GEMINI_MODEL);
    }
}
/** Testa uma chave fazendo uma chamada mínima de baixo custo. */
async function testAIProvider(input) {
    const { provider, apiKey, model } = input;
    let key;
    if (apiKey && apiKey.trim()) {
        key = apiKey.trim();
    }
    else {
        const enc = await getSetting(provider === "openai" ? exports.AI_OPENAI_KEY : exports.AI_GEMINI_KEY);
        key = enc
            ? (0, crypto_1.decryptToken)(enc)
            : provider === "openai"
                ? process.env.OPENAI_API_KEY ?? ""
                : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    }
    if (!key)
        return { ok: false, message: "Nenhuma chave configurada para testar." };
    try {
        if (provider === "openai") {
            const res = await fetch("https://api.openai.com/v1/models", {
                headers: { Authorization: `Bearer ${key}` },
            });
            if (!res.ok) {
                return { ok: false, message: `OpenAI retornou ${res.status}. Verifique a chave.` };
            }
            return { ok: true, message: "Conexão com OpenAI OK." };
        }
        // Gemini: chamada mínima de geração (baixo custo).
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "responda apenas: ok" }] }],
                generationConfig: { maxOutputTokens: 5 },
            }),
        });
        if (!res.ok) {
            return { ok: false, message: `Gemini retornou ${res.status}. Verifique a chave.` };
        }
        return { ok: true, message: "Conexão com Gemini OK." };
    }
    catch {
        return { ok: false, message: "Não foi possível alcançar o provider. Verifique a rede." };
    }
}
// ------------------------------------------------------------
// Runtime — ponte para o provider do app
// ------------------------------------------------------------
/**
 * Resolve a chave/modelo efetivos em runtime.
 * Retorna null se a IA não estiver configurada (nem DB nem env).
 */
async function resolveRuntimeAI() {
    const status = await getAIAdminStatus();
    if (!status.activeProvider)
        return null;
    if (status.activeProvider === "openai") {
        const enc = await getSetting(exports.AI_OPENAI_KEY);
        const apiKey = enc
            ? (0, crypto_1.decryptToken)(enc)
            : process.env.OPENAI_API_KEY ?? "";
        return { provider: "openai", apiKey, model: status.openai.model };
    }
    const enc = await getSetting(exports.AI_GEMINI_KEY);
    const apiKey = enc
        ? (0, crypto_1.decryptToken)(enc)
        : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    return { provider: "gemini", apiKey, model: status.gemini.model };
}
