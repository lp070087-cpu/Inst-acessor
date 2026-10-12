"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SyncMetricsButtonProps {
  connected: boolean;
  /** Plataforma cujas métricas serão atualizadas. */
  platform?: "instagram" | "tiktok";
  /** ISO string da última sincronização (exibida ao lado do botão). */
  lastSyncAt?: string | null;
}

/**
 * Botão "Atualizar métricas" do Dashboard.
 * - Chama POST /api/integrations/{platform}/sync
 * - Estados: idle → loading → success | error | cooldown
 * - Após sucesso/erro, revalida a página (server component) via router.refresh()
 */
export function SyncMetricsButton({
  connected,
  platform = "instagram",
  lastSyncAt,
}: SyncMetricsButtonProps) {
  const router = useRouter();

  const [state, setState] = React.useState<
    "idle" | "loading" | "success" | "error" | "cooldown"
  >("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  if (!connected) return null;

  async function handleSync() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/integrations/${platform}/sync`, { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };

      if (data.ok) {
        setState("success");
        setMessage("Métricas atualizadas com sucesso.");
      } else if (data.code === "cooldown") {
        setState("cooldown");
        setMessage(data.error ?? "Sincronização recente. Aguarde um instante.");
      } else {
        setState("error");
        setMessage(data.error ?? "Não foi possível atualizar as métricas.");
      }
    } catch {
      setState("error");
      setMessage("Falha de rede. Tente novamente.");
    } finally {
      // Recarrega os dados do server component após o resultado.
      setTimeout(() => router.refresh(), state === "success" ? 600 : 900);
    }
  }

  // Rodapé do card da conta: botão à esquerda, último sync à direita. Mensagens
  // de estado ocupam a linha de baixo para não empurrar o botão.
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          onClick={handleSync}
          disabled={state === "loading"}
          size="sm"
          variant="ghost"
        >
          {state === "loading" ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Atualizar métricas
        </Button>

        {lastSyncAt && state === "idle" && (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
            <Clock size={13} className="flex-none" />
            Última sincronização:{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(lastSyncAt))}
          </p>
        )}
      </div>

      {state === "success" && message && (
        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-success font-medium">
          <CheckCircle2 size={14} className="flex-none" />
          {message}
        </p>
      )}
      {state === "cooldown" && message && (
        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-warn font-medium">
          <Clock size={14} className="flex-none" />
          {message}
        </p>
      )}
      {state === "error" && message && (
        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-danger font-medium">
          <AlertTriangle size={14} className="flex-none" />
          {message}
        </p>
      )}
    </div>
  );
}
