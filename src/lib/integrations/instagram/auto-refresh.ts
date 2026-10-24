import { prisma } from "@/lib/db";

import { syncInstagram, type SyncResult } from "./sync";

/**
 * ATUALIZAÇÃO AUTOMÁTICA CONTROLADA DAS MÉTRICAS DO INSTAGRAM
 * ==========================================================
 *
 * PROBLEMA QUE RESOLVE
 *   Antes, ver dados atualizados exigia clicar em "Atualizar métricas". A tela
 *   sempre mostrava o último snapshot salvo, mas ninguém atualizava sozinho.
 *
 * COMO FUNCIONA (e por que é seguro no Vercel Hobby)
 *   Em vez de um cron (que no Hobby roda no máximo 1×/dia e não dá para confiar
 *   no intervalo), a atualização é SOB DEMANDA COM TTL: quando o usuário abre a
 *   tela, verificamos a idade do último sync; se passou do TTL, disparamos UM
 *   sync e devolvemos. Os dados salvos aparecem na hora — a tela nunca espera
 *   a rede da Meta para renderizar.
 *
 * GARANTIAS
 *   • Nunca sincroniza a cada render: só quando o dado está velho (TTL).
 *   • Nunca dispara requisições duplicadas: há uma trava em memória por usuário,
 *     então N abas/re-renders concorrentes compartilham UMA chamada.
 *   • Não briga com o cooldown do sync manual (`COOLDOWN_MS` = 60s): o TTL é
 *     muito maior, então quando decidimos sincronizar o cooldown já expirou.
 *   • Não inventa métrica nenhuma — apenas chama o mesmo `syncInstagram` do
 *     botão manual e reporta o resultado real.
 */

/**
 * Intervalo-alvo entre atualizações automáticas (1 hora), respeitando os
 * limites da Meta. O TTL é o piso; a decisão real é "último sync < agora - TTL".
 */
export const AUTO_REFRESH_TTL_MS = 60 * 60 * 1000;

/**
 * Trava de concorrência em memória. Em serverless, cada instância tem a sua —
 * o suficiente para colapsar o caso comum de várias abas/renders na mesma
 * instância. Não é um lock distribuído: é uma proteção de bom senso contra
 * rajadas, não uma barreira transacional (não precisa ser).
 */
const inFlight = new Map<string, Promise<SyncResult>>();

export interface AutoRefreshOutcome {
  /** Algo foi sincronizado nesta chamada? */
  refreshed: boolean;
  /** Motivo quando NÃO sincronizou. */
  skipped?:
    | "not_connected"
    | "fresh"
    | "in_flight"
    | "cooldown"
    | "error";
  /** Resumo seguro do sync (sem token), quando houve sincronização. */
  summary?: SyncResult["summary"];
  /** Mensagem segura quando falhou. */
  error?: string;
}

/**
 * Sincroniza APENAS se o último sync bem-sucedido passou do TTL.
 *
 * @param now injetável para teste (evita depender do relógio real).
 */
export async function refreshInstagramIfStale(
  userId: string,
  now: number = Date.now()
): Promise<AutoRefreshOutcome> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
    select: { status: true, lastSyncAt: true },
  });

  if (!connection || connection.status !== "CONNECTED") {
    return { refreshed: false, skipped: "not_connected" };
  }

  const lastSyncAt = connection.lastSyncAt?.getTime() ?? 0;
  if (now - lastSyncAt < AUTO_REFRESH_TTL_MS) {
    // Dado recente o bastante — nada a fazer. É o caminho da maioria das visitas.
    return { refreshed: false, skipped: "fresh" };
  }

  // Já existe um sync em andamento para este usuário → compartilha o resultado.
  const existing = inFlight.get(userId);
  if (existing) {
    const result = await existing;
    return result.ok
      ? { refreshed: true, summary: result.summary }
      : { refreshed: false, skipped: "error", error: result.error };
  }

  const run = syncInstagram(userId);
  inFlight.set(userId, run);
  try {
    const result = await run;
    if (result.ok) return { refreshed: true, summary: result.summary };
    if (result.code === "cooldown") return { refreshed: false, skipped: "cooldown" };
    return { refreshed: false, skipped: "error", error: result.error };
  } finally {
    inFlight.delete(userId);
  }
}
