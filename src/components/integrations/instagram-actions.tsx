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

interface InstagramActionsProps {
  connected: boolean;
  status: ConnectionStatus;
}

/**
 * Ações da página Redes Sociais.
 *
 * Conectado:
 *  - Atualizar conexão (trocar token)
 *  - Atualizar métricas
 *  - Trocar conta
 *  - Desconectar
 *
 * Não conectado:
 *  - Conectar Instagram
 *
 * Regra de produto: a interface mostra APENAS "Conectar Instagram".
 * A autenticação acontece por Instagram Business Login, do lado do servidor:
 * o usuário autoriza a própria conta profissional do Instagram, sem Página do
 * Facebook no caminho. Toda essa infraestrutura é interna e invisível.
 */
function InstagramActionsInner({ connected, status }: InstagramActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [busy, setBusy] = React.useState(false);

  const error = searchParams?.get("error");
  const connectedOk = searchParams?.get("connected") === "true";

  // Timeout de segurança (bug crítico): se `busy` ficou true mas a navegação
  // OAuth não completou em X segundos (ex.: a rota /connect não redirecionou),
  // libera o botão para nunca travar em "Conectando...".
  React.useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 10_000);
    return () => clearTimeout(t);
  }, [busy]);

  // Nunca mostra "Conectando..." quando a própria URL já carregou um erro.
  // (a conexão não está em andamento de verdade — só a mensagem de erro).
  const connecting = status === "CONNECTING" && !error;

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
    // Feedback imediato "Redirecionando..." antes da navegação OAuth
    // (a navegação pode levar alguns instantes no primeiro clique).
    setTimeout(() => {
      window.location.assign("/api/integrations/instagram/connect");
    }, 150);
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/instagram/disconnect", {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.refresh();
      } else {
        console.error("disconnect failed", data.error);
      }
    } catch {
      console.error("disconnect network error");
    } finally {
      setBusy(false);
    }
  }

  function handleReconnect() {
    setBusy(true);
    setTimeout(() => {
      window.location.assign("/api/integrations/instagram/connect");
    }, 150);
  }

  async function handleRefreshMetrics() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/instagram/refresh", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.refresh();
      } else {
        console.error("refresh metrics failed", data.error);
      }
    } catch {
      console.error("refresh metrics network error");
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
            ) : busy ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                <Link2 size={16} />
                Conectar Instagram
              </>
            )}
          </Button>
          {connectedOk && (
            <p className="inline-flex items-center gap-1.5 text-[13px] text-success font-medium">
              <CheckCircle2 size={15} />
              Instagram conectado com sucesso!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Wrapper público com Suspense (requerido por useSearchParams no build estático). */
export function InstagramActions(props: InstagramActionsProps) {
  return (
    <Suspense fallback={null}>
      <InstagramActionsInner {...props} />
    </Suspense>
  );
}

function getErrorMessage(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "denied":
      return "Você não autorizou a conexão com o Instagram. Nenhuma conta foi conectada.";
    case "missing_code":
      return "A Meta não retornou o código de autorização. Tente novamente.";
    case "invalid_state":
      return "Sessão de conexão inválida ou expirada. Inicie a conexão novamente.";
    case "state_expired":
      return "A sessão de conexão expirou. Inicie novamente.";
    case "token_exchange":
      return "Não foi possível obter o acesso ao Instagram. Tente novamente.";
    case "account_fetch":
      return "Não foi possível carregar os dados da sua conta do Instagram.";
    case "not_compatible":
      return "Esta conta não é um perfil profissional (Business/Creator) do Instagram. Use uma conta compatível.";
    case "config":
      return "A conexão com o Instagram ainda não está configurada. Tente novamente mais tarde.";
    case "server":
    case "unknown":
    default:
      return "Não foi possível concluir a conexão. Tente novamente.";
  }
}
