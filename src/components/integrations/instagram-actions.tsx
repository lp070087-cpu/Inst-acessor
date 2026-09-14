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
  /**
   * Quando o fluxo OAuth foi iniciado (updatedAt da conexão em CONNECTING).
   * Usado APENAS para liberar o botão quando a Meta não devolve o usuário ao
   * nosso callback (ex.: erro exibido dentro do instagram.com). Sem isso, o
   * `state` válido por 10 min manteria o botão preso em "Conectando...".
   */
  connectingSince?: string | null;
}

/**
 * Tempo máximo que o botão aceita ficar em "Conectando..." sem o usuário voltar.
 * Alinhado à validade do `state` (10 min) — depois disso o fluxo é considerado
 * abandonado e o usuário pode tentar de novo.
 */
const FLOW_STALE_MS = 10 * 60 * 1000;

/**
 * Tempo máximo do estado LOCAL de "Redirecionando...".
 * Se a navegação OAuth não acontecer em 12s (rota /connect lenta, rede ruim,
 * bloqueio do navegador), o botão volta ao normal sozinho. Sem isso o spinner
 * local ficava girando para sempre — o bug relatado.
 */
const REDIRECT_GUARD_MS = 12_000;

/**
 * Tempo máximo de uma chamada de rede interna (disconnect/refresh).
 * Sem isso, um fetch pendurado deixaria o botão desabilitado indefinidamente,
 * inclusive depois de o usuário sair e voltar para a página.
 */
const FETCH_TIMEOUT_MS = 15_000;

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
function InstagramActionsInner({
  connected,
  status,
  connectingSince,
}: InstagramActionsProps) {
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
    const t = setTimeout(() => setBusy(false), REDIRECT_GUARD_MS);
    return () => clearTimeout(t);
  }, [busy]);

  // Volta do Instagram via cache de navegação (bfcache): o navegador pode
  // restaurar a página exatamente como estava — com o spinner ligado —sem
  // remontar o componente. Aqui o estado local é zerado e os dados são
  // recalculados a partir do servidor.
  React.useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      setBusy(false);
      router.refresh();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  // Escape por tempo para o fluxo abandonado.
  //
  // Cenário real: a Meta exibe o erro DENTRO do instagram.com
  // (`/oauth/authorize/third_party/error/`) e NUNCA chama nosso callback.
  // Nesse caso o `state` continua não-consumido e válido por 10 min, então
  // /redes-sociais segue reportando CONNECTING e o botão fica preso.
  // Enquanto isso não expirar, o usuário não tem como tentar outra conta.
  const [now, setNow] = React.useState(() => Date.now());

  const startedAt = connectingSince ? Date.parse(connectingSince) : NaN;
  const flowStale =
    status === "CONNECTING" &&
    (!Number.isFinite(startedAt) || now - startedAt > FLOW_STALE_MS);

  // Só agenda o relógio quando de fato há um fluxo em andamento — evita
  // re-render desnecessário no estado normal (conectado/desconectado).
  React.useEffect(() => {
    if (status !== "CONNECTING") return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [status]);

  // Nunca mostra "Conectando..." quando a própria URL já carregou um erro
  // (a conexão não está em andamento de verdade — só a mensagem de erro)
  // nem quando o fluxo já passou do prazo sem o usuário retornar.
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
    // Feedback imediato "Redirecionando..." antes da navegação OAuth
    // (a navegação pode levar alguns instantes no primeiro clique).
    setTimeout(() => {
      window.location.assign("/api/integrations/instagram/connect");
    }, 150);
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const res = await fetchWithTimeout("/api/integrations/instagram/disconnect", {
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
      // Sempre libera o botão — sucesso, erro, timeout ou exceção.
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
      const res = await fetchWithTimeout("/api/integrations/instagram/refresh", {
        method: "POST",
      });
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
          {flowAbandoned && (
            <p className="inline-flex items-start gap-1.5 text-[13px] text-ink-soft">
              <AlertTriangle size={15} className="text-warn flex-none mt-0.5" />
              <span>
                A conexão anterior não foi concluída. Verifique se sua conta do
                Instagram é Profissional (Business ou Creator) e tente novamente.
              </span>
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

/**
 * `fetch` com prazo máximo. Uma requisição pendurada nunca mais deixa o botão
 * desabilitado: ao estourar o tempo, o AbortController cancela e o `finally`
 * do chamador libera o estado local.
 *
 * Só é usado em rotas internas do próprio app (disconnect/refresh) — o fluxo
 * OAuth do Instagram não passa por aqui.
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
      // Não reaproveitar resposta do cache HTTP do navegador: um GET
      // cacheado resolvia na hora e o loading "sumia" sem refletir o
      // estado real que o servidor acabou de gravar.
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
      return "Você cancelou a autorização. Nenhuma conta foi conectada.";
    case "permission":
      return "Esta conta ainda não possui autorização para conectar ao aplicativo. Verifique se sua conta do Instagram é Profissional (Business ou Creator) e tente novamente.";
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
