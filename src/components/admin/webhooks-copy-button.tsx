"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";

/**
 * Botão "Copiar URL" — copia a URL do webhook para a área de transferência.
 * Componente client (navigator.clipboard não existe no servidor).
 */
export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso (clipboard bloqueado).
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        "inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors " +
        (copied
          ? "border-success/30 bg-success/10 text-success"
          : "border-border-soft bg-surface text-ink-soft hover:border-purple/40 hover:text-purple")
      }
      aria-label="Copiar URL do webhook"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado" : "Copiar URL"}
    </button>
  );
}
