import { prisma } from "@/lib/db";

/**
 * RATE LIMIT INTERNO — Fase 7 (Parte 15)
 * ======================================
 * Guarda interna (in-memory) contra abuso na fila de publicação.
 *
 * LIMITAÇÃO REAL — LEIA ANTES DE CONFIAR NESTE MÓDULO
 * ---------------------------------------------------
 * Em serverless (Vercel) este limitador NÃO é um limite global. O estado vive no
 * `Map` do PROCESSO: cada instância tem o seu, o estado some quando a instância
 * esfria, e requisições concorrentes podem cair em instâncias diferentes — cada
 * uma com o próprio contador. Na prática ele limita "requisições por instância
 * viva por janela", não "requisições por usuário/IP no mundo".
 *
 * POR ISSO, ESTE MÓDULO NUNCA É A DEFESA PRINCIPAL:
 *   - WEBHOOKS (Instagram/TikTok): a defesa real é a ASSINATURA HMAC verificada
 *     sobre o corpo bruto, fail-closed (ver `@/lib/webhooks/signature`, os
 *     `route.ts` de webhook e `docs/INTEGRACOES-INSTAGRAM-TIKTOK.md`). Este
 *     limiter é só uma camada de cortesia contra flood.
 *   - IA / primeiro acesso / criação de regra: defesas primárias próprias
 *     (permissão, intervalo persistido, resposta genérica anti-enumeração), com
 *     o limiter como reforço.
 *
 * ONDE O LIMITE PRECISA SER CONFIÁVEL, USE `dbRateLimiter` (abaixo): contador
 * PERSISTENTE em `VerificationToken`, atômico no banco e compartilhado por todas
 * as instâncias. Sem migração e sem dependência nova.
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

// ================================================================
// LIMITADOR PERSISTENTE (DB) — para os caminhos NÃO AUTENTICADOS de maior risco
// ================================================================

/**
 * Contador de janela FIXA por chave, atômico no banco.
 *
 * Armazenamento: `VerificationToken` — a única tabela do schema SEM chave
 * estrangeira para `User` e com expiração própria (`expires`). Isso evita duas
 * armadilhas: (a) `AutomationEvent`/`UsageCounter` exigem um `userId` que EXISTA
 * (FK para `User`), e um usuário-sentinela seria dado inventado; (b) não exige
 * model novo nem migração. As linhas de limiter usam `identifier` prefixado com
 * `dbrl:` — isoladas das linhas de autenticação, que nunca usam esse prefixo — e
 * `expires` = fim da janela, de modo que qualquer varredura de expirados também
 * limpa as nossas.
 *
 * O que ele NÃO é: um limitador distribuído de alta precisão. É janela fixa com
 * uma corrida TOCTOU leve (duas chamadas leem o `used` antes de qualquer insert):
 * sob concorrência admite um POUCO acima do teto — mas nunca bloqueia a menos,
 * que é o lado seguro do erro.
 *
 * FAIL-OPEN DELIBERADO: se o banco falhar, a chamada PASSA. Para webhooks a
 * defesa real é a ASSINATURA; um contador de cortesia não pode virar bloqueio
 * total numa indisponibilidade do banco.
 */
export const dbRateLimiter = {
  /**
   * @returns `true` se a chamada pode prosseguir; `false` se a janela estourou.
   */
  async check(key: string, opts: { windowMs: number; max: number }): Promise<boolean> {
    const now = Date.now();
    const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;

    // `identifier` É o prefixo da janela+chave: todas as fichas daquele bucket o
    // compartilham, o que torna a contagem um `count` por igualdade exata.
    const identifier = `dbrl:${opts.windowMs}:${windowStart}:${encodeURIComponent(key)}`;

    try {
      const client = prisma as unknown as {
        verificationToken: {
          count(args: unknown): Promise<number>;
          create(args: unknown): Promise<unknown>;
          deleteMany(args: unknown): Promise<{ count: number }>;
        };
      };

      const used = await client.verificationToken.count({ where: { identifier } });
      if (used >= opts.max) return false;

      // Purge OPPORTUNÍSTICA (~1/50 chamadas): apaga fichas de limiter já
      // expiradas sem depender de job externo. Prefixo `dbrl:` isola o escopo.
      if (Math.random() < 0.02) {
        await client.verificationToken.deleteMany({
          where: { identifier: { startsWith: "dbrl:" }, expires: { lt: new Date(now) } },
        });
      }

      const nonce =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${now}-${Math.random().toString(36).slice(2, 10)}`;
      await client.verificationToken.create({
        data: {
          identifier,
          token: nonce,
          expires: new Date(windowStart + opts.windowMs),
        },
      });
      return true;
    } catch {
      console.warn("[rate-limit] contador persistente indisponível — seguindo (fail-open)");
      return true;
    }
  },
};
