import { PrismaClient } from "@prisma/client";
import { databaseContext } from "./db-context";

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

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = baseClient;

// All repositories share the transaction of the current async operation.
// There is no process-global reassignment: concurrent requests stay isolated.
export const prisma = new Proxy(baseClient, {
  get(target, property) {
    const client = databaseContext.getStore()?.client ?? target;
    const value = Reflect.get(client, property);
    if (typeof property === "string" && !property.startsWith("$") && value && typeof value === "object") {
      return new Proxy(value, {
        get(_delegate, method) {
          const active = databaseContext.getStore()?.client ?? target;
          const delegate = Reflect.get(active, property);
          const member = Reflect.get(delegate, method);
          return typeof member === "function" ? member.bind(delegate) : member;
        },
      });
    }
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function withDatabaseTransaction<T>(operation: () => Promise<T>): Promise<T> {
  if (databaseContext.getStore()) return operation();
  const afterCommit: Array<() => Promise<unknown>> = [];
  const result = await baseClient.$transaction(
    (client) => databaseContext.run({ client, afterCommit }, operation),
    { maxWait: 5000, timeout: 30000 },
  );
  // Notification failure does not undo a committed financial record.
  await Promise.allSettled(afterCommit.map((effect) => effect()));
  return result;
}
