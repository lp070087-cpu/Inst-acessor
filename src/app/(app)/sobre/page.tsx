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
} from "lucide-react";

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

export default function SobrePage() {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
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

      {/* Módulos */}
      <section>
        <h2 className="font-display text-[20px] font-bold text-ink mb-1">
          Um produto completo para o seu crescimento
        </h2>
        <p className="text-[13.5px] text-ink-soft mb-6">
          Do diagnóstico à publicação, o Inst Acessor cobre todo o ciclo do conteúdo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="bg-card border border-border-soft rounded-lg shadow-xs p-5 flex flex-col gap-3"
            >
              <span className="w-10 h-10 rounded-[12px] bg-ai-soft text-purple grid place-items-center">
                <m.icon size={20} strokeWidth={1.8} />
              </span>
              <h3 className="font-display text-[15px] font-bold text-ink">{m.title}</h3>
              <p className="text-[13px] text-ink-soft leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pilares */}
      <section>
        <h2 className="font-display text-[20px] font-bold text-ink mb-1">
          Nossos princípios
        </h2>
        <p className="text-[13.5px] text-ink-soft mb-6">
          Como o produto foi pensado para você.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-3 bg-card border border-border-soft rounded-lg shadow-xs p-5"
            >
              <ShieldCheck size={20} className="text-purple flex-none mt-0.5" />
              <div>
                <h3 className="font-display text-[14.5px] font-bold text-ink">{p.title}</h3>
                <p className="text-[13px] text-ink-soft leading-relaxed mt-0.5">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
