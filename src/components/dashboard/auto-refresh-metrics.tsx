"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Dispara a atualização automática das métricas do Instagram UMA vez por
 * abertura de tela, quando os dados estão velhos.
 *
 * Por que existe separado do botão: o botão é ação do usuário; isto é o
 * "manter atualizado" silencioso. O servidor decide se há o que fazer — este
 * componente só pergunta (`POST /api/integrations/instagram/auto-refresh`) e,
 * se o servidor sincronizou algo, recarrega os dados do servidor.
 *
 * Não renderiza nada. Nunca bloqueia a tela: os dados salvos aparecem primeiro;
 * a atualização acontece por baixo e reflete no `router.refresh()`.
 */
export function AutoRefreshMetrics({ connected }: { connected: boolean }) {
  const router = useRouter();
  // Guarda de sessão: garante UMA chamada por montagem, mesmo em StrictMode
  // (que roda efeitos duas vezes em dev) e em re-renders.
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (!connected || fired.current) return;
    fired.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/integrations/instagram/auto-refresh", {
          method: "POST",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { refreshed?: boolean };
        // Só recarrega se algo mudou no servidor — evita refresh inútil.
        if (!cancelled && data.refreshed) router.refresh();
      } catch {
        // Silencioso de propósito: a atualização automática nunca deve
        // incomodar o usuário com erro. O botão manual continua disponível.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, router]);

  return null;
}
