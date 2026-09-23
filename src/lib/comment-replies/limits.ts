import { LIMIT_BOUNDS } from "./limits-config";
import {
  countSentSince,
  lastSentAt,
  getOrCreateRule,
  type AutomationRule,
} from "./db";

/**
 * LIMITES DE ENVIO — NÚCLEO DE CONTROLE
 * ======================================
 * Nenhuma resposta automática é enviada sem passar por aqui. Os limites são
 * configuráveis pela tela, mas SEMPRE dentro de faixas seguras (os `clamp`
 * abaixo). O objetivo é nunca parecer automação abusiva para o Instagram —
 * que é justamente o que faz a conta perder alcance ou ser bloqueada.
 *
 * Regras implementadas:
 *   • máximo por execução        (maxRepliesPerRun)
 *   • máximo por hora            (maxRepliesPerHour)
 *   • máximo por dia             (maxRepliesPerDay)
 *   • intervalo mínimo entre envios (minimumIntervalSeconds)
 *   • pausa por rate limit       (temporária)
 *   • pausa por erro             (definitiva até o usuário reativar)
 *
 * Os valores são lidos do banco a cada verificação (sem cache de processo),
 * porque dois workers poderiam divergir; o custo é uma query barata por lote.
 */

/**
 * Faixas seguras — o usuário escolhe dentro delas, nunca fora.
 * Reexportadas de `./limits-config` (arquivo folha sem imports) para que a
 * interface possa exibi-las sem arrastar o repositório de banco para o bundle
 * do cliente.
 */
export { LIMIT_BOUNDS } from "./limits-config";
export type { LimitBounds } from "./limits-config";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Sanitiza um patch vindo do cliente antes de gravar. */
export function sanitizeLimits(input: {
  maxRepliesPerRun?: unknown;
  maxRepliesPerHour?: unknown;
  maxRepliesPerDay?: unknown;
  minimumIntervalSeconds?: unknown;
}) {
  const out: Record<string, number> = {};
  if (input.maxRepliesPerRun !== undefined) {
    out.maxRepliesPerRun = clamp(Number(input.maxRepliesPerRun), LIMIT_BOUNDS.maxRepliesPerRun.min, LIMIT_BOUNDS.maxRepliesPerRun.max);
  }
  if (input.maxRepliesPerHour !== undefined) {
    out.maxRepliesPerHour = clamp(Number(input.maxRepliesPerHour), LIMIT_BOUNDS.maxRepliesPerHour.min, LIMIT_BOUNDS.maxRepliesPerHour.max);
  }
  if (input.maxRepliesPerDay !== undefined) {
    out.maxRepliesPerDay = clamp(Number(input.maxRepliesPerDay), LIMIT_BOUNDS.maxRepliesPerDay.min, LIMIT_BOUNDS.maxRepliesPerDay.max);
  }
  if (input.minimumIntervalSeconds !== undefined) {
    out.minimumIntervalSeconds = clamp(
      Number(input.minimumIntervalSeconds),
      LIMIT_BOUNDS.minimumIntervalSeconds.min,
      LIMIT_BOUNDS.minimumIntervalSeconds.max
    );
  }
  // Coerência: por hora nunca maior que por dia; por execução nunca maior que por hora.
  if (out.maxRepliesPerDay !== undefined && out.maxRepliesPerHour !== undefined && out.maxRepliesPerHour > out.maxRepliesPerDay) {
    out.maxRepliesPerHour = out.maxRepliesPerDay;
  }
  if (out.maxRepliesPerHour !== undefined && out.maxRepliesPerRun !== undefined && out.maxRepliesPerRun > out.maxRepliesPerHour) {
    out.maxRepliesPerRun = out.maxRepliesPerHour;
  }
  return out;
}

export interface LimitCheck {
  allowed: boolean;
  reason?: string;
  /** Quando true, o envio deve ser tentado de novo mais tarde. */
  retryLater?: boolean;
}

export interface LimitState {
  rule: AutomationRule;
  sentLastHour: number;
  sentLastDay: number;
  lastSent: Date | null;
  /** Quantos já foram enviados nesta execução. */
  sentThisRun: number;
}

/** Carrega o estado atual de uso para um único usuário. */
export async function loadLimitState(userId: string, sentThisRun = 0): Promise<LimitState> {
  const now = Date.now();
  const rule = await getOrCreateRule(userId);
  const [sentLastHour, sentLastDay, lastSent] = await Promise.all([
    countSentSince(userId, new Date(now - 60 * 60 * 1000)),
    countSentSince(userId, new Date(now - 24 * 60 * 60 * 1000)),
    lastSentAt(userId),
  ]);
  return { rule, sentLastHour, sentLastDay, lastSent, sentThisRun };
}

/**
 * Decide se MAIS UMA resposta pode ser enviada agora.
 * Fail-closed: qualquer estado incerto bloqueia.
 */
export function checkLimits(state: LimitState): LimitCheck {
  const { rule } = state;

  if (rule.paused) {
    return { allowed: false, reason: "Respostas Inteligentes estão pausadas.", retryLater: true };
  }
  if (!rule.enabled) {
    return { allowed: false, reason: "A automação está desativada." };
  }
  if (state.sentThisRun >= rule.maxRepliesPerRun) {
    return {
      allowed: false,
      reason: `Limite de ${rule.maxRepliesPerRun} respostas por execução atingido.`,
      retryLater: true,
    };
  }
  if (state.sentLastHour >= rule.maxRepliesPerHour) {
    return {
      allowed: false,
      reason: `Limite de ${rule.maxRepliesPerHour} respostas por hora atingido.`,
      retryLater: true,
    };
  }
  if (state.sentLastDay >= rule.maxRepliesPerDay) {
    return {
      allowed: false,
      reason: `Limite de ${rule.maxRepliesPerDay} respostas nas últimas 24h atingido.`,
      retryLater: true,
    };
  }

  if (state.lastSent) {
    const elapsed = Date.now() - state.lastSent.getTime();
    const minMs = rule.minimumIntervalSeconds * 1000;
    if (elapsed < minMs) {
      const wait = Math.ceil((minMs - elapsed) / 1000);
      return {
        allowed: false,
        reason: `Intervalo mínimo entre respostas: aguarde ${wait}s.`,
        retryLater: true,
      };
    }
  }

  return { allowed: true };
}

/**
 * Como responder a uma falha da API.
 * - rate limit  → pausa TEMPORÁRIA (a automação volta sozinha)
 * - token inválido / permissão → pausa DEFINITIVA (exige ação do usuário)
 * - outros      → registra erro pontual, sem pausar
 */
export function pauseForError(code: string): { pause: boolean; temporary: boolean; message: string } {
  switch (code) {
    case "rate_limit":
      return {
        pause: true,
        temporary: true,
        message: "Limite do Instagram atingido. A automação foi pausada temporariamente.",
      };
    case "not_connected":
      return {
        pause: true,
        temporary: false,
        message: "A conexão com o Instagram expirou. Reconecte em Redes Sociais — a automação fica pausada até lá.",
      };
    case "capability":
      return {
        pause: true,
        temporary: false,
        message: "O Instagram não autorizou esta operação. A automação foi pausada para evitar erros repetidos.",
      };
    case "no_connection":
      return {
        pause: true,
        temporary: false,
        message: "Nenhuma conexão com o Instagram. A automação foi pausada.",
      };
    default:
      return { pause: false, temporary: false, message: "" };
  }
}

/**
 * Marca a pausa no registro da regra. NUNCA apaga histórico — o `CommentReplyLog`
 * é imutável para fins de auditoria; a pausa só impede novos envios.
 */
export async function applyPause(userId: string, paused: boolean): Promise<void> {
  const { updateRule } = await import("./db");
  await updateRule(userId, { paused });
}

/**
 * Pausa automática por desconexão do Instagram.
 * Chamada quando a conexão deixa de estar CONNECTED. O histórico permanece
 * intacto — apenas a automação para.
 */
export async function pauseForDisconnect(userId: string): Promise<void> {
  const rule = await getOrCreateRule(userId);
  if (!rule.paused) {
    const { updateRule } = await import("./db");
    await updateRule(userId, { paused: true });
  }
}

/**
 * Decide se uma pausa por rate limit já pode ser desfeita.
 *
 * Não existe "religar sozinho" arbitrário: a pausa temporária só é removida se
 * JÁ passou o período de espera E não houve nenhum envio nesse intervalo. Isso
 * evita que o sistema entre em ciclo de tentar → tomar bloqueio → tentar.
 *
 * Nunca desfaz uma pausa manual do usuário — o chamador informa se a pausa foi
 * automática (`temporary`) antes de invocar.
 */
export async function canResumeAfterRateLimit(
  userId: string,
  waitMinutes = 15
): Promise<boolean> {
  const since = new Date(Date.now() - waitMinutes * 60 * 1000);
  const sentInWindow = await countSentSince(userId, since);
  return sentInWindow === 0;
}


