import { LogoMark } from "./sections-a";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Instagram,
  Music2,
  Film,
  Image,
  Layers,
  Clock,
  CalendarClock,
  Bot,
  MessageCircle,
  Send,
  Repeat,
  Lock,
  KeyRound,
  Database,
  Eye,
  Settings,
  ChevronDown,
  Workflow,
  Rocket,
  Play,
  Bell,
  Bookmark,
  Heart,
  Info,
} from "lucide-react";

/* ============================================================
   Bloco D — Preview Social, Central de Publicação, Automações,
   Redes Sociais, Segurança, Planos, FAQ, CTA Final, Footer
   ============================================================ */

const PREVIEW_ITEMS = [
  { ic: Film, t: "Visualize antes de publicar", d: "Veja como seu Reel, story ou carrossel aparece no feed real." },
  { ic: Image, t: "Múltiplos formatos", d: "Carrossel, vídeo vertical, stories e fotos — tudo em preview fiel." },
  { ic: Layers, t: "Monte a sequência", d: "Organize os slides e a ordem antes de agendar." },
  { ic: CalendarClock, t: "Agende tudo", d: "Programe para vários dias e edite depois pelo calendário." },
];

export function PreviewSocial() {
  return (
    <section className="lnd-section">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Preview social</span>
          <h2 className="lnd-h2">
            Veja como vai ficar <span className="lnd-grad">antes de publicar</span>
          </h2>
          <p className="lnd-lead">
            Crie, pré-visualize e agende o conteúdo com a cara do seu perfil — sem surpresa na hora
            de ir ao ar.
          </p>
        </div>

        <div className="lnd-preview-wrap">
          <div className="lnd-preview-list">
            {PREVIEW_ITEMS.map((p, i) => (
              <div className="lnd-preview-item lnd-reveal" data-dir="left" data-delay={String(i + 1)} key={p.t}>
                <span className="lnd-p-ic">
                  <p.ic />
                </span>
                <span>
                  <b>{p.t}</b>
                  <span>{p.d}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="lnd-preview-phones lnd-reveal" data-dir="right">
            <div className="lnd-phone lnd-phone-a" aria-hidden="true">
              <div className="lnd-phone-screen">
                <div className="lnd-phone-status">
                  <span className="lnd-st-time">9:41</span>
                  <span className="lnd-st-island" />
                  <span className="lnd-st-icons">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="lnd-phone-top">
                  <span className="lnd-av">V</span>
                  <span>
                    <span className="lnd-uname">sua.marca</span>
                    <span className="lnd-usub">Patrocinado · 21h</span>
                  </span>
                </div>
                <div className="lnd-phone-media">
                  <Play size={42} />
                  <span className="lnd-vtag">Reel · 0:18</span>
                </div>
                <div className="lnd-phone-actions">
                  <Heart size={19} />
                  <MessageCircle size={19} />
                  <Send size={19} />
                  <Bookmark size={19} />
                </div>
                <div className="lnd-phone-likes">
                  <b>12.408</b> curtidas
                </div>
                <div className="lnd-phone-caption">
                  <b>sua.marca</b> Novo conteúdo no ar! 🔥 <span className="lnd-hl">#estrategia</span>{" "}
                  <span className="lnd-hl">#instagram</span>
                  <br />
                  <span style={{ color: "var(--lnd-ink-3)", fontSize: 11 }}>há 2 horas · ver tradução</span>
                </div>
              </div>
            </div>
            <div className="lnd-phone lnd-phone-b" aria-hidden="true">
              <div className="lnd-phone-screen">
                <div className="lnd-phone-status">
                  <span className="lnd-st-time">9:41</span>
                  <span className="lnd-st-island" />
                  <span className="lnd-st-icons">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="lnd-phone-top">
                  <span className="lnd-av">V</span>
                  <span>
                    <span className="lnd-uname">sua.marca</span>
                    <span className="lnd-usub">Patrocinado · 21h</span>
                  </span>
                </div>
                <div className="lnd-phone-media">
                  <Play size={42} />
                  <span className="lnd-vtag">Carrossel · 5 slides</span>
                </div>
                <div className="lnd-phone-actions">
                  <Heart size={19} />
                  <MessageCircle size={19} />
                  <Send size={19} />
                  <Bookmark size={19} />
                </div>
                <div className="lnd-phone-likes">
                  <b>8.231</b> curtidas
                </div>
                <div className="lnd-phone-caption">
                  <b>sua.marca</b> Os bastidores do novo lookbook ✨{" "}
                  <span className="lnd-hl">#moda</span> <span className="lnd-hl">#lookbook</span>
                  <br />
                  <span style={{ color: "var(--lnd-ink-3)", fontSize: 11 }}>há 5 horas · ver tradução</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PUBLISHING_ITEMS = [
  { ic: CalendarClock, t: "Agendamento", d: "Programe Reels, stories e carrosséis para o melhor horário." },
  { ic: Rocket, t: "Publicação direta", d: "Publique com confirmação real do Instagram e TikTok conectados." },
  { ic: Repeat, t: "Retry automático", d: "Se falhar, o sistema tenta novamente e registra o status." },
  { ic: Bell, t: "Status em tempo real", d: "Acompanhe agendado, publicado ou com erro — tudo na central." },
];

export function CentralPublicacao() {
  return (
    <section className="lnd-section">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Central de publicação</span>
          <h2 className="lnd-h2">
            Publique com <span className="lnd-grad">organização e segurança</span>
          </h2>
          <p className="lnd-lead">
            Uma central que gerencia agendamentos, fila de publicação e resultados — sem
            improviso de última hora.
          </p>
        </div>

        <div className="lnd-pipeline">
          {PUBLISHING_ITEMS.map((p, i) => (
            <div className="lnd-pipe-step lnd-reveal" data-delay={String((i % 2) + 1)} key={p.t}>
              <span className="lnd-a-ic">
                <p.ic />
              </span>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
              <span className="lnd-status-pill lnd-ready">Disponível</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const AUTOMACOES_READY = [
  { t: "Growth Engine", d: "Sua rotina de crescimento em um só lugar: missão do dia, padrões, experimentos e score." },
  { t: "Plano assistido", d: "A IA monta seu plano semanal e prioriza as ações de maior impacto." },
  { t: "Alertas inteligentes", d: "Mudanças no comportamento do perfil viram alertas acionáveis na hora." },
];

const AUTOMACOES_FUTURE = [
  { t: "Comentário → Resposta automática", d: "Responda comentários com a sua voz, com supervisão e limites de segurança." },
  { t: "Comentário → DM", d: "Converta engajamento em conversa privada automaticamente." },
  { t: "Comentário → Follow-up", d: "Acompanhe novos seguidores com uma sequência de boas-vindas." },
];

export function Automacoes() {
  return (
    <section className="lnd-section">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Automações</span>
          <h2 className="lnd-h2">
            Rotina que <span className="lnd-grad">cresce com você</span>
          </h2>
          <p className="lnd-lead">
            Duas camadas de automação: o Growth Engine já disponível e as automações de
            comentário/mensagens preparadas para quando a integração da Meta estiver habilitada.
          </p>
        </div>

        <div className="lnd-auto-grid">
          <div className="lnd-auto-card lnd-a-ready lnd-reveal" data-dir="left">
            <span className="lnd-a-ic">
              <Workflow size={22} />
            </span>
            <h3>
              Automações inteligentes (Growth Engine)
              <span className="lnd-status-pill lnd-ready">Disponível</span>
            </h3>
            <p>
              O motor de crescimento do Inst Acessor: aprende com os seus padrões, gera a missão
              do dia e recomenda experimentos.
            </p>
            <ul className="lnd-auto-features">
              {AUTOMACOES_READY.map((a) => (
                <li key={a.t}>
                  <CheckCircle2 size={15} />
                  <span>
                    <b>{a.t}.</b> {a.d}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lnd-auto-card lnd-a-future lnd-future lnd-reveal" data-dir="right">
            <span className="lnd-a-ic">
              <Bot size={22} />
            </span>
            <h3>
              Automações de comentários
              <span className="lnd-status-pill lnd-soon">Em preparação</span>
            </h3>
            <p>
              Automações de comentário e mensagem direta, com regras de segurança e supervisão.
              A ativação externa será disponibilizada quando a integração da Meta estiver habilitada.
            </p>
            <ul className="lnd-auto-features">
              {AUTOMACOES_FUTURE.map((a) => (
                <li key={a.t}>
                  <Clock size={15} style={{ color: "var(--lnd-ink-3)" }} />
                  <span>
                    <b>{a.t}.</b> {a.d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="lnd-auto-note">
              <Lock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
              Nada é publicado ou enviado automaticamente sem a sua confirmação.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const SOCIAL_CARDS = [
  {
    platform: "instagram",
    name: "Instagram",
    desc: "Análise completa do perfil, agendamento e publicação direta.",
    feats: ["Métricas e score", "Calendário e agendamento", "Publicação com confirmação"],
  },
  {
    platform: "tiktok",
    name: "TikTok",
    desc: "Acompanhe vídeos, seguidores e engajamento em um só painel.",
    feats: ["Métricas de vídeos", "Sync de perfil", "Gestão de conexão"],
  },
];

export function RedesSociais() {
  return (
    <section className="lnd-section">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Redes sociais</span>
          <h2 className="lnd-h2">
            Conecte suas redes <span className="lnd-grad">e centralize tudo</span>
          </h2>
          <p className="lnd-lead">
            Vincule seus perfis profissionais para liberar métricas, estratégias e automações.
          </p>
        </div>

        <div className="lnd-social-grid">
          {SOCIAL_CARDS.map((s, i) => (
            <div className={`lnd-social-card lnd-s-${s.platform} lnd-reveal`} data-delay={String(i + 1)} key={s.platform}>
              <div className="lnd-social-head">
                <span className="lnd-s-ic">
                  {s.platform === "instagram" ? <Instagram size={26} /> : <Music2 size={26} />}
                </span>
                <div>
                  <h3>{s.name}</h3>
                  <span>{s.desc}</span>
                </div>
              </div>
              <ul className="lnd-social-list">
                {s.feats.map((f) => (
                  <li key={f}>
                    <CheckCircle2 size={15} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lnd-social-note lnd-reveal">
          <Lock size={16} />
          <span>
            Conexões seguras e criptografadas. O Inst Acessor nunca publica nada na sua conta sem
            a sua autorização explícita.
          </span>
        </div>
      </div>
    </section>
  );
}

const SEC_ITEMS = [
  { ic: Lock, t: "Conexão autorizada", d: "Você autoriza o acesso de forma explícita e controlada, pelo fluxo oficial de integração." },
  { ic: ShieldCheck, t: "Integração oficial", d: "Usamos a integração oficial de dados, respeitando as permissões e os limites da plataforma." },
  { ic: KeyRound, t: "Permissões controladas", d: "Somente os dados necessários para a análise são acessados. Nada além do escopo." },
  { ic: Database, t: "Tokens protegidos", d: "Credenciais e tokens de acesso são tratados com protocolos de segurança padrão de mercado." },
  { ic: Eye, t: "Você pode desconectar", d: "A qualquer momento você revoga o acesso. O controle é seu, do início ao fim." },
  { ic: Settings, t: "Nenhuma senha armazenada", d: "O Inst Acessor não armazena senhas do Instagram. A autenticação acontece pelo fluxo oficial." },
];

export function Seguranca() {
  return (
    <section className="lnd-section" id="seguranca">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Segurança e conexão</span>
          <h2 className="lnd-h2">
            Seus dados, <span className="lnd-grad">conectados com segurança.</span>
          </h2>
          <p className="lnd-lead">A conexão é transparente e o controle está sempre com você.</p>
        </div>

        <div className="lnd-security-grid">
          {SEC_ITEMS.map((s, i) => (
            <div className="lnd-sec-card lnd-reveal" data-delay={String((i % 3) + 1)} key={s.t}>
              <div className="lnd-sec-ic">
                <s.ic size={22} />
              </div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>

        <div className="lnd-security-note lnd-reveal">
          <Info size={18} />
          <span>
            <b>Transparência:</b> os dados disponíveis dependem do que a integração oficial oferece
            para o seu tipo de conta. O Inst Acessor não afirma certificações que ainda não possui e
            trata cada conexão com o mesmo cuidado: mínimo acesso necessário e controle total para o
            usuário.
          </span>
        </div>
      </div>
    </section>
  );
}

// Todos os 3 planos liberam AS MESMAS funcionalidades — sem plano "básico",
// sem recurso "exclusivo" de um período. A diferença entre eles é apenas o
// período e o valor. A lista abaixo é intencionalmente idêntica nos 3 cards.
const ALL_FEATURES = [
  "Instagram + TikTok conectados",
  "Dashboard com Score de crescimento",
  "IA Acessor + Cérebro Estratégico",
  "Diagnóstico + Central de Ideias",
  "Gerador de Copy + Preview Social",
  "Calendário + Planejamento",
  "Mentoria + Análise de desempenho",
  "Rank com XP, Metas e Conquistas",
];

const PLANS = [
  {
    name: "Semanal",
    priceLabel: "R$ 27,00",
    period: "por semana",
    desc: "Acesso completo por 7 dias para conhecer a plataforma sem limite de funcionalidades.",
    feats: ALL_FEATURES,
    cta: "Assinar semanal",
    href: "/checkout?plano=semanal",
    featured: false,
  },
  {
    name: "Mensal",
    priceLabel: "R$ 77,00",
    period: "por mês",
    desc: "Todas as funcionalidades liberadas, com renovação simples quando quiser.",
    feats: ALL_FEATURES,
    cta: "Assinar mensal",
    href: "/checkout?plano=mensal",
    featured: true,
  },
  {
    name: "Anual",
    priceLabel: "R$ 547,00",
    period: "por ano",
    desc: "O melhor custo-benefício: todas as funcionalidades por 12 meses.",
    feats: ALL_FEATURES,
    cta: "Assinar anual",
    href: "/checkout?plano=anual",
    featured: false,
  },
];

export function Planos() {
  return (
    <section className="lnd-section" id="planos">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Planos</span>
          <h2 className="lnd-h2">
            Invista no seu crescimento, <span className="lnd-grad">sem exagero</span>
          </h2>
          <p className="lnd-lead">
            Planos simples e acessíveis. Cancele quando quiser — o valor é todo seu.
          </p>
        </div>

        <div className="lnd-plans-grid">
          {PLANS.map((p, i) => (
            <div className={`lnd-plan-card${p.featured ? " lnd-featured lnd-glowbox" : ""} lnd-reveal`} data-delay={String(i + 1)} key={p.name}>
              {p.featured && <span className="lnd-plan-badge">Mais escolhido</span>}
              <span className="lnd-plan-name">{p.name}</span>
              <div className="lnd-plan-price">
                <b>{p.priceLabel}</b>
                <span>{p.period}</span>
              </div>
              <p className="lnd-plan-desc">{p.desc}</p>
              <ul className="lnd-plan-feats">
                {p.feats.map((f) => (
                  <li key={f}>
                    <CheckCircle2 size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <a className={`lnd-btn lnd-btn-block ${p.featured ? "lnd-btn-primary" : "lnd-btn-ghost"} lnd-plan-cta`} href={p.href}>
                {p.cta}
                <ArrowRight />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "Preciso ter um perfil profissional do Instagram?",
    a: "Sim. Para conectar o Instagram e liberar métricas, é necessário um perfil profissional (Business ou Creator). O app te orienta na troca, se necessário.",
  },
  {
    q: "O Inst Acessor publica conteúdo na minha conta sem pedir?",
    a: "Não. Nada é publicado ou enviado sem a sua autorização explícita. A publicação programada só acontece quando você confirma e, se a integração externa ainda não estiver ativa, o item fica agendado com status transparente.",
  },
  {
    q: "Meus dados e os das minhas redes ficam seguros?",
    a: "Sim. As conexões são protegidas com criptografia, os tokens de acesso nunca são exibidos e a área administrativa exige autorização de servidor. Você mantém o controle o tempo todo.",
  },
  {
    q: "Posso cancelar a assinatura quando quiser?",
    a: "Pode. Os planos são flexíveis (semanal, mensal ou anual) e o cancelamento é simples. No plano anual, o valor já é o melhor custo-benefício.",
  },
  {
    q: "Como a IA gera as recomendações?",
    a: "A IA trabalha a partir dos dados do seu perfil conectado e de boas práticas consolidadas. Ela traduz métricas em ações concretas — nunca inventa resultados.",
  },
  {
    q: "Funciona para o meu nicho?",
    a: "Sim. O Inst Acessor calibra recomendações para diferentes mercados, de moda e lifestyle a finanças e educação. A estratégia é ajustada à sua realidade.",
  },
];

export function Faq() {
  return (
    <section className="lnd-section" id="faq">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">FAQ</span>
          <h2 className="lnd-h2">
            Perguntas <span className="lnd-grad">frequentes</span>
          </h2>
        </div>

        <div className="lnd-faq-list">
          {FAQ_ITEMS.map((f, i) => (
            <div className="lnd-faq-item lnd-reveal" data-delay={String((i % 3) + 1)} key={f.q}>
              <button className="lnd-faq-q" type="button">
                <span className="lnd-faq-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="lnd-faq-txt">{f.q}</span>
                <ChevronDown className="lnd-faq-chev" size={20} />
              </button>
              <div className="lnd-faq-a">
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaFinal() {
  return (
    <section className="lnd-cta-final">
      <div className="lnd-bg-decor" aria-hidden="true">
        <div className="lnd-grid-overlay" />
        <div className="lnd-orb lnd-orb-1" />
        <div className="lnd-orb lnd-orb-2" />
      </div>
      <div className="lnd-container lnd-inner">
        <div className="lnd-reveal" data-dir="scale">
          <span className="lnd-eyebrow">Comece hoje</span>
          <h2>
            Seu Instagram pode crescer com <span className="lnd-grad">mais inteligência</span>
          </h2>
          <p>
            Conecte seu perfil, receba seu diagnóstico e dê o primeiro passo de uma estratégia
            guiada por dados.
          </p>
          <div className="lnd-ctas">
            <a className="lnd-btn lnd-btn-primary lnd-btn-lg" href="/cadastro">
              Começar agora
              <ArrowRight />
            </a>
            <a className="lnd-btn lnd-btn-ghost lnd-btn-lg" href="#planos">
              Ver planos
            </a>
          </div>
          <p className="lnd-cta-note">Sem cartão para começar · Cancele quando quiser</p>
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { t: "Produto", links: [["Funcionalidades", "#funcionalidades"], ["Planos", "#planos"], ["FAQ", "#faq"]] },
  { t: "Plataforma", links: [["Entrar", "/login"], ["Criar conta", "/cadastro"]] },
  { t: "Legal", links: [["Segurança", "#seguranca"], ["Termos de uso", "/termos"], ["Privacidade", "/privacidade"], ["Exclusão de dados", "/data-deletion"]] },
];

export function Footer() {
  return (
    <footer className="lnd-footer">
      <div className="lnd-container">
        <div className="lnd-footer-grid">
          <div className="lnd-footer-brand">
            <a href="#" className="lnd-logo">
              <span className="lnd-logo-mark">
                <LogoMark />
              </span>
              Inst <em>Acessor</em>
            </a>
            <p>
              A plataforma de análise e crescimento para Instagram que transforma dados em
              estratégia.
            </p>
          </div>
          {FOOTER_LINKS.map((col) => (
            <div className="lnd-footer-col" key={col.t}>
              <h4>{col.t}</h4>
              {col.links.map(([label, href]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="lnd-footer-disclaimer">
          Inst Acessor é uma plataforma independente e não representa nem é afiliada ao Instagram
          ou à Meta Platforms. Todas as marcas e produtos citados pertencem aos seus respectivos
          proprietários. As informações apresentadas nesta página incluem dados de demonstração
          para fins ilustrativos.
        </div>

        <div className="lnd-footer-bottom">
          <p>
            © <span data-year>2026</span> Inst Acessor. Todos os direitos reservados.
          </p>
          <p className="lnd-footer-credit">
            Desenvolvido pela <span className="lnd-credit-unitrix">Unitrix</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export const SectionsD = [PreviewSocial, CentralPublicacao, Automacoes, RedesSociais, Seguranca, Planos, Faq, CtaFinal, Footer];
