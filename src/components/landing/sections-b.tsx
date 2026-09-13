import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MoveRight,
  MessageSquare,
  Lightbulb,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Wand2,
  Send,
  Copy,
  RefreshCw,
  Compass,
  BellRing,
} from "lucide-react";

/* ============================================================
   Bloco B — Score, IA, Diagnóstico, Estratégia,
   Nichos, Calendário, Ideias, Gerador de Copy
   Recriação fiel à apresentação aprovada (apresentacao/).
   A seção "Mentoria" (Direcionamento de quem entende de dados)
   foi removida no enxugamento da landing.
   O "Dashboard" NÃO fica aqui — voltou para `sections-a.tsx`,
   que é onde ele sempre morou.
   ============================================================ */

const SCORE_PILLARS = [
  { lbl: "Alcance", val: 92 },
  { lbl: "Engajamento", val: 76 },
  { lbl: "Consistência", val: 84 },
  { lbl: "Estratégia", val: 68 },
];

export function Score() {
  return (
    <section className="lnd-section lnd-console" id="score">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Score de crescimento</span>
          <h2 className="lnd-h2">
            Um número que resume <span className="lnd-grad">sua estratégia</span>
          </h2>
          <p className="lnd-lead">
            O Score de 0 a 100 combina os pilares que realmente movem o algoritmo. Entenda sua
            posição e o que melhorar primeiro.
          </p>
        </div>

        <div className="lnd-score-wrap lnd-reveal" data-dir="scale">
          <div className="lnd-score-gauge">
            <span className="lnd-ring-cap">Score geral</span>
            <svg viewBox="0 0 160 160" width="200" height="200" className="lnd-ring-svg" role="img" aria-label="Score 84 de 100">
              <circle cx="80" cy="80" r="68" fill="none" stroke="var(--lnd-surface)" strokeWidth="14" />
              <circle
                className="lnd-ring-progress"
                cx="80"
                cy="80"
                r="68"
                fill="none"
                stroke="url(#lndScoreGrad)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray="427.3"
                strokeDashoffset="427.3"
                data-ring="84"
                data-circ="427.3"
              />
              <defs>
                <linearGradient id="lndScoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#F43F8E" />
                  <stop offset="0.5" stopColor="#A855F7" />
                  <stop offset="1" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="lnd-gauge-num">
              <b>
                <span data-count="84">0</span>
                <span className="lnd-slash">/100</span>
              </b>
              <span>Alcance excelente, estratégia em evolução</span>
            </div>
          </div>

          <div className="lnd-score-pillars">
            {SCORE_PILLARS.map((p) => (
              <div className="lnd-pillar" key={p.lbl}>
                <div className="lnd-p-top">
                  <span>{p.lbl}</span>
                  <b>{p.val}</b>
                </div>
                <div className="lnd-pillar-bar">
                  <i data-w={p.val} style={{ width: 0 }} />
                </div>
              </div>
            ))}
            <p className="lnd-score-note">
              A IA cruza alcance, engajamento, consistência e estratégia para calcular o seu
              Score — e mostra o próximo nível a alcançar.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const AI_CHIPS = [
  { ic: MessageSquare, t: "Chat contextual", d: "Pergunte sobre métricas, formatos e tendências." },
  { ic: Wand2, t: "Copy pronta", d: "Legendas, Reels, Stories e carrosséis no tom da sua marca." },
  { ic: Lightbulb, t: "Ideias com base em dados", d: "Oportunidades de conteúdo com potencial de alcance." },
  { ic: Compass, t: "Mentoria", d: "Direcionamento passo a passo para o seu momento." },
];

const AI_QUESTIONS = [
  { k: "1", q: "Por que meus Reels perderam alcance?" },
  { k: "2", q: "Qual é o melhor horário para eu postar?" },
  { k: "3", q: "Que conteúdo eu deveria criar esta semana?" },
  { k: "4", q: "Como posso aumentar meu engajamento?" },
  { k: "5", q: "O que preciso melhorar no meu perfil?" },
];

export function IaAcessor() {
  return (
    <section className="lnd-section" id="ia">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">IA Acessor</span>
          <h2 className="lnd-h2">
            Sua <span className="lnd-grad">assistente de crescimento</span>
          </h2>
          <p className="lnd-lead">
            Uma IA que conhece o seu Instagram e trabalha com você: responde, cria, sugere e
            direciona — sempre a partir dos seus dados.
          </p>
        </div>

        <div className="lnd-ai-wrap">
          <div className="lnd-ai-copy">
            <div className="lnd-ai-chip-list">
              {AI_CHIPS.map((c, i) => (
                <div className="lnd-ai-chip lnd-reveal" data-dir="left" data-delay={String(i + 1)} key={c.t}>
                  <span className="lnd-ic">
                    <c.ic />
                  </span>
                  <span>
                    <b>{c.t}</b>
                    <span>{c.d}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="lnd-ai-note lnd-reveal">
              Tudo dentro do contexto real do seu perfil, nicho e objetivos — sem fórmulas
              prontas.
            </p>
          </div>

          <div className="lnd-ai-panel lnd-reveal" data-dir="right">
            <div className="lnd-ai-panel-header">
              <span className="lnd-ai-avatar">
                <Sparkles />
              </span>
              <div>
                <h3>IA Acessor</h3>
                <p>online agora</p>
              </div>
            </div>
            <div className="lnd-ai-bubbles" data-ai-log aria-live="polite">
              <div className="lnd-ai-bubble lnd-b-right lnd-ai-greet">
                <span className="lnd-tag">IA Acessor</span>
                <span className="lnd-ai-body">
                  Opa! 👋 Toque numa pergunta abaixo e eu analiso seu perfil — do mesmo jeito que
                  faria dentro do app.
                </span>
              </div>
            </div>
            <div className="lnd-ai-qs" role="group" aria-label="Perguntas demonstrativas">
              {AI_QUESTIONS.map((it) => (
                <button
                  type="button"
                  className="lnd-ai-q"
                  data-ai-q={it.k}
                  data-ai-question={it.q}
                  key={it.k}
                >
                  {it.q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type Diag = { lbl: string; w: number; st: "strong" | "opp" | "warn" | "weak"; cap: string };

const DIAG: Diag[] = [
  { lbl: "Alcance", w: 88, st: "strong", cap: "Bom" },
  { lbl: "Engajamento", w: 62, st: "opp", cap: "Pode melhorar" },
  { lbl: "Consistência", w: 84, st: "strong", cap: "Bom" },
  { lbl: "SEO do perfil", w: 58, st: "warn", cap: "Atenção" },
  { lbl: "Formatos", w: 86, st: "strong", cap: "Bom" },
  { lbl: "Stories", w: 55, st: "warn", cap: "Atenção" },
  { lbl: "Hashtags", w: 64, st: "opp", cap: "Pode melhorar" },
  { lbl: "Conversão", w: 42, st: "weak", cap: "Crítico" },
];

export function Diagnostico() {
  return (
    <section className="lnd-section" id="diagnostico">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Diagnóstico</span>
          <h2 className="lnd-h2">
            A saúde do seu perfil, <span className="lnd-grad">item por item</span>
          </h2>
          <p className="lnd-lead">
            O Inst Acessor lê cada parte do seu Instagram e classifica o que está forte, o que
            trava e o que precisa de atenção.
          </p>
        </div>

        <div className="lnd-diag-list">
          {DIAG.map((d) => (
            <div className={`lnd-diag-row lnd-diag-${d.st} lnd-reveal`} key={d.lbl}>
              <span className="lnd-diag-lbl">{d.lbl}</span>
              <span className="lnd-diag-track">
                <i data-w={d.w} style={{ width: 0 }} />
              </span>
              <small>{d.w}/100</small>
              <span className="lnd-diag-cap">{d.cap}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type Alerta = { ic: typeof AlertTriangle; kind: "warn" | "danger" | "success"; t: string; d: string; time: string };

const ALERTAS: Alerta[] = [
  { ic: AlertTriangle, kind: "warn", t: "Alcance caiu 18%", d: "Nos últimos 7 dias seu alcance caiu comparado ao período anterior.", time: "há 2h" },
  { ic: AlertTriangle, kind: "danger", t: "Engajamento abaixo da média", d: "Seus últimos 3 posts ficaram abaixo da sua média de engajamento.", time: "há 6h" },
  { ic: CheckCircle2, kind: "success", t: "Padrão detectado", d: "Reels em terça-feira geram 2,1x mais alcance que a média.", time: "ontem" },
  { ic: Clock, kind: "warn", t: "Frequência caiu", d: "Você ficou 4 dias sem publicar — o algoritmo pode penalizar.", time: "há 2 dias" },
  { ic: CheckCircle2, kind: "success", t: "Melhor conteúdo", d: "Carrosséis educativos têm o melhor desempenho de salvamentos.", time: "há 3 dias" },
];

const MOVES: { tag: "up" | "info"; t: string; d: string }[] = [
  { tag: "up", t: "Publicar Reels 3x por semana", d: "Reels têm 2,1x mais alcance que a sua média de outros formatos." },
  { tag: "up", t: "Manter stories diários", d: "Sua audiência assiste stories com constância — aproveite o topo do feed." },
  { tag: "info", t: "Testar carrossel educativo", d: "Carrosséis geram mais salvamentos e são a sua maior oportunidade." },
  { tag: "up", t: "Responder comentários em até 2h", d: "Engajamento na hora aumenta o alcance dos próximos posts." },
  { tag: "info", t: "Revisar SEO do perfil", d: "Bio e destaques com palavras-chave melhoram descoberta no Instagram." },
];

export function Estrategia() {
  return (
    <section className="lnd-section" id="estrategia">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Alertas inteligentes + Estratégia</span>
          <h2 className="lnd-h2">
            Do alerta ao <span className="lnd-grad">plano de ação</span>
          </h2>
          <p className="lnd-lead">
            O Inst Acessor detecta o que muda no seu perfil e traduz cada sinal em uma ação
            priorizada por impacto — do problema ao próximo passo.
          </p>
        </div>

        <div className="lnd-strategy-wrap lnd-strategy-unified lnd-reveal" data-dir="scale">
          {/* Esquerda — alertas detectados (problemas) */}
          <div className="lnd-strategy-col lnd-strategy-col-alerts">
            <div className="lnd-strategy-col-head">
              <span className="lnd-sc-icon lnd-sc-icon-alert">
                <BellRing />
              </span>
              <div>
                <b>Alertas detectados</b>
                <span>Sinais que exigem atenção agora</span>
              </div>
            </div>
            <div className="lnd-alert-list">
              {ALERTAS.map((a, i) => (
                <div className={`lnd-alert-item lnd-alert-${a.kind} lnd-reveal`} data-delay={String(i + 1)} key={a.t}>
                  <span className="lnd-ic">
                    <a.ic />
                  </span>
                  <div className="lnd-a-body">
                    <b>{a.t}</b>
                    <p>{a.d}</p>
                  </div>
                  <span className="lnd-a-time">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fluxo PROBLEMA → AÇÃO (conector decorativo) */}
          <div className="lnd-strategy-flow" aria-hidden="true">
            <span className="lnd-flow-label">Problema</span>
            <span className="lnd-flow-arrow">
              <MoveRight />
            </span>
            <span className="lnd-flow-label">Ação</span>
          </div>

          {/* Direita — score + plano de ação priorizado */}
          <div className="lnd-strategy-col lnd-strategy-col-plan">
            <div className="lnd-strategy-col-head">
              <span className="lnd-sc-icon lnd-sc-icon-plan">
                <Target />
              </span>
              <div>
                <b>Plano de ação</b>
                <span>Priorizado por impacto para o seu momento</span>
              </div>
            </div>
            <div className="lnd-strategy-score lnd-reveal" data-dir="left">
              <svg viewBox="0 0 160 160" width="150" height="150" className="lnd-ring-svg" role="img" aria-label="76 de 100">
                <circle cx="80" cy="80" r="68" fill="none" stroke="var(--lnd-surface)" strokeWidth="13" />
                <circle
                  className="lnd-ring-progress"
                  cx="80"
                  cy="80"
                  r="68"
                  fill="none"
                  stroke="url(#lndStratGrad)"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray="427.3"
                  strokeDashoffset="427.3"
                  data-ring="76"
                  data-circ="427.3"
                />
                <defs>
                  <linearGradient id="lndStratGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#6366F1" />
                    <stop offset="1" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="lnd-gauge-num">
                <b>
                  <span data-count="76">0</span>
                  <span className="lnd-slash">/100</span>
                </b>
                <span>5 movimentos de alto impacto</span>
              </div>
            </div>
            <div className="lnd-strategy-main lnd-reveal" data-dir="right" data-delay="1">
              <div className="lnd-move-list">
                {MOVES.map((m) => (
                  <div className="lnd-move-item" key={m.t}>
                    <span className={`lnd-move-tag lnd-tag-${m.tag}`}>
                      {m.tag === "up" ? <ArrowUpRight /> : <MoveRight />}
                    </span>
                    <div className="lnd-move-body">
                      <b>{m.t}</b>
                      <p>{m.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="lnd-reco-strip">
                <span className="lnd-reco-label">Recomendado esta semana</span>
                <div className="lnd-reco-items">
                  <span>3 Reels</span>
                  <span>2 Carrosséis</span>
                  <span>4 Stories</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const NICHOS: { lbl: string; val: string; hot?: boolean }[] = [
  { lbl: "Nicho", val: "Moda & Lifestyle", hot: true },
  { lbl: "Subnicho", val: "Looks casuais" },
  { lbl: "Melhores formatos", val: "Reels 2,4x" },
  { lbl: "Tendências", val: "Backstage" },
  { lbl: "Frequência ideal", val: "5-7 posts/semana" },
  { lbl: "Melhores períodos", val: "Ter e Qui 19h30" },
  { lbl: "Oportunidades", val: "Carrossel educativo" },
  { lbl: "Benchmark contextual", val: "6,4% vs 4,1%" },
];

export function Nichos() {
  return (
    <section className="lnd-section" id="nichos">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Inteligência de nicho</span>
          <h2 className="lnd-h2">
            Insights do <span className="lnd-grad">seu nicho</span>, direto pro seu plano
          </h2>
          <p className="lnd-lead">
            Comparação contextual com o seu segmento: o que funciona para perfis parecidos e onde
            você pode se destacar.
          </p>
        </div>

        <div className="lnd-niche-table">
          <div className="lnd-niche-th" aria-hidden="true">
            <span>Dimensão</span>
            <span>Referência do nicho</span>
          </div>
          {NICHOS.map((n, i) => (
            <div className="lnd-niche-tr lnd-reveal" data-delay={String((i % 2) + 1)} key={n.lbl}>
              <span className="lnd-niche-key">
                {n.hot ? <b className="lnd-niche-hot">Top</b> : null}
                {n.lbl}
              </span>
              <span className="lnd-niche-val">{n.val}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type Dia = { d: string; lbl: string; fmt: string; best?: boolean };

const DIAS: Dia[] = [
  { d: "Seg", lbl: "Segunda", fmt: "Reel" },
  { d: "Ter", lbl: "Terça", fmt: "Story", best: true },
  { d: "Qua", lbl: "Quarta", fmt: "Carrossel" },
  { d: "Qui", lbl: "Quinta", fmt: "Reel" },
  { d: "Sex", lbl: "Sexta", fmt: "Backstage" },
  { d: "Sáb", lbl: "Sábado", fmt: "Story + Reel" },
  { d: "Dom", lbl: "Domingo", fmt: "Descanso" },
];

const CAL_INSIGHTS = [
  { t: "Melhor dia", v: "Terça-feira" },
  { t: "Melhor horário", v: "19h30" },
  { t: "Melhor formato", v: "Carrossel" },
];

export function Calendario() {
  return (
    <section className="lnd-section" id="calendario">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Calendário inteligente</span>
          <h2 className="lnd-h2">
            Saiba exatamente <span className="lnd-grad">o que postar e quando</span>
          </h2>
          <p className="lnd-lead">
            Uma semana de conteúdo planejada a partir dos seus dados — com formatos, horários e os
            melhores dias para publicar.
          </p>
        </div>

        <div className="lnd-cal-wrap">
          <div className="lnd-cal-card lnd-reveal">
            <div className="lnd-cal-days">
              {DIAS.map((d) => (
                <div className={`lnd-cal-day${d.best ? " lnd-best" : ""}`} key={d.d}>
                  <span className="lnd-d-name">{d.d}</span>
                  <b className="lnd-d-format">{d.fmt}</b>
                  {d.best ? <em>Melhor</em> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="lnd-cal-insights">
            {CAL_INSIGHTS.map((c, i) => (
              <div className="lnd-cal-insight lnd-reveal" data-delay={String(i + 1)} key={c.t}>
                <span>{c.t}</span>
                <b>{c.v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const IDEIAS = [
  { ic: TrendingUp, t: "Reel: 3 erros que matam o alcance", tag: "Reel" },
  { ic: Lightbulb, t: "Carrossel: 5 hábitos de quem cresce", tag: "Carrossel" },
  { ic: MessageSquare, t: "Enquete: qual próximo conteúdo você quer?", tag: "Story" },
  { ic: Sparkles, t: "Backstage: como eu monto meu calendário", tag: "Reel" },
  { ic: Target, t: "Antes x Depois: o que mudou no meu perfil", tag: "Carrossel" },
  { ic: Lightbulb, t: "Dica rápida: o horário que mais engaja", tag: "Reel" },
  { ic: TrendingUp, t: "Série: minha rotina de conteúdo em 7 dias", tag: "Carrossel" },
  { ic: MessageSquare, t: "Caixa de perguntas: dúvidas sobre crescimento", tag: "Story" },
  { ic: Sparkles, t: "Revelando meu Score de crescimento", tag: "Reel" },
];

export function Ideias() {
  return (
    <section className="lnd-section" id="ideias">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Central de ideias</span>
          <h2 className="lnd-h2">
            Ideias de conteúdo <span className="lnd-grad">que sua audiência quer ver</span>
          </h2>
          <p className="lnd-lead">
            Sugestões geradas a partir dos seus dados e do seu nicho, com potencial estimado para
            você priorizar.
          </p>
        </div>

        <div className="lnd-ideas-editorial">
          {IDEIAS.map((id, i) => (
            <div className={`lnd-idea-row${i === 4 ? " lnd-featured-idea" : ""} lnd-reveal`} data-delay={String((i % 2) + 1)} key={id.t}>
              <span className="lnd-idea-ic">
                <id.ic />
              </span>
              <p>{id.t}</p>
              <b className="lnd-idea-tag">{id.tag}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const COPY_TABS = [
  { id: "tab-copy-reel", label: "Reel" },
  { id: "tab-copy-story", label: "Story" },
  { id: "tab-copy-carrossel", label: "Carrossel" },
  { id: "tab-copy-legenda", label: "Legenda" },
];

export function GeradorCopy() {
  return (
    <section className="lnd-section" id="gerador-copy">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Gerador de copy</span>
          <h2 className="lnd-h2">
            Copy pronta, <span className="lnd-grad">no tom da sua marca</span>
          </h2>
          <p className="lnd-lead">
            Escolha o formato, informe o tema e a IA escreve a legenda — com gancho, contexto e
            chamada para ação.
          </p>
        </div>

        <div className="lnd-copy-flow">
          <div className="lnd-copy-steps lnd-reveal" data-dir="left">
            <h3>Como funciona</h3>
            <div className="lnd-copy-step lnd-done">
              <span className="lnd-cs-num">1</span>
              <span>
                <b>Escolha o formato</b>
                <span>Reel, Story, carrossel ou legenda</span>
              </span>
            </div>
            <div className="lnd-copy-step lnd-done">
              <span className="lnd-cs-num">2</span>
              <span>
                <b>Informe o tema</b>
                <span>Uma frase sobre o assunto</span>
              </span>
            </div>
            <div className="lnd-copy-step lnd-done">
              <span className="lnd-cs-num">3</span>
              <span>
                <b>Receba a copy</b>
                <span>Variações com gancho, contexto e CTA</span>
              </span>
            </div>
          </div>

          <div className="lnd-copy-output lnd-reveal" data-dir="right" data-tabs>
            <div className="lnd-copy-tabs">
              {COPY_TABS.map((t) => (
                <button className="lnd-copy-tab" data-tab-target={t.id} key={t.id}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="lnd-copy-box">
              <div className="lnd-cb-lbl">
                <span>Copy gerada</span>
                <span className="lnd-demo-badge">Demonstração</span>
              </div>
              <div className="lnd-cb-text" id="lnd-copy-text" aria-live="polite" />
            </div>
            <div className="lnd-copy-actions">
              <button className="lnd-copy-btn lnd-primary" type="button">
                <RefreshCw size={16} />
                Gerar nova copy
              </button>
              <button className="lnd-copy-btn lnd-ghost" type="button">
                <Copy size={16} />
                Copiar
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const SectionsB = [Score, IaAcessor, Diagnostico, Estrategia, Nichos, Calendario, Ideias, GeradorCopy];
