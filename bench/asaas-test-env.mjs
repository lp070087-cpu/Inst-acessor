/**
 * TRAVA DE BANCO DOS TESTES DE ASAAS — NUNCA TOCAR UM BANCO REAL
 * ==============================================================
 * IMPORTANTE (incidente registrado): ao rodar um teste anterior SEM esta trava,
 * o `@prisma/client` carregou AUTOMATICAMENTE o arquivo `.env` do projeto —
 * que aponta para PRODUÇÃO — porque `DATABASE_URL` não estava definido no
 * processo. O Node NÃO carrega `.env.local` sozinho, então o banco de staging
 * nunca foi usado. Resultado: uma linha sintética foi gravada em produção.
 *
 * Esta trava impede a repetição. Ela define um `DATABASE_URL` INALCANÇÁVEL
 * (127.0.0.1:1 — nada escuta) ANTES de qualquer módulo de `src/` ser avaliado.
 * O Prisma NÃO sobrescreve uma variável já definida, então `.env` é ignorado e
 * qualquer tentativa de acesso ao banco FALHA FECHADO (a rota do webhook devolve
 * 5xx em vez de processar).
 *
 * Deve ser o PRIMEIRO import do teste (`import "./asaas-test-env.mjs";`) para que
 * o módulo seja avaliado antes do grafo de `@/lib/db`.
 */
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/asaas_test_no_db";
process.env.DIRECT_URL = process.env.DATABASE_URL;
