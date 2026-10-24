/**
 * ENTRADA DOS TESTES DE ASAAS (offline)
 * =====================================
 * Uso: node --import ./bench/register-asaas-tests.mjs bench/test-asaas-flows.mjs
 *
 * 1) INSTALA A TRAVA DE BANCO **antes** de qualquer módulo de `src/` ser
 *    avaliado. `@prisma/client` carrega `.env` (PRODUÇÃO) automaticamente quando
 *    `DATABASE_URL` está ausente; o Node não carrega `.env.local`. Definir aqui
 *    um `DATABASE_URL` inalcançável evita que o teste toque a produção (o Prisma
 *    NÃO sobrescreve variável já definida). Ver `asaas-test-env.mjs`.
 * 2) Registra o loader (alias `@/` + shim offline de `next/server`).
 */
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/asaas_test_no_db";
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { register } from "node:module";
register("./stub-loader.mjs", import.meta.url);
