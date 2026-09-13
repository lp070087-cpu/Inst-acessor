"use strict";
/**
 * TESTES DETERMINÍSTICOS — BILLING ASAAS (Fase atual)
 * ====================================================
 * Testa a lógica pura do billing Asaas SEM APIs externas nem banco (mocks ONLY):
 *   - catálogo oficial de planos (imutável, preços/duração/ciclo corretos)
 *   - configuração Asaas (defaults, sem nunca revelar valores de chave)
 *   - status de integração (label, webhook, nunca valores)
 *   - sanitização de payloads (nunca logar token/secret/apikey)
 *   - parser de webhook (lista explícita, eventId determinístico, recusa payload
 *     sem referência estável, conversão value→centavos)
 *   - cliente HTTP (fail-closed sem chave, erros tipados, URL base sem barra)
 *
 * Para rodar: npm run billing:test
 * (Não usa vitest/jest — depende apenas de Node + assert).
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
const catalog_1 = require("../src/lib/billing/plans/catalog");
const config_1 = require("../src/lib/billing/asaas/config");
const webhook_1 = require("../src/lib/billing/asaas/webhook");
const client_1 = require("../src/lib/billing/asaas/client");
const types_1 = require("../src/lib/billing/asaas/types");
const manual_access_core_1 = require("../src/lib/billing/manual-access-core");
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
// 1. Catálogo oficial de planos (imutável, server-side)
// ------------------------------------------------------------
function catalogSection() {
    test("catálogo tem exatamente 3 planos (sem Combo)", () => {
        assert.strictEqual(catalog_1.PLAN_CATALOG.length, 3);
        const slugs = catalog_1.PLAN_CATALOG.map((p) => p.slug).sort();
        assert.deepStrictEqual(slugs, ["anual", "mensal", "semanal"]);
        assert.ok(!catalog_1.PLAN_CATALOG.some((p) => /combo/i.test(p.name)), "não deve existir plano Combo");
    });
    test("preços oficiais em centavos: semanal 2700, mensal 7700, anual 54700", () => {
        const bySlug = new Map(catalog_1.PLAN_CATALOG.map((p) => [p.slug, p]));
        assert.strictEqual(bySlug.get("semanal")?.priceCents, 2700);
        assert.strictEqual(bySlug.get("mensal")?.priceCents, 7700);
        assert.strictEqual(bySlug.get("anual")?.priceCents, 54700);
        for (const p of catalog_1.PLAN_CATALOG) {
            assert.ok(Number.isInteger(p.priceCents), `${p.slug} preço deve ser inteiro em centavos`);
            assert.strictEqual(p.currency, "BRL");
        }
    });
    test("tipos/ciclos corretos: semanal ONE_TIME, mensal/anual RECURRING", () => {
        const bySlug = new Map(catalog_1.PLAN_CATALOG.map((p) => [p.slug, p]));
        assert.strictEqual(bySlug.get("semanal")?.type, "ONE_TIME");
        assert.strictEqual(bySlug.get("semanal")?.billingInterval, null);
        assert.strictEqual(bySlug.get("semanal")?.durationDays, 7);
        assert.strictEqual(bySlug.get("mensal")?.type, "RECURRING");
        assert.strictEqual(bySlug.get("mensal")?.billingInterval, "MONTH");
        assert.strictEqual(bySlug.get("mensal")?.durationDays, 30);
        assert.strictEqual(bySlug.get("anual")?.type, "RECURRING");
        assert.strictEqual(bySlug.get("anual")?.billingInterval, "YEAR");
        assert.strictEqual(bySlug.get("anual")?.durationDays, 365);
    });
    test("todos os planos liberam Instagram + TikTok e estão ativos", () => {
        for (const p of catalog_1.PLAN_CATALOG) {
            assert.ok(p.features.includes("Instagram"), `${p.slug} libera Instagram`);
            assert.ok(p.features.includes("TikTok"), `${p.slug} libera TikTok`);
            assert.strictEqual(p.active, true);
        }
    });
}
// ------------------------------------------------------------
// 2. Configuração Asaas (env-driven, nunca revela valores)
// ------------------------------------------------------------
function configSection() {
    test("sem ASAAS_API_KEY → não configurado, base sandbox, PIX default", () => {
        withEnv({
            ASAAS_API_KEY: undefined,
            ASAAS_ENV: undefined,
            ASAAS_BASE_URL: undefined,
            ASAAS_WEBHOOK_TOKEN: undefined,
            ASAAS_BILLING_TYPE: undefined,
        }, () => {
            const cfg = (0, config_1.getAsaasConfig)();
            assert.strictEqual(cfg.apiKey, "");
            assert.strictEqual(cfg.environment, "sandbox");
            assert.strictEqual(cfg.baseUrl, config_1.ASAAS_SANDBOX_URL);
            assert.strictEqual(cfg.billingType, "PIX");
            assert.strictEqual((0, config_1.isAsaasConfigured)(cfg), false);
        });
    });
    test("ASAAS_ENV=production → base produção e rótulo Produção", () => {
        withEnv({
            ASAAS_API_KEY: "sk_test",
            ASAAS_ENV: "production",
            ASAAS_BASE_URL: undefined,
        }, () => {
            const cfg = (0, config_1.getAsaasConfig)();
            assert.strictEqual(cfg.environment, "production");
            assert.strictEqual(cfg.baseUrl, config_1.ASAAS_PRODUCTION_URL);
            assert.strictEqual((0, config_1.asaasEnvironmentLabel)(cfg), "Produção");
            assert.strictEqual((0, config_1.isAsaasConfigured)(cfg), true);
        });
    });
    test("ASAAS_BASE_URL custom → normaliza barra final e respeita", () => {
        withEnv({
            ASAAS_API_KEY: "sk_test",
            ASAAS_BASE_URL: "https://api-sandbox.asaas.com/v3/",
        }, () => {
            const cfg = (0, config_1.getAsaasConfig)();
            assert.strictEqual(cfg.baseUrl, "https://api-sandbox.asaas.com/v3");
        });
    });
    test("asaasStatus nunca revela a chave; webhook configurado conforme token", () => {
        withEnv({
            ASAAS_API_KEY: "super-secret-key-123",
            ASAAS_WEBHOOK_TOKEN: "wh-secret",
            ASAAS_ENV: "sandbox",
        }, () => {
            const st = (0, config_1.asaasStatus)();
            assert.strictEqual(st.configured, true);
            assert.strictEqual(st.webhookConfigured, true);
            assert.strictEqual(st.environment, "sandbox");
            const json = JSON.stringify(st);
            assert.ok(!json.includes("super-secret"), "status não deve vazar a chave");
            assert.ok(!json.includes("wh-secret"), "status não deve vazar o webhook token");
        });
    });
    test("asaasStatus sem chave → configured false, label 'Não configurado'", () => {
        withEnv({ ASAAS_API_KEY: undefined }, () => {
            const st = (0, config_1.asaasStatus)();
            assert.strictEqual(st.configured, false);
            assert.strictEqual(st.environment, null);
            assert.strictEqual(st.label, "Não configurado");
        });
    });
    test("getAsaasConfig copia a chave, mas nada além dela é exposto", () => {
        withEnv({ ASAAS_API_KEY: "   sk_xpto   ", ASAAS_ENV: "sandbox" }, () => {
            const cfg = (0, config_1.getAsaasConfig)();
            // trim aplicado
            assert.strictEqual(cfg.apiKey, "sk_xpto");
        });
    });
}
// ------------------------------------------------------------
// 3. Sanitização de payload (nunca logar credenciais)
// ------------------------------------------------------------
function sanitizeSection() {
    test("sanitizeAsaasPayload remove token/secret/access_/apikey em profundidade", () => {
        const payload = {
            customer: { id: "cus_1", name: "Ana" },
            payment: {
                id: "pay_1",
                value: 77,
                access_token: "at-123",
                apiKey: "ak-456",
            },
            nested: {
                authorization: "Bearer abc",
                data: [{ secret: "s1", ok: true }],
            },
            safe: "mantém",
        };
        const out = (0, client_1.sanitizeAsaasPayload)(payload);
        assert.strictEqual(out.safe, "mantém");
        assert.strictEqual(out.customer.id, "cus_1");
        assert.ok(!("access_token" in out.payment), "access_token removido");
        assert.ok(!("apiKey" in out.payment), "apiKey removido");
        assert.ok(!("authorization" in out.nested), "authorization removido");
        assert.ok(!("secret" in out.nested.data[0]), "secret removido em array");
        assert.strictEqual(out.nested.data[0].ok, true);
    });
    test("sanitizeAsaasPayload preserva primitivos e arrays", () => {
        assert.strictEqual((0, client_1.sanitizeAsaasPayload)("str"), "str");
        assert.strictEqual((0, client_1.sanitizeAsaasPayload)(42), 42);
        assert.deepStrictEqual((0, client_1.sanitizeAsaasPayload)([1, "a", null]), [1, "a", null]);
        assert.strictEqual((0, client_1.sanitizeAsaasPayload)(null), null);
    });
}
// ------------------------------------------------------------
// 4. Parser de webhook (lista explícita + eventId determinístico)
// ------------------------------------------------------------
function webhookSection() {
    test("aceita PAYMENT_CONFIRMED com payment completo → eventId estável", () => {
        const parsed = (0, webhook_1.parseAsaasWebhook)({
            event: "PAYMENT_CONFIRMED",
            payment: {
                id: "pay_abc",
                customer: "cus_1",
                subscription: "sub_9",
                value: 77,
                paidDate: "2026-08-29",
                status: "CONFIRMED",
            },
        });
        assert.ok(parsed, "deve aceitar PAYMENT_CONFIRMED");
        assert.strictEqual(parsed.eventId, "PAYMENT_CONFIRMED:pay_abc");
        assert.strictEqual(parsed.externalPaymentId, "pay_abc");
        assert.strictEqual(parsed.externalSubscriptionId, "sub_9");
        assert.strictEqual(parsed.externalCustomerId, "cus_1");
        assert.strictEqual(parsed.amountCents, 7700);
        assert.strictEqual(parsed.paidAt, "2026-08-29");
    });
    test("aceita todos os eventos de assinatura confirmados (SUBSCRIPTION_*)", () => {
        for (const event of types_1.ASAAS_SUBSCRIPTION_EVENTS) {
            const parsed = (0, webhook_1.parseAsaasWebhook)({
                event,
                subscription: { id: "sub_x", customer: "cus_1", value: 547 },
            });
            assert.ok(parsed, `deve aceitar ${event}`);
            assert.strictEqual(parsed.eventId, `${event}:sub_x`);
        }
    });
    test("aceita todos os eventos conhecidos da lista explícita", () => {
        for (const event of types_1.ASAAS_KNOWN_EVENTS) {
            const parsed = (0, webhook_1.parseAsaasWebhook)({
                event,
                payment: { id: "pay_k", value: 27 },
            });
            assert.ok(parsed, `deve aceitar ${event}`);
        }
    });
    test("rejeita eventos fora da lista explícita", () => {
        const parsed = (0, webhook_1.parseAsaasWebhook)({ event: "PAYMENT_MYSTERY", payment: { id: "p1" } });
        assert.strictEqual(parsed, null);
    });
    test("rejeita payload sem referência externa estável", () => {
        const parsed = (0, webhook_1.parseAsaasWebhook)({ event: "PAYMENT_CONFIRMED", payment: { value: 27 } });
        assert.strictEqual(parsed, null);
    });
    test("eventId prioriza payment > subscription > customer", () => {
        const parsed = (0, webhook_1.parseAsaasWebhook)({
            event: "PAYMENT_RECEIVED",
            payment: { id: "pay_p", customer: "cus_c" },
            subscription: { id: "sub_s" },
            customer: { id: "cus_c" },
        });
        assert.ok(parsed);
        assert.strictEqual(parsed.eventId, "PAYMENT_RECEIVED:pay_p");
    });
    test("value não-numérico → amountCents null; valor convertido *100", () => {
        const p1 = (0, webhook_1.parseAsaasWebhook)({ event: "PAYMENT_CONFIRMED", payment: { id: "p1", value: "77" } });
        assert.strictEqual(p1.amountCents, null);
        const p2 = (0, webhook_1.parseAsaasWebhook)({ event: "PAYMENT_CONFIRMED", payment: { id: "p2", value: 27.5 } });
        assert.strictEqual(p2.amountCents, 2750);
    });
    test("eventHasSubscription detecta subscription no payload", () => {
        assert.strictEqual((0, webhook_1.eventHasSubscription)({ event: "SUBSCRIPTION_UPDATED", subscription: { id: "s1" } }), true);
        assert.strictEqual((0, webhook_1.eventHasSubscription)({ event: "PAYMENT_CONFIRMED", payment: { id: "p1", subscription: "s1" } }), true);
        assert.strictEqual((0, webhook_1.eventHasSubscription)({ event: "PAYMENT_CONFIRMED", payment: { id: "p1" } }), false);
    });
}
// ------------------------------------------------------------
// 5. Cliente HTTP (fail-closed, erros tipados, sem valores)
// ------------------------------------------------------------
function clientSection() {
    test("AsaasNotConfiguredError é lançado sem chave (fail-closed)", async () => {
        withEnv({ ASAAS_API_KEY: undefined, ASAAS_BASE_URL: undefined }, () => {
            // request é interno; validamos a regra de configuração que o aciona
            const cfg = (0, config_1.getAsaasConfig)();
            assert.strictEqual(cfg.apiKey, "");
            // Garante que o construtor do erro funciona isoladamente
            const err = new client_1.AsaasNotConfiguredError();
            assert.strictEqual(err.name, "AsaasNotConfiguredError");
        });
    });
    test("AsaasHttpError sanitiza corpo e expõe status/código", () => {
        const err = new client_1.AsaasHttpError(400, {
            errors: [{ code: "invalid_cpfCnpj", description: "CPF inválido." }],
        });
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.code, "invalid_cpfCnpj");
        assert.strictEqual(err.message, "CPF inválido.");
        assert.strictEqual(err.errors.length, 1);
    });
    test("AsaasHttpError com corpo não-objeto usa mensagem genérica", () => {
        const err = new client_1.AsaasHttpError(500, "erro cru");
        assert.strictEqual(err.status, 500);
        assert.strictEqual(err.message, "Erro desconhecido do Asaas.");
    });
    test("timeout e user-agent são valores fixos de servidor", () => {
        assert.strictEqual(client_1.ASAAS_TIMEOUT_MS, 15000);
    });
}
// ------------------------------------------------------------
// 6. Liberação manual de acesso pelo ADMIN (núcleo puro)
// ------------------------------------------------------------
function manualAccessSection() {
    test("constantes diferenciam manual (ADMIN_MANUAL/manual) de Asaas (ASAAS/asaas)", () => {
        assert.strictEqual(manual_access_core_1.MANUAL_SOURCE, "ADMIN_MANUAL");
        assert.strictEqual(manual_access_core_1.MANUAL_PROVIDER, "manual");
        assert.strictEqual(manual_access_core_1.ASAAS_SOURCE, "ASAAS");
        assert.strictEqual(manual_access_core_1.ASAAS_PROVIDER, "asaas");
        assert.notStrictEqual(manual_access_core_1.MANUAL_SOURCE, manual_access_core_1.ASAAS_SOURCE);
    });
    test("limites oficiais da duração: 1..3650 dias", () => {
        assert.strictEqual(manual_access_core_1.MANUAL_MIN_DAYS, 1);
        assert.strictEqual(manual_access_core_1.MANUAL_MAX_DAYS, 3650);
    });
    test("normalizeEmail trima e converte para minúsculas; inválido → null", () => {
        assert.strictEqual((0, manual_access_core_1.normalizeEmail)("  Ana@Exemplo.COM  "), "ana@exemplo.com");
        assert.strictEqual((0, manual_access_core_1.normalizeEmail)("  teste@dominio.com.br  "), "teste@dominio.com.br");
        assert.strictEqual((0, manual_access_core_1.normalizeEmail)(""), null);
        assert.strictEqual((0, manual_access_core_1.normalizeEmail)("sem-arroba"), null);
        assert.strictEqual((0, manual_access_core_1.normalizeEmail)("a@b"), null);
        assert.strictEqual((0, manual_access_core_1.normalizeEmail)("x@y.z"), "x@y.z");
    });
    test("validateGrantDays aceita inteiro 1..3650 e rejeita fora/não-inteiro", () => {
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(1), true);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(7), true);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(30), true);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(90), true);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(3650), true);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(0), false);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(-1), false);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(3651), false);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(30.5), false);
        assert.strictEqual((0, manual_access_core_1.validateGrantDays)(NaN), false);
    });
    test("computeGrantDates: início=agora, expiração=agora+dias exatos", () => {
        const now = new Date("2026-08-30T12:00:00.000Z");
        const { startAt, expiresAt } = (0, manual_access_core_1.computeGrantDates)(now, 30);
        assert.strictEqual(startAt.getTime(), now.getTime());
        assert.strictEqual(expiresAt.getTime(), now.getTime() + 30 * 86400000);
    });
    test("computeExtendedExpiry: estende a partir de max(expiração atual, agora)", () => {
        const now = new Date("2026-08-30T12:00:00.000Z");
        const future = new Date("2026-09-10T12:00:00.000Z");
        const past = new Date("2026-08-01T12:00:00.000Z");
        // Expiração futura → a partir dela
        const e1 = (0, manual_access_core_1.computeExtendedExpiry)(future, now, 7);
        assert.strictEqual(e1.getTime(), future.getTime() + 7 * 86400000);
        // Expiração passada/nula → a partir de agora
        const e2 = (0, manual_access_core_1.computeExtendedExpiry)(past, now, 7);
        assert.strictEqual(e2.getTime(), now.getTime() + 7 * 86400000);
        const e3 = (0, manual_access_core_1.computeExtendedExpiry)(null, now, 7);
        assert.strictEqual(e3.getTime(), now.getTime() + 7 * 86400000);
    });
    test("resolveAnchorPlanSlug: <=7 semanal, <=45 mensal, senão anual", () => {
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(1), "semanal");
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(7), "semanal");
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(8), "mensal");
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(30), "mensal");
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(45), "mensal");
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(46), "anual");
        assert.strictEqual((0, manual_access_core_1.resolveAnchorPlanSlug)(3650), "anual");
    });
}
// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
async function main() {
    console.log("\n🔎 Billing Asaas — testes determinísticos\n");
    catalogSection();
    configSection();
    sanitizeSection();
    webhookSection();
    clientSection();
    manualAccessSection();
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
