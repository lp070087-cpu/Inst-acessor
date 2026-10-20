import Link from "next/link";
import type { ReactNode } from "react";

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="space-y-3 border-t border-border-soft pt-6">
    <h2 id={id} className="text-lg font-semibold text-ink sm:text-xl">{title}</h2>
    <div className="space-y-3 text-sm leading-7 text-ink-soft sm:text-base">{children}</div>
  </section>;
}

export function LegalPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const linkClass = "rounded px-1 py-2 text-sm font-semibold text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple";
  return <div className="min-h-screen bg-bg-ice text-ink">
    <a href="#conteudo-legal" className="sr-only rounded bg-surface p-3 text-purple focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">Ir para o conteúdo</a>
    <header className="border-b border-border-soft bg-surface">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link href="/" className="rounded text-xl font-bold text-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Inst Acessor</Link>
        <Link href="/" className={linkClass}>Voltar ao início</Link>
      </div>
    </header>
    <main id="conteudo-legal" className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <article className="min-w-0 space-y-7 rounded-3xl border border-border-soft bg-surface p-5 shadow-brand-lg sm:p-9 [overflow-wrap:anywhere]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple">Documentação de homologação · 19/10/2026</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="text-sm leading-7 text-ink-soft sm:text-base">{description}</p>
        </div>
        <aside aria-labelledby="status-documento" className="space-y-2 rounded-2xl border border-purple/20 bg-ai-soft p-4 text-sm leading-6">
          <h2 id="status-documento" className="font-semibold text-purple">Versão para validação, com pendências</h2>
          <p>O responsável legal e o canal oficial de atendimento ainda não foram definidos nesta versão. A revisão jurídica está pendente. Estes dados e os procedimentos operacionais devem ser completados antes da abertura ao público.</p>
          <p>Esta documentação descreve o comportamento previsto e os limites conhecidos; não comprova aprovação da Meta, integração externa validada ou disponibilidade comercial.</p>
        </aside>
        {children}
      </article>
      <nav aria-label="Documentos e informações sobre dados" className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/termos" className={linkClass}>Termos de uso</Link>
        <Link href="/privacidade" className={linkClass}>Privacidade</Link>
        <Link href="/data-deletion" className={linkClass}>Exclusão de dados</Link>
      </nav>
    </main>
  </div>;
}
