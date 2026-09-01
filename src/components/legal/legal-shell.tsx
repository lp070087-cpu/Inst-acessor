import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/landing/sections-a";

/**
 * SHELL DAS PÁGINAS LEGAIS — server component, sem autenticação.
 * Usado por /privacidade, /termos e /data-deletion.
 * Reutiliza a identidade visual aprovada (legal.css + LogoMark).
 */

const FOOTER_LINKS = [
  { href: "/", label: "Início" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/data-deletion", label: "Exclusão de dados" },
];

export function LegalShell({
  eyebrow,
  title,
  subtitle,
  meta,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  meta?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-root">
      <header className="legal-topbar">
        <div className="legal-topbar-inner">
          <Link href="/" className="legal-brand" aria-label="Inst Acessor — início">
            <span className="legal-logo-mark" aria-hidden="true">
              <LogoMark />
            </span>
            <span>
              Inst <em>Acessor</em>
            </span>
          </Link>
          <nav className="legal-topbar-links" aria-label="Páginas legais">
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/data-deletion">Exclusão</Link>
            <Link href="/login" className="legal-topbar-cta">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <section className="legal-hero">
        <div className="legal-hero-inner">
          <span className="legal-eyebrow">{eyebrow}</span>
          <h1 className="legal-h1">{title}</h1>
          <p className="legal-sub">{subtitle}</p>
          {meta && <div className="legal-meta">{meta}</div>}
        </div>
      </section>

      <main className="legal-body">
        {updated && <div className="legal-updated">{updated}</div>}
        {children}
      </main>

      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <span className="legal-footer-brand">
            <span className="legal-logo-mark" aria-hidden="true">
              <LogoMark />
            </span>
            <span>
              Inst <em>Acessor</em>
            </span>
          </span>
          <nav className="legal-footer-links" aria-label="Links institucionais">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="legal-footer-note">
          <p>
            © {new Date().getFullYear()} Inst Acessor. Todos os direitos reservados.
            Inst Acessor é uma plataforma independente e não é afiliada ao Instagram,
            à Meta Platforms ou ao TikTok. As marcas citadas pertencem aos seus
            respectivos proprietários.
          </p>
        </div>
      </footer>
    </div>
  );
}
