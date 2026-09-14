import {
  ArrowRight,
  TrendingDown,
  BarChart3,
  Clock,
  PieChart,
  EyeOff,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
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
  { href: "#dashboard", label: "Funcionalidades" },
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

/**
 * Hero da landing — sem o mockup de dashboard do lado direito.
 *
 * O card grande de métricas (12.840 seguidores, engajamento, gráfico de
 * alcance, anel de score 84/100 e os chips de score/alcance) foi REMOVIDO
 * nesta rodada. Sem ele, o Hero não faz mais sentido como grid de 2 colunas:
 * virou UMA coluna centralizada (`lnd-hero-grid lnd-hero-centered`), com o
 * conteúdo textual (kicker, título, subtítulo, CTAs e a faixa de confiança)
 * centralizado e com largura de leitura confortável.
 *
 * A seção escura com o GRÁFICO de evolução de alcance NÃO é isto — aquela
 * é o componente `Dashboard`, que fica logo abaixo do Hero.
 */
export function Hero() {
  return (
    <section className="lnd-hero" id="hero">
      <div className="lnd-bg-decor" aria-hidden="true">
        <div className="lnd-grid-overlay" />
        <div className="lnd-orb lnd-orb-1" />
        <div className="lnd-orb lnd-orb-2" />
        <div className="lnd-orb lnd-orb-3" />
      </div>
      <div className="lnd-container lnd-hero-grid lnd-hero-centered">
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

/* ============================================================
   DASHBOARD INTELIGENTE — 2ª seção da página (fundo escuro)
   ------------------------------------------------------------
   É a seção de fundo escuro (`.lnd-console`) com o GRÁFICO de
   evolução de alcance. Implementação ORIGINAL, recuperada do
   histórico (o componente tinha sido removido por engano).
   Não é reconstrução por aproximação: o código abaixo é o mesmo
   que existia em `sections-a.tsx` antes do enxugamento.
   ============================================================ */

function ChartSvg() {
  return (
    <svg viewBox="0 0 560 180" className="lnd-chart-svg" role="img" aria-label="Gráfico de evolução de alcance">
      <defs>
        <linearGradient id="lndAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lndLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F43F8E" />
          <stop offset="0.5" stopColor="#A855F7" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      {/* Eixo Y à esquerda: valores de alcance alinhados às linhas de grade */}
      {[
        { y: 26, lbl: "192k" },
        { y: 62, lbl: "156k" },
        { y: 98, lbl: "120k" },
        { y: 134, lbl: "84k" },
        { y: 170, lbl: "48k" },
      ].map(({ y, lbl }) => (
        <g key={y}>
          <line x1="42" y1={y} x2="552" y2={y} className="lnd-grid-line" />
          <text x="8" y={y + 4} className="lnd-axis-txt" textAnchor="start">
            {lbl}
          </text>
        </g>
      ))}
      {/* Eixo X discreto: período (dias da semana) */}
      {[
        { x: 127, lbl: "Seg" },
        { x: 212, lbl: "Ter" },
        { x: 297, lbl: "Qua" },
        { x: 382, lbl: "Qui" },
        { x: 467, lbl: "Sex" },
        { x: 552, lbl: "Sáb" },
      ].map(({ x, lbl }) => (
        <text key={x} x={x} y="176" className="lnd-axis-txt" textAnchor="middle">
          {lbl}
        </text>
      ))}
      <path
        d="M42,158 C82,152 128,145 172,134 C216,122 252,110 297,98 C342,86 384,72 427,62 C472,52 512,38 552,26 L552,172 L42,172 Z"
        className="lnd-area"
      />
      <path
        d="M42,158 C82,152 128,145 172,134 C216,122 252,110 297,98 C342,86 384,72 427,62 C472,52 512,38 552,26"
        pathLength={1}
        className="lnd-line"
      />
      {[
        [172, 134],
        [297, 98],
        [427, 62],
        [552, 26],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" className="lnd-dot" data-dot={i} />
      ))}
    </svg>
  );
}

const KPIS: {
  lbl: string;
  val: number;
  suffix: string;
  trend: string;
  dir: "up" | "down" | "warn";
  sub: string;
  decimals?: number;
}[] = [
  { lbl: "Seguidores", val: 12840, suffix: "", trend: "▲ 4,8%", dir: "up", sub: "+412 em 30 dias" },
  { lbl: "Engajamento", val: 6.4, suffix: "%", trend: "▲ 1,2%", dir: "up", sub: "média do período", decimals: 1 },
  { lbl: "Alcance", val: 86400, suffix: "", trend: "▲ 32%", dir: "up", sub: "últimos 30 dias" },
  { lbl: "Visualizações", val: 129600, suffix: "", trend: "▲ 18%", dir: "up", sub: "total no mês" },
  { lbl: "Reels", val: 2.1, suffix: "x", trend: "▲ 2,1x", dir: "up", sub: "desempenho vs média", decimals: 1 },
  { lbl: "Stories", val: 3120, suffix: "", trend: "◆ 0,4%", dir: "warn", sub: "visualizações" },
];

type CompareRow = { name: string; val: string; delta: string; dir: "up" | "down" | "warn" };

const COMPARE: { title: string; rows: CompareRow[] }[] = [
  {
    title: "Crescimento semanal",
    rows: [
      { name: "Semana atual", val: "+118", delta: "▲ 12%", dir: "up" },
      { name: "Semana anterior", val: "+96", delta: "▲ 8%", dir: "up" },
      { name: "Melhor dia", val: "Terça +34", delta: "◆ estável", dir: "warn" },
      { name: "Ganhos", val: "+1.284", delta: "▲", dir: "up" },
      { name: "Perdas", val: "-312", delta: "▼", dir: "down" },
    ],
  },
  {
    title: "Crescimento mensal",
    rows: [
      { name: "Este mês", val: "+412", delta: "▲ 18%", dir: "up" },
      { name: "Mês anterior", val: "+348", delta: "▲ 9%", dir: "up" },
      { name: "Salvamentos", val: "+2.1k", delta: "▲ 24%", dir: "up" },
      { name: "Compartilhamentos", val: "+840", delta: "▲ 16%", dir: "up" },
      { name: "Comparação 90d", val: "+38%", delta: "▲", dir: "up" },
    ],
  },
];

export function Dashboard() {
  return (
    <section className="lnd-section lnd-console" id="dashboard">
      <span id="funcionalidades" className="lnd-anchor" aria-hidden="true" />
      <div className="lnd-container">
        <div className="lnd-section-head lnd-reveal">
          <span className="lnd-eyebrow">Dashboard</span>
          <h2 className="lnd-h2">
            Seus números, lidos com <span className="lnd-grad">inteligência</span>
          </h2>
          <p className="lnd-lead">
            O painel reúne tudo o que importa: KPIs, evolução de alcance e comparação entre
            períodos — para você decidir com clareza.
          </p>
          <span className="lnd-demo-badge" style={{ marginTop: 14 }}>
            Dados de demonstração
          </span>
        </div>

        <div className="lnd-kpi-grid">
          {KPIS.map((k, i) => (
            <div className="lnd-kpi-card lnd-reveal" data-delay={String(i + 1)} key={k.lbl}>
              <div className="lnd-k-top">
                <span className="lnd-k-lbl">{k.lbl}</span>
                <span className={`lnd-k-trend lnd-${k.dir}`}>
                  {k.dir === "up" ? <ArrowUpRight /> : k.dir === "down" ? <ArrowDownRight /> : null}
                  {k.trend}
                </span>
              </div>
              <div className="lnd-k-num">
                <b data-count={k.val} data-decimals={k.decimals ?? 0} data-suffix={k.suffix}>
                  {k.decimals
                    ? k.val.toFixed(k.decimals).replace(".", ",") + k.suffix
                    : k.val.toLocaleString("pt-BR") + k.suffix}
                </b>
              </div>
              <div className="lnd-k-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="lnd-chart-card lnd-reveal" style={{ marginTop: 16 }}>
          <div className="lnd-k-top">
            <span className="lnd-k-lbl">Evolução de alcance</span>
            <span className="lnd-k-trend lnd-up">
              <ArrowUpRight />
              32%
            </span>
          </div>
          <ChartSvg />
        </div>

        <div className="lnd-compare-grid" style={{ marginTop: 18 }}>
          {COMPARE.map((col, ci) => (
            <div className="lnd-compare-card lnd-reveal" data-delay={String(ci + 1)} key={col.title}>
              <h4>{col.title}</h4>
              {col.rows.map((c) => (
                <div className="lnd-compare-row" key={c.name}>
                  <span className="lnd-c-name">{c.name}</span>
                  <span className="lnd-c-val">{c.val}</span>
                  <span className={`lnd-c-delta lnd-${c.dir}`}>{c.delta}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="lnd-bench-strip lnd-reveal" style={{ marginTop: 18 }}>
          <span className="lnd-bench-label">Benchmark do nicho</span>
          <span className="lnd-bench-item">
            <b>6,4%</b>
            <span>seu engajamento</span>
          </span>
          <span className="lnd-bench-item">
            <b>4,1%</b>
            <span>média do nicho</span>
          </span>
          <span className="lnd-bench-item lnd-up">
            <b>▲ 2,3 p.p.</b>
            <span>acima da média</span>
          </span>
          <span className="lnd-bench-note">
            Análise comparativa contextual — dados de demonstração.
          </span>
        </div>
      </div>
    </section>
  );
}

export const SectionsA = [Nav, Hero, Marquee, Problema, Solucao, ComoFunciona, Dashboard];
