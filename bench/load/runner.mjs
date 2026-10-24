#!/usr/bin/env node
/**
 * LABORATÓRIO DE CARGA DO INST ACESSOR — runner principal
 * =======================================================
 * Mede o NOSSO app (páginas e APIs internas de leitura) sob concorrência
 * crescente: 10, 25, 50, 100, 250 e 500 usuários simultâneos.
 *
 * O que este laboratório NÃO faz, por construção (ver `guard.mjs`):
 *   • não atinge Meta/Instagram, TikTok, OpenAI, Gemini, Asaas, InfinitePay,
 *     Vercel Blob nem webhooks;
 *   • não roda contra produção por padrão;
 *   • não escreve no banco (só requisições GET de leitura).
 *
 * COMO USAR
 *   node bench/load/runner.mjs --base http://localhost:3000 --level 10
 *   node bench/load/runner.mjs --base http://localhost:3000 --level 25 --duration 30
 *   node bench/load/runner.mjs --list            # mostra os alvos permitidos
 *
 * `--level` = número de USUÁRIOS SIMULTÂNEOS (concorrência), que é o que a
 * escala 10→500 significa aqui. Rodam por `--duration` segundos (padrão 20).
 *
 * Sem dependências: usa apenas o `fetch` nativo do Node 18+. Nada foi
 * adicionado ao package.json.
 */

import {
  assertSafeTarget,
  assertInternalEndpoint,
  ALLOWED_PATHS,
  LEVELS,
} from "./guard.mjs";
import { summarize, formatRow, CRITERIA_TEXT } from "./metrics.mjs";
import { authHeaders, describeSession, redact, looksLikeLogin } from "./auth.mjs";

// ------------------------------------------------------------------ args
function parseArgs(argv) {
  const out = {
    base: process.env.BENCH_BASE_URL || "http://localhost:3000",
    level: null,
    duration: 20,
    paths: null,
    allowProduction: false,
    allowPreview: false,
    confirmHeavy: false,
    list: false,
    checkAuth: false,
    allowAnonymous: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") out.base = argv[++i];
    else if (a === "--level") out.level = Number(argv[++i]);
    else if (a === "--duration") out.duration = Number(argv[++i]);
    else if (a === "--paths") out.paths = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--allow-production") out.allowProduction = true;
    else if (a === "--allow-preview") out.allowPreview = true;
    else if (a === "--confirm-heavy") out.confirmHeavy = true;
    else if (a === "--list") out.list = true;
    else if (a === "--check-auth") out.checkAuth = true;
    else if (a === "--allow-anonymous") out.allowAnonymous = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.list) {
  console.log("\nAlvos de LEITURA permitidos (DB-only, sem API externa):");
  for (const p of ALLOWED_PATHS) console.log(`  ${p}`);
  console.log("\nNíveis disponíveis:", LEVELS.join(", "));
  console.log("");
  process.exit(0);
}

// ------------------------------------------------------------- travas
let target;
try {
  target = assertSafeTarget(args.base, {
    allowProduction: args.allowProduction,
    allowPreview: args.allowPreview,
  });
} catch (err) {
  console.error(String(err.message || err));
  process.exit(2);
}

const paths = (args.paths && args.paths.length ? args.paths : ALLOWED_PATHS).map((p) => {
  try {
    return assertInternalEndpoint(p);
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(2);
  }
});

if (args.level === null || !LEVELS.includes(args.level)) {
  console.error(`\n  Informe --level com um destes valores: ${LEVELS.join(", ")}\n`);
  process.exit(2);
}
if (args.level >= 250 && !args.confirmHeavy) {
  console.error(
    [
      "",
      `  ⚠️  Nível ${args.level} é CARGA PESADA.`,
      "     Ele não roda sem confirmação explícita: --confirm-heavy",
      "     Prepare um ambiente descartável antes (banco e processo dedicados).",
      "",
    ].join("\n")
  );
  process.exit(2);
}

const baseUrl = args.base.replace(/\/$/, "");

/** Timeout de cada requisição do laboratório (preflight e carga). */
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------- PREFLIGHT DE SESSÃO
// Uma ÚNICA requisição valida se estamos de fato autenticados. Sem isso, tudo
// que mediríamos é "request → auth → redirect", não o trabalho da aplicação.
const session = describeSession();

async function probeAuth(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(baseUrl + path, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: authHeaders(),
    });
    await res.arrayBuffer().catch(() => {});
    return { status: res.status, loginReason: await looksLikeLogin(res) };
  } catch (err) {
    return { status: 0, error: redact(String(err?.message || err)) };
  } finally {
    clearTimeout(timer);
  }
}

console.log("\n=== LABORATÓRIO DE CARGA — INST ACESSOR ===");
console.log(`Alvo........: ${baseUrl}  (host: ${target.host})`);
console.log(`Proteção....: ${target.isProduction ? "PRODUÇÃO (liberado por flag!)" : "ok — alvo não é produção"}`);
console.log(
  `Sessão......: ${
    session.present ? `presente (${session.bytes} bytes, via ${session.source})` : "AUSENTE"
  }`
);
console.log(`Nível.......: ${args.level} usuários simultâneos`);
console.log(`Duração.....: ${args.duration}s`);
console.log(`Endpoints...: ${paths.join(", ")}`);
console.log("Externos....: NENHUM (allowlist só de leitura interna)");
console.log("");

if (session.present) {
  const probe = await probeAuth(paths[0]);
  console.log(`Validação de sessão em ${paths[0]}: status ${probe.status}`);
  if (probe.loginReason) {
    console.error(
      [
        "",
        `  ⛔ ABORTADO: a sessão NÃO está válida (${probe.loginReason}).`,
        "     A rota redirecionou/negou acesso — medir agora seria medir o login,",
        "     não a aplicação. Renove o cookie de sessão e tente de novo.",
        "",
      ].join("\n")
    );
    process.exit(3);
  }
  if (probe.status >= 500 || probe.status === 0) {
    console.error(
      [
        "",
        `  ⛔ ABORTADO: a validação falhou (status ${probe.status}${probe.error ? ` — ${probe.error}` : ""}).`,
        "     Confirme que o app está no ar no --base informado.",
        "",
      ].join("\n")
    );
    process.exit(3);
  }
  console.log("  → sessão válida: a carga vai medir a aplicação (não o login).\n");
} else if (args.checkAuth) {
  console.log("Nenhuma sessão fornecida. Defina BENCH_SESSION_COOKIE (ou BENCH_SESSION_FILE).\n");
  process.exit(3);
} else if (!args.allowAnonymous) {
  console.error(
    [
      "",
      "  ⛔ ABORTADO: nenhuma sessão fornecida.",
      "",
      "  Sem sessão, o resultado mede só 'request → auth → redirect' — não o",
      "  caminho real (aplicação → Prisma → Neon). Para rodar mesmo assim e medir",
      "  apenas a porta, use --allow-anonymous. Para medir de verdade, forneça a",
      "  sessão em runtime:",
      "",
      "     BENCH_SESSION_COOKIE='<SESSAO_LOCAL>' node bench/load/runner.mjs --base http://localhost:3000 --level 10",
      "",
      "  (o valor NUNCA entra em arquivo nem é impresso)",
      "",
    ].join("\n")
  );
  process.exit(3);
} else {
  console.log("  ⚠️  Rodando ANÔNIMO (--allow-anonymous): mede a porta, não a aplicação.\n");
}

// ------------------------------------------------------------- execução
/**
 * Método permitido na carga. FIXO em GET — trava em profundidade do "somente
 * leitura": não existe caminho no laboratório que emita POST/PUT/PATCH/DELETE.
 * Se algum dia alguém tentar mudar isto, o comentário e o teste abaixo falham.
 */
const ALLOWED_METHOD = "GET";

/** Faz UMA requisição e devolve o resultado classificado. */
async function oneRequest(path) {
  if (ALLOWED_METHOD !== "GET") {
    throw new Error("O laboratório só emite GET (somente leitura).");
  }
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(baseUrl + path, {
      method: ALLOWED_METHOD,
      redirect: "manual", // não segue redirect para /login: mede a resposta real
      signal: controller.signal,
      headers: authHeaders(),
    });
    const elapsed = performance.now() - started;
    // Consome o corpo para a conexão poder ser reaproveitada.
    await res.arrayBuffer().catch(() => {});
    return { status: res.status, ms: elapsed, timedOut: false, path };
  } catch (err) {
    const elapsed = performance.now() - started;
    const timedOut = controller.signal.aborted;
    return { status: 0, ms: elapsed, timedOut, error: String(err?.message || err), path };
  } finally {
    clearTimeout(timer);
  }
}

/** Roda `concurrency` workers em paralelo durante `durationMs`. */
async function runLevel(level, durationMs, pathList) {
  const latencies = [];
  const perPath = new Map(pathList.map((p) => [p, []]));
  let requests = 0;
  let ok = 0;
  let client4xx = 0;
  let server5xx = 0;
  let errors = 0;
  let timeouts = 0;
  let authedLikely = 0;
  let cursor = 0;

  const startedAt = performance.now();
  const deadline = startedAt + durationMs;

  async function worker() {
    while (performance.now() < deadline) {
      const path = pathList[cursor++ % pathList.length];
      const r = await oneRequest(path);
      requests++;
      if (r.timedOut) timeouts++;
      if (r.status === 0) {
        errors++;
      } else if (r.status >= 200 && r.status < 400) {
        ok++;
        authedLikely++;
        latencies.push(r.ms);
        perPath.get(path)?.push(r.ms);
      } else if (r.status >= 400 && r.status < 500) {
        client4xx++;
        latencies.push(r.ms);
        perPath.get(path)?.push(r.ms);
      } else if (r.status >= 500) {
        server5xx++;
        errors++;
        latencies.push(r.ms);
        perPath.get(path)?.push(r.ms);
      }
    }
  }

  await Promise.all(Array.from({ length: level }, () => worker()));
  const elapsedMs = performance.now() - startedAt;

  return {
    overall: summarize({
      latenciesMs: latencies,
      requests,
      ok,
      client4xx,
      server5xx,
      errors,
      timeouts,
      elapsedMs,
    }),
    perPath: Object.fromEntries(
      [...perPath.entries()].map(([p, arr]) => [
        p,
        summarize({
          latenciesMs: arr,
          requests: arr.length,
          ok: arr.length,
          client4xx: 0,
          server5xx: 0,
          errors: 0,
          timeouts: 0,
          elapsedMs,
        }),
      ])
    ),
    authedLikely,
  };
}

function printTable(rows) {
  const cols = Object.keys(rows[0]);
  const width = {};
  for (const c of cols) {
    width[c] = Math.max(c.length, ...rows.map((r) => String(r[c]).length));
  }
  const line = (r) => cols.map((c) => String(r[c]).padEnd(width[c])).join("  ");
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
  for (const r of rows) console.log(line(r));
}

const result = await runLevel(args.level, args.duration * 1000, paths);

console.log("RESULTADO GERAL");
printTable([formatRow(`n=${args.level}`, result.overall)]);

console.log("\nPOR ENDPOINT (p95 / erros)");
const perPathRows = Object.entries(result.perPath).map(([p, s]) => ({
  endpoint: p,
  reqs: String(s.requests),
  p50: s.p50Ms === null ? "n/a" : `${Math.round(s.p50Ms)} ms`,
  p95: s.p95Ms === null ? "n/a" : `${Math.round(s.p95Ms)} ms`,
  p99: s.p99Ms === null ? "n/a" : `${Math.round(s.p99Ms)} ms`,
}));
if (perPathRows.length) printTable(perPathRows);

console.log("\nCRITÉRIOS DE CLASSIFICAÇÃO");
for (const l of CRITERIA_TEXT) console.log("  " + l);

if (result.authedLikely === 0 && result.overall.requests > 0) {
  console.log(
    [
      "",
      "  ⚠️  Nenhuma resposta 2xx/3xx — as rotas provavelmente redirecionaram para /login.",
      "     Sem sessão, o número mede a PORTA (auth + redirect), não o trabalho da página.",
      "     Para medir o caminho real, rode o laboratório no ambiente do dev server",
      "     já autenticado (ver bench/load/README.md).",
      "",
    ].join("\n")
  );
}

console.log("");
