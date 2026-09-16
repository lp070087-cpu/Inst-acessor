/**
 * FRESCOR DOS DADOS
 * =================
 * Traduz `SocialConnection.lastSyncAt` em texto para a interface.
 *
 * `lastSyncAt` é gravado SOMENTE por uma sincronização real de dados (o Bloco 1
 * removeu a escrita no OAuth e na renovação de token). Portanto:
 *
 *   null          → nunca sincronizou. Não é "agora" nem "0".
 *   agora         → "Atualizado agora"
 *   X min/horas   → "Atualizado há X"
 *   > limite      → "Dados desatualizados" (o último valor real CONTINUA
 *                   exibido — dado velho é melhor que dado apagado).
 */

/** A partir de quanto tempo sem sincronizar os dados passam a ser "antigos". */
export const STALE_AFTER_HOURS = 24;

export interface SyncFreshness {
  /** Texto principal, pronto para exibição. */
  label: string;
  /** Texto secundário opcional (data absoluta). */
  detail: string | null;
  /** true quando passou do limite — a UI pode sinalizar sem apagar o valor. */
  stale: boolean;
  /** true quando existe uma sincronização registrada. */
  known: boolean;
}

export function describeSync(lastSyncAt: Date | string | null | undefined): SyncFreshness {
  if (!lastSyncAt) {
    return {
      label: "Ainda não sincronizado",
      detail: null,
      stale: false,
      known: false,
    };
  }

  const date = lastSyncAt instanceof Date ? lastSyncAt : new Date(lastSyncAt);
  if (Number.isNaN(date.getTime())) {
    return { label: "Ainda não sincronizado", detail: null, stale: false, known: false };
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  const stale = hours >= STALE_AFTER_HOURS;

  let label: string;
  if (minutes < 1) label = "Atualizado agora";
  else if (minutes < 60) label = `Atualizado há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  else if (hours < 24) label = `Atualizado há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  else if (days === 1) label = "Atualizado ontem";
  else label = `Atualizado há ${days} dias`;

  return {
    label,
    detail: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    stale,
    known: true,
  };
}
