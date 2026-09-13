import { LIMIT_BOUNDS } from "./limits-config";
import {
  countSentSince,
  lastSentAt,
  getOrCreateRule,
  type AutomationRule,
} from "./db";

/**
 * LIMITES DE ENVIO Ã¢â‚¬â€ NÃƒÅ¡CLEO DE CONTROLE
 * ======================================
 * Nenhuma resposta automÃƒÂ¡tica ÃƒÂ© enviada sem passar por aqui. Os limites sÃƒÂ£o
 * configurÃƒÂ¡veis pela tela, mas SEMPRE dentro de faixas seguras (os `clamp`
 * abaixo). O objetivo ÃƒÂ© nunca parecer automaÃƒÂ§ÃƒÂ£o abusiva para o Instagram Ã¢â‚¬â€
 * que ÃƒÂ© justamente o que faz a conta perder alcance ou ser bloqueada.
 *
 * Regras implementadas:
 *   Ã¢â‚¬Â¢ mÃƒÂ¡ximo por execuÃƒÂ§ÃƒÂ£o        (maxRepliesPerRun)
 *   Ã¢â‚¬Â¢ mÃƒÂ¡ximo por hora            (maxRepliesPerHour)
 *   Ã¢â‚¬Â¢ mÃƒÂ¡ximo por dia             (maxRepliesPerDay)
 *   Ã¢â‚¬Â¢ intervalo mÃƒÂ­nimo entre envios (minimumIntervalSeconds)
 *   Ã¢â‚¬Â¢ pausa por rate limit       (temporÃƒÂ¡ria)
 *   Ã¢â‚¬Â¢ pausa por erro             (definitiva atÃƒÂ© o usuÃƒÂ¡rio reativar)
 *
 * Os valores sÃƒÂ£o lidos do banco a cada verificaÃƒÂ§ÃƒÂ£o (sem cache de processo),
 * porque dois workers poderiam divergir; o custo ÃƒÂ© uma query barata por lote.
 */

/**
 * Faixas seguras Ã¢â‚¬â€ o usuÃƒÂ¡rio escolhe dentro delas, nunca fora.
 * Reexportadas de `./limits-config` (arquivo folha sem imports) para que a
 * interface possa exibi-las sem arrastar o repositÃƒÂ³rio de banco para o bundle
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
  // CoerÃƒÂªncia: por hora nunca maior que por dia; por execuÃƒÂ§ÃƒÂ£o nunca maior que por hora.
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
  /** Quantos jÃƒÂ¡ foram enviados nesta execuÃƒÂ§ÃƒÂ£o. */
  sentThisRun: number;
}

/** Carrega o estado atual de uso para um ÃƒÂºnico usuÃƒÂ¡rio. */
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
    return { allowed: false, reason: "Respostas Inteligentes estÃƒÂ£o pausadas.", retryLater: true };
  }
  if (!rule.enabled) {
    return { allowed: false, reason: "A automaÃƒÂ§ÃƒÂ£o estÃƒÂ¡ desativada." };
  }
  if (state.sentThisRun >= rule.maxRepliesPerRun) {
    return {
      allowed: false,
      reason: `Limite de ${rule.maxRepliesPerRun} respostas por execuÃƒÂ§ÃƒÂ£o atingido.`,
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
      reason: `Limite de ${rule.maxRepliesPerDay} respostas nas ÃƒÂºltimas 24h atingido.`,
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
        reason: `Intervalo mÃƒÂ­nimo entre respostas: aguarde ${wait}s.`,
        retryLater: true,
      };
    }
  }

  return { allowed: true };
}

/**
 * Como responder a uma falha da API.
 * - rate limit  Ã¢â€ â€™ pausa TEMPORÃƒÂRIA (a automaÃƒÂ§ÃƒÂ£o volta sozinha)
 * - token invÃƒÂ¡lido / permissÃƒÂ£o Ã¢â€ â€™ pausa DEFINITIVA (exige aÃƒÂ§ÃƒÂ£o do usuÃƒÂ¡rio)
 * - outros      Ã¢â€ â€™ registra erro pontual, sem pausar
 */
export function pauseForError(code: string): { pause: boolean; temporary: boolean; message: string } {
  switch (code) {
    case "rate_limit":
      return {
        pause: true,
        temporary: true,
        message: "Limite do Instagram atingido. A automaÃƒÂ§ÃƒÂ£o foi pausada temporariamente.",
      };
    case "not_connected":
      return {
        pause: true,
        temporary: false,
        message: "A conexÃƒÂ£o com o Instagram expirou. Reconecte em Redes Sociais Ã¢â‚¬â€ a automaÃƒÂ§ÃƒÂ£o fica pausada atÃƒÂ© lÃƒÂ¡.",
      };
    case "capability":
      return {
        pause: true,
        temporary: false,
        message: "O Instagram nÃƒÂ£o autorizou esta operaÃƒÂ§ÃƒÂ£o. A automaÃƒÂ§ÃƒÂ£o foi pausada para evitar erros repetidos.",
      };
    case "no_connection":
      return {
        pause: true,
        temporary: false,
        message: "Nenhuma conexÃƒÂ£o com o Instagram. A automaÃƒÂ§ÃƒÂ£o foi pausada.",
      };
    default:
      return { pause: false, temporary: false, message: "" };
  }
}

/**
 * Marca a pausa no registro da regra. NUNCA apaga histÃƒÂ³rico Ã¢â‚¬â€ o `CommentReplyLog`
 * ÃƒÂ© imutÃƒÂ¡vel para fins de auditoria; a pausa sÃƒÂ³ impede novos envios.
 */
export async function applyPause(userId: string, paused: boolean): Promise<void> {
  const { updateRule } = await import("./db");
  await updateRule(userId, { paused });
}

/**
 * Pausa automÃƒÂ¡tica por desconexÃƒÂ£o do Instagram.
 * Chamada quando a conexÃƒÂ£o deixa de estar CONNECTED. O histÃƒÂ³rico permanece
 * intacto Ã¢â‚¬â€ apenas a automaÃƒÂ§ÃƒÂ£o para.
 */
export async function pauseForDisconnect(userId: string): Promise<void> {
  const rule = await getOrCreateRule(userId);
  if (!rule.paused) {
    const { updateRule } = await import("./db");
    await updateRule(userId, { paused: true });
  }
}

/**
 * Decide se uma pausa por rate limit jÃƒÂ¡ pode ser desfeita.
 *
 * NÃƒÂ£o existe "religar sozinho" arbitrÃƒÂ¡rio: a pausa temporÃƒÂ¡ria sÃƒÂ³ ÃƒÂ© removida se
 * JÃƒÂ passou o perÃƒÂ­odo de espera E nÃƒÂ£o houve nenhum envio nesse intervalo. Isso
 * evita que o sistema entre em ciclo de tentar Ã¢â€ â€™ tomar bloqueio Ã¢â€ â€™ tentar.
 *
 * Nunca desfaz uma pausa manual do usuÃƒÂ¡rio Ã¢â‚¬â€ o chamador informa se a pausa foi
 * automÃƒÂ¡tica (`temporary`) antes de invocar.
 */
export async function canResumeAfterRateLimit(
  userId: string,
  waitMinutes = 15
): Promise<boolean> {
  const since = new Date(Date.now() - waitMinutes * 60 * 1000);
  const sentInWindow = await countSentSince(userId, since);
  return sentInWindow === 0;
}


