"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Link2,
  RefreshCw,
  BarChart3,
  Repeat,
  Unplug,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR";

interface TikTokActionsProps {
  connected: boolean;
  status: ConnectionStatus;
}

/**
 * Ações da página Redes Sociais para o TikTok.
 *
 * Conectado:
 *  - Atualizar conexão (trocar token)
 *  - Atualizar métricas
 *  - Trocar conta
 *  - Desconectar
 *
 * Não conectado:
 *  - Conectar TikTok
 */
function TikTokActionsInner({ connected, status }: TikTokActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [busy, setBusy] = React.useState(false);

  const error = searchParams?.get("error");
  const connectedOk = searchParams?.get("connected") === "true";

  const connecting = status === "CONNECTING";

  React.useEffect(() => {
    // Feedback de sucesso/erro vindo do callback (query params controlados).
    if (connectedOk) {
      const t = setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("connected");
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [connectedOk]);

  function handleConnect() {
    setBusy(true);
    window.location.assign("/api/integrations/tiktok/connect");
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/tiktok/disconnect", {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.refresh();
      } else {
        console.error("tiktok disconnect failed", data.error);
      }
    } catch {
      console.error("tiktok disconnect network error");
    } finally {
      setBusy(false);
    }
  }

  function handleReconnect() {
    setBusy(true);
    window.location.assign("/api/integrations/tiktok/connect");
  }

  async function handleRefreshMetrics() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/tiktok/refresh", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.refresh();
      } else {
        console.error("tiktok refresh failed", data.error);
      }
    } catch {
      console.error("tiktok refresh network error");
    } finally {
      setBusy(false);
    }
  }

  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex flex-col gap-3">
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-softMid px-4 py-3">
          <AlertTriangle size={17} className="text-danger flex-none mt-0.5" />
          <p className="text-[13px] text-ink">{errorMessage}</p>
        </div>
      )}

      {connected ? (
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={handleReconnect} disabled={busy || connecting} size="sm">
            <RefreshCw size={15} />
            Atualizar conexão
          </Button>
          <Button
            onClick={handleRefreshMetrics}
            disabled={busy}
            size="sm"
            variant="ghost"
          >
            <BarChart3 size={15} />
            Atualizar métricas
          </Button>
          <Button onClick={handleReconnect} disabled={busy} size="sm" variant="ghost">
            <Repeat size={15} />
            Trocar conta
          </Button>
          <Button
            onClick={handleDisconnect}
            disabled={busy}
            size="sm"
            variant="danger"
          >
            <Unplug size={15} />
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button onClick={handleConnect} disabled={busy || connecting} size="md">
            {connecting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Link2 size={16} />
                Conectar TikTok
              </>
            )}
          </Button>
          {connectedOk && (
            <p className="inline-flex items-center gap-1.5 text-[13px] text-success font-medium">
              <CheckCircle2 size={15} />
              TikTok conectado com sucesso!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Wrapper público com Suspense (requerido por useSearchParams no build estático). */
export function TikTokActions(props: TikTokActionsProps) {
  return (
    <Suspense fallback={null}>
      <TikTokActionsInner {...props} />
    </Suspense>
  );
}

function getErrorMessage(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "denied":
      return "Você não autorizou a conexão com o TikTok. Nenhuma conta foi conectada.";
    case "missing_code":
      return "O TikTok não retornou o código de autorização. Tente novamente.";
    case "invalid_state":
      return "Sessão de conexão inválida ou expirada. Inicie a conexão novamente.";
    case "state_expired":
      return "A sessão de conexão expirou. Inicie novamente.";
    case "token_exchange":
      return "Não foi possível obter o acesso ao TikTok. Tente novamente.";
    case "config":
      return "A conexão com o TikTok ainda não está configurada. Tente novamente mais tarde.";
    case "server":
    case "unknown":
    default:
      return "Não foi possível concluir a conexão. Tente novamente.";
  }
}
