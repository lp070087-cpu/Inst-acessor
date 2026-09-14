"use client";

import * as React from "react";
import {
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  Monitor,
  Smartphone,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * INSTALAR O INST ACESSOR (PWA)
 * ==============================
 * Bloco discreto em Configurações. NUNCA aparece como popup invasivo, nunca
 * abre sozinho, nunca cobre a tela — o usuário decide se quer instalar.
 *
 * Como cada plataforma se comporta:
 *
 *   • Android / Chrome / Edge / desktop Chromium
 *       O navegador dispara `beforeinstallprompt`. Guardamos o evento e só
 *       então mostramos o botão "Instalar Inst Acessor". O clique chama
 *       `prompt()` — a janela nativa do navegador, não a nossa.
 *
 *   • iOS / iPadOS (Safari)
 *       NÃO existe instalação programática. A Apple exige o caminho manual,
 *       então mostramos a instrução curta: Compartilhar → Adicionar à Tela
 *       de Início. É a única forma suportada e é o que faz a instalação
 *       funcionar de verdade no iPhone/iPad.
 *
 *   • Desktop (Windows/macOS/Linux)
 *       A mesma API de instalação vale para navegadores Chromium no desktop.
 *       Quando o navegador não oferece, mostramos apenas a instrução de
 *       "instalar pelo menu do navegador" — sem botão morto.
 *
 *   • Já instalado (rodando em modo standalone)
 *       Mostramos apenas a confirmação. Não há o que instalar.
 *
 * Nada aqui força, persiste ou interrompe: é informação + uma ação opcional.
 */

/** Evento não padronizado do Chromium — tipado aqui de propósito. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "checking" | "installed" | "prompt" | "ios" | "manual" | "unsupported";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  // `navigator.standalone` é o sinal do iOS.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return mq || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se apresenta como Mac com toque.
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  return iOSDevice;
}

export function InstallAppCard() {
  const [mode, setMode] = React.useState<Mode>("checking");
  const promptRef = React.useRef<BeforeInstallPromptEvent | null>(null);

  React.useEffect(() => {
    // Já rodando como app instalado → nada a fazer.
    if (isStandalone()) {
      setMode("installed");
      return;
    }

    // iOS: não há `beforeinstallprompt`; o caminho é sempre manual.
    if (isIos()) {
      setMode("ios");
      return;
    }

    let settled = false;

    const onBeforeInstallPrompt = (e: Event) => {
      // Guarda o evento para disparar depois, no clique — sem abrir nada
      // automaticamente (é proibido exibir prompt sem gesto do usuário).
      e.preventDefault();
      settled = true;
      promptRef.current = e as BeforeInstallPromptEvent;
      setMode("prompt");
    };

    const onInstalled = () => {
      promptRef.current = null;
      setMode("installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Se o navegador não disparar o evento em pouco tempo, caímos no modo
    // manual (instrução pelo menu do navegador) em vez de deixar um botão
    // morto na tela.
    const fallback = setTimeout(() => {
      if (!settled) setMode("manual");
    }, 1200);

    return () => {
      clearTimeout(fallback);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const [busy, setBusy] = React.useState(false);

  async function handleInstall() {
    const evt = promptRef.current;
    if (!evt) return;
    setBusy(true);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") {
        setMode("installed");
      }
    } catch {
      // Sem alarde: o usuário pode tentar de novo pelo menu do navegador.
    } finally {
      setBusy(false);
      promptRef.current = null;
    }
  }

  return (
    <section className="rounded-lg border border-border-soft bg-card shadow-xs p-6 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <span className="w-12 h-12 rounded-[14px] bg-ai-soft text-purple grid place-items-center flex-none">
          <Download size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold text-ink">
            Aplicativo
          </h2>
          <p className="text-[13px] text-ink-soft mt-1">
            Instale o Inst Acessor no seu computador ou celular para abrir em um
            clique, em tela cheia, como um aplicativo.
          </p>
        </div>
      </div>

      {/* ---------- já instalado ---------- */}
      {mode === "installed" && (
        <p className="inline-flex items-center gap-2 text-[13px] font-medium text-success">
          <CheckCircle2 size={16} className="flex-none" />
          Você já está usando o Inst Acessor instalado.
        </p>
      )}

      {/* ---------- Android / Chrome / Edge / desktop Chromium ---------- */}
      {mode === "prompt" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleInstall} disabled={busy} size="md">
            <Download size={16} />
            {busy ? "Abrindo..." : "Instalar Inst Acessor"}
          </Button>
          <span className="text-[12.5px] text-ink-muted">
            O navegador vai pedir uma confirmação.
          </span>
        </div>
      )}

      {/* ---------- iOS / iPadOS ---------- */}
      {mode === "ios" && (
        <div className="rounded-md border border-border-soft bg-surface/50 px-4 py-3.5 flex flex-col gap-2">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Smartphone size={15} className="text-purple flex-none" />
            Instalar no iPhone ou iPad
          </p>
          <ol className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
            <li className="inline-flex items-start gap-2">
              <Share size={14} className="text-purple flex-none mt-0.5" />
              <span>
                Toque em <strong className="font-semibold text-ink">Compartilhar</strong> no
                Safari.
              </span>
            </li>
            <li className="inline-flex items-start gap-2">
              <PlusSquare size={14} className="text-purple flex-none mt-0.5" />
              <span>
                Escolha{" "}
                <strong className="font-semibold text-ink">
                  Adicionar à Tela de Início
                </strong>{" "}
                e confirme.
              </span>
            </li>
          </ol>
          <p className="text-[12px] text-ink-muted">
            O Safari é o único navegador do iOS que permite instalar. Uso pelo
            Chrome no iPhone não oferece essa opção.
          </p>
        </div>
      )}

      {/* ---------- desktop / navegador sem evento ---------- */}
      {mode === "manual" && (
        <div className="rounded-md border border-border-soft bg-surface/50 px-4 py-3.5 flex items-start gap-2.5">
          <Monitor size={16} className="text-purple flex-none mt-0.5" />
          <p className="text-[13px] text-ink-soft leading-relaxed">
            Neste navegador a instalação é feita pelo próprio menu: procure o
            ícone de{" "}
            <strong className="font-semibold text-ink">instalar aplicativo</strong>{" "}
            na barra de endereços, ou abra o menu do navegador e escolha{" "}
            <strong className="font-semibold text-ink">
              Instalar Inst Acessor
            </strong>
            . No Chrome e no Edge costuma aparecer um ícone de monitor com uma
            seta dentro.
          </p>
        </div>
      )}

      {mode === "checking" && (
        <p className="text-[12.5px] text-ink-muted">Verificando disponibilidade…</p>
      )}

      <div className="flex items-start gap-2.5 text-[12.5px] text-ink-muted">
        <Info size={15} className="flex-none mt-0.5" />
        <p>
          O aplicativo instalado é o mesmo Inst Acessor que você já usa — não é
          uma versão separada e não guarda dados no seu aparelho.
        </p>
      </div>
    </section>
  );
}
