import { PrismaClient } from "@prisma/client";

/**
 * CLIENTE PRISMA ÚNICO — inclusive em produção
 * ============================================
 * Antes, o cache em `globalThis` só acontecia quando `NODE_ENV !== "production"`.
 * Em produção (Vercel/serverless) isso fazia cada avaliação do módulo criar um
 * `PrismaClient` NOVO — e cada um abre e mantém o PRÓPRIO pool de conexões.
 * Quando a instância da lambda é congelada/descartada, esse pool é derrubado de
 * forma abrupta: é a origem clássica dos erros intermitentes `Closed` e
 * `ConnectionReset` contra o Neon, além de esgotar conexões sob concorrência.
 *
 * Em dev o guard continua necessário para o Hot Reload não acumular clientes.
 * Em produção, cachear é o padrão correto: uma instância reutiliza o mesmo pool.
 *
 * Pool: o `pool_size` do Neon e o `connection_limit` do Prisma são POR INSTÂNCIA.
 * Se aparecerem erros de pool, ajuste `connection_limit` na `DATABASE_URL`
 * (ex.: `?connection_limit=1&pool_timeout=20&connect_timeout=10`).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
