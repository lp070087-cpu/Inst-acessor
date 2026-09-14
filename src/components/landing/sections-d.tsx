import { LogoMark } from "./sections-a";
import { UNITRIXAPP_CNPJ } from "@/lib/config/site";
import {
  PLAN_CATALOG,
  formatBRL,
  planLandingPeriod,
  planShortName,
  LANDING_PLAN_FEATURES,
} from "@/lib/billing/plans/display";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Instagram,
  Music2,
  Clock,
  Bot,
  Lock,
  KeyRound,
  Database,
  Eye,
  Settings,
  ChevronDown,
  Workflow,
  Info,
} from "lucide-react";

/* ============================================================
   Bloco D — Automações, Redes Sociais, Segurança, Planos, FAQ,
   CTA Final, Footer
   ============================================================ */

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
// período e o valor, por isso a lista de benefícios é a mesma nos 3 cards e
// vive em `@/lib/billing/plans/display` (LANDING_PLAN_FEATURES), junto das
// demais regras de apresentação.
//
// PREÇO, NOME, DESCRIÇÃO E PERIODICIDADE DOS CARDS VÊM DO CATÁLOGO OFICIAL
// (`PLAN_CATALOG`) — a mesma fonte que o checkout server-side usa para cobrar.
// Nenhum valor é escrito aqui: mudar o preço no catálogo reflete na landing.
// O selo "Mais escolhido" é derivado do `badge` do catálogo, não de um slug.

/** Ordem de exibição na landing: do menor para o maior período. */
const LANDING_PLAN_ORDER = ["semanal", "mensal", "anual"] as const;

export function Planos() {
  const plans = LANDING_PLAN_ORDER.map((slug) =>
    PLAN_CATALOG.find((p) => p.slug === slug && p.active)
  ).filter((p): p is (typeof PLAN_CATALOG)[number] => Boolean(p));

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
          {plans.map((p, i) => {
            const shortName = planShortName(p);
            const featured = p.badge === "MAIS_ESCOLHIDO";
            return (
              <div
                className={`lnd-plan-card${featured ? " lnd-featured lnd-glowbox" : ""} lnd-reveal`}
                data-delay={String(i + 1)}
                key={p.slug}
              >
                {featured && <span className="lnd-plan-badge">Mais escolhido</span>}
                <span className="lnd-plan-name">{shortName}</span>
                <div className="lnd-plan-price">
                  <b>{formatBRL(p.priceCents)}</b>
                  <span>{planLandingPeriod(p)}</span>
                </div>
                <p className="lnd-plan-desc">{p.description}</p>
                <ul className="lnd-plan-feats">
                  {LANDING_PLAN_FEATURES.map((f) => (
                    <li key={f}>
                      <CheckCircle2 size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  className={`lnd-btn lnd-btn-block ${featured ? "lnd-btn-primary" : "lnd-btn-ghost"} lnd-plan-cta`}
                  href={`/checkout?plano=${encodeURIComponent(p.slug)}`}
                >
                  Assinar {shortName.toLowerCase()}
                  <ArrowRight />
                </a>
              </div>
            );
          })}
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
  { t: "Produto", links: [["Funcionalidades", "#dashboard"], ["Planos", "#planos"], ["FAQ", "#faq"]] },
  { t: "Plataforma", links: [["Entrar", "/login?from=landing"], ["Criar conta", "/cadastro"]] },
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
            Desenvolvido pela <span className="lnd-credit-unitrix">Unitrixapp</span>
            {/* CNPJ — aparece SÓ quando o número existir. Não há CNPJ
                cadastrado no projeto, então hoje nada é renderizado: nenhum
                número é inventado nem reaproveitado de terceiros. Para exibir,
                basta definir `NEXT_PUBLIC_UNITRIXAPP_CNPJ` (ver site.ts). */}
            {UNITRIXAPP_CNPJ && (
              <span className="lnd-credit-cnpj">CNPJ {UNITRIXAPP_CNPJ}</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}

export const SectionsD = [Automacoes, RedesSociais, Seguranca, Planos, Faq, CtaFinal, Footer];
