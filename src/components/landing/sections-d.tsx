import { LogoMark } from "./sections-a";
import { UNITRIXAPP_CNPJ } from "@/lib/config/site";
import {
  PLAN_CATALOG,
  formatBRL,
  planLandingPeriod,
  planShortName,
  planAfterText,
} from "@/lib/billing/plans/display";
import { quotaForPlan } from "@/lib/billing/plans/limits";
import { getPlanPromoDisplay } from "@/lib/billing/promo-db";
import { evaluateCapacity } from "@/lib/billing/capacity-db";
import { PromoCountdown } from "@/components/billing/promo-countdown";
import { WaitlistPlanLink } from "./launch-waitlist";
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
  Target,
  Share2,
  History,
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

/**
 * As duas redes NÃO estão no mesmo estágio, e a página não deve sugerir que
 * estão. O Instagram é o caminho validado de ponta a ponta (conexão, métricas
 * e publicação em produção). O TikTok ainda está em integração — por isso
 * carrega o mesmo selo "Em preparação" já usado em Automações, em vez de um
 * checkmark verde idêntico ao do Instagram.
 */
const SOCIAL_CARDS = [
  {
    platform: "instagram",
    name: "Instagram",
    desc: "Conexão pela API oficial. Métricas e publicação direta são liberadas conforme a homologação da Meta.",
    feats: ["Métricas e score do perfil", "Calendário e fila de publicação", "Publicação só com sua confirmação"],
    status: "soon" as const,
    statusLabel: "Homologação Meta",
  },
  {
    platform: "tiktok",
    name: "TikTok",
    desc: "Vídeos, seguidores e engajamento no mesmo painel, após a homologação do TikTok.",
    feats: ["Métricas de vídeos", "Sync de perfil", "Gestão de conexão"],
    status: "soon" as const,
    statusLabel: "Em preparação",
  },
];

/* ============================================================
   CAPACIDADES — funções secundárias AGRUPADAS em cards compactos
   ------------------------------------------------------------
   Substitui as seções inteiras de Metas, Perfil, Histórico,
   Automações e Segurança. Cada card descreve, em uma frase, o que
   a função REALMENTE entrega (mesmo texto que já estava aprovado
   nas seções originais) — nada de recurso novo. Reaproveita as
   classes `.lnd-security-grid` / `.lnd-sec-card`, que já existiam
   no `landing.css`.
   ============================================================ */
const CAPACIDADES = [
  {
    ic: Target,
    t: "Metas",
    d: "Objetivos diários, semanais e mensais com barras de progresso, tempo restante e recompensas.",
  },
  {
    ic: Share2,
    t: "Perfil público",
    d: "Um cartão com a sua jornada — rank, XP, conquistas e evolução — pronto para compartilhar.",
  },
  {
    ic: History,
    t: "Histórico",
    d: "A mudança dos números e do Score ao longo do tempo, de 7 dias a 1 ano.",
  },
  {
    ic: Workflow,
    t: "Automações",
    d: "Growth Engine com missão do dia, padrões, experimentos e alertas acionáveis.",
  },
  {
    ic: ShieldCheck,
    t: "Segurança",
    d: "Conexão transparente com a Meta, controle sempre com você e nada publicado sem autorização.",
  },
  {
    ic: Bot,
    t: "Respostas inteligentes",
    d: "Sugestões de resposta para comentários com a sua voz — você aprova antes de enviar.",
  },
];

export function Capacidades() {
  return (
    <section className="lnd-section" id="capacidades">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Ainda dentro do app</span>
          <h2 className="lnd-h2">
            Tudo que sustenta <span className="lnd-grad">a sua rotina</span>
          </h2>
          <p className="lnd-lead">
            Funções que trabalham junto com o que você já viu — sem virar uma seção para cada uma.
          </p>
        </div>

        <div className="lnd-security-grid">
          {CAPACIDADES.map((c, i) => (
            <div className="lnd-sec-card lnd-reveal" data-delay={String((i % 3) + 1)} key={c.t}>
              <div className="lnd-sec-ic">
                <c.ic size={22} />
              </div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RedesSociais() {
  return (
    <section className="lnd-section">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Integrações</span>
          <h2 className="lnd-h2">
            O que já funciona <span className="lnd-grad">e o que depende das plataformas</span>
          </h2>
          <p className="lnd-lead">
            Calendário, IA, Preview Social e biblioteca de mídia funcionam desde o primeiro acesso.
            Métricas e publicação direta dependem da homologação de cada rede.
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
                  <h3>
                    {s.name}
                    <span className={`lnd-status-pill lnd-${s.status}`}>{s.statusLabel}</span>
                  </h3>
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

// 6 planos vendáveis (semanal + 5 mensais). Todos liberam as MESMAS
// funcionalidades — sem recurso exclusivo por período. A diferença está no
// período, no preço e nas FRANQUIAS (limits.ts). Por isso a lista de quotas
// é derivada de `PLAN_QUOTAS` por slug, não escrita à mão.
//
// PREÇO, NOME, DESCRIÇÃO E PERIODICIDADE VÊM DO CATÁLOGO OFICIAL
// (`PLAN_CATALOG`) — mesma fonte que o checkout server-side usa para cobrar.
// Nenhum valor é escrito aqui: mudar o preço no catálogo reflete na landing.
// O selo "Mais escolhido" é derivado do `badge` do catálogo, não de um slug.
// Planos com `active: false` aparecem como PREVIEW ("Em breve", CTA desabilitado)
// — marketing apenas; o gate real continua no checkout server-side.

/** Ordem de exibição na landing: 6 vendáveis (legados mensal/anual fora). */
const LANDING_PLAN_ORDER = ["semanal", "mensal", "anual"] as const;

export async function Planos() {
  // Preview inclusivo: mostra `active: false` como card "Em breve" em vez de
  // esconder. O único comprável hoje é o semanal; os demais são vitrine.
  const plans = LANDING_PLAN_ORDER.map((slug) =>
    PLAN_CATALOG.find((p) => p.slug === slug)
  ).filter((p): p is (typeof PLAN_CATALOG)[number] => Boolean(p));

  // PRÉ-VENDA REAL — lida do servidor (`SystemSetting`, configurada pelo ADMIN).
  // É a MESMA configuração que o checkout usa para decidir o valor cobrado: a
  // landing deixa de ser uma tabela paralela de preços e passa a anunciar
  // exatamente a oferta vigente. `infraOk === false` significa que o banco não
  // respondeu e o valor exibido é o padrão — nunca apresentamos isso como se
  // fosse a configuração real do admin.
  const promo = await getPlanPromoDisplay();

  // VENDA ABERTA? — mesma decisão de capacidade que o checkout aplica no
  // servidor. Com o lote fechado pelo admin, o botão principal leva à lista de
  // espera em vez de mandar o visitante a um checkout que vai recusar a compra.
  // Falha de leitura mantém os dois caminhos (o checkout continua decidindo).
  const sales = await evaluateCapacity(null)
    .then(({ decision }) => ({ open: decision.allowed, message: decision.message }))
    .catch(() => ({ open: true, message: "" }));

  return (
    <section className="lnd-section" id="planos">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Planos</span>
          <h2 className="lnd-h2">
            Escolha seu plano <span className="lnd-grad">e comece</span>
          </h2>
          <p className="lnd-lead">
            Todos os planos incluem o app completo. Muda só o período e a franquia de uso.
          </p>
        </div>

        {!sales.open && (
          <div className="lnd-plans-closed lnd-reveal" role="status">
            <span className="lnd-pulse" aria-hidden="true" />
            <p>{sales.message || "As vendas deste lote estão encerradas. Entre na lista de espera e avisaremos quando abrir."}</p>
          </div>
        )}

        <div className="lnd-plans-grid">
          {plans.map((p, i) => {
            const shortName = planShortName(p);
            // Destaque com justificativa verificável: o anual tem o menor custo
            // por mês. Nenhum selo de popularidade sem dado de vendas.
            const featured = p.badge === "MELHOR_CUSTO_BENEFICIO";
            const isPreview = !p.active;
            const isPremium = p.slug === "elite" || p.slug === "master";
            const quota = quotaForPlan(p.slug);
            const showcase = promo.bySlug[p.slug];
            const onSale = Boolean(!isPreview && showcase?.showPromo && showcase.promoPriceCents != null);
            const promoPrice = onSale ? showcase!.promoPriceCents! : null;

            // Linhas de franquia — derivadas de PLAN_QUOTAS, nunca inventadas.
            // `null` = sem teto (semanal/legado). Texto curto.
            const quotaLines: string[] = (() => {
              const fmt = (n: number | null) => (n == null ? "ilimitado" : String(n));
              const lines: string[] = [];
              // IA por dia + por ciclo
              if (quota.aiPerDay == null && quota.aiPerCycle == null) {
                lines.push("Gerações de IA: ilimitado");
              } else {
                const dia = quota.aiPerDay == null ? "ilimitado/dia" : `${quota.aiPerDay}/dia`;
                const ciclo = quota.aiPerCycle == null ? "ilimitado/ciclo" : `${quota.aiPerCycle}/ciclo`;
                lines.push(`Gerações de IA: ${dia} · ${ciclo}`);
              }
              lines.push(`Respostas por ciclo: ${fmt(quota.autoRepliesPerCycle)}`);
              lines.push(`Publicações por ciclo: ${fmt(quota.publicationsPerCycle)}`);
              lines.push(`Análises de perfil por ciclo: ${fmt(quota.profileAnalysisPerCycle)}`);
              lines.push(`Automações ativas: ${fmt(quota.activeAutomationRules)}`);
              lines.push(`Contas conectadas: ${fmt(quota.connectedAccounts)}`);
              return lines;
            })();

            const cardClass = [
              "lnd-plan-card",
              featured ? "lnd-featured lnd-glowbox" : "",
              onSale ? "lnd-plan-onsale" : "",
              isPreview ? "lnd-plan-soon" : "",
              isPremium && !featured ? "lnd-plan-premium" : "",
              "lnd-reveal",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div className={cardClass} data-delay={String(i + 1)} key={p.slug}>
                {featured && <span className="lnd-plan-badge">Melhor custo-benefício</span>}
                {isPreview && !featured && <span className="lnd-plan-badge lnd-plan-badge-soon">Em breve</span>}

                <span className="lnd-plan-name">{shortName}</span>

                {onSale && promoPrice != null ? (
                  <>
                    <span className="lnd-plan-was">
                      DE <s>{formatBRL(p.priceCents)}</s>
                    </span>
                    <span className="lnd-plan-selo">PRÉ-VENDA</span>
                    <div className="lnd-plan-price lnd-plan-price-promo">
                      <b>{formatBRL(promoPrice)}</b>
                      <span>{planLandingPeriod(p)}</span>
                    </div>
                    {showcase?.qualifier && <p className="lnd-plan-promo-note">{showcase.qualifier}</p>}
                    {showcase?.afterText && <p className="lnd-plan-promo-after">{showcase.afterText}</p>}
                  </>
                ) : (
                  <>
                    <div className="lnd-plan-price">
                      <b>{formatBRL(p.priceCents)}</b>
                      <span>{planLandingPeriod(p)}</span>
                    </div>
                    {planAfterText(p.slug, p.priceCents) && (
                      <p className="lnd-plan-promo-after">{planAfterText(p.slug, p.priceCents)}</p>
                    )}
                  </>
                )}

                <p className="lnd-plan-desc">{p.description}</p>

                {onSale && showcase?.countdownRunning && showcase.countdownEndsAt && (
                  <PromoCountdown
                    endsAt={showcase.countdownEndsAt}
                    label={promo.config.countdown.label}
                    className="lnd-plan-countdown"
                    refreshOnExpire
                  />
                )}

                <ul className="lnd-plan-feats">
                  {quotaLines.map((f) => (
                    <li key={f}>
                      <CheckCircle2 size={16} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isPreview ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="lnd-btn lnd-btn-block lnd-btn-ghost lnd-plan-cta lnd-plan-cta-soon"
                    title="Plano em breve — ainda não disponível para compra"
                  >
                    Em breve
                  </button>
                ) : sales.open ? (
                  <a
                    className={`lnd-btn lnd-btn-block ${featured ? "lnd-btn-primary" : "lnd-btn-ghost"} lnd-plan-cta`}
                    href={`/checkout?plano=${encodeURIComponent(p.slug)}`}
                  >
                    Assinar o {shortName.toLowerCase()}
                    <ArrowRight />
                  </a>
                ) : null}
                <WaitlistPlanLink slug={p.slug} label={shortName} primary={!sales.open && featured} />
              </div>
            );
          })}
        </div>

        {/* Degradação honesta: o banco não respondeu e a oferta exibida é o
            padrão do produto, não a configuração do admin. Dizemos isso em vez
            de apresentar um valor como se fosse o vigente. */}
        {!promo.infraOk && (
          <p className="lnd-plan-warn">
            Não foi possível confirmar a configuração da pré-venda agora. Os valores
            acima são os oficiais do catálogo e serão reconfirmados no checkout.
          </p>
        )}
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "O que já funciona hoje e o que depende da Meta ou do TikTok?",
    a: "Calendário, IA Acessor, gerador de copy, Preview Social com recorte de imagens e biblioteca de mídia funcionam desde o primeiro acesso. Métricas do perfil e publicação direta dependem da homologação de cada plataforma e são liberadas assim que aprovadas.",
  },
  {
    q: "Preciso de um perfil profissional do Instagram?",
    a: "Para conectar o Instagram, sim: Business ou Creator. O app orienta a troca, se necessário.",
  },
  {
    q: "O Inst Acessor publica algo sem a minha permissão?",
    a: "Não. Nada é publicado ou respondido sem a sua confirmação, e cada item da fila mostra o status real.",
  },
  {
    q: "Como funciona o pagamento e o cancelamento?",
    a: "O pagamento é processado pelo Asaas. O semanal é um pagamento único de 7 dias, sem renovação. Mensal e anual renovam automaticamente e você pode cancelar a renovação quando quiser em Minha Assinatura.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. As conexões usam o fluxo oficial de autorização, os tokens ficam criptografados e você pode desconectar suas redes a qualquer momento.",
  },
];

export function Faq() {
  return (
    <section className="lnd-section" id="faq">
      <div className="lnd-container">
        <div className="lnd-section-head lnd-center lnd-reveal">
          <span className="lnd-eyebrow">Dúvidas</span>
          <h2 className="lnd-h2">
            Antes de <span className="lnd-grad">assinar</span>
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
          <span className="lnd-eyebrow">Pronto para começar</span>
          <h2>
            Menos improviso, <span className="lnd-grad">mais constância no Instagram</span>
          </h2>
          <p>Escolha o plano que cabe na sua rotina e organize seu conteúdo em um só lugar.</p>
          <div className="lnd-ctas">
            <a className="lnd-btn lnd-btn-primary lnd-btn-lg" href="#planos">
              Escolher meu plano
              <ArrowRight />
            </a>
            <a className="lnd-btn lnd-btn-ghost lnd-btn-lg" href="#lista-de-espera">
              Entrar na lista de espera
            </a>
          </div>
          <p className="lnd-cta-note">Pagamento pelo Asaas · Semanal sem renovação · Cancele a renovação quando quiser</p>
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { t: "Produto", links: [["Como funciona", "#como-funciona"], ["Planos", "#planos"], ["Lista de espera", "#lista-de-espera"], ["Dúvidas", "#faq"]] },
  { t: "Plataforma", links: [["Entrar", "/login?from=landing"], ["Criar conta", "/cadastro"]] },
  { t: "Legal", links: [["Termos de uso", "/termos"], ["Privacidade", "/privacidade"], ["Exclusão de dados", "/data-deletion"]] },
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
