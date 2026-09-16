/**
 * STATUS EFETIVO DA CONEXÃO
 * =========================
 * Um `CONNECTING` SEM fluxo OAuth ativo e válido é resquício de um fluxo
 * interrompido — cenário real: a Meta exibe o erro dentro do `instagram.com`
 * e nunca chama o nosso callback, então o status fica preso em CONNECTING.
 * Nesse caso o estado real é DISCONNECTED (senão a interface trava em
 * "Conectando..." para sempre).
 *
 * Fonte ÚNICA: usada por /redes-sociais e /configuracoes, para que as duas
 * telas nunca discordem sobre o estado da conexão. Extraído da lógica que já
 * existia em /redes-sociais (Bloco do bug "Conectar preso") — mesmo
 * comportamento, agora compartilhado.
 */

export type EffectiveConnectionStatus =
  | "CONNECTED"
  | "CONNECTING"
  | "DISCONNECTED"
  | "ERROR";

export function effectiveConnectionStatus(
  status: string | null | undefined,
  hasActiveFlow: boolean
): EffectiveConnectionStatus {
  if (status === "CONNECTING" && !hasActiveFlow) return "DISCONNECTED";
  return (status ?? "DISCONNECTED") as EffectiveConnectionStatus;
}
