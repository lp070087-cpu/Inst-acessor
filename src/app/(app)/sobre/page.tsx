import type { Metadata } from "next";
import {
  Sparkles,
  BarChart3,
  CalendarDays,
  Send,
  Zap,
  GraduationCap,
  BrainCircuit,
  Lightbulb,
  PenSquare,
  Trophy,
  Eye,
  Share2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Reveal } from "@/components/sobre/reveal";

export const metadata: Metadata = {
  title: "Sobre o Inst Acessor",
  description: "Conheça o produto — inteligência para o crescimento do seu Instagram.",
};

const MODULES = [
  {
    icon: BarChart3,
    title: "Dashboard inteligente",
    desc: "Seus números, lidos com inteligência: KPIs, evolução de engajamento e comparação entre formatos.",
  },
  {
    icon: Sparkles,
    title: "IA Acessor",
    desc: "Sua mentoria com IA: analisa o perfil, traduz métricas em estratégia e gera um plano prático.",
  },
  {
    icon: PenSquare,
    title: "Gerador de Copy",
    desc: "Legendas prontas em segundos, alinhadas à sua voz e ao seu nicho.",
  },
  {
    icon: Lightbulb,
    title: "Central de Ideias",
    desc: "Inspiração para conteúdos que conectam com o seu público.",
  },
  {
    icon: Eye,
    title: "Preview Social",
    desc: "Veja como seu perfil aparece antes de publicar — feed, stories e vídeos.",
  },
  {
    icon: Trophy,
    title: "Rank & Conquistas",
    desc: "Sua posição no ranking, metas, XP e conquistas para manter a consistência.",
  },
  {
    icon: CalendarDays,
    title: "Calendário",
    desc: "Planejamento e pipeline de conteúdo, com plano semanal assistido por IA.",
  },
  {
    icon: Send,
    title: "Central de Publicação",
    desc: "Fila, status e re-tentativas de publicação em um só lugar.",
  },
  {
    icon: Zap,
    title: "Automações Inteligentes",
    desc: "Motor operacional de crescimento com regras de resposta — nada é enviado automaticamente sem você revisar.",
  },
  {
    icon: GraduationCap,
    title: "Mentoria",
    desc: "Acompanhamento personalizado com recomendações baseadas nos seus dados.",
  },
  {
    icon: BrainCircuit,
    title: "Score Inteligente",
    desc: "Seu score de 0 a 100 com diagnóstico — pontos fortes e o que destravar.",
  },
  {
    icon: Share2,
    title: "Redes Sociais",
    desc: "Conecte e gerencie suas contas com segurança — tokens criptografados.",
  },
];

const PILLARS = [
  {
    title: "Tudo em um só lugar",
    desc: "Análise, estratégia, IA, calendário, automações e gamificação — sem ferramentas espalhadas.",
  },
  {
    title: "Baseado nos seus dados",
    desc: "Recomendações nascem do seu perfil, não de conselhos genéricos de internet.",
  },
  {
    title: "Foco em execução",
    desc: "Cada insight vira uma ação concreta: copie, publique e acompanhe.",
  },
  {
    title: "Sem achismo",
    desc: "Decisões guiadas por métricas e score, com histórico de evolução.",
  },
  {
    title: "Custo acessível",
    desc: "Um plano que cabe na realidade de criadores e pequenos negócios.",
  },
  {
    title: "Evolução contínua",
    desc: "Novos módulos e automações chegam regularmente para a sua base.",
  },
];

const LEGAL_LINKS = [
  {
    href: "/termos",
    title: "Termos de Uso",
    desc: "As regras de uso do Inst Acessor e do seu conteúdo.",
  },
  {
    href: "/privacidade",
    title: "Política de Privacidade",
    desc: "Como seus dados são coletados, usados e protegidos.",
  },
  {
    href: "/data-deletion",
    title: "Exclusão de Dados",
    desc: "Como solicitar a exclusão dos seus dados e da sua conta.",
  },
];

export default function SobrePage() {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <Reveal>
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center rounded-pill bg-ai-soft text-purple border border-purple/20 font-semibold text-[12px] uppercase tracking-wider px-3 py-1 w-fit">
            Sobre o produto
          </span>
          <h1 className="font-display text-[30px] font-bold text-ink">
            O Inst Acessor é o seu time de estratégia de Instagram
          </h1>
          <p className="text-[15px] text-ink-soft max-w-2xl leading-relaxed">
            Ele lê os dados, decide os próximos passos e te entrega um plano prático:
            diagnóstico, calendário, copy pronta e automações — tudo direcionado por IA,
            sem depender de achismo.
          </p>
        </div>
      </Reveal>

      {/* Módulos */}
      <section>
        <Reveal delay={60}>
          <h2 className="font-display text-[20px] font-bold text-ink mb-1">
            Um produto completo para o seu crescimento
          </h2>
          <p className="text-[13.5px] text-ink-soft mb-6">
            Do diagnóstico à publicação, o Inst Acessor cobre todo o ciclo do conteúdo.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={Math.min(i, 8) * 40}>
              <div className="h-full bg-card border border-border-soft rounded-lg shadow-xs p-5 flex flex-col gap-3 transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-md hover:border-purple/25 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-xs">
                <span className="w-10 h-10 rounded-[12px] bg-ai-soft text-purple grid place-items-center">
                  <m.icon size={20} strokeWidth={1.8} />
                </span>
                <h3 className="font-display text-[15px] font-bold text-ink">{m.title}</h3>
                <p className="text-[13px] text-ink-soft leading-relaxed">{m.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pilares */}
      <section>
        <Reveal delay={60}>
          <h2 className="font-display text-[20px] font-bold text-ink mb-1">
            Nossos princípios
          </h2>
          <p className="text-[13.5px] text-ink-soft mb-6">
            Como o produto foi pensado para você.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={Math.min(i, 5) * 40}>
              <div className="h-full flex items-start gap-3 bg-card border border-border-soft rounded-lg shadow-xs p-5 transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-md hover:border-purple/25 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-xs">
                <ShieldCheck size={20} className="text-purple flex-none mt-0.5" />
                <div>
                  <h3 className="font-display text-[14.5px] font-bold text-ink">{p.title}</h3>
                  <p className="text-[13px] text-ink-soft leading-relaxed mt-0.5">{p.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Legal */}
      <Reveal delay={60}>
        <section>
          <h2 className="font-display text-[20px] font-bold text-ink mb-1">
            Transparência
          </h2>
          <p className="text-[13.5px] text-ink-soft mb-6">
            Documentos legais do Inst Acessor.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LEGAL_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group flex flex-col gap-1.5 bg-card border border-border-soft rounded-lg shadow-xs p-5 transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-md hover:border-purple/25 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-xs"
              >
                <h3 className="font-display text-[14.5px] font-bold text-ink flex items-center justify-between gap-2">
                  {l.title}
                  <ArrowRight
                    size={15}
                    className="text-ink-muted transition-all duration-300 group-hover:text-purple group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                  />
                </h3>
                <p className="text-[12.5px] text-ink-soft leading-relaxed">{l.desc}</p>
              </a>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
