/**
 * PROMOÇÃO — PRÉ-VENDA E AUTORIDADE DE PREÇO (P17–P21)
 * ====================================================
 * Módulo PURO: sem banco, sem HTTP, sem React. Recebe o plano, a configuração
 * da promoção (que o ADMIN grava em `SystemSetting`) e o HISTÓRICO REAL do
 * comprador, e devolve o preço que o servidor vai cobrar.
 *
 * POR QUE ELE EXISTE
 * ------------------
 * "O backend é a autoridade de preço." O navegador NUNCA envia preço — ele
 * envia o SLUG do plano. Todo valor cobrado nasce aqui, no servidor, a partir
 * de (a) catálogo oficial, (b) configuração do admin, (c) histórico do
 * comprador. Um cliente que adultere o payload não consegue alterar o valor,
 * porque não há campo de preço para adulterar.
 *
 * REGRAS DE HONESTIDADE
 * ---------------------
 *  1. Promoção configurada mas VENCIDA (countdown no passado) → preço CHEIO.
 *     O countdown não é decorativo: ele é a condição, avaliada no servidor.
 *  2. Configuração inválida (preço promocional ≥ preço cheio, negativo, zero)
 *     é DESCARTADA inteira e vale o preço cheio. Uma promoção que não é
 *     desconto não é promoção — e cobrar mais caro por causa de config errada
 *     seria o pior desfecho possível.
 *  3. O preço devolvido nunca é "estimado": ou é o do catálogo, ou é um valor
 *     de promoção que o admin gravou explicitamente.
 *  4. Elegibilidade é por HISTÓRICO CONFIRMADO, nunca por declaração do
 *     comprador: as contagens vêm de pagamentos já registrados no banco.
 */

import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import { formatBRL } from "@/lib/billing/plans/display";

/** Chave única em `SystemSetting` onde o admin grava a promoção. */
export const PROMO_SETTING_KEY = "billing.promo.v1";

/**
 * Preços CHEIOS oficiais (centavos).
 *
 * Fonte única: `PLAN_CATALOG`. Antes eram 3 números escritos aqui que apenas
 * "espelhavam" o catálogo — duas tabelas de preço que podiam divergir. Se o
 * catálogo mudar, este mapa acompanha sozinho, e não existe caminho em que o
 * checkout use um preço que o catálogo não reconhece.
 */
export const BASE_PRICE_CENTS: Record<string, number> = Object.fromEntries(
  PLAN_CATALOG.map((plan) => [plan.slug, plan.priceCents])
);

/**
 * Pré-venda PADRÃO (P17). É o valor usado quando o admin ainda não gravou
 * nada — assim a promoção anunciada funciona desde o primeiro deploy, e o
 * admin pode sobrescrever/desligar pelo painel.
 */
export const DEFAULT_PROMO: PromoConfig = {
  enabled: true,
  semanal: {
    enabled: true,
    promoPriceCents: 1190, // R$ 11,90
    /** Somente na PRIMEIRA compra do comprador (nenhum pagamento anterior). */
    requiresNoPreviousPurchase: true,
  },
  mensal: {
    enabled: true,
    promoPriceCents: 4590, // R$ 45,90
    /** Vale nas 3 PRIMEIRAS cobranças; da 4ª em diante, preço cheio. */
    chargesAtPromoPrice: 3,
  },
  anual: {
    enabled: true,
    promoPriceCents: 43290, // R$ 432,90
    /** Vale no PRIMEIRO ano; na renovação, preço cheio. */
    yearsAtPromoPrice: 1,
  },
  countdown: {
    active: false,
    /** ISO 8601 ou null = sem prazo. */
    endsAt: null,
    label: "Pré-venda de lançamento",
  },
};

export interface PromoConfig {
  enabled: boolean;
  semanal: {
    enabled: boolean;
    promoPriceCents: number;
    requiresNoPreviousPurchase: boolean;
  };
  mensal: {
    enabled: boolean;
    promoPriceCents: number;
    chargesAtPromoPrice: number;
  };
  anual: {
    enabled: boolean;
    promoPriceCents: number;
    yearsAtPromoPrice: number;
  };
  countdown: {
    active: boolean;
    endsAt: string | null;
    label: string;
  };
}

/** Histórico REAL do comprador — contagens de pagamentos confirmados. */
export interface BuyerHistory {
  /** Total de pagamentos confirmados, em qualquer plano. */
  confirmedPaymentsTotal: number;
  /** Pagamentos confirmados no plano MENSAL. */
  confirmedMonthlyCharges: number;
  /** Pagamentos confirmados no plano ANUAL. */
  confirmedYearlyCharges: number;
}

/** Motivo pelo qual a promoção NÃO se aplicou (para a UI poder ser explícita). */
export type PromoSkipReason =
  | "PROMO_DESATIVADA"
  | "PLANO_SEM_PROMO"
  | "COUNTDOWN_ENCERRADO"
  | "NAO_E_PRIMEIRA_COMPRA"
  | "LIMITE_DE_COBRANCAS_ATINGIDO"
  | "CONFIGURACAO_INVALIDA";

export interface PromoResolution {
  /** Preço CHEIO do catálogo, sempre presente. */
  basePriceCents: number;
  /** Preço que o servidor vai cobrar. Igual ao cheio quando não há promoção. */
  priceCents: number;
  /** `true` somente quando houve desconto real aplicado. */
  applied: boolean;
  /** Quanto está sendo descontado (0 quando não aplica). */
  discountCents: number;
  /** Rótulo curto para o card ("Pré-venda", "1º ano", "3 primeiras cobranças"). */
  label: string | null;
  /** Por que não aplicou — `null` quando aplicou. */
  skipReason: PromoSkipReason | null;
  /** Em quantas cobranças o valor promocional ainda vale (null = sem limite). */
  remainingPromoCharges: number | null;
  /**
   * `true` quando o admin configurou um preço promocional que NÃO é desconto
   * (≥ cheio). A promoção é descartada e a tela pode avisar o admin.
   */
  configRejected: boolean;
  /** Fim do countdown em ISO (null quando não há). */
  countdownEndsAt: string | null;
  /** `true` quando o countdown está ativo e ainda não venceu. */
  countdownRunning: boolean;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v > 0;
}

/**
 * Normaliza o que veio do `SystemSetting` (string JSON, possivelmente
 * adulterada ou de uma versão antiga) num `PromoConfig` utilizável.
 *
 * Cada campo é validado individualmente e cai no padrão quando inválido — mas
 * `enabled` é sempre tratado de forma conservadora: só fica ligado se o valor
 * for literalmente `true`. Qualquer outra coisa desliga a promoção.
 */
export function parsePromoConfig(raw: unknown): PromoConfig {
  if (typeof raw === "string") {
    try {
      return parsePromoConfig(JSON.parse(raw));
    } catch {
      return DEFAULT_PROMO;
    }
  }
  // `null`, número, boolean, array ou string que não é JSON válido: NÃO é um
  // objeto de configuração. Vale o padrão anunciado — o MESMO comportamento de
  // quando nada foi gravado. Sem esta linha, um array cairia no ramo de objeto,
  // seria lido como "objeto sem `enabled: true`" e devolveria uma config com a
  // promoção desligada — uma terceira resposta, diferente de todos os outros
  // casos de entrada inválida, e impossível de auditar.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_PROMO;

  const o = raw as Record<string, unknown>;
  const obj = (k: string): Record<string, unknown> =>
    o[k] && typeof o[k] === "object" ? (o[k] as Record<string, unknown>) : {};

  const sem = obj("semanal");
  const men = obj("mensal");
  const anu = obj("anual");
  const cd = obj("countdown");

  const endsAtRaw = cd.endsAt;
  const endsAt =
    typeof endsAtRaw === "string" && !Number.isNaN(new Date(endsAtRaw).getTime())
      ? new Date(endsAtRaw).toISOString()
      : null;

  return {
    enabled: o.enabled === true,
    semanal: {
      enabled: sem.enabled === true,
      promoPriceCents: isPositiveInt(sem.promoPriceCents)
        ? sem.promoPriceCents
        : DEFAULT_PROMO.semanal.promoPriceCents,
      requiresNoPreviousPurchase: sem.requiresNoPreviousPurchase !== false,
    },
    mensal: {
      enabled: men.enabled === true,
      promoPriceCents: isPositiveInt(men.promoPriceCents)
        ? men.promoPriceCents
        : DEFAULT_PROMO.mensal.promoPriceCents,
      chargesAtPromoPrice: isPositiveInt(men.chargesAtPromoPrice)
        ? men.chargesAtPromoPrice
        : DEFAULT_PROMO.mensal.chargesAtPromoPrice,
    },
    anual: {
      enabled: anu.enabled === true,
      promoPriceCents: isPositiveInt(anu.promoPriceCents)
        ? anu.promoPriceCents
        : DEFAULT_PROMO.anual.promoPriceCents,
      yearsAtPromoPrice: isPositiveInt(anu.yearsAtPromoPrice)
        ? anu.yearsAtPromoPrice
        : DEFAULT_PROMO.anual.yearsAtPromoPrice,
    },
    countdown: {
      active: cd.active === true,
      endsAt,
      label:
        typeof cd.label === "string" && cd.label.trim()
          ? cd.label.trim().slice(0, 80)
          : DEFAULT_PROMO.countdown.label,
    },
  };
}

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------

function fullPrice(
  basePriceCents: number,
  countdownEndsAt: string | null,
  countdownRunning: boolean,
  skipReason: PromoSkipReason,
  configRejected = false
): PromoResolution {
  return {
    basePriceCents,
    priceCents: basePriceCents,
    applied: false,
    discountCents: 0,
    label: null,
    skipReason,
    remainingPromoCharges: null,
    configRejected,
    countdownEndsAt,
    countdownRunning,
  };
}

/**
 * Decide o preço de UMA compra.
 *
 * @param slug    slug do plano ("semanal" | "mensal" | "anual")
 * @param basePriceCents preço CHEIO vindo do catálogo oficial (autoridade maior
 *                       que `BASE_PRICE_CENTS`, que é só espelho de segurança)
 * @param config  configuração já normalizada (`parsePromoConfig`)
 * @param history histórico REAL do comprador
 * @param now     instante avaliado (ISO) — injetado para ser determinístico
 */
export function resolvePromoPrice(input: {
  slug: string;
  basePriceCents: number;
  config: PromoConfig;
  history: BuyerHistory;
  now: string;
}): PromoResolution {
  const { slug, config, history } = input;
  const base = isPositiveInt(input.basePriceCents)
    ? input.basePriceCents
    : BASE_PRICE_CENTS[slug] ?? 0;

  const now = new Date(input.now);
  const nowValid = !Number.isNaN(now.getTime());

  // Countdown: avaliado ANTES de tudo. Vencido = preço cheio, sem exceção.
  const countdownEndsAt = config.countdown.endsAt;
  let countdownRunning = false;
  if (config.countdown.active && countdownEndsAt && nowValid) {
    countdownRunning = new Date(countdownEndsAt).getTime() > now.getTime();
  }

  if (!config.enabled) {
    return fullPrice(base, countdownEndsAt, countdownRunning, "PROMO_DESATIVADA");
  }

  // Countdown ativo mas VENCIDO → encerra a promoção inteira. Este é o ponto
  // em que "preço promocional manipulado" é recusado: o servidor olha a hora.
  if (config.countdown.active && countdownEndsAt && !countdownRunning) {
    return fullPrice(base, countdownEndsAt, false, "COUNTDOWN_ENCERRADO");
  }

  if (slug === "semanal") {
    const cfg = config.semanal;
    if (!cfg.enabled) return fullPrice(base, countdownEndsAt, countdownRunning, "PLANO_SEM_PROMO");
    if (cfg.promoPriceCents >= base) {
      return fullPrice(base, countdownEndsAt, countdownRunning, "CONFIGURACAO_INVALIDA", true);
    }
    if (cfg.requiresNoPreviousPurchase && history.confirmedPaymentsTotal > 0) {
      return fullPrice(base, countdownEndsAt, countdownRunning, "NAO_E_PRIMEIRA_COMPRA");
    }
    return {
      basePriceCents: base,
      priceCents: cfg.promoPriceCents,
      applied: true,
      discountCents: base - cfg.promoPriceCents,
      label: "Pré-venda · primeira compra",
      skipReason: null,
      // Plano de pagamento único: a promoção vale nesta compra, e só.
      remainingPromoCharges: null,
      configRejected: false,
      countdownEndsAt,
      countdownRunning,
    };
  }

  if (slug === "mensal") {
    const cfg = config.mensal;
    if (!cfg.enabled) return fullPrice(base, countdownEndsAt, countdownRunning, "PLANO_SEM_PROMO");
    if (cfg.promoPriceCents >= base) {
      return fullPrice(base, countdownEndsAt, countdownRunning, "CONFIGURACAO_INVALIDA", true);
    }
    const used = history.confirmedMonthlyCharges;
    const remaining = cfg.chargesAtPromoPrice - used;
    if (remaining <= 0) {
      return fullPrice(base, countdownEndsAt, countdownRunning, "LIMITE_DE_COBRANCAS_ATINGIDO");
    }
    return {
      basePriceCents: base,
      priceCents: cfg.promoPriceCents,
      applied: true,
      discountCents: base - cfg.promoPriceCents,
      label: `Pré-venda · ${remaining} de ${cfg.chargesAtPromoPrice} cobranças com desconto`,
      skipReason: null,
      remainingPromoCharges: remaining,
      configRejected: false,
      countdownEndsAt,
      countdownRunning,
    };
  }

  if (slug === "anual") {
    const cfg = config.anual;
    if (!cfg.enabled) return fullPrice(base, countdownEndsAt, countdownRunning, "PLANO_SEM_PROMO");
    if (cfg.promoPriceCents >= base) {
      return fullPrice(base, countdownEndsAt, countdownRunning, "CONFIGURACAO_INVALIDA", true);
    }
    const used = history.confirmedYearlyCharges;
    const remaining = cfg.yearsAtPromoPrice - used;
    if (remaining <= 0) {
      return fullPrice(base, countdownEndsAt, countdownRunning, "LIMITE_DE_COBRANCAS_ATINGIDO");
    }
    return {
      basePriceCents: base,
      priceCents: cfg.promoPriceCents,
      applied: true,
      discountCents: base - cfg.promoPriceCents,
      label:
        cfg.yearsAtPromoPrice === 1
          ? "Pré-venda · primeiro ano"
          : `Pré-venda · ${remaining} de ${cfg.yearsAtPromoPrice} anos com desconto`,
      skipReason: null,
      remainingPromoCharges: remaining,
      configRejected: false,
      countdownEndsAt,
      countdownRunning,
    };
  }

  return fullPrice(base, countdownEndsAt, countdownRunning, "PLANO_SEM_PROMO");
}

/**
 * Vitrine de UM plano: preço cheio + preço promocional, prontos para o card.
 * Tipo NOMEADO de propósito — é o que o SERVIDOR manda para os componentes de
 * card (landing e "Minha Assinatura") e nenhum deles deve redigitar a forma.
 */
export interface PlanPromoShowcase {
  basePriceCents: number;
  promoPriceCents: number | null;
  discountCents: number;
  discountPercent: number;
  label: string | null;
  /**
   * Condição EXATA da pré-venda, em texto curto — o "nas 3 primeiras
   * cobranças" / "no primeiro ano" / "somente na primeira compra" que fica
   * abaixo do preço promocional no card.
   *
   * Derivado da configuração gravada pelo admin (`chargesAtPromoPrice`,
   * `yearsAtPromoPrice`, `requiresNoPreviousPurchase`), não escrito à mão no
   * componente: se o admin mudar de 3 para 2 cobranças, o texto acompanha.
   */
  qualifier: string | null;
  /**
   * O que passa a valer DEPOIS da condição ("Depois R$ 77,00/mês"). Só existe
   * quando a pré-venda é condicional — no semanal não há "depois", porque a
   * compra é única.
   */
  afterText: string | null;
  countdownEndsAt: string | null;
  countdownRunning: boolean;
  showPromo: boolean;
}

/**
 * Vitrine COMPLETA de preços: a configuração vigente + o resultado por plano.
 *
 * É montada no SERVIDOR (onde o banco é lido) e viaja até os cards da landing e
 * de "Minha Assinatura". Declarada neste módulo PURO para que a página (Server
 * Component) e o card (Client Component) usem a MESMA forma, sem que o
 * componente de cliente precise importar o módulo que fala com o banco.
 */
export interface PlanPromoDisplay {
  /** Configuração vigente (já normalizada) da pré-venda. */
  config: PromoConfig;
  /** Vitrine por slug do plano. Slug ausente = nada a anunciar. */
  bySlug: Record<string, PlanPromoShowcase>;
  /** `false` = o banco não respondeu e o exibido é o PADRÃO, não a config real. */
  infraOk: boolean;
}

/**
 * Preço CHEIO + preço promocional de uma vez, para os CARDS.
 * Não consulta histórico nenhum: é a vitrine do PLANO, não a oferta de uma
 * pessoa. A elegibilidade individual (primeira compra / cobranças usadas) só
 * pode ser decidida com o histórico — e por isso só o checkout faz isso.
 */
export function planPromoDisplay(input: {
  slug: string;
  basePriceCents: number;
  config: PromoConfig;
  now: string;
}): PlanPromoShowcase {
  const { slug, config } = input;
  const base = isPositiveInt(input.basePriceCents)
    ? input.basePriceCents
    : BASE_PRICE_CENTS[slug] ?? 0;

  const now = new Date(input.now);
  const nowValid = !Number.isNaN(now.getTime());
  const countdownEndsAt = config.countdown.endsAt;
  const countdownRunning =
    config.countdown.active && countdownEndsAt && nowValid
      ? new Date(countdownEndsAt).getTime() > now.getTime()
      : false;

  const off = {
    basePriceCents: base,
    promoPriceCents: null,
    discountCents: 0,
    discountPercent: 0,
    label: null,
    qualifier: null,
    afterText: null,
    countdownEndsAt,
    countdownRunning,
    showPromo: false,
  };

  if (!config.enabled) return off;
  if (config.countdown.active && countdownEndsAt && !countdownRunning) return off;

  const cfg =
    slug === "semanal" ? config.semanal : slug === "mensal" ? config.mensal : slug === "anual" ? config.anual : null;
  if (!cfg || !cfg.enabled) return off;
  if (cfg.promoPriceCents >= base) return off;

  const label =
    slug === "semanal"
      ? "Pré-venda · primeira compra"
      : slug === "mensal"
        ? `Pré-venda · ${config.mensal.chargesAtPromoPrice} primeiras cobranças`
        : config.anual.yearsAtPromoPrice === 1
          ? "Pré-venda · primeiro ano"
          : `Pré-venda · ${config.anual.yearsAtPromoPrice} primeiros anos`;

  // A CONDIÇÃO e o "DEPOIS" em texto. Derivados da config, para o card não
  // precisar (nem poder) reescrever as regras por conta própria.
  let qualifier: string | null;
  let afterText: string | null;
  if (slug === "semanal") {
    // Compra ÚNICA: não existe "depois" — sem renovação automática.
    qualifier = config.semanal.requiresNoPreviousPurchase
      ? "somente na primeira compra"
      : "por tempo limitado";
    afterText = null;
  } else if (slug === "mensal") {
    const n = config.mensal.chargesAtPromoPrice;
    qualifier = n === 1 ? "na 1ª cobrança" : `nas ${n} primeiras cobranças`;
    afterText = `Depois ${formatBRL(base)}/mês`;
  } else {
    const n = config.anual.yearsAtPromoPrice;
    qualifier = n === 1 ? "no primeiro ano" : `nos ${n} primeiros anos`;
    afterText = `Renovação por ${formatBRL(base)}/ano`;
  }

  return {
    basePriceCents: base,
    promoPriceCents: cfg.promoPriceCents,
    discountCents: base - cfg.promoPriceCents,
    discountPercent: Math.round(((base - cfg.promoPriceCents) / base) * 1000) / 10,
    label,
    qualifier,
    afterText,
    countdownEndsAt,
    countdownRunning,
    showPromo: true,
  };
}

/**
 * VALORES LEGÍTIMOS de cobrança de um plano (P21/P22).
 * ===================================================
 * Usado pelo WEBHOOK para decidir se o valor que o Asaas confirmou é aceitável.
 *
 * Por que não comparar com o preço de catálogo, e pronto: porque com a
 * pré-venda ligada o valor LEGÍTIMO deixa de ser o cheio. Recusar a cobrança
 * promocional faria o cliente PAGAR e não receber acesso — o pior desfecho
 * possível. Aceitar qualquer valor também não serve: liberaria acesso pagando
 * menos do que a promoção.
 *
 * A resposta é um CONJUNTO FECHADO: o preço cheio, mais o preço promocional do
 * plano QUANDO ele é de fato um desconto na configuração gravada pelo admin.
 * Qualquer valor fora desse conjunto é recusado.
 *
 * LIMITE CONHECIDO E ACEITO: na renovação de assinatura, o Asaas cobra o valor
 * que a própria assinatura carrega — e o webhook aceita enquanto o promocional
 * do plano estiver vigente, sem contar em qual cobrança o comprador está. Isso
 * pode cobrar o promocional por mais ciclos do que os `chargesAtPromoPrice`
 * previstos. É uma perda de receita no limite, NÃO uma brecha: o valor continua
 * vindo do Asaas (a partir da assinatura criada no checkout) e nunca de um
 * número escolhido pelo cliente. Preferimos isso a recusar um pagamento real.
 */
export function acceptableChargeAmounts(input: {
  slug: string;
  basePriceCents: number;
  config: PromoConfig;
  /** Instante da decisão. Necessário para o countdown vencer. */
  now?: string;
}): number[] {
  const base = isPositiveInt(input.basePriceCents)
    ? input.basePriceCents
    : BASE_PRICE_CENTS[input.slug] ?? 0;
  const allowed = new Set<number>();
  if (isPositiveInt(base)) allowed.add(base);

  // COUNTDOWN VENCIDO ENCERRA A PROMOÇÃO — mesma regra do checkout.
  // Sem esta linha o webhook aceitaria para sempre o valor promocional de uma
  // promoção que o checkout já não cobra: o conjunto de valores "legítimos"
  // ficaria maior do que o preço que o servidor realmente pratica. Vencido,
  // o único valor legítimo volta a ser o cheio.
  const countdownRunning = describeCountdown(
    input.config.countdown.endsAt,
    input.now ?? new Date().toISOString()
  ).running;
  const promoVigente =
    input.config.enabled &&
    !(input.config.countdown.active && !countdownRunning);

  // O preço promocional só entra no conjunto se a promoção estiver vigente e
  // configurada para aquele plano COMO DESCONTO. Um valor ≥ cheio não é
  // promoção e não amplia o que o webhook aceita.
  if (promoVigente) {
    const cfg =
      input.slug === "semanal"
        ? input.config.semanal
        : input.slug === "mensal"
          ? input.config.mensal
          : input.slug === "anual"
            ? input.config.anual
            : null;
    if (cfg && cfg.enabled && isPositiveInt(cfg.promoPriceCents) && cfg.promoPriceCents < base) {
      allowed.add(cfg.promoPriceCents);
    }
  }

  return Array.from(allowed).sort((a, b) => a - b);
}

/**
 * Texto do countdown em linguagem natural a partir de um instante real.
 * Devolve `null` quando não há prazo — e a UI simplesmente não mostra contador.
 * Nunca inventa data.
 */
export function describeCountdown(
  endsAt: string | null,
  now: string
): { running: boolean; text: string | null; days: number; hours: number; minutes: number; seconds: number } {
  if (!endsAt) {
    return { running: false, text: null, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const end = new Date(endsAt).getTime();
  const start = new Date(now).getTime();
  if (Number.isNaN(end) || Number.isNaN(start) || end <= start) {
    return { running: false, text: null, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const total = Math.floor((end - start) / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}min`);
  if (days === 0 && hours === 0 && minutes === 0) parts.push(`${seconds}s`);

  return { running: true, text: parts.join(" "), days, hours, minutes, seconds };
}
