/**
 * FAIXAS SEGURAS DE LIMITE — ARQUIVO FOLHA
 * =========================================
 * Sem nenhum import, de propósito.
 *
 * Este arquivo existe porque os componentes de interface rodam no cliente e
 * precisam exibir as faixas permitidas. Importar `./limits.ts` num componente
 * "use client" arrastaria junto o repositório (`./db` → cliente Prisma), que é
 * código exclusivo de servidor. Mantendo as faixas aqui, a UI importa só
 * números e o servidor continua sendo a única fonte que grava.
 *
 * Quem GRAVA é sempre `sanitizeLimits()` em `./limits.ts`, que reaplica estas
 * mesmas faixas — ou seja, a validação real nunca depende do cliente.
 */

export const LIMIT_BOUNDS = {
  maxRepliesPerRun: { min: 1, max: 50, default: 10 },
  maxRepliesPerHour: { min: 1, max: 100, default: 20 },
  maxRepliesPerDay: { min: 1, max: 300, default: 60 },
  minimumIntervalSeconds: { min: 10, max: 3600, default: 30 },
} as const;

export type LimitBounds = typeof LIMIT_BOUNDS;
