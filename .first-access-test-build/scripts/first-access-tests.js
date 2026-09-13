"use strict";
/**
 * TESTES DETERMINÍSTICOS — PRIMEIRO ACESSO (Fase atual)
 * ======================================================
 * Testa a lógica pura do fluxo de primeiro acesso SEM APIs externas nem banco
 * (mocks ONLY):
 *   - núcleo puro (core.ts): normalização de e-mail, força de senha, status
 *     efetivo do grant, usabilidade do token, geração/hash de token, origem
 *     permitida, constantes oficiais
 *   - provider de e-mail desacoplado (email/index.ts): NUNCA finge envio;
 *     sem provider configurado → status NOT_CONFIGURED
 *   - validadores Zod (validators/first-access.ts): e-mail, token mínimo,
 *     senha forte, confirmação de senha
 *   - WebAuthn (webauthn/index.ts): pendência controlada — nunca habilita
 *     passkey, nunca aceita credencial falsa
 *
 * Para rodar: npm run first-access:test
 * (Não usa vitest/jest — depende apenas de Node + assert.)
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
const assert = __importStar(require("node:assert"));
const core_1 = require("../src/lib/first-access/core");
const email_1 = require("../src/lib/email");
const first_access_1 = require("../src/lib/validators/first-access");
const webauthn_1 = require("../src/lib/webauthn");
// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
let passed = 0;
const failures = [];
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    }
    catch (err) {
        failures.push(name);
        console.error(`  ❌ ${name}`);
        console.error(`     ${err instanceof Error ? err.message : String(err)}`);
    }
}
/** Roda `fn` com envs temporárias e restaura o ambiente original. */
function withEnv(envs, fn) {
    const original = new Map();
    for (const [k, v] of Object.entries(envs)) {
        original.set(k, process.env[k]);
        if (v === undefined)
            delete process.env[k];
        else
            process.env[k] = v;
    }
    try {
        fn();
    }
    finally {
        for (const [k, v] of original) {
            if (v === undefined)
                delete process.env[k];
            else
                process.env[k] = v;
        }
    }
}
// ------------------------------------------------------------
// 1. Núcleo puro — normalizeEmail
// ------------------------------------------------------------
function normalizeEmailSection() {
    test("normalizeEmail trima e converte para minúsculas", () => {
        assert.strictEqual((0, core_1.normalizeEmail)("  Ana@Exemplo.COM  "), "ana@exemplo.com");
        assert.strictEqual((0, core_1.normalizeEmail)("Cliente@Dominio.com.br"), "cliente@dominio.com.br");
    });
    test("normalizeEmail aceita e-mails válidos simples", () => {
        assert.strictEqual((0, core_1.normalizeEmail)("a@b.co"), "a@b.co");
        assert.strictEqual((0, core_1.normalizeEmail)("x@y.z"), "x@y.z");
        assert.strictEqual((0, core_1.normalizeEmail)("nome.sobrenome@sub.dominio.com"), "nome.sobrenome@sub.dominio.com");
    });
    test("normalizeEmail rejeita vazio/nulo/sem arroba/sem domínio", () => {
        assert.strictEqual((0, core_1.normalizeEmail)(""), null);
        assert.strictEqual((0, core_1.normalizeEmail)("   "), null);
        assert.strictEqual((0, core_1.normalizeEmail)(null), null);
        assert.strictEqual((0, core_1.normalizeEmail)(undefined), null);
        assert.strictEqual((0, core_1.normalizeEmail)("sem-arroba"), null);
        assert.strictEqual((0, core_1.normalizeEmail)("a@b"), null);
        assert.strictEqual((0, core_1.normalizeEmail)("a b@c.com"), null);
    });
}
// ------------------------------------------------------------
// 2. Núcleo puro — força de senha
// ------------------------------------------------------------
function passwordSection() {
    test("isStrongPassword aceita 8+ caracteres", () => {
        assert.strictEqual((0, core_1.isStrongPassword)("12345678"), true);
        assert.strictEqual((0, core_1.isStrongPassword)("senha-forte-123"), true);
    });
    test("isStrongPassword rejeita < 8 caracteres", () => {
        assert.strictEqual((0, core_1.isStrongPassword)(""), false);
        assert.strictEqual((0, core_1.isStrongPassword)("1234567"), false);
        assert.strictEqual((0, core_1.isStrongPassword)("a".repeat(7)), false);
    });
    test("isStrongPassword rejeita não-string", () => {
        assert.strictEqual((0, core_1.isStrongPassword)(12345678), false);
        assert.strictEqual((0, core_1.isStrongPassword)(null), false);
        assert.strictEqual((0, core_1.isStrongPassword)(undefined), false);
    });
}
// ------------------------------------------------------------
// 3. Núcleo puro — status efetivo do grant
// ------------------------------------------------------------
function grantStatusSection() {
    const now = new Date("2026-08-30T12:00:00.000Z");
    const past = new Date("2026-08-01T12:00:00.000Z");
    const future = new Date("2026-09-30T12:00:00.000Z");
    test("CANCELED permanece CANCELED mesmo sem expiração", () => {
        assert.strictEqual((0, core_1.effectiveGrantStatus)("CANCELED", null, now), "CANCELED");
        assert.strictEqual((0, core_1.effectiveGrantStatus)("CANCELED", future, now), "CANCELED");
    });
    test("expiração no passado → EXPIRED (independente do persistido)", () => {
        assert.strictEqual((0, core_1.effectiveGrantStatus)("ACTIVE", past, now), "EXPIRED");
        assert.strictEqual((0, core_1.effectiveGrantStatus)("PENDING_FIRST_ACCESS", past, now), "EXPIRED");
    });
    test("dentro do período → status persistido (ACTIVE/PENDING_FIRST_ACCESS)", () => {
        assert.strictEqual((0, core_1.effectiveGrantStatus)("ACTIVE", future, now), "ACTIVE");
        assert.strictEqual((0, core_1.effectiveGrantStatus)("PENDING_FIRST_ACCESS", future, now), "PENDING_FIRST_ACCESS");
    });
    test("sem expiração → status persistido", () => {
        assert.strictEqual((0, core_1.effectiveGrantStatus)("ACTIVE", null, now), "ACTIVE");
        assert.strictEqual((0, core_1.effectiveGrantStatus)("PENDING_FIRST_ACCESS", null, now), "PENDING_FIRST_ACCESS");
    });
    test("status ausente/undefined → base PENDING_FIRST_ACCESS", () => {
        assert.strictEqual((0, core_1.effectiveGrantStatus)(undefined, null, now), "PENDING_FIRST_ACCESS");
        assert.strictEqual((0, core_1.effectiveGrantStatus)(null, null, now), "PENDING_FIRST_ACCESS");
    });
    test("expiração no exato instante now → EXPIRED (<=)", () => {
        const exact = new Date(now.getTime());
        assert.strictEqual((0, core_1.effectiveGrantStatus)("ACTIVE", exact, now), "EXPIRED");
    });
}
// ------------------------------------------------------------
// 4. Núcleo puro — usabilidade do token (replay/expiração)
// ------------------------------------------------------------
function tokenUsabilitySection() {
    const now = new Date("2026-08-30T12:00:00.000Z");
    const future = new Date("2026-08-30T13:00:00.000Z");
    const past = new Date("2026-08-30T11:00:00.000Z");
    test("token válido → usable", () => {
        assert.strictEqual((0, core_1.isFirstAccessTokenUsable)({ consumed: false, usedAt: null, expiresAt: future }, now), true);
    });
    test("token consumido → inválido (replay)", () => {
        assert.strictEqual((0, core_1.isFirstAccessTokenUsable)({ consumed: true, usedAt: null, expiresAt: future }, now), false);
        assert.strictEqual((0, core_1.isFirstAccessTokenUsable)({ consumed: true, usedAt: now, expiresAt: future }, now), false);
    });
    test("token com usedAt preenchido → inválido", () => {
        assert.strictEqual((0, core_1.isFirstAccessTokenUsable)({ consumed: false, usedAt: now, expiresAt: future }, now), false);
    });
    test("token expirado → inválido", () => {
        assert.strictEqual((0, core_1.isFirstAccessTokenUsable)({ consumed: false, usedAt: null, expiresAt: past }, now), false);
    });
    test("token expira no exato instante now → inválido (<=)", () => {
        assert.strictEqual((0, core_1.isFirstAccessTokenUsable)({ consumed: false, usedAt: null, expiresAt: now }, now), false);
    });
}
// ------------------------------------------------------------
// 5. Núcleo puro — geração e hash de token
// ------------------------------------------------------------
function tokenCryptoSection() {
    test("generateRandomToken devolve base64url opaco (~43 chars)", () => {
        const t = (0, core_1.generateRandomToken)();
        assert.strictEqual(typeof t, "string");
        assert.ok(t.length >= 40 && t.length <= 48, `tamanho inesperado: ${t.length}`);
        assert.ok(/^[A-Za-z0-9_-]+$/.test(t), "deve ser base64url (sem + / =)");
    });
    test("generateRandomToken gera valores únicos", () => {
        const set = new Set();
        for (let i = 0; i < 500; i++)
            set.add((0, core_1.generateRandomToken)());
        assert.strictEqual(set.size, 500);
    });
    test("hashToken é SHA-256 hex determinístico", () => {
        const h1 = (0, core_1.hashToken)("meu-token-x");
        const h2 = (0, core_1.hashToken)("meu-token-x");
        assert.strictEqual(h1, h2);
        assert.strictEqual(h1.length, 64);
        assert.ok(/^[0-9a-f]{64}$/.test(h1), "hash deve ser hex minúsculo");
    });
    test("hashToken NUNCA contém o token cru (hash unidirecional)", () => {
        const token = "token-ultra-secreto-abc123";
        const hash = (0, core_1.hashToken)(token);
        assert.ok(!hash.includes("token"), "hash não deve conter o cru");
        assert.ok(!hash.includes("abc123"), "hash não deve conter o cru");
        assert.notStrictEqual(hash, token);
    });
    test("tokens diferentes → hashes diferentes", () => {
        assert.notStrictEqual((0, core_1.hashToken)("a"), (0, core_1.hashToken)("b"));
    });
}
// ------------------------------------------------------------
// 6. Núcleo puro — origens permitidas + constantes
// ------------------------------------------------------------
function constantsSection() {
    test("origens permitidas: INFINITEPAY, ASAAS e ADMIN_MANUAL", () => {
        assert.strictEqual((0, core_1.isValidOrigin)("INFINITEPAY"), true);
        assert.strictEqual((0, core_1.isValidOrigin)("ASAAS"), true);
        assert.strictEqual((0, core_1.isValidOrigin)("ADMIN_MANUAL"), true);
    });
    test("origens inválidas são rejeitadas", () => {
        assert.strictEqual((0, core_1.isValidOrigin)(""), false);
        assert.strictEqual((0, core_1.isValidOrigin)("MANUAL"), false);
        assert.strictEqual((0, core_1.isValidOrigin)("asaas"), false);
        assert.strictEqual((0, core_1.isValidOrigin)("MAGIC"), false);
    });
    test("constantes oficiais de segurança", () => {
        assert.strictEqual(core_1.FIRST_ACCESS_TOKEN_TTL_MINUTES, 60);
        assert.strictEqual(core_1.FIRST_ACCESS_TOKEN_BYTES, 32);
        assert.deepStrictEqual(core_1.ACCESS_GRANT_STATUSES, [
            "PENDING_FIRST_ACCESS",
            "ACTIVE",
            "EXPIRED",
            "CANCELED",
        ]);
    });
    test("mensagem anti-enumeração é genérica (não confirma existência)", () => {
        assert.strictEqual(core_1.EMAIL_NOT_ELIGIBLE_MESSAGE, "Se houver uma liberação de acesso para este e-mail, enviaremos um link seguro.");
        assert.ok(!core_1.EMAIL_NOT_ELIGIBLE_MESSAGE.includes("não existe"));
        assert.ok(!core_1.EMAIL_NOT_ELIGIBLE_MESSAGE.includes("não encontrado"));
    });
}
// ------------------------------------------------------------
// 7. Provider de e-mail — NUNCA finge envio
// ------------------------------------------------------------
function emailSection() {
    test("sem provider configurado → status NOT_CONFIGURED, ok=false", async () => {
        const res = await (0, email_1.sendFirstAccessEmail)({
            to: "cliente@exemplo.com",
            activationUrl: "https://app.instacessor.com/primeiro-acesso?token=x",
            expiresInMinutes: 60,
        });
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.status, "NOT_CONFIGURED");
    });
    test("isEmailProviderConfigured é falso sem EMAIL_PROVIDER", () => {
        withEnv({ EMAIL_PROVIDER: undefined }, () => {
            assert.strictEqual((0, email_1.isEmailProviderConfigured)(), false);
        });
    });
    test("isEmailProviderConfigured é falso para 'none'/vazio", () => {
        withEnv({ EMAIL_PROVIDER: "none" }, () => {
            assert.strictEqual((0, email_1.isEmailProviderConfigured)(), false);
        });
        withEnv({ EMAIL_PROVIDER: "" }, () => {
            assert.strictEqual((0, email_1.isEmailProviderConfigured)(), false);
        });
    });
    test("isEmailProviderConfigured é verdadeiro com provider real", () => {
        withEnv({ EMAIL_PROVIDER: "resend" }, () => {
            assert.strictEqual((0, email_1.isEmailProviderConfigured)(), true);
        });
    });
}
// ------------------------------------------------------------
// 8. Validadores Zod
// ------------------------------------------------------------
function validatorsSection() {
    test("requestFirstAccessSchema aceita e-mail e normaliza", () => {
        const r = first_access_1.requestFirstAccessSchema.safeParse({ email: "  Cliente@Exemplo.COM  " });
        assert.strictEqual(r.success, true);
        if (r.success)
            assert.strictEqual(r.data.email, "cliente@exemplo.com");
    });
    test("requestFirstAccessSchema rejeita e-mail inválido/vazio", () => {
        assert.strictEqual(first_access_1.requestFirstAccessSchema.safeParse({ email: "" }).success, false);
        assert.strictEqual(first_access_1.requestFirstAccessSchema.safeParse({ email: "sem-arroba" }).success, false);
        assert.strictEqual(first_access_1.requestFirstAccessSchema.safeParse({}).success, false);
    });
    test("verifyFirstAccessTokenSchema exige token com 16+ chars", () => {
        assert.strictEqual(first_access_1.verifyFirstAccessTokenSchema.safeParse({ token: "a".repeat(16) }).success, true);
        assert.strictEqual(first_access_1.verifyFirstAccessTokenSchema.safeParse({ token: "short" }).success, false);
        assert.strictEqual(first_access_1.verifyFirstAccessTokenSchema.safeParse({ token: "" }).success, false);
    });
    test("createFirstAccessSchema exige senha forte (8+)", () => {
        assert.strictEqual(first_access_1.createFirstAccessSchema.safeParse({ token: "t".repeat(20), password: "12345678", confirmPassword: "12345678" }).success, true);
        assert.strictEqual(first_access_1.createFirstAccessSchema.safeParse({ token: "t".repeat(20), password: "1234567", confirmPassword: "1234567" }).success, false);
    });
    test("createFirstAccessSchema rejeita senhas que não coincidem", () => {
        assert.strictEqual(first_access_1.createFirstAccessSchema.safeParse({ token: "t".repeat(20), password: "12345678", confirmPassword: "87654321" }).success, false);
    });
    test("createFirstAccessSchema rejeita token curto", () => {
        assert.strictEqual(first_access_1.createFirstAccessSchema.safeParse({ token: "short", password: "12345678", confirmPassword: "12345678" }).success, false);
    });
}
// ------------------------------------------------------------
// 9. WebAuthn — pendência controlada honesta
// ------------------------------------------------------------
function webauthnSection() {
    test("getPasskeyStatus é sempre enabled=false (nunca finge)", () => {
        const st = (0, webauthn_1.getPasskeyStatus)();
        assert.strictEqual(st.enabled, false);
        assert.ok(st.reason.length > 0);
    });
    test("startPasskeyRegistration retorna erro honesto, ok=false", async () => {
        const res = await (0, webauthn_1.startPasskeyRegistration)({ userId: "u1" });
        assert.strictEqual(res.ok, false);
        assert.ok(res.error.length > 0);
    });
    test("verifyPasskeyAssertion nunca aceita credencial", async () => {
        const res = await (0, webauthn_1.verifyPasskeyAssertion)({ id: "fake" });
        assert.strictEqual(res.ok, false);
        assert.ok(res.error.includes("senha"));
    });
}
// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
async function main() {
    console.log("\n🔎 Primeiro Acesso — testes determinísticos\n");
    normalizeEmailSection();
    passwordSection();
    grantStatusSection();
    tokenUsabilitySection();
    tokenCryptoSection();
    constantsSection();
    emailSection();
    validatorsSection();
    webauthnSection();
    console.log(`\nResultado: ${passed} passaram, ${failures.length} falharam\n`);
    if (failures.length > 0) {
        console.error("Falhas:");
        for (const f of failures)
            console.error(`  - ${f}`);
        process.exit(1);
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
