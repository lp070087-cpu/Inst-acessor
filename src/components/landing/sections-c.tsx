import type { ReactNode } from "react";
import {
  Trophy,
  Star,
  Target,
  Zap,
  Flame,
  Crown,
  Rocket,
  Medal,
  Gem,
  Award,
  TrendingUp,
  BarChart3,
  Film,
  Image,
  Layers,
  Compass,
  CheckCircle2,
  Shield,
  Calendar,
  Link2,
  Gauge,
  PenLine,
  User,
  Share2,
  TrendingDown,
  Search,
  X,
  History,
  Clock,
  CircleCheck,
  Heart,
  MessageCircle,
  Send,
  BadgeCheck,
} from "lucide-react";
import { LogoMark } from "./sections-a";

/* ============================================================
   Bloco C — Metas, XP, Rank, Conquistas, Badges,
   Timeline, Análise de Conteúdos, Perfil, Histórico, Diferencial
   Recriação fiel à apresentação aprovada (apresentacao/).
   ============================================================ */

const METAS = [
  { when: "Meta diária", t: "Ganhar seguidores", sub: "Meta: +40 hoje", pct: 78, val: 31, meta: "40", time: "Restam 6h", xp: "+40 XP" },
  { when: "Meta semanal", t: "Aumentar alcance", sub: "Meta: 120k contas", pct: 64, val: 77, meta: "120k", time: "Restam 3 dias", xp: "+120 XP", suffix: "k" },
  { when: "Meta mensal", t: "Aumentar crescimento", sub: "Meta: +2.000 seguidores", pct: 52, val: 1040, meta: "2.000", time: "Restam 18 dias", xp: "+400 XP" },
];

export function Metas() {
  return (
    <section className="lnd-section" id="metas">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Metas</span>
          <h2 className="lnd-h2">
            Objetivos claros, <span className="lnd-grad">progresso visível.</span>
          </h2>
          <p className="lnd-lead">
            Metas diárias, semanais e mensais com barras de progresso, tempo restante e
            recompensas.
          </p>
        </div>

        <div className="lnd-goals-grid">
          {METAS.map((m, i) => (
            <div className="lnd-goal-card lnd-reveal" data-delay={String(i + 1)} key={m.t}>
              <span className="lnd-g-when">{m.when}</span>
              <span className="lnd-g-ic">
                <Target size={21} />
              </span>
              <h3>{m.t}</h3>
              <p className="lnd-g-sub">{m.sub}</p>
              <div className="lnd-goal-ring" aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <circle className="lnd-goal-ring-track" cx="50" cy="50" r="40" />
                  <circle
                    className="lnd-goal-ring-fill"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeDasharray="251.33"
                    strokeDashoffset="251.33"
                    data-ring={m.pct}
                    data-circ="251.33"
                  />
                </svg>
                <b>{m.pct}%</b>
              </div>
              <div className="lnd-goal-meta">
                <span>
                  <b>{m.val.toLocaleString("pt-BR")}</b> / {m.meta}
                </span>
                <span>{m.time}</span>
                <span className="lnd-gm-xp">{m.xp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const XP_MILESTONES = [
  { nv: "Nv 6", v: "1.500", st: "reached" },
  { nv: "Nv 7", v: "2.200", st: "reached" },
  { nv: "Nv 8", v: "2.840", st: "current" },
  { nv: "Nv 9", v: "3.200", st: "" },
  { nv: "Nv 10", v: "4.000", st: "" },
];

export function Xp() {
  return (
    <section className="lnd-section lnd-console lnd-xp-section" id="xp">
      <div className="lnd-bg-decor" aria-hidden="true">
        <div className="lnd-orb lnd-orb-2" />
        <div className="lnd-orb lnd-orb-1" />
      </div>
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">XP e progressão</span>
          <h2 className="lnd-h2">
            Cada evolução vira <span className="lnd-grad">progresso.</span>
          </h2>
          <p className="lnd-lead">
            O Inst Acessor gamifica o crescimento: quanto mais consistente e estratégico, mais XP
            e mais nível.
          </p>
        </div>

        <div className="lnd-xp-wrap">
          <div className="lnd-xp-card lnd-reveal" data-dir="left">
            <div className="lnd-xp-level-row">
              <div className="lnd-xp-level-badge">
                <span className="lnd-lv-ic">
                  <Trophy size={22} />
                </span>
                <div>
                  <b>Nível 8</b>
                  <span>Estrategista em ascensão</span>
                </div>
              </div>
              <div className="lnd-xp-num">
                <b>
                  <span data-count="2840">0</span> XP
                </b>
                <span>acumulados</span>
              </div>
            </div>

            <div className="lnd-xp-bar">
              <div className="lnd-xp-bar-track">
                <i className="lnd-xp-bar-fill" data-w="70" style={{ width: 0 }} />
              </div>
              <div className="lnd-xp-bar-labels">
                <span>Nível 8</span>
                <span>
                  Faltam <b>
                    <span data-count="360">0</span> XP
                  </b>{" "}
                  para o Nível 9
                </span>
              </div>
            </div>

            <div className="lnd-xp-milestones">
              {XP_MILESTONES.map((m) => (
                <div className={`lnd-xp-milestone ${m.st}`} key={m.nv}>
                  <b>{m.nv}</b>
                  <span>{m.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lnd-xp-copy lnd-reveal" data-dir="right" data-delay="2">
            <h2 className="lnd-h2" style={{ fontSize: "clamp(24px,3vw,34px)" }}>
              Crescer também é <span className="lnd-grad">jogo.</span>
            </h2>
            <p className="lnd-lead">
              Metas cumpridas, sequências mantidas e boas práticas aplicadas rendem XP. Você
              acompanha sua evolução de forma motivadora e concreta.
            </p>
            <div className="lnd-xp-stats">
              <div className="lnd-xp-stat">
                <span className="lnd-ic">
                  <Flame size={20} />
                </span>
                <b data-count="6">0</b>
                <span>sequência de semanas ativas</span>
              </div>
              <div className="lnd-xp-stat">
                <span className="lnd-ic">
                  <Zap size={20} />
                </span>
                <b data-count="12">0</b>
                <span>metas batidas este mês</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Rank() {
  return (
    <section className="lnd-section lnd-console" id="rank">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Rank</span>
          <h2 className="lnd-h2">
            Evolução reconhecida, <span className="lnd-grad">nível por nível.</span>
          </h2>
          <p className="lnd-lead">
            Acompanhe seu rank, veja os próximos objetivos e compartilhe sua evolução.
          </p>
        </div>

        <div className="lnd-rank-wrap">
          <div className="lnd-rank-current lnd-reveal" data-dir="left">
            <div className="lnd-rc-top">
              <span>Rank atual</span>
              <span className="lnd-demo-badge">Simulado</span>
            </div>
            <div className="lnd-rank-tier">
              <span className="lnd-tier-ic">
                <Trophy />
              </span>
              <div>
                <h3>Estrategista</h3>
                <p>Rank 8 — você está entre os 12% mais consistentes</p>
              </div>
              <div className="lnd-tier-xp">
                <b>
                  <span data-count="2840">0</span> XP
                </b>
                <span>acumulados</span>
              </div>
            </div>
            <div className="lnd-rank-progress">
              <div className="lnd-rp-labels">
                <span>Próxima meta: Rank 9 — Especialista</span>
                <span>
                  <b data-count="360">0</b> XP restantes
                </span>
              </div>
              <div className="lnd-rp-bar">
                <i data-w="70" style={{ width: 0 }} />
              </div>
            </div>
            <div className="lnd-rank-next">
              {[
                { t: "Especialista", d: "Rank 9 · 3.200 XP", next: true },
                { t: "Mestre", d: "Rank 10 · 4.000 XP" },
                { t: "Lendário", d: "Rank 11 · 6.000 XP" },
              ].map((r) => (
                <div className={`lnd-rank-next-card${r.next ? " lnd-next" : ""}`} key={r.t}>
                  <span className="lnd-rn-ic">
                    <Medal />
                  </span>
                  <b>{r.t}</b>
                  <span>{r.d}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lnd-rank-menu lnd-reveal" data-dir="right" data-delay="2">
            <a href="#perfil" className="lnd-rank-menu-item lnd-rm-1">
              <span className="lnd-rm-ic">
                <User />
              </span>
              <div>
                <b>Perfil público</b>
                <span>Compartilhe sua evolução</span>
              </div>
            </a>
            <a href="#conquistas" className="lnd-rank-menu-item lnd-rm-2">
              <span className="lnd-rm-ic">
                <Award />
              </span>
              <div>
                <b>Meus destaques</b>
                <span>Seus marcos principais</span>
              </div>
            </a>
            <a href="#conquistas" className="lnd-rank-menu-item lnd-rm-3">
              <span className="lnd-rm-ic">
                <Gem />
              </span>
              <div>
                <b>Conquistas</b>
                <span>Badges e troféus</span>
              </div>
            </a>
            <a href="#historico" className="lnd-rank-menu-item lnd-rm-4">
              <span className="lnd-rm-ic">
                <History />
              </span>
              <div>
                <b>Histórico</b>
                <span>Evolução ao longo do tempo</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

type Ach = { ic: typeof Trophy; t: string; d: string; st: "done" | "progress" | "locked"; w?: number };

const CONQUISTAS: Ach[] = [
  { ic: TrendingUp, t: "Primeiro Seguidor", d: "Começou a jornada", st: "done" },
  { ic: User, t: "100 Seguidores", d: "Primeira centena", st: "done" },
  { ic: User, t: "500 Seguidores", d: "Meio milhar", st: "done" },
  { ic: User, t: "1.000 Seguidores", d: "Primeiro milhar", st: "done" },
  { ic: User, t: "5.000 Seguidores", d: "5 mil alcançados", st: "progress", w: 61 },
  { ic: User, t: "10.000 Seguidores", d: "Dez mil alcançados", st: "locked" },
  { ic: Clock, t: "Criador Frequente", d: "7 semanas seguidas publicando", st: "done" },
  { ic: TrendingUp, t: "Crescimento Consistente", d: "30 dias de alta contínua", st: "done" },
  { ic: Gauge, t: "Engajamento em Alta", d: "Engajamento acima de 6%", st: "progress", w: 84 },
  { ic: PenLine, t: "Especialista em Conteúdo", d: "100 conteúdos publicados", st: "locked" },
];

export function Conquistas() {
  return (
    <section className="lnd-section" id="conquistas">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Conquistas</span>
          <h2 className="lnd-h2">
            Cada marco vira <span className="lnd-grad">uma conquista.</span>
          </h2>
          <p className="lnd-lead">
            Marcos de seguidores, consistência e engajamento — com estados claros de bloqueado, em
            andamento e concluído.
          </p>
        </div>

        <div className="lnd-ach-grid">
          {CONQUISTAS.map((c, i) => (
            <div className={`lnd-ach-card lnd-${c.st} lnd-reveal`} data-delay={String((i % 5) + 1)} key={c.t}>
              <span className="lnd-ach-ic">
                <c.ic size={22} />
              </span>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              <span className={`lnd-ach-status lnd-${c.st}`}>
                {c.st === "done" ? "Concluído" : c.st === "progress" ? `Em andamento · ${c.w}%` : "Bloqueado"}
              </span>
              {c.st === "progress" && c.w ? (
                <div className="lnd-ach-progress">
                  <i data-w={c.w} style={{ width: 0 }} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const BADGES = [
  { tier: "t-bronze", t: "Bronze", d: "Primeiros passos consistentes", req: "1.000 XP", st: "done" },
  { tier: "t-silver", t: "Prata", d: "Crescimento reconhecido", req: "2.500 XP", st: "inprogress" },
  { tier: "t-gold", t: "Ouro", d: "Estratégia consolidada", req: "5.000 XP", st: "locked" },
  { tier: "t-diamond", t: "Diamante", d: "Excelência em crescimento", req: "10.000 XP", st: "locked" },
  { tier: "t-legend", t: "Lendário", d: "Referência no ecossistema", req: "20.000 XP", st: "locked" },
];

export function Badges() {
  return (
    <section className="lnd-section" id="badges">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Badges e troféus</span>
          <h2 className="lnd-h2">
            Cinco níveis de <span className="lnd-grad">reconhecimento.</span>
          </h2>
          <p className="lnd-lead">
            Cada categoria representa um patamar de evolução. Passe o mouse e veja o requisito de
            cada badge.
          </p>
        </div>

        <div className="lnd-badge-tiers">
          {BADGES.map((b, i) => (
            <div className={`lnd-badge-card lnd-${b.tier} lnd-reveal`} data-delay={String(i + 1)} key={b.t}>
              <div className="lnd-badge-medal">
                <Award />
              </div>
              <h3>{b.t}</h3>
              <p>{b.d}</p>
              <div className="lnd-badge-req">
                Requisito: <b>{b.req}</b>
              </div>
              <span className={`lnd-badge-status lnd-${b.st}`}>
                {b.st === "done" ? "Concluído" : b.st === "inprogress" ? "Em andamento · 84%" : "Bloqueado"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TL_PANELS: { id: string; label: string; cards: { ic: typeof Trophy; t: string; val: string; date: string }[] }[] = [
  {
    id: "tl-hoje",
    label: "Hoje",
    cards: [
      { ic: Search, t: "Melhor dia de alcance", val: "18,2k", date: "Hoje · Reel das 19h30" },
      { ic: Gauge, t: "Melhor dia de engajamento", val: "8,9%", date: "Hoje · Stories + Reel" },
      { ic: User, t: "Maior pico de seguidores", val: "+54", date: "Hoje · manhã" },
      { ic: TrendingUp, t: "Maior ganho diário", val: "+96", date: "Hoje · 24h" },
      { ic: TrendingDown, t: "Maior queda diária", val: "-18", date: "Hoje · madrugada" },
    ],
  },
  {
    id: "tl-7d",
    label: "7d",
    cards: [
      { ic: Search, t: "Melhor dia de alcance", val: "42,6k", date: "Terça · Reel viral leve" },
      { ic: Gauge, t: "Melhor dia de engajamento", val: "9,4%", date: "Terça · +212 comentários" },
      { ic: User, t: "Maior pico de seguidores", val: "+118", date: "Terça · 19h30" },
      { ic: TrendingUp, t: "Maior ganho diário", val: "+118", date: "Terça · pico semanal" },
      { ic: TrendingDown, t: "Maior queda diária", val: "-31", date: "Domingo · sem publicação" },
    ],
  },
  {
    id: "tl-30d",
    label: "30d",
    cards: [
      { ic: Search, t: "Melhor dia de alcance", val: "210k", date: "12/08 · Reel de maior alcance" },
      { ic: Gauge, t: "Melhor dia de engajamento", val: "11,2%", date: "12/08 · carrossel salvamentos" },
      { ic: User, t: "Maior pico de seguidores", val: "+412", date: "Semana do dia 12/08" },
      { ic: TrendingUp, t: "Maior ganho diário", val: "+96", date: "12/08 · pico mensal" },
      { ic: TrendingDown, t: "Maior queda diária", val: "-48", date: "02/08 · pós-pico de Reel" },
    ],
  },
  {
    id: "tl-90d",
    label: "90d",
    cards: [
      { ic: Search, t: "Melhor dia de alcance", val: "312k", date: "23/06 · Reel de maior alcance" },
      { ic: Gauge, t: "Melhor dia de engajamento", val: "13,1%", date: "23/06 · viral de Reel" },
      { ic: User, t: "Maior pico de seguidores", val: "+1.284", date: "Jun · melhor semana" },
      { ic: TrendingUp, t: "Maior ganho diário", val: "+340", date: "23/06 · pico trimestral" },
      { ic: TrendingDown, t: "Maior queda diária", val: "-64", date: "28/06 · correção pós-viral" },
    ],
  },
];

export function Timeline() {
  return (
    <section className="lnd-section" id="timeline">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Timeline de crescimento</span>
          <h2 className="lnd-h2">
            Os momentos que <span className="lnd-grad">marcaram sua evolução.</span>
          </h2>
          <p className="lnd-lead">Destaques do seu histórico, com filtro por período.</p>
        </div>

        <div className="lnd-timeline-tabs lnd-reveal" data-tabs="tl-">
          {TL_PANELS.map((p) => (
            <button className="lnd-timeline-tab" data-tab-target={p.id} key={p.id}>
              {p.label}
            </button>
          ))}
        </div>

        {TL_PANELS.map((p) => (
          <div className="lnd-timeline-grid" id={p.id} data-tab-panel key={p.id}>
            {p.cards.map((c, i) => (
              <div className="lnd-tl-card lnd-reveal" data-delay={String(i + 1)} key={c.t}>
                <span className="lnd-tl-ic">
                  <c.ic size={20} />
                </span>
                <h3>{c.t}</h3>
                <div className="lnd-tl-val">{c.val}</div>
                <div className="lnd-tl-date">{c.date}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

const CONTENT = [
  { t: "Como organizar fotos de produto que vendem", fmt: "Reel", alc: "24,6k", eng: "9,2%", delta: "+3,4%", dir: "up", thumb: Film },
  { t: "5 erros de fotografia para e-commerce", fmt: "Carrossel", alc: "18,2k", eng: "7,8%", delta: "+1,9%", dir: "up", thumb: Layers },
  { t: "Bastidor: como criamos o novo lookbook", fmt: "Story", alc: "9,4k", eng: "4,1%", delta: "-0,8%", dir: "down", thumb: Image },
];

const FORMATS = [
  { t: "Reels", pct: 82 },
  { t: "Carrosséis", pct: 64 },
  { t: "Stories", pct: 47 },
  { t: "Fotos no feed", pct: 38 },
];

export function AnaliseConteudos() {
  return (
    <section className="lnd-section" id="analise">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Análise de desempenho</span>
          <h2 className="lnd-h2">
            Veja o que funciona <span className="lnd-grad">— e repita</span>
          </h2>
          <p className="lnd-lead">
            Ranking dos conteúdos com melhor desempenho e distribuição de engajamento por formato.
          </p>
        </div>

        <div className="lnd-content-grid">
          <div className="lnd-content-ranking">
            {CONTENT.map((c, i) => (
              <div className="lnd-content-item lnd-reveal" data-delay={String(i + 1)} key={c.t}>
                <span className="lnd-ci-rank">{i + 1}º</span>
                <span className={`lnd-ci-thumb lnd-t${i + 1}`}>
                  <c.thumb size={18} />
                </span>
                <span className="lnd-ci-body">
                  <b>{c.t}</b>
                  <span>{c.fmt} · alcance {c.alc}</span>
                </span>
                <span className="lnd-ci-stats">
                  <b>{c.eng}</b>
                  <span>engajamento</span>
                </span>
                <span className={`lnd-ci-delta lnd-${c.dir}`}>
                  {c.dir === "up" ? "▲" : "▼"} {c.delta}
                </span>
              </div>
            ))}
            <div className="lnd-metric-avail-note lnd-reveal">
              <BarChart3 size={16} />
              <span>
                Métricas exibidas como demonstração. No app, os dados vêm da sua conta conectada.
              </span>
            </div>
          </div>

          <div className="lnd-format-bars lnd-reveal" data-dir="right">
            <h3>Engajamento por formato</h3>
            {FORMATS.map((f, i) => (
              <div className={`lnd-format-row lnd-f-${i + 1}`} key={f.t}>
                <div className="lnd-f-top">
                  <b>{f.t}</b>
                  <span>{f.pct}%</span>
                </div>
                <div className="lnd-f-bar">
                  <i data-w={f.pct} style={{ width: 0 }} />
                </div>
              </div>
            ))}
            <p className="lnd-format-note">
              Reels concentram o maior alcance — carrosséis geram mais salvamentos por engajamento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Perfil() {
  return (
    <section className="lnd-section" id="perfil">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Compartilhe sua evolução</span>
          <h2 className="lnd-h2">
            Seu crescimento, <span className="lnd-grad">pronto pra contar.</span>
          </h2>
          <p className="lnd-lead">
            O Inst Acessor monta um cartão público com a sua jornada — rank, XP, conquistas e
            evolução — do jeito que fica bem em qualquer rede.
          </p>
        </div>

        <div className="lnd-profile-wrap">
          <div className="lnd-profile-card lnd-reveal" data-dir="scale">
            {/* Linha de topo estilo publicação */}
            <div className="lnd-pub-top">
              <div className="lnd-pub-brand">
                <span className="lnd-pub-brand-ic" aria-hidden="true">
                  <LogoMark />
                </span>
                <span>Inst Acessor</span>
              </div>
              <button className="lnd-pub-dots" type="button" aria-label="Opções do cartão" tabIndex={-1}>
                <i />
                <i />
                <i />
              </button>
            </div>

            <div className="lnd-profile-body">
              {/* Cabeçalho do autor + ações */}
              <div className="lnd-profile-head">
                <div className="lnd-pub-author">
                  <span className="lnd-profile-avatar">
                    <User />
                  </span>
                  <div>
                    <h3>
                      @seuperfil
                      <BadgeCheck size={15} className="lnd-verified" aria-label="Verificado" />
                    </h3>
                    <div className="lnd-ph-handle">Criador de conteúdo · Moda &amp; Lifestyle</div>
                  </div>
                </div>
                <div className="lnd-profile-actions">
                  <a className="lnd-btn lnd-btn-primary lnd-btn-sm" href="/cadastro">
                    Compartilhar evolução
                    <Share2 size={15} />
                  </a>
                </div>
              </div>

              {/* Faixa de conquista (semântica de share) */}
              <div className="lnd-pub-achieve">
                <span className="lnd-pub-achieve-ic" aria-hidden="true">
                  <Trophy size={17} />
                </span>
                <p>
                  Evoluí no <b>Rank 8 · Estrategista</b> — <b>2.840 XP</b> conquistados em 90 dias
                </p>
              </div>

              {/* Métricas */}
              <div className="lnd-profile-stats">
                <div className="lnd-profile-stat">
                  <b data-count="12840">0</b>
                  <span>Seguidores</span>
                </div>
                <div className="lnd-profile-stat">
                  <b data-count="6.4" data-decimals="1">
                    0
                  </b>
                  <span>Engajamento %</span>
                </div>
                <div className="lnd-profile-stat">
                  <b data-count="84">0</b>
                  <span>Score</span>
                </div>
                <div className="lnd-profile-stat">
                  <b data-count="2840">0</b>
                  <span>XP</span>
                </div>
              </div>

              {/* Evolução em barras */}
              <div className="lnd-profile-evol">
                <h4>
                  Evolução <span>Últimos 90 dias</span>
                </h4>
                <div className="lnd-evol-bars" aria-hidden="true">
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

              {/* Ações sociais + compartilhar */}
              <div className="lnd-pub-foot">
                <div className="lnd-pub-social">
                  <span className="lnd-pub-social-ic lnd-pub-heart" aria-label="Curtir">
                    <Heart size={17} />
                  </span>
                  <span className="lnd-pub-social-ic lnd-pub-comment" aria-label="Comentar">
                    <MessageCircle size={17} />
                  </span>
                  <span className="lnd-pub-social-ic lnd-pub-send" aria-label="Enviar">
                    <Send size={17} />
                  </span>
                </div>
                <button className="lnd-pub-share" type="button">
                  <Share2 size={15} />
                  Compartilhar evolução
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HistSvg({ id, area, line, dot }: { id: string; area: string; line: string; dot?: [number, number] }) {
  return (
    <svg className="lnd-hist-svg" viewBox="0 0 640 384" role="img" aria-label="Gráfico de evolução">
      <defs>
        <linearGradient id={`lndHistLine${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F43F8E" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={`lndHistArea${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[59, 140, 222, 303].map((y) => (
        <line key={y} className="lnd-grid-line" x1="0" y1={y} x2="640" y2={y} />
      ))}
      <text className="lnd-axis-txt" x="8" y="50">
        13k
      </text>
      <text className="lnd-axis-txt" x="8" y="131">
        12,5k
      </text>
      <text className="lnd-axis-txt" x="8" y="213">
        12k
      </text>
      <text className="lnd-axis-txt" x="8" y="294">
        11,5k
      </text>
      <path className="lnd-area" d={area} fill={`url(#lndHistArea${id})`} />
      <path className="lnd-line" d={line} stroke={`url(#lndHistLine${id})`} />
      {dot ? <circle className="lnd-dot" cx={dot[0]} cy={dot[1]} r="5" /> : null}
    </svg>
  );
}

const HIST_PANELS: { id: string; label: string; area: string; line: string; dot?: [number, number] }[] = [
  {
    id: "hist-7d",
    label: "7 dias",
    area: "M0,266 C50,254 90,263 140,236 C190,210 240,222 290,189 C340,157 390,174 440,136 C490,97 550,109 640,59 L640,384 L0,384 Z",
    line: "M0,266 C50,254 90,263 140,236 C190,210 240,222 290,189 C340,157 390,174 440,136 C490,97 550,109 640,59",
    dot: [440, 136],
  },
  {
    id: "hist-30d",
    label: "30 dias",
    area: "M0,295 C60,284 120,292 180,263 C240,233 300,245 360,207 C420,171 480,189 560,142 L640,103 L640,384 L0,384 Z",
    line: "M0,295 C60,284 120,292 180,263 C240,233 300,245 360,207 C420,171 480,189 560,142 L640,103",
    dot: [560, 142],
  },
  {
    id: "hist-90d",
    label: "90 dias",
    area: "M0,325 C80,310 140,316 220,275 C300,233 380,248 460,195 C540,148 600,133 640,112 L640,384 L0,384 Z",
    line: "M0,325 C80,310 140,316 220,275 C300,233 380,248 460,195 C540,148 600,133 640,112",
  },
  {
    id: "hist-6m",
    label: "6 meses",
    area: "M0,354 C100,337 160,340 240,301 C320,263 420,275 520,216 C580,180 620,160 640,142 L640,384 L0,384 Z",
    line: "M0,354 C100,337 160,340 240,301 C320,263 420,275 520,216 C580,180 620,160 640,142",
  },
  {
    id: "hist-1a",
    label: "1 ano",
    area: "M0,369 C120,352 200,360 300,313 C400,266 520,284 640,207 L640,384 L0,384 Z",
    line: "M0,369 C120,352 200,360 300,313 C400,266 520,284 640,207",
  },
];

const HIST_MINI = [
  { lbl: "Seguidores (7d)", val: 12840, delta: "▲ +412 no mês" },
  { lbl: "Engajamento médio", val: 6.4, delta: "▲ +1,2 p.p.", decimals: 1, suffix: "%" },
  { lbl: "Alcance acumulado", val: 86400, delta: "▲ +32%" },
  { lbl: "Consistência", val: 83, delta: "▲ +6 p.p.", suffix: "%" },
  { lbl: "Score do perfil", val: 84, delta: "▲ +12 desde o início", suffix: "/100", score: true },
];

export function Historico() {
  return (
    <section className="lnd-section lnd-console" id="historico">
      <div className="lnd-bg-decor" aria-hidden="true">
        <div className="lnd-orb lnd-orb-3" />
      </div>
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Histórico</span>
          <h2 className="lnd-h2">
            Sua evolução, <span className="lnd-grad">registrada e comparável.</span>
          </h2>
          <p className="lnd-lead">
            Acompanhe a mudança dos números e do Score ao longo do tempo — de 7 dias a 1 ano.
          </p>
        </div>

        <div className="lnd-hist-tabs lnd-reveal" data-tabs="hist-">
          {HIST_PANELS.map((p) => (
            <button className="lnd-hist-tab" data-tab-target={p.id} key={p.id}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="lnd-hist-wrap">
          {HIST_PANELS.map((p) => (
            <div className="lnd-hist-chart-card" id={p.id} data-tab-panel key={p.id}>
              <h3>Evolução de seguidores e Score</h3>
              <p>Últimos {p.label.toLowerCase()}</p>
              <HistSvg id={p.id.replace("hist-", "")} area={p.area} line={p.line} dot={p.dot} />
            </div>
          ))}

          <div className="lnd-hist-cards">
            {HIST_MINI.map((m, i) => (
              <div className={`lnd-hist-mini${m.score ? " lnd-hm-score" : ""} lnd-reveal`} data-delay={String(i + 1)} key={m.lbl}>
                <span>{m.lbl}</span>
                <b>
                  <span data-count={m.val} data-decimals={m.decimals ?? 0} data-suffix={m.suffix ?? ""}>
                    {m.decimals ? m.val.toFixed(m.decimals).replace(".", ",") : m.val.toLocaleString("pt-BR")}
                  </span>
                  {m.suffix ?? ""}
                </b>
                <span className="lnd-hm-delta lnd-up">{m.delta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Diferencial() {
  return (
    <section className="lnd-section" id="diferencial">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Diferencial</span>
          <h2 className="lnd-h2">
            Mais do que métricas. <span className="lnd-grad">Inteligência para agir.</span>
          </h2>
          <p className="lnd-lead">
            Enquanto ferramentas tradicionais mostram números, o Inst Acessor entrega o caminho
            completo até a ação.
          </p>
        </div>

        <div className="lnd-diff-wrap">
          <div className="lnd-diff-col lnd-diff-traditional lnd-reveal" data-dir="left">
            <h3>Ferramentas tradicionais</h3>
            {[
              "Mostram números brutos",
              "Sem diagnóstico",
              "Sem plano de ação",
              "Você precisa saber interpretar",
              "Sem motivação de longo prazo",
            ].map((t) => (
              <div className="lnd-dt-item" key={t}>
                <span className="lnd-ic lnd-bad">
                  <X />
                </span>
                {t}
              </div>
            ))}
          </div>

          <div className="lnd-diff-col lnd-diff-acessor lnd-reveal" data-dir="right" data-delay="2">
            <h3>
              <span className="lnd-logo-mark">
                <LogoMark />
              </span>{" "}
              Inst Acessor
            </h3>
            {[
              "Dados organizados e legíveis",
              "Diagnóstico claro por pilar",
              "Estratégia e próximas ações",
              "Oportunidades detectadas",
              "Metas, XP e evolução",
            ].map((t) => (
              <div className="lnd-dt-item" key={t}>
                <span className="lnd-ic">
                  <CircleCheck />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export const SectionsC = [Metas, Xp, Rank, Conquistas, Badges, Timeline, AnaliseConteudos, Perfil, Historico, Diferencial];
