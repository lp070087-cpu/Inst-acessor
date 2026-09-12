import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assinar o Inst Acessor",
  description:
    "Escolha seu plano e finalize a assinatura com pagamento seguro via Asaas.",
};

/**
 * CHECKOUT PÚBLICO — shell visual compartilhado (/checkout e /checkout/retorno).
 * Fora dos route groups autenticados e FORA do matcher do middleware — ou seja,
 * páginas públicas. O comprador NÃO precisa ter conta para comprar.
 */
export default function CheckoutLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full opacity-50 blur-[80px]"
          style={{
            background:
              "radial-gradient(circle, rgba(244,63,142,.14), transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="absolute top-60 -left-44 w-[520px] h-[520px] rounded-full opacity-50 blur-[80px]"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,.13), transparent 65%)",
          }}
        />
      </div>

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-12">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-2.5 font-display text-[19px] font-bold tracking-tight"
        >
          <span className="grid w-10 h-10 place-items-center rounded-[12px] bg-brand-grad text-white shadow-brand">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 11l4-5 4 3 5-7 5 9" />
              <path d="M3 19h18" />
              <path d="M12 8l2 3 3 1" />
            </svg>
          </span>
          <span className="text-ink">
            Inst <em className="not-italic text-grad font-extrabold">Acessor</em>
          </span>
        </a>

        <div className="w-full max-w-[560px]">{children}</div>

        <p className="mt-8 text-center text-[12.5px] text-ink-muted">
          Pagamento processado com segurança pelo Asaas · ©{" "}
          {new Date().getFullYear()} Inst Acessor
        </p>
      </main>
    </div>
  );
}
