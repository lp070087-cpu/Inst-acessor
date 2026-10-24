/**
 * TRAVA PADRÃO DE BANCO PARA QUALQUER TESTE EM `bench/`
 * =====================================================
 * INCIDENTE QUE MOTIVOU ESTE ARQUIVO (2026-10-08)
 * -----------------------------------------------
 * Um teste em `bench/` importou código de `src/lib` e, ao exercitar a rota do
 * webhook, o `@prisma/client` carregou AUTOMATICAMENTE o `.env` do projeto —
 * que aponta para PRODUÇÃO. O Node NÃO carrega `.env.local` sozinho, então o
 * banco de staging nunca foi usado. Uma linha sintética foi gravada em produção.
 *
 * O que este módulo faz: define `DATABASE_URL`/`DIRECT_URL` como um endereço
 * INALCANÇÁVEL (127.0.0.1:1 — nada escuta) ANTES de qualquer módulo de `src/`
 * ser avaliado. O Prisma NÃO sobrescreve uma variável já definida, então o
 * `.env` é ignorado e qualquer acesso ao banco FALHA FECHADO.
 *
 * COMO USAR (nos testes que importam `src/`):
 *     import "./db-guard.mjs";   // PRIMEIRA linha do teste
 *
 * Para rodar um teste CONTRA A STAGING de propósito, defina
 * `BENCH_ALLOW_STAGING=1` no ambiente — a trava então só valida que o host não é
 * produção (nunca libera produção, em hipótese alguma).
 */

/** Hosts de PRODUÇÃO — presença deles aborta o teste. */
const PROD_MARKERS = ["ep-autumn-sky"];

/** Endereço inalcançável: garante que nenhuma chamada real aconteça. */
const UNREACHABLE = "postgresql://guard:guard@127.0.0.1:1/bench_no_db";

const allowStaging = process.env.BENCH_ALLOW_STAGING === "1";

if (!allowStaging) {
  // Trava forte: nada de banco real, nem staging. Só o inalcançável.
  process.env.DATABASE_URL = UNREACHABLE;
  process.env.DIRECT_URL = UNREACHABLE;
} else {
  // Modo staging explícito: continua proibido apontar para produção.
  const url = process.env.DATABASE_URL ?? "";
  if (PROD_MARKERS.some((m) => url.includes(m))) {
    console.error("⛔ bench/db-guard: DATABASE_URL aponta para PRODUÇÃO — abortado.");
    process.exit(2);
  }
}

export const BENCH_DB_GUARD = {
  /** `true` quando o teste roda sem banco (caso padrão). */
  offline: !allowStaging,
  url: process.env.DATABASE_URL,
};
