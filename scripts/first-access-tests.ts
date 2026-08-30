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

import * as assert from "node:assert";
import {
  normalizeEmail,
  isStrongPassword,
  effectiveGrantStatus,
  isFirstAccessTokenUsable,
  generateRandomToken,
  hashToken,
  isValidOrigin,
  ACCESS_GRANT_STATUSES,
  FIRST_ACCESS_TOKEN_TTL_MINUTES,
  FIRST_ACCESS_TOKEN_BYTES,
  EMAIL_NOT_ELIGIBLE_MESSAGE,
} from "../src/lib/first-access/core";
import {
  sendFirstAccessEmail,
  isEmailProviderConfigured,
} from "../src/lib/email";
import {
  requestFirstAccessSchema,
  verifyFirstAccessTokenSchema,
  createFirstAccessSchema,
} from "../src/lib/validators/first-access";
import {
  getPasskeyStatus,
  startPasskeyRegistration,
  verifyPasskeyAssertion,
} from "../src/lib/webauthn";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ❌ ${name}`);
    console.error(`     ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Roda `fn` com envs temporárias e restaura o ambiente original. */
function withEnv(envs: Record<string, string | undefined>, fn: () => void) {
  const original = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(envs)) {
    original.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of original) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ------------------------------------------------------------
// 1. Núcleo puro — normalizeEmail
// ------------------------------------------------------------

function normalizeEmailSection() {
  test("normalizeEmail trima e converte para minúsculas", () => {
    assert.strictEqual(normalizeEmail("  Ana@Exemplo.COM  "), "ana@exemplo.com");
    assert.strictEqual(normalizeEmail("Cliente@Dominio.com.br"), "cliente@dominio.com.br");
  });

  test("normalizeEmail aceita e-mails válidos simples", () => {
    assert.strictEqual(normalizeEmail("a@b.co"), "a@b.co");
    assert.strictEqual(normalizeEmail("x@y.z"), "x@y.z");
    assert.strictEqual(normalizeEmail("nome.sobrenome@sub.dominio.com"), "nome.sobrenome@sub.dominio.com");
  });

  test("normalizeEmail rejeita vazio/nulo/sem arroba/sem domínio", () => {
    assert.strictEqual(normalizeEmail(""), null);
    assert.strictEqual(normalizeEmail("   "), null);
    assert.strictEqual(normalizeEmail(null), null);
    assert.strictEqual(normalizeEmail(undefined), null);
    assert.strictEqual(normalizeEmail("sem-arroba"), null);
    assert.strictEqual(normalizeEmail("a@b"), null);
    assert.strictEqual(normalizeEmail("a b@c.com"), null);
  });
}

// ------------------------------------------------------------
// 2. Núcleo puro — força de senha
// ------------------------------------------------------------

function passwordSection() {
  test("isStrongPassword aceita 8+ caracteres", () => {
    assert.strictEqual(isStrongPassword("12345678"), true);
    assert.strictEqual(isStrongPassword("senha-forte-123"), true);
  });

  test("isStrongPassword rejeita < 8 caracteres", () => {
    assert.strictEqual(isStrongPassword(""), false);
    assert.strictEqual(isStrongPassword("1234567"), false);
    assert.strictEqual(isStrongPassword("a".repeat(7)), false);
  });

  test("isStrongPassword rejeita não-string", () => {
    assert.strictEqual(isStrongPassword(12345678 as unknown as string), false);
    assert.strictEqual(isStrongPassword(null as unknown as string), false);
    assert.strictEqual(isStrongPassword(undefined as unknown as string), false);
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
    assert.strictEqual(effectiveGrantStatus("CANCELED", null, now), "CANCELED");
    assert.strictEqual(effectiveGrantStatus("CANCELED", future, now), "CANCELED");
  });

  test("expiração no passado → EXPIRED (independente do persistido)", () => {
    assert.strictEqual(effectiveGrantStatus("ACTIVE", past, now), "EXPIRED");
    assert.strictEqual(effectiveGrantStatus("PENDING_FIRST_ACCESS", past, now), "EXPIRED");
  });

  test("dentro do período → status persistido (ACTIVE/PENDING_FIRST_ACCESS)", () => {
    assert.strictEqual(effectiveGrantStatus("ACTIVE", future, now), "ACTIVE");
    assert.strictEqual(effectiveGrantStatus("PENDING_FIRST_ACCESS", future, now), "PENDING_FIRST_ACCESS");
  });

  test("sem expiração → status persistido", () => {
    assert.strictEqual(effectiveGrantStatus("ACTIVE", null, now), "ACTIVE");
    assert.strictEqual(effectiveGrantStatus("PENDING_FIRST_ACCESS", null, now), "PENDING_FIRST_ACCESS");
  });

  test("status ausente/undefined → base PENDING_FIRST_ACCESS", () => {
    assert.strictEqual(effectiveGrantStatus(undefined, null, now), "PENDING_FIRST_ACCESS");
    assert.strictEqual(effectiveGrantStatus(null, null, now), "PENDING_FIRST_ACCESS");
  });

  test("expiração no exato instante now → EXPIRED (<=)", () => {
    const exact = new Date(now.getTime());
    assert.strictEqual(effectiveGrantStatus("ACTIVE", exact, now), "EXPIRED");
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
    assert.strictEqual(
      isFirstAccessTokenUsable({ consumed: false, usedAt: null, expiresAt: future }, now),
      true
    );
  });

  test("token consumido → inválido (replay)", () => {
    assert.strictEqual(
      isFirstAccessTokenUsable({ consumed: true, usedAt: null, expiresAt: future }, now),
      false
    );
    assert.strictEqual(
      isFirstAccessTokenUsable({ consumed: true, usedAt: now, expiresAt: future }, now),
      false
    );
  });

  test("token com usedAt preenchido → inválido", () => {
    assert.strictEqual(
      isFirstAccessTokenUsable({ consumed: false, usedAt: now, expiresAt: future }, now),
      false
    );
  });

  test("token expirado → inválido", () => {
    assert.strictEqual(
      isFirstAccessTokenUsable({ consumed: false, usedAt: null, expiresAt: past }, now),
      false
    );
  });

  test("token expira no exato instante now → inválido (<=)", () => {
    assert.strictEqual(
      isFirstAccessTokenUsable({ consumed: false, usedAt: null, expiresAt: now }, now),
      false
    );
  });
}

// ------------------------------------------------------------
// 5. Núcleo puro — geração e hash de token
// ------------------------------------------------------------

function tokenCryptoSection() {
  test("generateRandomToken devolve base64url opaco (~43 chars)", () => {
    const t = generateRandomToken();
    assert.strictEqual(typeof t, "string");
    assert.ok(t.length >= 40 && t.length <= 48, `tamanho inesperado: ${t.length}`);
    assert.ok(/^[A-Za-z0-9_-]+$/.test(t), "deve ser base64url (sem + / =)");
  });

  test("generateRandomToken gera valores únicos", () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) set.add(generateRandomToken());
    assert.strictEqual(set.size, 500);
  });

  test("hashToken é SHA-256 hex determinístico", () => {
    const h1 = hashToken("meu-token-x");
    const h2 = hashToken("meu-token-x");
    assert.strictEqual(h1, h2);
    assert.strictEqual(h1.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(h1), "hash deve ser hex minúsculo");
  });

  test("hashToken NUNCA contém o token cru (hash unidirecional)", () => {
    const token = "token-ultra-secreto-abc123";
    const hash = hashToken(token);
    assert.ok(!hash.includes("token"), "hash não deve conter o cru");
    assert.ok(!hash.includes("abc123"), "hash não deve conter o cru");
    assert.notStrictEqual(hash, token);
  });

  test("tokens diferentes → hashes diferentes", () => {
    assert.notStrictEqual(hashToken("a"), hashToken("b"));
  });
}

// ------------------------------------------------------------
// 6. Núcleo puro — origens permitidas + constantes
// ------------------------------------------------------------

function constantsSection() {
  test("origens permitidas: ASAAS e ADMIN_MANUAL", () => {
    assert.strictEqual(isValidOrigin("ASAAS"), true);
    assert.strictEqual(isValidOrigin("ADMIN_MANUAL"), true);
  });

  test("origens inválidas são rejeitadas", () => {
    assert.strictEqual(isValidOrigin(""), false);
    assert.strictEqual(isValidOrigin("MANUAL"), false);
    assert.strictEqual(isValidOrigin("asaas"), false);
    assert.strictEqual(isValidOrigin("MAGIC"), false);
  });

  test("constantes oficiais de segurança", () => {
    assert.strictEqual(FIRST_ACCESS_TOKEN_TTL_MINUTES, 60);
    assert.strictEqual(FIRST_ACCESS_TOKEN_BYTES, 32);
    assert.deepStrictEqual(ACCESS_GRANT_STATUSES, [
      "PENDING_FIRST_ACCESS",
      "ACTIVE",
      "EXPIRED",
      "CANCELED",
    ]);
  });

  test("mensagem anti-enumeração é genérica (não confirma existência)", () => {
    assert.strictEqual(
      EMAIL_NOT_ELIGIBLE_MESSAGE,
      "Se houver uma liberação de acesso para este e-mail, enviaremos um link seguro."
    );
    assert.ok(!EMAIL_NOT_ELIGIBLE_MESSAGE.includes("não existe"));
    assert.ok(!EMAIL_NOT_ELIGIBLE_MESSAGE.includes("não encontrado"));
  });
}

// ------------------------------------------------------------
// 7. Provider de e-mail — NUNCA finge envio
// ------------------------------------------------------------

function emailSection() {
  test("sem provider configurado → status NOT_CONFIGURED, ok=false", async () => {
    const res = await sendFirstAccessEmail({
      to: "cliente@exemplo.com",
      activationUrl: "https://app.instacessor.com/primeiro-acesso?token=x",
      expiresInMinutes: 60,
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, "NOT_CONFIGURED");
  });

  test("isEmailProviderConfigured é falso sem EMAIL_PROVIDER", () => {
    withEnv({ EMAIL_PROVIDER: undefined }, () => {
      assert.strictEqual(isEmailProviderConfigured(), false);
    });
  });

  test("isEmailProviderConfigured é falso para 'none'/vazio", () => {
    withEnv({ EMAIL_PROVIDER: "none" }, () => {
      assert.strictEqual(isEmailProviderConfigured(), false);
    });
    withEnv({ EMAIL_PROVIDER: "" }, () => {
      assert.strictEqual(isEmailProviderConfigured(), false);
    });
  });

  test("isEmailProviderConfigured é verdadeiro com provider real", () => {
    withEnv({ EMAIL_PROVIDER: "resend" }, () => {
      assert.strictEqual(isEmailProviderConfigured(), true);
    });
  });
}

// ------------------------------------------------------------
// 8. Validadores Zod
// ------------------------------------------------------------

function validatorsSection() {
  test("requestFirstAccessSchema aceita e-mail e normaliza", () => {
    const r = requestFirstAccessSchema.safeParse({ email: "  Cliente@Exemplo.COM  " });
    assert.strictEqual(r.success, true);
    if (r.success) assert.strictEqual(r.data.email, "cliente@exemplo.com");
  });

  test("requestFirstAccessSchema rejeita e-mail inválido/vazio", () => {
    assert.strictEqual(requestFirstAccessSchema.safeParse({ email: "" }).success, false);
    assert.strictEqual(requestFirstAccessSchema.safeParse({ email: "sem-arroba" }).success, false);
    assert.strictEqual(requestFirstAccessSchema.safeParse({}).success, false);
  });

  test("verifyFirstAccessTokenSchema exige token com 16+ chars", () => {
    assert.strictEqual(verifyFirstAccessTokenSchema.safeParse({ token: "a".repeat(16) }).success, true);
    assert.strictEqual(verifyFirstAccessTokenSchema.safeParse({ token: "short" }).success, false);
    assert.strictEqual(verifyFirstAccessTokenSchema.safeParse({ token: "" }).success, false);
  });

  test("createFirstAccessSchema exige senha forte (8+)", () => {
    assert.strictEqual(
      createFirstAccessSchema.safeParse({ token: "t".repeat(20), password: "12345678", confirmPassword: "12345678" }).success,
      true
    );
    assert.strictEqual(
      createFirstAccessSchema.safeParse({ token: "t".repeat(20), password: "1234567", confirmPassword: "1234567" }).success,
      false
    );
  });

  test("createFirstAccessSchema rejeita senhas que não coincidem", () => {
    assert.strictEqual(
      createFirstAccessSchema.safeParse({ token: "t".repeat(20), password: "12345678", confirmPassword: "87654321" }).success,
      false
    );
  });

  test("createFirstAccessSchema rejeita token curto", () => {
    assert.strictEqual(
      createFirstAccessSchema.safeParse({ token: "short", password: "12345678", confirmPassword: "12345678" }).success,
      false
    );
  });
}

// ------------------------------------------------------------
// 9. WebAuthn — pendência controlada honesta
// ------------------------------------------------------------

function webauthnSection() {
  test("getPasskeyStatus é sempre enabled=false (nunca finge)", () => {
    const st = getPasskeyStatus();
    assert.strictEqual(st.enabled, false);
    assert.ok(st.reason.length > 0);
  });

  test("startPasskeyRegistration retorna erro honesto, ok=false", async () => {
    const res = await startPasskeyRegistration({ userId: "u1" });
    assert.strictEqual(res.ok, false);
    assert.ok(res.error.length > 0);
  });

  test("verifyPasskeyAssertion nunca aceita credencial", async () => {
    const res = await verifyPasskeyAssertion({ id: "fake" });
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
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
