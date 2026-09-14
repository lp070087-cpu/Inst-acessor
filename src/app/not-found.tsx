import Link from "next/link";

/**
 * 404 GLOBAL do Inst Acessor.
 * ===========================
 * Usado por qualquer `notFound()` do App Router — inclusive pela rota
 * pública `/p/[slug]` quando o perfil não existe. Fica no root layout, então
 * NÃO depende de sessão: quem chega por um link público vê uma página
 * elegante e nunca um redirecionamento para o login.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh bg-bg px-4 py-20 flex items-center justify-center">
      <div className="w-full max-w-md text-center flex flex-col items-center gap-5">
        <span className="font-data text-[64px] leading-none font-bold text-transparent bg-clip-text bg-brand-grad">
          404
        </span>

        <h1 className="font-display text-[22px] font-bold text-ink leading-tight">
          Não encontramos esta página
        </h1>

        <p className="text-[14px] text-ink-soft leading-relaxed">
          O endereço pode estar incorreto, ter mudado de nome — ou o perfil
          público que você procura ainda não existe.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-pill bg-brand-grad px-5 py-3 text-[14px] font-semibold text-white shadow-brand transition hover:opacity-95"
          >
            Ir para a página inicial
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-pill border border-border-soft bg-card px-5 py-3 text-[14px] font-semibold text-ink-soft transition hover:text-ink"
          >
            Entrar na minha conta
          </Link>
        </div>
      </div>
    </main>
  );
}
