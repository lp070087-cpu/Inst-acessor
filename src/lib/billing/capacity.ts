/**
 * CAPACIDADE DE VENDAS — NÚCLEO PURO (vagas / lista de espera)
 * ============================================================
 * Módulo PURO: sem banco, sem HTTP, sem React. Recebe (a) a configuração que o
 * ADMIN grava em `SystemSetting`, (b) o USO REAL medido no banco (pagantes
 * ativos + reservas pendentes + convites ativos) e (c) se o comprador tem
 * convite vigente, e decide se ESTA compra pode ocupar uma vaga.
 *
 * POR QUE ELE EXISTE
 * ------------------
 * O limite de vagas é uma regra de NEGÓCIO, e regra de negócio se decide no
 * servidor — nunca escondendo um botão. O navegador pode mandar qualquer coisa;
 * a decisão nasce aqui, a partir de números lidos do banco.
 *
 * MODELO DE CONTAGEM (uma identidade = um pagante)
 * ------------------------------------------------
 * "Pagante" é uma PESSOA, não uma linha. O mesmo e-mail pode ter vários
 * `AccessGrant` (uma cobrança por ciclo), então contar linhas inflaria o número
 * e fecharia a venda cedo. Contamos E-MAILS DISTINTOS com acesso ativo.
 *
 * Reservas PENDENTES de checkout seguram vaga por um tempo curto (ver
 * RESERVATION_TTL_MINUTES). Passado esse tempo, a reserva "expira" sozinha (ela
 * é medida por janela de tempo), sem precisar apagar nada.
 *
 * CONVITES da lista de espera também seguram vaga enquanto válidos — é assim
 * que o admin "libera uma vaga" para uma pessoa específica mesmo com a lotação
 * cheia, sem furar o limite global.
 */

/** Chave única em `SystemSetting` onde o admin grava a capacidade. */
export const CAPACITY_SETTING_KEY = "billing.capacity.v1";

/** Por quanto tempo um checkout PENDING segura uma vaga (minutos). */
export const RESERVATION_TTL_MINUTES = 15;

/** Por quantos dias um convite de lista de espera permanece válido. */
export const INVITE_TTL_DAYS = 7;

/**
 * Capacidade PADRÃO: SEM limite e com as vendas ABERTAS.
 *
 * É, de propósito, o comportamento que o produto já tinha antes desta feature —
 * ligar um teto silenciosamente bloquearia vendas que hoje funcionam. O admin
 * define o limite quando quiser pelo painel; até lá, nada muda.
 */
export const DEFAULT_CAPACITY: CapacityConfig = {
  signupsOpen: true,
  maxPayers: null,
  message:
    "As vagas deste lote foram preenchidas. Entre na lista de espera e avisaremos assim que uma nova vaga abrir.",
};

export interface CapacityConfig {
  /** `false` = vendas fechadas independentemente do limite. */
  signupsOpen: boolean;
  /** Teto de pagantes. `null` = ilimitado. */
  maxPayers: number | null;
  /** Mensagem mostrada ao comprador quando não há vaga. */
  message: string;
}

/** Uso REAL medido no banco no instante da decisão. */
export interface CapacityUsage {
  /** E-mails distintos com acesso ASAAS ativo (pagantes reais). */
  activePayers: number;
  /** Checkouts PENDING dentro da janela de reserva. */
  pendingReservations: number;
  /** Convites de lista de espera ainda válidos (seguram vaga). */
  activeInvites: number;
  /** `true` quando o comprador DESTA compra tem convite vigente. */
  hasActiveInvite: boolean;
  /** `true` quando o e-mail DESTA compra JÁ é um pagante ativo. */
  buyerIsActivePayer: boolean;
}

export type CapacityReason = "OPEN" | "INVITED" | "EXISTING_PAYER" | "SIGNUPS_CLOSED" | "AT_LIMIT";

export interface CapacityDecision {
  allowed: boolean;
  reason: CapacityReason;
  /** Mensagem para o comprador. Configurável pelo admin quando bloqueia. */
  message: string;
  maxPayers: number | null;
  /** Total ocupado (pagantes + reservas + convites). */
  used: number;
  /** Vagas restantes; `null` quando ilimitado. */
  seatsRemaining: number | null;
  activePayers: number;
  pendingReservations: number;
  activeInvites: number;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

function isNonNegativeInt(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    Number.isInteger(v) &&
    v >= 0
  );
}

/**
 * Normaliza o que veio do `SystemSetting` (string JSON, possivelmente adulterada
 * ou de uma versão antiga) num `CapacityConfig` utilizável.
 *
 * Conservador onde importa: `signupsOpen` só é `false` quando o valor gravado é
 * LITERALMENTE `false`. Qualquer outra coisa (ausente, string, `0`) mantém as
 * vendas abertas — fechar vendas por acidente de tipo seria o pior desfecho.
 */
export function parseCapacityConfig(raw: unknown): CapacityConfig {
  if (typeof raw === "string") {
    try {
      return parseCapacityConfig(JSON.parse(raw));
    } catch {
      return DEFAULT_CAPACITY;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_CAPACITY;
  }

  const o = raw as Record<string, unknown>;

  return {
    signupsOpen: o.signupsOpen !== false,
    maxPayers: isNonNegativeInt(o.maxPayers) ? o.maxPayers : null,
    message:
      typeof o.message === "string" && o.message.trim()
        ? o.message.trim().slice(0, 240)
        : DEFAULT_CAPACITY.message,
  };
}

// ---------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------

/**
 * Decide se UMA compra pode ocupar uma vaga AGORA.
 *
 * Ordem das regras (importa):
 *  1. Comprador que JÁ é pagante ativo → sua vaga já existe; comprar de novo
 *     (trocar de plano, renovar pelo checkout) NÃO é uma vaga nova.
 *  2. Convite vigente → a vaga já foi reservada para essa pessoa.
 *  3. Vendas fechadas pelo admin bloqueiam, mesmo abaixo do teto.
 *  4. Teto de pagantes bloqueia quando o total ocupado o alcança.
 *  5. Caso contrário, libera.
 */
export function decideCapacity(input: {
  config: CapacityConfig;
  usage: CapacityUsage;
}): CapacityDecision {
  const { config, usage } = input;
  const max = config.maxPayers;
  const used =
    Math.max(0, usage.activePayers) +
    Math.max(0, usage.pendingReservations) +
    Math.max(0, usage.activeInvites);
  const seatsRemaining = max == null ? null : Math.max(0, max - used);

  const base = {
    maxPayers: max,
    used,
    seatsRemaining,
    activePayers: Math.max(0, usage.activePayers),
    pendingReservations: Math.max(0, usage.pendingReservations),
    activeInvites: Math.max(0, usage.activeInvites),
  } as const;

  // 1) Já é pagante ativo — não consome vaga nova.
  if (usage.buyerIsActivePayer) {
    return {
      allowed: true,
      reason: "EXISTING_PAYER",
      message: "Cliente já ativo — a vaga desta conta já está reservada.",
      ...base,
    };
  }

  // 2) Convite vigente → a vaga é dele.
  if (usage.hasActiveInvite) {
    return {
      allowed: true,
      reason: "INVITED",
      message: "Convite válido: sua vaga está reservada.",
      ...base,
    };
  }

  // 3) Vendas fechadas pelo admin.
  if (!config.signupsOpen) {
    return {
      allowed: false,
      reason: "SIGNUPS_CLOSED",
      message: config.message,
      ...base,
    };
  }

  // 4) Teto atingido.
  if (max != null && used >= max) {
    return {
      allowed: false,
      reason: "AT_LIMIT",
      message: config.message,
      ...base,
    };
  }

  // 5) Aberto.
  return {
    allowed: true,
    reason: "OPEN",
    message: "Vagas disponíveis.",
    ...base,
  };
}
