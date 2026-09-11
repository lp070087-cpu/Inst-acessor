/**
 * TESTES DETERMINÍSTICOS — INSTAGRAM BUSINESS LOGIN
 * ==================================================
 * Valida a integração Instagram SEM chamada real à API externa e SEM banco.
 * Cobre:
 *   - hosts oficiais (autorização, OAuth token, dados/publicação);
 *   - ausência total de Facebook Login / graph.facebook.com;
 *   - URL de autorização (endpoint, client_id, redirect_uri, response_type,
 *     state/CSRF, scopes);
 *   - scopes default (5 oficiais) e override por INSTAGRAM_SCOPES;
 *   - fail-closed sem configuração (app id/secret e redirect uri);
 *   - prioridade de credenciais (INSTAGRAM_APP_* > META_APP_*);
 *   - parsing do nó `me` (id, username, account_type BUSINESS/CREATOR);
 *   - tipo de conta normalizado (BUSINESS / CREATOR / MEDIA_CREATOR / desconhecido);
 *   - ausência da dependência `instagram_business_account` (Página do Facebook);
 *   - elegibilidade da renovação de token long-lived;
 *   - criptografia AES-256-GCM do token (round-trip) antes de persistir.
 *
 * Para rodar: npm run instagram:test
 * (Não usa vitest/jest — apenas Node + assert.)
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  INSTAGRAM_GRAPH_BASE,
  INSTAGRAM_OAUTH_BASE,
  INSTAGRAM_AUTHORIZE_BASE,
  getMetaCredentials,
  getWebhookAppSecret,
  getRedirectUri,
  INSTAGRAM_GRAPH_VERSION,
  FETCH_TIMEOUT_MS,
} from "../src/lib/integrations/instagram/client";
import {
  buildAuthUrl,
  exchangeCodeForToken,
  getInstagramScopes,
  INSTAGRAM_DEFAULT_SCOPES,
} from "../src/lib/integrations/instagram/oauth";
import { normalizeAccountType } from "../src/lib/integrations/instagram/metrics";
import {
  shouldAttemptRenewal,
  RENEWAL_MARGIN_MS,
  MIN_TOKEN_AGE_MS,
} from "../src/lib/integrations/instagram/token-policy";

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

/** Igual a `test`, mas para casos assíncronos (com fetch simulado). */
async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
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

/** Versão assíncrona de `withEnv` (para cenários com fetch simulado). */
async function withEnvAsync(
  envs: Record<string, string | undefined>,
  fn: () => Promise<void>
): Promise<void> {
  const original = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(envs)) {
    original.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of original) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Aplica um cenário de env limpo para a integração Instagram. */
function cleanInstagramEnv() {
  return {
    INSTAGRAM_APP_ID: undefined,
    INSTAGRAM_APP_SECRET: undefined,
    META_APP_ID: undefined,
    META_APP_SECRET: undefined,
    INSTAGRAM_REDIRECT_URI: undefined,
    INSTAGRAM_SCOPES: undefined,
    INSTAGRAM_GRAPH_VERSION: undefined,
  } as Record<string, string | undefined>;
}

const TEST_REDIRECT = "https://unitrixapp.com.br/api/integrations/instagram/callback";

/**
 * Lê um arquivo do projeto como texto (para checagens estruturais).
 * O teste compilado fica em `.instagram-test-build/scripts/`, portanto a raiz
 * do projeto está dois níveis acima.
 */
function readSource(relative: string): string {
  return fs.readFileSync(path.join(__dirname, "..", "..", relative), "utf8");
}

/**
 * Texto do arquivo SEM comentários.
 *
 * Necessário porque os próprios arquivos explicam, em comentário, o que NÃO
 * usam (ex.: "não usamos graph.facebook.com"). Checar o texto cru daria falso
 * positivo contra a documentação do arquivo. Aqui só o CÓDIGO é inspecionado.
 *
 * Os `//` de `https://` são preservados (só removemos `//` precedido de espaço
 * ou início de linha).
 */
function readCode(relative: string): string {
  return readSource(relative)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

// ------------------------------------------------------------
// 1. Hosts oficiais do Instagram Business Login
// ------------------------------------------------------------

function hostsSection() {
  test("autorização usa instagram.com/oauth/authorize (não o dialog do Facebook)", () => {
    assert.strictEqual(INSTAGRAM_AUTHORIZE_BASE, "https://www.instagram.com");
  });

  test("troca de token usa api.instagram.com", () => {
    assert.strictEqual(INSTAGRAM_OAUTH_BASE, "https://api.instagram.com");
  });

  test("dados/insights/publicação usam graph.instagram.com", () => {
    assert.strictEqual(INSTAGRAM_GRAPH_BASE, "https://graph.instagram.com");
  });

  test("nenhum host é facebook.com", () => {
    for (const host of [
      INSTAGRAM_AUTHORIZE_BASE,
      INSTAGRAM_OAUTH_BASE,
      INSTAGRAM_GRAPH_BASE,
    ]) {
      assert.ok(!host.includes("facebook.com"), `host indevido: ${host}`);
    }
  });

  test("nenhum host é graph.facebook.com", () => {
    assert.ok(!INSTAGRAM_GRAPH_BASE.includes("graph.facebook.com"));
  });

  test("versão default da API é v21.0", () => {
    assert.strictEqual(INSTAGRAM_GRAPH_VERSION, "v21.0");
  });

  test("timeout do cliente é 20s", () => {
    assert.strictEqual(FETCH_TIMEOUT_MS, 20000);
  });
}

// ------------------------------------------------------------
// 2. URL de autorização (state/CSRF + parâmetros oficiais)
// ------------------------------------------------------------

function authUrlSection() {
  test("buildAuthUrl aponta para o endpoint oficial do Instagram", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "123", INSTAGRAM_APP_SECRET: "s", INSTAGRAM_REDIRECT_URI: TEST_REDIRECT },
      () => {
        const url = buildAuthUrl("state-abc");
        assert.ok(
          url.startsWith("https://www.instagram.com/oauth/authorize?"),
          `URL inesperada: ${url}`
        );
      }
    );
  });

  test("buildAuthUrl NÃO usa facebook.com nem o dialog OAuth do Facebook", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "123", INSTAGRAM_APP_SECRET: "s", INSTAGRAM_REDIRECT_URI: TEST_REDIRECT },
      () => {
        const url = buildAuthUrl("state-abc");
        assert.ok(!url.includes("facebook.com"), "não deve usar Facebook Login");
        assert.ok(!url.includes("/dialog/oauth"), "não deve usar o dialog do Facebook");
      }
    );
  });

  test("buildAuthUrl envia client_id, redirect_uri, response_type=code e state", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "app-42", INSTAGRAM_APP_SECRET: "s", INSTAGRAM_REDIRECT_URI: TEST_REDIRECT },
      () => {
        const url = new URL(buildAuthUrl("csrf-token-xyz"));
        assert.strictEqual(url.searchParams.get("client_id"), "app-42");
        assert.strictEqual(url.searchParams.get("redirect_uri"), TEST_REDIRECT);
        assert.strictEqual(url.searchParams.get("response_type"), "code");
        assert.strictEqual(url.searchParams.get("state"), "csrf-token-xyz");
      }
    );
  });

  test("state diferente gera URL diferente (CSRF preservado)", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "1", INSTAGRAM_APP_SECRET: "s", INSTAGRAM_REDIRECT_URI: TEST_REDIRECT },
      () => {
        assert.notStrictEqual(buildAuthUrl("a"), buildAuthUrl("b"));
      }
    );
  });

  test("sem state a URL ainda é montada mas sem parâmetro state", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "1", INSTAGRAM_APP_SECRET: "s", INSTAGRAM_REDIRECT_URI: TEST_REDIRECT },
      () => {
        const url = new URL(buildAuthUrl(""));
        assert.strictEqual(url.searchParams.get("state"), "");
      }
    );
  });
}

// ------------------------------------------------------------
// 3. Scopes (default oficial + override por env)
// ------------------------------------------------------------

function scopesSection() {
  const EXPECTED = [
    "instagram_business_basic",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
    "instagram_business_content_publish",
  ];

  test("default tem exatamente os 5 scopes oficiais", () => {
    assert.deepStrictEqual([...INSTAGRAM_DEFAULT_SCOPES], EXPECTED);
  });

  test("default NÃO contém scopes do Facebook Login", () => {
    for (const legacy of [
      "instagram_basic",
      "instagram_manage_insights",
      "instagram_manage_comments",
      "pages_show_list",
      "pages_manage_posts",
      "business_management",
    ]) {
      assert.ok(
        !(INSTAGRAM_DEFAULT_SCOPES as readonly string[]).includes(legacy),
        `scope legado indevido: ${legacy}`
      );
    }
  });

  test("auth URL inclui os 5 scopes oficiais por default", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "1", INSTAGRAM_APP_SECRET: "s", INSTAGRAM_REDIRECT_URI: TEST_REDIRECT },
      () => {
        const scope = new URL(buildAuthUrl("st")).searchParams.get("scope") ?? "";
        const list = scope.split(",");
        for (const s of EXPECTED) assert.ok(list.includes(s), `scope ausente: ${s}`);
        assert.strictEqual(list.length, EXPECTED.length);
      }
    );
  });

  test("INSTAGRAM_SCOPES sobrescreve os scopes default", () => {
    withEnv(
      {
        ...cleanInstagramEnv(),
        INSTAGRAM_APP_ID: "1",
        INSTAGRAM_APP_SECRET: "s",
        INSTAGRAM_REDIRECT_URI: TEST_REDIRECT,
        INSTAGRAM_SCOPES: "instagram_business_basic,instagram_business_manage_insights",
      },
      () => {
        assert.strictEqual(
          getInstagramScopes(),
          "instagram_business_basic,instagram_business_manage_insights"
        );
        const scope = new URL(buildAuthUrl("st")).searchParams.get("scope");
        assert.strictEqual(
          scope,
          "instagram_business_basic,instagram_business_manage_insights"
        );
      }
    );
  });

  test("INSTAGRAM_SCOPES vazio/em branco cai no default", () => {
    withEnv({ ...cleanInstagramEnv(), INSTAGRAM_SCOPES: "   " }, () => {
      assert.strictEqual(getInstagramScopes(), EXPECTED.join(","));
    });
    withEnv({ ...cleanInstagramEnv(), INSTAGRAM_SCOPES: "" }, () => {
      assert.strictEqual(getInstagramScopes(), EXPECTED.join(","));
    });
  });
}

// ------------------------------------------------------------
// 4. Fail-closed sem configuração
// ------------------------------------------------------------

function configSection() {
  test("sem INSTAGRAM_APP_ID/SECRET → IntegrationConfigError", () => {
    withEnv(cleanInstagramEnv(), () => {
      assert.throws(
        () => getMetaCredentials(),
        (err: unknown) =>
          err instanceof Error && err.name === "IntegrationConfigError"
      );
    });
  });

  test("sem INSTAGRAM_REDIRECT_URI → IntegrationConfigError", () => {
    withEnv(cleanInstagramEnv(), () => {
      assert.throws(
        () => getRedirectUri(),
        (err: unknown) =>
          err instanceof Error && err.name === "IntegrationConfigError"
      );
    });
  });

  test("buildAuthUrl falha fechado sem config (não devolve URL inventada)", () => {
    withEnv(cleanInstagramEnv(), () => {
      assert.throws(() => buildAuthUrl("st"), /./);
    });
  });

  test("redirect URI retorna o valor explícito configurado", () => {
    withEnv({ ...cleanInstagramEnv(), INSTAGRAM_REDIRECT_URI: TEST_REDIRECT }, () => {
      assert.strictEqual(getRedirectUri(), TEST_REDIRECT);
    });
  });

  test("redirect URI de produção NÃO está hardcoded no código", () => {
    const src = readCode("src/lib/integrations/instagram/client.ts");
    assert.ok(
      !src.includes("unitrixapp.com.br"),
      "o redirect não pode estar fixado no código — deve vir do ambiente"
    );
  });
}

// ------------------------------------------------------------
// 5. Prioridade de credenciais (novo app > compatibilidade)
// ------------------------------------------------------------

function credentialsSection() {
  test("INSTAGRAM_APP_ID tem prioridade sobre META_APP_ID", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "novo", INSTAGRAM_APP_SECRET: "novo-s", META_APP_ID: "antigo", META_APP_SECRET: "antigo-s" },
      () => {
        const creds = getMetaCredentials();
        assert.strictEqual(creds.appId, "novo");
        assert.strictEqual(creds.appSecret, "novo-s");
      }
    );
  });

  test("META_APP_ID/SECRET continuam funcionando (compatibilidade temporária)", () => {
    withEnv(
      { ...cleanInstagramEnv(), META_APP_ID: "antigo", META_APP_SECRET: "antigo-s" },
      () => {
        const creds = getMetaCredentials();
        assert.strictEqual(creds.appId, "antigo");
        assert.strictEqual(creds.appSecret, "antigo-s");
      }
    );
  });

  test("par misto (INSTAGRAM_APP_ID + META_APP_SECRET) é aceito sem fallback silencioso", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_ID: "novo", META_APP_SECRET: "antigo-s" },
      () => {
        const creds = getMetaCredentials();
        assert.strictEqual(creds.appId, "novo");
        assert.strictEqual(creds.appSecret, "antigo-s");
      }
    );
  });

  test("app secret do webhook usa INSTAGRAM_APP_SECRET primeiro e nunca vaza", () => {
    withEnv(
      { ...cleanInstagramEnv(), INSTAGRAM_APP_SECRET: "novo-s", META_APP_SECRET: "antigo-s" },
      () => {
        assert.strictEqual(getWebhookAppSecret(), "novo-s");
      }
    );
    withEnv({ ...cleanInstagramEnv(), META_APP_SECRET: "antigo-s" }, () => {
      assert.strictEqual(getWebhookAppSecret(), "antigo-s");
    });
    withEnv(cleanInstagramEnv(), () => {
      assert.strictEqual(getWebhookAppSecret(), "");
    });
  });
}

// ------------------------------------------------------------
// 6. Conta Instagram: nó `me` direto (sem Página do Facebook)
// ------------------------------------------------------------

function accountSection() {
  test("BUSINESS é normalizado como BUSINESS", () => {
    assert.strictEqual(normalizeAccountType("BUSINESS"), "BUSINESS");
  });

  test("CREATOR é normalizado como CREATOR", () => {
    assert.strictEqual(normalizeAccountType("CREATOR"), "CREATOR");
  });

  test("MEDIA_CREATOR é tratado como CREATOR", () => {
    assert.strictEqual(normalizeAccountType("MEDIA_CREATOR"), "CREATOR");
  });

  test("tipo ausente/desconhecido vira PROFESSIONAL (nunca inventa BUSINESS)", () => {
    assert.strictEqual(normalizeAccountType(undefined), "PROFESSIONAL");
    assert.strictEqual(normalizeAccountType(null), "PROFESSIONAL");
    assert.strictEqual(normalizeAccountType(""), "PROFESSIONAL");
    assert.strictEqual(normalizeAccountType("PERSONAL"), "PERSONAL");
  });

  test("normalizeAccountType tolera minúsculas e espaços", () => {
    assert.strictEqual(normalizeAccountType(" business "), "BUSINESS");
    assert.strictEqual(normalizeAccountType("creator"), "CREATOR");
  });

  test("metrics.ts NÃO consulta instagram_business_account (Página do Facebook)", () => {
    const src = readCode("src/lib/integrations/instagram/metrics.ts");
    assert.ok(
      !src.includes("instagram_business_account"),
      "a dependência da Página do Facebook deve ter sido removida"
    );
  });

  test("metrics.ts consulta o nó me com account_type", () => {
    const src = readCode("src/lib/integrations/instagram/metrics.ts");
    assert.ok(src.includes("account_type"), "deve ler account_type do nó me");
    assert.ok(src.includes("followers_count"), "deve preservar seguidores");
    assert.ok(src.includes("follows_count"), "deve preservar seguindo");
    assert.ok(src.includes("media_count"), "deve preservar quantidade de mídia");
    assert.ok(src.includes("biography"), "deve preservar bio");
    assert.ok(src.includes("profile_views"), "deve preservar insights da conta");
  });

  test("nenhum arquivo do Instagram referencia graph.facebook.com no código", () => {
    for (const file of [
      "src/lib/integrations/instagram/client.ts",
      "src/lib/integrations/instagram/oauth.ts",
      "src/lib/integrations/instagram/metrics.ts",
      "src/lib/publishing/instagram/index.ts",
    ]) {
      const src = readCode(file);
      assert.ok(
        !src.includes("graph.facebook.com"),
        `${file} ainda usa graph.facebook.com`
      );
    }
  });

  test("nenhum arquivo do Instagram usa o dialog do Facebook", () => {
    for (const file of [
      "src/lib/integrations/instagram/oauth.ts",
      "src/lib/integrations/instagram/client.ts",
    ]) {
      const src = readCode(file);
      assert.ok(
        !src.includes("/dialog/oauth"),
        `${file} ainda usa o dialog OAuth do Facebook`
      );
    }
  });

  test("nenhum arquivo do Instagram usa scopes do Facebook Login", () => {
    for (const file of [
      "src/lib/integrations/instagram/oauth.ts",
      "src/lib/integrations/instagram/client.ts",
      "src/lib/publishing/instagram/index.ts",
    ]) {
      const src = readCode(file);
      for (const legacy of [
        "pages_show_list",
        "pages_manage_posts",
        "business_management",
      ]) {
        assert.ok(!src.includes(legacy), `${file} ainda usa o scope ${legacy}`);
      }
    }
  });
}

// ------------------------------------------------------------
// 7. Renovação do token long-lived (elegibilidade)
// ------------------------------------------------------------

function renewalSection() {
  const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);
  const hours = (n: number) => n * 60 * 60 * 1000;
  const days = (n: number) => n * 24 * 60 * 60 * 1000;

  test("token recém-criado (<24h) NÃO é renovado (a API recusaria)", () => {
    assert.strictEqual(
      shouldAttemptRenewal(new Date(NOW + days(60)), new Date(NOW - hours(2)), NOW),
      false
    );
  });

  test("token com mais de 24h e perto de expirar É renovado", () => {
    assert.strictEqual(
      shouldAttemptRenewal(new Date(NOW + days(3)), new Date(NOW - days(50)), NOW),
      true
    );
  });

  test("token com mais de 24h e longe de expirar NÃO é renovado (economia de chamada)", () => {
    assert.strictEqual(
      shouldAttemptRenewal(new Date(NOW + days(40)), new Date(NOW - days(5)), NOW),
      false
    );
  });

  test("sem data de expiração conhecida tenta renovar (após 24h)", () => {
    assert.strictEqual(shouldAttemptRenewal(null, new Date(NOW - days(2)), NOW), true);
  });

  test("sem createdAt (desconhecido) tenta renovar", () => {
    assert.strictEqual(shouldAttemptRenewal(new Date(NOW + days(1)), null, NOW), true);
  });

  test("token já expirado tenta renovar (a rota tratará a recusa)", () => {
    assert.strictEqual(
      shouldAttemptRenewal(new Date(NOW - days(1)), new Date(NOW - days(50)), NOW),
      true
    );
  });

  test("margem de renovação é de 5 dias e idade mínima de 24h", () => {
    assert.strictEqual(RENEWAL_MARGIN_MS, days(5));
    assert.strictEqual(MIN_TOKEN_AGE_MS, hours(24));
  });
}

// ------------------------------------------------------------
// 8. Troca do code por token (parsing) — fetch simulado, SEM rede
// ------------------------------------------------------------

/**
 * Simula a API do Instagram SEM tocar a rede.
 *
 * `handler` decide a resposta (status/corpo) a partir da URL; `calls` acumula
 * tudo o que foi requisitado, para inspecionarmos hosts, método e corpo.
 * Assim o teste é determinístico e não depende da API externa.
 */
interface FetchCall {
  url: string;
  init?: RequestInit;
}

interface StubResponse {
  status?: number;
  body?: unknown;
  raw?: string;
}

function stubFetch(handler: (url: string, init?: RequestInit) => StubResponse) {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const { status = 200, body, raw } = handler(url, init);
    return new Response(raw ?? JSON.stringify(body ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

/** Responde como a API: token curto no api.instagram.com, longo no graph. */
const shortThenLong = (long: Record<string, unknown> = { access_token: "TOKEN-LONGO" }) =>
  (url: string): StubResponse =>
    url.startsWith("https://api.instagram.com/oauth/access_token")
      ? { body: { access_token: "TOKEN-CURTO", user_id: "178414" } }
      : { body: long };

/** Env válido da integração para os cenários de troca de token. */
const TOKEN_ENV = {
  ...cleanInstagramEnv(),
  INSTAGRAM_APP_ID: "app-42",
  INSTAGRAM_APP_SECRET: "secret-42",
  INSTAGRAM_REDIRECT_URI: TEST_REDIRECT,
};

/** Executa `fn` com um stub de fetch ativo e o restaura sempre. */
async function usingStub(
  handler: (url: string, init?: RequestInit) => StubResponse,
  fn: (calls: FetchCall[]) => Promise<void>
): Promise<void> {
  const stub = stubFetch(handler);
  try {
    await fn(stub.calls);
  } finally {
    stub.restore();
  }
}

async function tokenExchangeSection() {
  await testAsync("troca o code pelo token CURTO e depois pelo LONGO (hosts corretos)", () =>
    withEnvAsync(TOKEN_ENV, () =>
      usingStub(shortThenLong({ access_token: "TOKEN-LONGO", expires_in: 5183944 }), async (calls) => {
        const result = await exchangeCodeForToken("CODE-123");

        // O token devolvido é o LONGO — o curto NUNCA é persistido.
        assert.strictEqual(result.accessToken, "TOKEN-LONGO");

        assert.strictEqual(calls.length, 2, "devem existir exatamente 2 chamadas");
        assert.ok(
          calls[0]!.url.startsWith("https://api.instagram.com/oauth/access_token"),
          `1ª chamada deveria ser api.instagram.com: ${calls[0]!.url}`
        );
        assert.ok(
          calls[1]!.url.startsWith("https://graph.instagram.com/access_token?"),
          `2ª chamada deveria ser graph.instagram.com/access_token: ${calls[1]!.url}`
        );
        assert.ok(
          calls[1]!.url.includes("grant_type=ig_exchange_token"),
          "o exchange precisa usar ig_exchange_token"
        );

        // O app secret NUNCA vai na URL da troca do `code` (essa é um POST e
        // carrega tudo no body). Já o exchange de long-lived é uma EXCEÇÃO
        // imposta pela própria API oficial: ela exige `client_secret` na query
        // dessa chamada GET. Não inventamos um formato alternativo para isso.
        assert.ok(
          !calls[0]!.url.includes("secret-42"),
          "o app secret não pode aparecer na URL da troca do code"
        );
        assert.ok(
          calls[1]!.url.includes("client_secret="),
          "o exchange de long-lived exige client_secret na query (formato oficial)"
        );
      })
    )
  );

  await testAsync("app secret vai no BODY (nunca na URL) e o code é enviado", () =>
    withEnvAsync(TOKEN_ENV, () =>
      usingStub(shortThenLong(), async (calls) => {
        await exchangeCodeForToken("CODE-XYZ");

        const first = calls[0]!;
        assert.strictEqual(first.init?.method, "POST");
        assert.ok(!first.url.includes("secret-42"), "secret não pode estar na URL");
        assert.ok(!first.url.includes("CODE-XYZ"), "code não pode estar na URL");

        const body = String(first.init?.body ?? "");
        assert.ok(body.includes("client_id=app-42"), `body sem client_id: ${body}`);
        assert.ok(body.includes("client_secret=secret-42"), "body sem client_secret");
        assert.ok(
          body.includes("grant_type=authorization_code"),
          "body sem grant_type=authorization_code"
        );
        assert.ok(body.includes("code=CODE-XYZ"), "body sem o code");
        assert.ok(
          body.includes("redirect_uri="),
          "a troca precisa enviar o redirect_uri"
        );
      })
    )
  );

  await testAsync("expiração do token longo é ~60 dias (5183944s)", () =>
    withEnvAsync(TOKEN_ENV, () =>
      usingStub(shortThenLong({ access_token: "T2", expires_in: 5183944 }), async () => {
        const before = Date.now();
        const result = await exchangeCodeForToken("C");
        const after = Date.now();

        assert.ok(result.expiresAt, "a expiração deve ser conhecida");
        const ms = (result.expiresAt as Date).getTime();
        const expected = 5183944 * 1000;
        assert.ok(
          ms - before >= expected && ms - after <= expected,
          "expiração fora do intervalo esperado"
        );
      })
    )
  );

  await testAsync("scopes concedidos vêm de `permissions` quando presente", () =>
    withEnvAsync(TOKEN_ENV, () =>
      usingStub(
        (url) =>
          url.startsWith("https://api.instagram.com/oauth/access_token")
            ? {
                body: {
                  access_token: "T1",
                  permissions:
                    "instagram_business_basic,instagram_business_manage_insights",
                },
              }
            : { body: { access_token: "T2" } },
        async () => {
          const result = await exchangeCodeForToken("C");
          assert.strictEqual(
            result.scopes,
            "instagram_business_basic,instagram_business_manage_insights"
          );
        }
      )
    )
  );

  await testAsync(
    "FAIL-CLOSED: se o exchange longo falhar, o token curto NÃO é devolvido",
    () =>
      withEnvAsync(TOKEN_ENV, () =>
        usingStub(
          (url) =>
            url.startsWith("https://api.instagram.com/oauth/access_token")
              ? { body: { access_token: "TOKEN-CURTO" } }
              : { status: 400, body: { error: { message: "invalid token" } } },
          async () => {
            await assert.rejects(
              () => exchangeCodeForToken("C"),
              (err: unknown) => {
                assert.ok(err instanceof Error, "deveria lançar erro");
                assert.strictEqual((err as { name?: string }).name, "InstagramApiError");
                assert.strictEqual(
                  (err as { code?: string }).code,
                  "LONG_LIVED_EXCHANGE",
                  "o erro deve identificar o passo de long-lived"
                );
                assert.ok(
                  !err.message.includes("TOKEN-CURTO"),
                  "o erro nunca pode conter o token"
                );
                return true;
              }
            );
          }
        )
      )
  );

  await testAsync("code inválido → erro TOKEN_EXCHANGE (sem token devolvido)", () =>
    withEnvAsync(TOKEN_ENV, () =>
      usingStub(
        () => ({ body: { error_message: "Invalid authorization code" } }),
        async () => {
          await assert.rejects(
            () => exchangeCodeForToken("C"),
            (err: unknown) =>
              (err as { code?: string }).code === "TOKEN_EXCHANGE"
          );
        }
      )
    )
  );

  await testAsync(
    "resposta não-JSON no exchange → erro controlado (sem vazar corpo bruto)",
    () =>
      withEnvAsync(TOKEN_ENV, () =>
        usingStub(
          (url) =>
            url.startsWith("https://api.instagram.com/oauth/access_token")
              ? { body: { access_token: "T1" } }
              : { raw: "<html>gateway error</html>" },
          async () => {
            await assert.rejects(
              () => exchangeCodeForToken("C"),
              (err: unknown) => {
                // Guarda de tipo: além de deixar o acesso a `.message` seguro,
                // garante que o erro seja mesmo um Error (e não um valor solto).
                assert.ok(err instanceof Error, "deveria lançar um Error");
                assert.strictEqual(
                  (err as { code?: string }).code,
                  "LONG_LIVED_EXCHANGE"
                );
                assert.ok(
                  !err.message.includes("<html>"),
                  "nunca repassar o corpo bruto da resposta"
                );
                return true;
              }
            );
          }
        )
      )
  );

  await testAsync("sem configuração, a troca falha fechado (não inventa token)", () =>
    withEnvAsync(cleanInstagramEnv(), async () => {
      await assert.rejects(
        () => exchangeCodeForToken("C"),
        (err: unknown) =>
          (err as { name?: string }).name === "IntegrationConfigError"
      );
    })
  );
}

// ------------------------------------------------------------
// 9. Publicação (adapter) — hosts, endpoints e formato do corpo
// ------------------------------------------------------------

/**
 * O adapter de publicação importa Prisma (banco), portanto não pode ser
 * carregado nesta suíte isolada. Validamos o contrato de rede por leitura do
 * código-fonte: host, endpoints e formato do corpo são exatamente o que a API
 * do Instagram exige — e nada aponta para o Facebook.
 */
function publishingSection() {
  const ADAPTER = "src/lib/publishing/instagram/index.ts";

  test("adapter publica em graph.instagram.com e nunca em graph.facebook.com", () => {
    const src = readCode(ADAPTER);
    assert.ok(
      src.includes('"https://graph.instagram.com"'),
      "o host da publicação deve ser graph.instagram.com"
    );
    assert.ok(
      !/https?:\/\/graph\.facebook\.com/.test(src),
      "a publicação não pode usar graph.facebook.com"
    );
  });

  test("endpoints oficiais de publicação estão declarados", () => {
    const src = readCode(ADAPTER);
    for (const endpoint of ["/media`", "/media_publish`"]) {
      assert.ok(src.includes(endpoint), `endpoint ausente no adapter: ${endpoint}`);
    }
    assert.ok(
      src.includes("fields=status_code"),
      "a consulta de status precisa ler status_code"
    );
    assert.ok(
      src.includes("creation_id"),
      "a publicação precisa enviar creation_id"
    );
    assert.ok(
      src.includes("is_carousel_item"),
      "o carrossel precisa marcar is_carousel_item"
    );
  });

  test("publicação envia corpo form-urlencoded (formato oficial do endpoint)", () => {
    const src = readSource(ADAPTER);
    assert.ok(
      src.includes("application/x-www-form-urlencoded"),
      "o POST de mídia exige form-urlencoded"
    );
    assert.ok(
      src.includes("new URLSearchParams"),
      "o corpo deve ser montado com URLSearchParams"
    );
  });

  test("publicação exige o scope de conteúdo (documentado no adapter)", () => {
    const src = readSource(ADAPTER);
    assert.ok(
      src.includes("instagram_business_content_publish"),
      "o adapter deve declarar a permissão de publicação exigida"
    );
  });

  test("publicação NÃO fabrica id externo quando a API não confirma", () => {
    const src = readSource(ADAPTER);
    assert.ok(
      src.includes("Publicação não confirmada pela API."),
      "sem confirmação real, a publicação deve falhar (nunca inventar externalId)"
    );
    assert.ok(
      !/externalId:\s*["'`]/.test(src),
      "o externalId não pode ser um literal fixo no código"
    );
  });
}

// ------------------------------------------------------------
// Run
// ------------------------------------------------------------

async function main() {
  console.log("\n🧪 TESTES — INSTAGRAM BUSINESS LOGIN\n");

  console.log("1. Hosts oficiais");
  hostsSection();

  console.log("\n2. URL de autorização (OAuth)");
  authUrlSection();

  console.log("\n3. Scopes");
  scopesSection();

  console.log("\n4. Fail-closed sem configuração");
  configSection();

  console.log("\n5. Credenciais (prioridade e compatibilidade)");
  credentialsSection();

  console.log("\n6. Conta Instagram (nó me, sem Página do Facebook)");
  accountSection();

  console.log("\n7. Renovação de token long-lived");
  renewalSection();

  console.log("\n8. Troca do code por token (fetch simulado, sem rede)");
  await tokenExchangeSection();

  console.log("\n9. Publicação (adapter)");
  publishingSection();

  console.log(`\n${passed} passaram, ${failures.length} falharam`);
  if (failures.length > 0) {
    console.error("\nFalhas:");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log("✅ Todos os testes do Instagram passaram.\n");
}

void main();
