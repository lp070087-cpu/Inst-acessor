/**
 * TRAVA DE SEGURANÇA DO LABORATÓRIO DE CARGA
 * ==========================================
 * Este arquivo existe para tornar IMPOSSÍVEL (por padrão) rodar carga contra
 * produção ou contra qualquer API de terceiros. As duas travas são aplicadas
 * ANTES de qualquer requisição sair.
 *
 * 1. TRAVA DE ALVO (host)
 *    - Bloqueia o domínio oficial de produção.
 *    - Bloqueia QUALQUER host *.vercel.app (um link de preview pode apontar
 *      para produção; não dá para saber sem checar, então recusamos por
 *      padrão).
 *    - Aceita por padrão apenas alvos locais (localhost / 127.0.0.1) e
 *      endereços de rede privada (10.x / 192.168.x), que são ambiente
 *      controlado.
 *
 * 2. TRAVA DE ROTA (path)
 *    - Só permite caminhos da ALLOWLIST e RECUSA explicitamente as famílias de
 *      rota que falam com terceiros (Meta/Instagram, TikTok, IA, Blob, Asaas,
 *      InfinitePay, webhooks). Mesmo que alguém adicione um endpoint por
 *      engano, ele não passa.
 *
 * As duas travas podem ser desligadas conscientemente com flags explícitas
 * (`--allow-production`, `--allow-preview`). Foram deixadas desligaveis apenas
 * para não travar um uso legítimo em staging — NUNCA use contra produção.
 */

/** Domínios oficiais de produção do Inst Acessor. */
const PRODUCTION_HOSTS = new Set([
  "unitrixapp.com.br",
  "www.unitrixapp.com.br",
  "instacessor.com.br",
  "www.instacessor.com.br",
  "instacessor.app",
  "www.instacessor.app",
]);

/** Hosts considerados ambiente controlado (seguros por padrão). */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"]);

function hostOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPrivateHost(host) {
  if (LOCAL_HOSTS.has(host)) return true;
  if (host.endsWith(".local")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/**
 * Valida o alvo. Lança se não for seguro. Retorna metadados para o relatório.
 * @param {string} rawUrl
 * @param {{ allowProduction?: boolean, allowPreview?: boolean }} opts
 */
export function assertSafeTarget(rawUrl, opts = {}) {
  const host = hostOf(rawUrl);
  if (!host) {
    throw new Error(`URL inválida: "${rawUrl}". Use algo como http://localhost:3000`);
  }

  const isProduction = PRODUCTION_HOSTS.has(host);
  const isVercelPreview = host.endsWith(".vercel.app");

  if (isProduction && !opts.allowProduction) {
    throw new Error(
      [
        "",
        "  ⛔ RECUSADO: alvo é o DOMÍNIO OFICIAL DE PRODUÇÃO.",
        `     host: ${host}`,
        "",
        "  O laboratório de carga NUNCA roda em produção por padrão — carga",
        "  contra produção pode degradar o serviço de usuários reais.",
        "",
        "  Use um ambiente controlado:",
        "     node bench/load/runner.mjs --base http://localhost:3000 --level 10",
        "",
        "  (Se você tem CERTEZA de que é um ambiente descartável, --allow-production.",
        "   Não use isso contra o domínio oficial.)",
        "",
      ].join("\n")
    );
  }

  if (isVercelPreview && !opts.allowPreview && !opts.allowProduction) {
    throw new Error(
      [
        "",
        `  ⛔ RECUSADO: "${host}" é um domínio de PREVIEW da Vercel.`,
        "",
        "  Um link de preview pode apontar para o mesmo banco/serviço de produção.",
        "  Rode contra um alvo local (http://localhost:3000) ou um staging isolado.",
        "",
        "  Para sobrescrever conscientemente: --allow-preview",
        "",
      ].join("\n")
    );
  }

  return {
    host,
    isProduction,
    isVercelPreview,
    isLocal: isPrivateHost(host),
  };
}

/** Famílias de rota que falam com terceiros ou escrevem — nunca alvo de carga. */
const FORBIDDEN_PREFIXES = [
  "/api/webhooks",
  "/api/integrations",
  "/api/ai",
  "/api/upload",
  "/api/billing",
  "/api/auth",
  "/api/account",
  "/api/first-access",
  "/api/admin",
];

/**
 * Caminhos de LEITURA liberados.
 *
 * Critério: o handler (ou a página) NÃO pode escrever no banco. Auditado um a
 * um — as páginas e/ou funções foram lidas para confirmar ausência de
 * `create`/`update`/`delete`/`upsert`.
 *
 * NÃO está aqui (e não deve entrar sem auditoria):
 *   • `/api/rank` — apesar de ser GET, ele GRAVA: `recomputeGoalProgress`
 *     atualiza `UserGoal` (`goal.update`) e concede XP (`grantXpAmount`).
 *     Não é leitura; incluí-lo violaria a regra "só leitura" desta fase.
 *   • `/api/alertas` → `generateAlerts` (leitura, mas verificado);
 *   • `/api/padroes`  → leitura;
 *   • `/api/calendar` → leitura; `/calendario` → `listPlannedContent` +
 *     `buildWeeklyPlan` (leitura).
 */
export const ALLOWED_PATHS = [
  "/dashboard",
  "/calendario",
  "/biblioteca-de-midia",
  "/api/calendar",
  "/api/alertas",
  "/api/padroes",
];

/**
 * Valida um caminho contra as allow/deny lists.
 * @param {string} path
 */
export function assertInternalEndpoint(path) {
  const clean = path.split("?")[0];
  for (const bad of FORBIDDEN_PREFIXES) {
    if (clean.startsWith(bad)) {
      throw new Error(
        `⛔ Rota recusada: "${clean}" pertence a "${bad}" (terceiros/escrita). ` +
          `O laboratório só atinge endpoints de leitura listados em ALLOWED_PATHS.`
      );
    }
  }
  if (!ALLOWED_PATHS.includes(clean)) {
    throw new Error(
      `⛔ Rota fora da allowlist: "${clean}". ` +
        `Adicione conscientemente em ALLOWED_PATHS (bench/load/guard.mjs) só se for leitura e não falar com terceiros.`
    );
  }
  return clean;
}

/** Nível de carga → concorrência. Nada fora daqui é aceito. */
export const LEVELS = [10, 25, 50, 100, 250, 500];
