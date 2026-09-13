import {
  ArrowRight,
  Target,
  Zap,
  TrendingDown,
  BarChart3,
  Clock,
  PieChart,
  EyeOff,
  Calendar,
  AlertTriangle,
} from "lucide-react";

/* ============================================================
   Bloco A — Nav, Hero, Marquee, Problema, Solução, Como Funciona
   Recriação fiel à apresentação aprovada (apresentacao/).
   ============================================================ */

/** Logo-mark oficial (SVG vetorial idêntico à apresentação). */
export function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l4-5 4 3 5-7 5 9" />
      <path d="M3 19h18" />
      <path d="M12 8l2 3 3 1" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#ia", label: "Funcionalidades" },
  { href: "#ia", label: "Inteligência" },
  { href: "#estrategia", label: "Estratégia" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#planos", label: "Planos" },
];

export function Nav() {
  return (
    <header className="lnd-nav">
      <div className="lnd-container lnd-nav-inner">
        <a href="#hero" className="lnd-logo" aria-label="Inst Acessor — início">
          <span className="lnd-logo-mark" aria-hidden="true">
            <LogoMark />
          </span>
          <span>
            Inst <em>Acessor</em>
          </span>
        </a>

        <nav className="lnd-nav-links" aria-label="Navegação principal">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          {/* Abaixo de 900px o botão "Entrar" da barra é escondido (`display:none`
              em .lnd-nav-cta .lnd-btn-ghost). Sem este item o login ficava
              inacessível no celular. Ele só aparece no menu dropdown. */}
          <a className="lnd-only-mobile" href="/login?from=landing">
            Entrar
          </a>
        </nav>

        <div className="lnd-nav-cta">
          {/* `from=landing` garante que a tela de login apareça mesmo para quem
              já tem sessão no navegador (ver src/middleware.ts e login/page.tsx). */}
          <a className="lnd-btn lnd-btn-ghost lnd-btn-sm" href="/login?from=landing">
            Entrar
          </a>
          <a className="lnd-btn lnd-btn-primary lnd-btn-sm" href="/cadastro">
            Criar conta
            <ArrowRight />
          </a>
          <button className="lnd-nav-burger" aria-label="Abrir menu">
            <svg className="lnd-burger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <svg className="lnd-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroMockup() {
  return (
    <div className="lnd-hero-visual lnd-reveal" data-dir="right" data-delay="2">
      <div className="lnd-hero-visual-inner" data-parallax="0.12">
        <div className="lnd-dash-mock">
          <div className="lnd-dash-topbar">
            <div className="lnd-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="lnd-url">
              <span>app.instacessor.com.br</span>
            </div>
            <div className="lnd-dots" aria-hidden="true" style={{ visibility: "hidden" }}>
              <i />
            </div>
          </div>
          <div className="lnd-dash-body">
            <div className="lnd-dash-left">
              <div className="lnd-dash-card lnd-dash-stats">
                <div>
                  <div className="lnd-lbl">
                    Seguidores
                    <span className="lnd-up">▲ 4,8%</span>
                  </div>
                  <div className="lnd-num">
                    <span data-count="12840">0</span> <small>seguidores</small>
                  </div>
                </div>
                <div>
                  <div className="lnd-lbl">Engajamento</div>
                  <div className="lnd-num">
                    <span data-count="6.4" data-decimals="1">
                      0
                    </span>
                    <small>%</small>
                  </div>
                </div>
              </div>
              <div className="lnd-dash-card lnd-dash-chart">
                <div className="lnd-lbl">
                  Alcance — últimos 12 dias
                  <span className="lnd-up">▲ 32%</span>
                </div>
                <div className="lnd-chart-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
            <div className="lnd-dash-right">
              <div className="lnd-dash-card lnd-score-ring-wrap">
                <span className="lnd-ring-cap">Score do perfil</span>
                <svg viewBox="0 0 80 80" width="96" height="96" className="lnd-ring-svg" aria-hidden="true">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--lnd-surface)" strokeWidth="9" />
                  <circle
                    className="lnd-ring-progress"
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="url(#lndMiniGrad)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray="213.6"
                    strokeDashoffset="213.6"
                    data-ring="84"
                    data-circ="213.6"
                  />
                  <defs>
                    <linearGradient id="lndMiniGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#F43F8E" />
                      <stop offset="0.5" stopColor="#A855F7" />
                      <stop offset="1" stopColor="#6366F1" />
                    </linearGradient>
                  </defs>
                </svg>
                <b className="lnd-ring-num">
                  <span className="lnd-ring-num-val" data-count="84">0</span>
                  <span className="lnd-ring-num-slash">/100</span>
                </b>
              </div>
              <div className="lnd-dash-card lnd-score-pill-list">
                <div className="lnd-score-pill">
                  <span>Engajamento</span>
                  <b>74</b>
                </div>
                <div className="lnd-score-pill">
                  <span>Crescimento</span>
                  <b>88</b>
                </div>
                <div className="lnd-score-pill">
                  <span>Alcance</span>
                  <b>91</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* O chip flutuante "1.284 seguidores" (lnd-fc-1) foi removido — era
            ESTE o card que o usuário mandou tirar, e não a seção seguinte da
            landing. Os chips "score do perfil" (lnd-fc-2) e "alcance em Reels"
            (lnd-fc-3) continuam, assim como o mockup principal do dashboard. */}
        <div className="lnd-float-chip lnd-fc-2">
          <span className="lnd-ic" style={{ background: "var(--lnd-grad)" }}>
            <Target size={15} />
          </span>
          <span>
            <small data-count="92">0</small>
            <span>score do perfil</span>
          </span>
        </div>
        <div className="lnd-float-chip lnd-fc-3">
          <span className="lnd-ic" style={{ background: "linear-gradient(135deg,#a855f7,#6366f1)" }}>
            <Zap size={15} />
          </span>
          <span>
            <small data-count="2" data-suffix="x">
              0
            </small>
            <span>alcance em Reels</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="lnd-hero" id="hero">
      <div className="lnd-bg-decor" aria-hidden="true">
        <div className="lnd-grid-overlay" />
        <div className="lnd-orb lnd-orb-1" />
        <div className="lnd-orb lnd-orb-2" />
        <div className="lnd-orb lnd-orb-3" />
      </div>
      <div className="lnd-container lnd-hero-grid">
        <div className="lnd-hero-copy">
          <div className="lnd-hero-kicker lnd-reveal">
            <span className="lnd-pulse" aria-hidden="true" />
            Plataforma inteligente de análise e crescimento para Instagram
          </div>
          <h1 className="lnd-hero-title lnd-reveal" data-delay="1">
            <span className="lnd-line">
              <span className="lnd-line-inner">Transforme dados do Instagram em</span>
            </span>
            <span className="lnd-line">
              <span className="lnd-line-inner">
                <span className="lnd-grad">decisões de crescimento.</span>
              </span>
            </span>
          </h1>
          <p className="lnd-hero-sub lnd-reveal" data-delay="2">
            O Inst Acessor analisa seu perfil, acompanha sua evolução e transforma métricas em
            estratégias práticas para ajudar você a crescer de forma inteligente.
          </p>
          <div className="lnd-hero-ctas lnd-reveal" data-delay="3">
            <a className="lnd-btn lnd-btn-primary lnd-btn-lg" href="/cadastro">
              Começar agora
              <ArrowRight />
            </a>
            <a className="lnd-btn lnd-btn-ghost lnd-btn-lg" href="#como-funciona">
              Conhecer a plataforma
            </a>
          </div>
          <div className="lnd-hero-trust lnd-reveal" data-delay="4">
            <div className="lnd-avatars" aria-hidden="true">
              <span>M</span>
              <span>L</span>
              <span>J</span>
              <span>R</span>
            </div>
            <p>
              <b>Pensado para criadores e marcas</b> que querem entender e acelerar o próprio
              crescimento.
            </p>
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  );
}

const MARQUEE_ITEMS = [
  "Análise de perfil",
  "Score inteligente",
  "IA contextual",
  "Diagnóstico",
  "Estratégia",
  "Calendário",
  "Metas",
  "XP e Rank",
  "Alertas",
  "Gamificação",
  "Análise de conteúdo",
  "Histórico",
];

export function Marquee() {
  return (
    <div className="lnd-marquee" aria-hidden="true">
      <div className="lnd-marquee-track">
        {[0, 1].map((dup) =>
          MARQUEE_ITEMS.map((item, i) => (
            <span className="lnd-marquee-item" key={`${dup}-${i}`}>
              <i className="lnd-dot" />
              <b>{item}</b>
            </span>
          )),
        )}
      </div>
    </div>
  );
}

const PROBLEMAS = [
  { ic: TrendingDown, t: "Alcance diminuindo", d: "O alcance caiu e você não sabe por quê." },
  { ic: BarChart3, t: "Crescimento parado", d: "Seguidores e engajamento estagnaram." },
  { ic: Clock, t: "Baixa consistência", d: "Sem rotina, o algoritmo ignora o seu perfil." },
  { ic: PieChart, t: "Métricas confusas", d: "Dados espalhados, sem um diagnóstico claro." },
  { ic: EyeOff, t: "Não saber o que funciona", d: "Você publica, mas não sabe o que gerou resultado." },
  { ic: Calendar, t: "Não saber quando publicar", d: "Horários e formatos no escuro." },
  { ic: AlertTriangle, t: "Sem estratégia", d: "Falta um plano de ação para o seu perfil." },
];

export function Problema() {
  return (
    <section className="lnd-section" id="problema">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">O problema</span>
          <h2 className="lnd-h2">
            Você tem números. Mas sabe <span className="lnd-grad">o que fazer</span> com eles?
          </h2>
          <p className="lnd-lead">
            Números soltos não geram crescimento. Sem a leitura certa dos dados, você continua
            postando no escuro.
          </p>
        </div>

        <div className="lnd-problem-editorial">
          {PROBLEMAS.map((p) => (
            <div className="lnd-problem-row lnd-reveal" key={p.t}>
              <span className="lnd-px" aria-hidden="true">
                ✕
              </span>
              <b>{p.t}</b>
              <span>{p.d}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Solucao() {
  return (
    <section className="lnd-section lnd-solucao" id="solucao">
      <div className="lnd-container">
        <div className="lnd-solucao-note lnd-reveal" data-dir="scale">
          <span className="lnd-eyebrow">A solução</span>
          <h2 className="lnd-h2">
            Tudo o que você precisa para crescer, <span className="lnd-grad">em um só lugar</span>
          </h2>
          <p className="lnd-lead">
            O Inst Acessor é o seu time de estratégia de Instagram: ele lê os dados, decide os
            próximos passos e te acompanha até a execução.
          </p>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Conecte seu Instagram", d: "Vincule seu perfil profissional em segundos, pelo fluxo oficial e seguro." },
  { n: "02", t: "O Inst Acessor analisa", d: "Lê suas métricas, formatos, horários e audiência." },
  { n: "03", t: "A inteligência encontra padrões", d: "Detecta o que funciona, o que trava e as oportunidades." },
  { n: "04", t: "Você recebe um plano", d: "Diagnóstico, metas, calendário e próximas ações direcionadas." },
];

export function ComoFunciona() {
  return (
    <section className="lnd-section" id="como-funciona">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Como funciona</span>
          <h2 className="lnd-h2">
            Do zero à estratégia em <span className="lnd-grad">4 passos</span>
          </h2>
        </div>
        <div className="lnd-steps">
          <span className="lnd-scrub-line" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <div className="lnd-step lnd-reveal" data-delay={String(i + 1)} key={s.n}>
              <span className="lnd-step-num">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
        <div className="lnd-flow-note-wrap lnd-reveal">
          <span className="lnd-flow-note">
            Instagram → conexão → dados → análise → diagnóstico → estratégia → metas → XP →
            evolução → Rank
          </span>
        </div>
      </div>
    </section>
  );
}

export const SectionsA = [Nav, Hero, Marquee, Problema, Solucao, ComoFunciona];
