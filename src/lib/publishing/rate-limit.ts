/**
 * RATE LIMIT INTERNO — Fase 7 (Parte 15)
 * ======================================
 * Guarda interna simples (in-memory, best-effort) contra abuso na fila de
 * publicação. NÃO é uma fronteira de segurança definitiva — em produção
 * com Vercel, um limite persistente (DB/Upstash) pode substituir este módulo
 * sem quebrar contrato.
 *
 * Uso:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
 *   if (!limiter.check(userId)) return 429;
 */

interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();

  // Limpeza periódica para não crescer sem limite.
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000);
  if (typeof interval.unref === "function") interval.unref();

  return {
    /** True se a ação pode prosseguir; false se estourou o limite. */
    check(key: string): boolean {
      const now = Date.now();
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (current.count >= max) return false;
      current.count += 1;
      return true;
    },
    reset(key: string) {
      buckets.delete(key);
    },
  };
}

/** Limiter padrão da fila de publicação (por usuário). */
export const publishingRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
});

/** Limiter padrão de criação de automações (por usuário). */
export const automationRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
});

/** Limiter padrão de chamadas de IA (por usuário) — evita abuso de custo. */
export const aiRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
});

/** Limiter padrão de sincronização de métricas (por usuário). */
export const syncRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
});

/**
 * Limiter de criação de conta (por IP) — sem sessão disponível no register.
 * Window maior e teto baixo para evitar abuso de cadastros em massa.
 */
export const registerRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
});

/**
 * Limiter de solicitação de primeiro acesso — PER-EMAIL e por IP.
 * Evita flood de tokens de ativação para um mesmo endereço (anti-spam de
 * e-mail/abuso do provider). O IP é coberto pelo limiter da própria rota;
 * este complementa com a granularidade por e-mail normalizado.
 */
export const firstAccessEmailRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 3,
});

/** Extrai o IP do cliente a partir do Request (best-effort). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Limiter de webhooks (por IP) — proteção básica contra flood de eventos
 * enquanto a assinatura real (X-Hub-Signature-256) não é configurada.
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 120,
});
