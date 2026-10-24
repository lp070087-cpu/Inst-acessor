import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";

export const databaseContext = new AsyncLocalStorage<{
  client: Prisma.TransactionClient;
  afterCommit: Array<() => Promise<unknown>>;
}>();

/** External effects must never escape a transaction that may roll back. */
export function afterDatabaseCommit(effect: () => Promise<unknown>): void {
  const context = databaseContext.getStore();
  if (!context) throw new Error("Transaction context required");
  context.afterCommit.push(effect);
}
