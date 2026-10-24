"use client";

import * as React from "react";

/**
 * ERRO NO PRÓPRIO LAYOUT RAIZ
 * ===========================
 * `global-error.tsx` só é acionado quando a falha acontece ACIMA dos layouts
 * normais — inclusive no `<html>`/`<body>` do root layout. Por isso ele
 * precisa renderizar a própria estrutura de documento e NÃO pode depender de
 * nenhum provider (tema, toast) nem de CSS do app garantido.
 *
 * Estilos são inline de propósito: se o layout raiz falhou, as classes do
 * Tailwind podem não ter carregado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F8FA",
          color: "#111318",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>
            Não foi possível carregar o Inst Acessor
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#667085", margin: "0 0 20px" }}>
            Tente recarregar a página. Se o problema continuar, aguarde alguns
            instantes antes de tentar novamente.
          </p>
          <button
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "12px 22px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "linear-gradient(90deg, #F43F8E 0%, #8B5CF6 50%, #4F46E5 100%)",
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
