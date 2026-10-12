"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * BOUNDARY DE ERRO GLOBAL
 * =======================
 * Sem isto, qualquer exceção não tratada numa rota derrubava a árvore inteira
 * e o usuário via a tela de erro crua do Next (ou uma página em branco). Aqui
 * ele vê uma mensagem controlada, com a opção de tentar de novo.
 *
 * Nunca expomos a mensagem do erro na tela: `error.message` pode conter
 * detalhe interno (consulta, nome de campo, URL). Só registramos no console.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-bg px-4 py-20 flex items-center justify-center">
      <div className="w-full max-w-md text-center flex flex-col items-center gap-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle size={26} />
        </span>

        <h1 className="font-display text-[22px] font-bold text-ink leading-tight">
          Algo deu errado por aqui
        </h1>

        <p className="text-[14px] text-ink-soft leading-relaxed">
          A página não conseguiu carregar agora. Isso costuma ser temporário —
          tente de novo. Se continuar, volte para o início e refaça o caminho.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand-grad px-5 py-3 text-[14px] font-semibold text-white shadow-brand transition hover:opacity-95 cursor-pointer"
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-pill border border-border-soft bg-card px-5 py-3 text-[14px] font-semibold text-ink-soft transition hover:text-ink"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
