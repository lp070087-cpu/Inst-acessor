import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Página inicial pública.
 * Redireciona para o app ou apresenta a porta de entrada.
 * A apresentação comercial aprovada permanece intacta em
 * `apresentacao/index.html` — esta rota é o ponto de entrada do SaaS.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg">
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

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 sm:px-10 h-16 max-w-[1180px] mx-auto w-full">
          <Link href="/" aria-label="Inst Acessor — início">
            <span className="inline-flex items-center gap-2.5 font-display text-[19px] font-bold tracking-tight">
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
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13.5px] font-semibold text-ink-soft hover:text-ink transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-1.5 rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white text-[13.5px] font-semibold px-5 py-2.5 shadow-brand transition-all duration-300 hover:shadow-brand-lg hover:-translate-y-0.5 hover:bg-[position:100%_100%]"
            >
              Criar conta
            </Link>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-[640px] text-center">
            <span className="inline-flex items-center gap-2 rounded-pill bg-ai-soft border border-purple/20 text-purple text-[12px] font-semibold px-3.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-grad" />
              Inteligência para o seu Instagram
            </span>
            <h1 className="mt-6 font-display text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink">
              Seu Instagram com <span className="text-grad">estratégia</span>,
              não no chute.
            </h1>
            <p className="mt-5 text-[clamp(15px,1.6vw,18px)] text-ink-soft leading-relaxed">
              O Inst Acessor analisa seu perfil, acompanha sua evolução e
              transforma métricas em planos práticos de crescimento.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/cadastro"
                className="inline-flex items-center gap-2 rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white text-[15px] font-semibold px-7 py-3.5 shadow-brand transition-all duration-300 hover:shadow-brand-lg hover:-translate-y-0.5 hover:bg-[position:100%_100%]"
              >
                Começar agora
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-pill bg-card text-ink text-[15px] font-semibold px-7 py-3.5 border border-border shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
              >
                Já tenho conta
              </Link>
            </div>
            <p className="mt-8 text-[12.5px] text-ink-muted">
              Fase 1 — Fundação. A integração com o Instagram será liberada em
              breve.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
