/**
 * SESSÃO DO LABORATÓRIO — RUNTIME APENAS, NUNCA EM ARQUIVO
 * =======================================================
 * As rotas internas exigem sessão. Para medir o caminho real (aplicação →
 * Prisma → Neon) em vez do redirect para /login, o laboratório precisa do
 * cookie de sessão — mas esse cookie é um SEGREDO e JAMAIS pode ficar no
 * código, num arquivo versionado, ou impresso no terminal.
 *
 * REGRAS DESTE MÓDULO
 *   1. A sessão vem SOMENTE de variável de ambiente, em runtime:
 *        BENCH_SESSION_COOKIE   (o valor inteiro do header "Cookie")
 *      ou, alternativamente, de um arquivo local NÃO versionado:
 *        BENCH_SESSION_FILE     (caminho de um arquivo com o mesmo conteúdo)
 *      Nenhum dos dois é lido de dentro do repositório por padrão, e nenhum
 *      valor é escrito em disco por este módulo.
 *   2. O valor NUNCA é impresso. Só reportamos PRESENÇA e um tamanho
 *      aproximado ("cookie presente: 143 bytes") — nunca o conteúdo.
 *   3. O cookie é usado apenas como header da própria requisição. Não é
 *      logado, não é salvo, não vaza para mensagens de erro (ver `redact`).
 */

import { readFileSync } from "node:fs";

/** Valor literal do header Cookie — mantido só em memória. */
let runtimeCookie = null;

/**
 * Carrega a sessão em runtime. Não lança se não houver: quem chama decide se
 * isso é erro (o runner exige sessão por padrão).
 */
export function loadSession() {
  if (runtimeCookie) return runtimeCookie;

  // 1) variável de ambiente (preferida — não toca o disco)
  const fromEnv = process.env.BENCH_SESSION_COOKIE;
  if (fromEnv && fromEnv.trim()) {
    runtimeCookie = fromEnv.trim();
    return runtimeCookie;
  }

  // 2) arquivo local indicado por env (fora do repositório, de preferência)
  const file = process.env.BENCH_SESSION_FILE;
  if (file && file.trim()) {
    try {
      const content = readFileSync(file.trim(), "utf8").trim();
      if (content) {
        runtimeCookie = content;
        return runtimeCookie;
      }
    } catch (err) {
      // A mensagem NÃO inclui o conteúdo — só o motivo e o caminho.
      throw new Error(`Falha ao ler BENCH_SESSION_FILE (${file.trim()}): ${err?.code || err?.message || "erro"}`);
    }
  }

  return null;
}

export function hasSession() {
  return Boolean(loadSession());
}

/**
 * Descrição SEGURA da sessão para o relatório: presença + tamanho. Nunca o
 * valor, nunca nomes de cookie que revelem detalhes desnecessários.
 */
export function describeSession() {
  const cookie = loadSession();
  if (!cookie) return { present: false, bytes: 0, source: null };
  const source = process.env.BENCH_SESSION_COOKIE ? "env" : "file";
  return { present: true, bytes: Buffer.byteLength(cookie, "utf8"), source };
}

/**
 * Cabeçalhos de uma requisição. Com sessão, injeta o cookie; sem, segue
 * anônima (o runner avisa e, por padrão, aborta antes da carga).
 */
export function authHeaders() {
  const headers = { "user-agent": "inst-acessor-loadlab/1.0" };
  const cookie = loadSession();
  if (cookie) headers["cookie"] = cookie;
  return headers;
}

/**
 * Remove qualquer coisa que pareça credencial de um texto antes de imprimir.
 * Cinto de segurança: mesmo que um cookie aparecesse num erro do `fetch`, ele
 * não chega ao terminal.
 */
export function redact(text) {
  if (!text) return text;
  let out = String(text);
  // Valores de cookie conhecidos em runtime.
  const cookie = runtimeCookie;
  if (cookie) out = out.split(cookie).join("[SESSAO_REDIGIDA]");
  // Padrões comuns de credencial, mesmo que não sejam os nossos.
  out = out.replace(/(next-auth\.session-token|__Secure-next-auth\.session-token)=[^;\s]+/gi, "$1=[REDIGIDO]");
  out = out.replace(/(authorization:\s*bearer\s+)\S+/gi, "$1[REDIGIDO]");
  out = out.replace(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, "[JWT_REDIGIDO]");
  return out;
}

/** Detecta se uma resposta é, na prática, a tela de login (não o app). */
export async function looksLikeLogin(res) {
  // 1) Redirect explícito para /login
  const loc = res.headers.get("location") || "";
  if (/\/login(\?|$)/.test(loc)) return "redirect-para-login";

  // 2) 401/403 explícitos
  if (res.status === 401) return "401-unauthorized";
  if (res.status === 403) return "403-forbidden";

  return null;
}
