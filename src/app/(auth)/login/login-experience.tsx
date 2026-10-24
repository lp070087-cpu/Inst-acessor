import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, CalendarCheck2, ShieldCheck, Sparkles } from "lucide-react";

import "./login.css";

/**
 * MOLDURA DA TELA DE LOGIN.
 *
 * Versão clara alinhada à identidade da landing aprovada (branco, magenta,
 * roxo e azul; Sora nos títulos e Plus Jakarta no corpo). Substitui o palco
 * escuro com círculos, rejeitado pelo proprietário.
 *
 * Desktop: painel de marca à esquerda (proposta + prévia ilustrativa do
 * produto) e o formulário à direita. Celular: só a marca e o formulário.
 * Todas as animações são CSS e respeitam `prefers-reduced-motion`.
 */
const BARS = [38, 52, 46, 64, 58, 76, 88];

export function LoginExperience({ children }: { children: ReactNode }) {
  return (
    <div className="lgn-root">
      <aside className="lgn-aside" aria-hidden="true">
        <div className="lgn-aside-inner">
          <span className="lgn-eyebrow">Inteligência para o seu Instagram</span>
          <p className="lgn-aside-title">
            Seu crescimento, <span className="lgn-grad">guiado por dados.</span>
          </p>
          <ul className="lgn-points">
            <li>
              <BarChart3 size={18} strokeWidth={2} /> Métricas reais do perfil em um só painel
            </li>
            <li>
              <CalendarCheck2 size={18} strokeWidth={2} /> Calendário e publicação com confirmação
            </li>
            <li>
              <Sparkles size={18} strokeWidth={2} /> IA que sugere o próximo passo
            </li>
          </ul>

          <div className="lgn-preview">
            <div className="lgn-preview-head">
              <span className="lgn-preview-label">Score do perfil</span>
              <span className="lgn-preview-tag">Exemplo ilustrativo</span>
            </div>
            <div className="lgn-preview-body">
              <div className="lgn-ring" style={{ ["--lgn-score" as string]: 82 }}>
                <span>82</span>
              </div>
              <div className="lgn-bars">
                {BARS.map((height, index) => (
                  <span
                    key={index}
                    style={{ height: `${height}%`, animationDelay: `${0.35 + index * 0.07}s` }}
                  />
                ))}
              </div>
            </div>
            <div className="lgn-preview-foot">
              <span className="lgn-chip lgn-chip-up">+18% alcance</span>
              <span className="lgn-chip">Melhor horário 19h</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="lgn-main">
        <Link href="/" className="lgn-brand" aria-label="Inst Acessor — página inicial">
          <span className="lgn-brand-badge" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l4-5 4 3 5-7 5 9" />
              <path d="M3 19h18" />
              <path d="M12 8l2 3 3 1" />
            </svg>
          </span>
          <span className="lgn-brand-name">
            Inst <em>Acessor</em>
          </span>
        </Link>

        <section className="lgn-card">{children}</section>

        <p className="lgn-legal">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
          Conexão protegida · <Link href="/privacidade">Privacidade</Link> ·{" "}
          <Link href="/termos">Termos</Link>
        </p>
      </main>
    </div>
  );
}
