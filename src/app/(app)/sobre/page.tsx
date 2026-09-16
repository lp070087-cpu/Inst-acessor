import type { Metadata } from "next";
import {
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Instagram,
  Lightbulb,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sobre o Inst Acessor",
  description:
    "Conheça o Inst Acessor e os recursos que ajudam a transformar dados em estratégia de crescimento.",
};

const resources = [
  {
    icon: BarChart3,
    title: "Análise de desempenho",
    description:
      "Acompanhe métricas e evolução para entender melhor o desempenho dos seus perfis.",
  },
  {
    icon: BrainCircuit,
    title: "Inteligência aplicada",
    description:
      "Use recursos de IA para transformar informações e contexto em análises e direcionamentos.",
  },
  {
    icon: Lightbulb,
    title: "Ideias e conteúdo",
    description:
      "Encontre ideias, desenvolva copies e organize conteúdos de acordo com seus objetivos.",
  },
  {
    icon: CalendarDays,
    title: "Planejamento",
    description:
      "Organize conteúdos, calendário e próximos passos em um fluxo centralizado.",
  },
  {
    icon: MessageCircle,
    title: "Respostas inteligentes",
    description:
      "Gerencie interações e recursos de resposta para apoiar o relacionamento com sua audiência.",
  },
  {
    icon: TrendingUp,
    title: "Growth",
    description:
      "Transforme dados, padrões e sinais do perfil em ações orientadas ao crescimento.",
  },
];

export default function SobrePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink">
          Sobre o Inst Acessor
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          Dados, inteligência e planejamento reunidos para apoiar sua estratégia
          de crescimento.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-purple/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl" />

          <div className="relative flex max-w-3xl flex-col gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-purple/10 text-purple">
              <Sparkles size={23} />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="font-display text-[22px] font-bold text-ink sm:text-[26px]">
                Transforme informação em direção
              </h2>

              <p className="max-w-2xl text-[14px] leading-7 text-ink-soft">
                O Inst Acessor reúne análise, inteligência artificial,
                planejamento e ferramentas de conteúdo em um único ambiente.
                A proposta é ajudar você a entender melhor seus dados, organizar
                sua estratégia e tomar decisões com mais contexto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[19px] font-bold text-ink">
            O que você encontra na plataforma
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Recursos conectados para acompanhar, planejar e executar sua
            estratégia.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => {
            const Icon = resource.icon;

            return (
              <Card key={resource.title} hover>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] bg-purple/10 text-purple">
                    <Icon size={20} />
                  </div>
                  <CardTitle>{resource.title}</CardTitle>
                </CardHeader>

                <CardContent className="pt-1">
                  <p className="text-[13.5px] leading-6 text-ink-soft">
                    {resource.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] bg-purple/10 text-purple">
              <Target size={20} />
            </div>
            <CardTitle>Uma estratégia mais organizada</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3 pt-1">
            {[
              "Centralize informações importantes do seu perfil.",
              "Acompanhe evolução e sinais relevantes.",
              "Transforme análises em próximos passos.",
              "Planeje conteúdo com mais contexto.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0 text-success"
                />
                <span className="text-[13.5px] leading-6 text-ink-soft">
                  {item}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] bg-purple/10 text-purple">
              <ShieldCheck size={20} />
            </div>
            <CardTitle>Você continua no controle</CardTitle>
          </CardHeader>

          <CardContent className="pt-1">
            <p className="text-[13.5px] leading-6 text-ink-soft">
              A plataforma foi estruturada para trabalhar com dados da sua conta
              e das integrações autorizadas. Conexões, configurações e recursos
              ficam centralizados no seu ambiente, enquanto as ações que exigem
              autorização continuam vinculadas à sua conta.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-purple/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-purple">
                <Rocket size={19} />
                <span className="text-[12px] font-bold uppercase tracking-wider">
                  Inst Acessor
                </span>
              </div>

              <h2 className="font-display text-[20px] font-bold text-ink">
                Crescimento com dados, contexto e consistência.
              </h2>

              <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">
                Acompanhe seus dados, organize sua estratégia e use as
                ferramentas da plataforma para transformar aprendizado em ação.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-[14px] border border-border-soft bg-surface px-4 py-3">
              <Instagram size={20} className="text-purple" />
              <span className="text-[13px] font-semibold text-ink">
                Instagram
              </span>
              <span className="text-ink-muted">+</span>
              <span className="text-[13px] font-semibold text-ink">
                TikTok
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}