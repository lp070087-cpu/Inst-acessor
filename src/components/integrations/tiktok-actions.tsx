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
  /**
   * Quando o fluxo OAuth foi iniciado (updatedAt da conexão em CONNECTING).
   * Usado APENAS para liberar o botão quando o TikTok não devolve o usuário ao
   * nosso callback (ex.: erro/exigência exibidos dentro do próprio TikTok).
   */
  connectingSince?: string | null;
}

/**
 * Tempo máximo que o botão aceita ficar em "Conectando..." sem o usuário
 * voltar. Alinhado à validade do `state` (10 min) — depois disso o fluxo é
 * considerado abandonado e o usuário pode tentar de novo.
 */
const FLOW_STALE_MS = 10 * 60 * 1000;

/**
 * Tempo máximo do estado LOCAL de "Redirecionando...". Se a navegação OAuth
 * não acontecer em 12s, o botão volta ao normal sozinho — é o que impede o
 * spinner infinito relatado.
 */
const REDIRECT_GUARD_MS = 12_000;

/** Prazo máximo de uma chamada interna (disconnect/refresh). */
const FETCH_TIMEOUT_MS = 15_000;

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
function TikTokActionsInner({
  connected,
  status,
  connectingSince,
}: TikTokActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [busy, setBusy] = React.useState(false);

  const error = searchParams?.get("error");
  const connectedOk = searchParams?.get("connected") === "true";

  // Timeout de segurança do estado LOCAL: se o clique não virar navegação
  // OAuth (rota lenta, rede ruim, bloqueio), o botão volta ao normal.
  React.useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), REDIRECT_GUARD_MS);
    return () => clearTimeout(t);
  }, [busy]);

  // Volta do TikTok via bfcache: o navegador restaura a página como estava
  // (spinner ligado) sem remontar o componente. Zera o estado local e
  // recalcula tudo a partir do servidor.
  React.useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      setBusy(false);
      router.refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  // Escape por tempo para fluxo abandonado — mesmo tratamento do Instagram.
  const [now, setNow] = React.useState(() => Date.now());
  const startedAt = connectingSince ? Date.parse(connectingSince) : NaN;
  const flowStale =
    status === "CONNECTING" &&
    (!Number.isFinite(startedAt) || now - startedAt > FLOW_STALE_MS);

  React.useEffect(() => {
    if (status !== "CONNECTING") return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [status]);

  const connecting = status === "CONNECTING" && !error && !flowStale;
  const flowAbandoned = status === "CONNECTING" && flowStale && !error;

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
    // Mesmo feedback imediato do Instagram: "Redirecionando..." antes da
    // navegação OAuth (o primeiro clique pode levar alguns instantes).
    setTimeout(() => {
      window.location.assign("/api/integrations/tiktok/connect");
    }, 150);
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const res = await fetchWithTimeout("/api/integrations/tiktok/disconnect", {
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
      const res = await fetchWithTimeout("/api/integrations/tiktok/refresh", { method: "POST" });
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
            ) : busy ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Redirecionando...
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
          {flowAbandoned && (
            <p className="inline-flex items-start gap-1.5 text-[13px] text-ink-soft">
              <AlertTriangle size={15} className="text-warn flex-none mt-0.5" />
              <span>
                A conexão anterior não foi concluída. Volte aqui e tente
                novamente para autorizar o acesso.
              </span>
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

/**
 * `fetch` com prazo máximo — sem ele, uma requisição pendurada deixaria o
 * botão desabilitado indefinidamente. Ao estourar, o AbortController cancela e
 * o `finally` do chamador libera o estado local. Não toca no fluxo OAuth.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  ms: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      // Sem cache HTTP: uma resposta cacheada resolvia instantaneamente
      // e o estado exibido não refletia o que o servidor acabou de gravar.
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
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
