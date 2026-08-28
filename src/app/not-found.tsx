import Link from "next/link";
import { Home, Search } from "lucide-react";

/**
 * 404 global — cobre qualquer rota inexistente fora do group `(app)`.
 * Preserva a identidade visual (mesma paleta/tipografia aprovada).
 */
export default function GlobalNotFound() {
  return (
    <main className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-[22px] bg-surface border border-soft grid place-items-center mb-6">
          <Search size={26} strokeWidth={1.8} className="text-ink-muted" />
        </div>
        <h1 className="font-display text-[28px] font-bold text-ink">
          Página não encontrada
        </h1>
        <p className="text-[14px] text-ink-soft mt-2 max-w-sm">
          O endereço que você acessou não existe ou foi movido. Verifique o link
          ou volte para o início.
        </p>
        <div className="flex items-center gap-3 mt-7">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-purple text-white text-[13.5px] font-semibold px-5 py-2.5 hover:bg-indigo transition-colors"
          >
            <Home size={15} />
            Início
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-soft bg-white text-ink text-[13.5px] font-semibold px-5 py-2.5 hover:bg-surface transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
