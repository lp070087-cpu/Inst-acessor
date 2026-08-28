"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";

/**
 * Error boundary do app — nunca exibe stack trace/erro técnico ao usuário.
 * Oferece tentar novamente e voltar ao Dashboard (preserva identidade visual).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log apenas no servidor/console com contexto sanitizado (sem tokens/secrets).
    console.error("[app/error]", error.message ?? "erro desconhecido");
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-16 h-16 rounded-[22px] bg-danger-soft border border-danger/20 grid place-items-center mb-6">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-danger"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="font-display text-[28px] font-bold text-ink">
        Algo deu errado
      </h1>
      <p className="text-[14px] text-ink-soft mt-2 max-w-sm">
        Ocorreu um erro inesperado ao carregar esta página. Tente novamente ou
        volte para o seu painel.
      </p>
      <div className="flex items-center gap-3 mt-7">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-purple text-white text-[13.5px] font-semibold px-5 py-2.5 hover:bg-indigo transition-colors cursor-pointer"
        >
          <RefreshCw size={15} />
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-soft bg-white text-ink text-[13.5px] font-semibold px-5 py-2.5 hover:bg-surface transition-colors"
        >
          <Home size={15} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
