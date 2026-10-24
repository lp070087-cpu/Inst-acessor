import type { Metadata } from "next";

import "./landing.css";

import { LandingClient } from "@/components/landing/landing-client";
import {
  Nav,
  Hero,
  Marquee,
  Movimentos,
  Problema,
  Solucao,
  ComoFunciona,
  Dashboard,
} from "@/components/landing/sections-a";
import { IaAcessor, Diagnostico, Estrategia, GeradorCopy } from "@/components/landing/sections-b";
import { Metas, Xp, Rank, Badges, Perfil, Historico } from "@/components/landing/sections-c";
import {
  Automacoes,
  RedesSociais,
  Seguranca,
  Planos,
  Faq,
  CtaFinal,
  Footer,
} from "@/components/landing/sections-d";

/**
 * Página de venda oficial do Inst Acessor.
 *
 * ============================================================
 * ORDEM DESTA PÁGINA — reordenada na rodada de estratégia
 * ============================================================
 * A ordem anterior empilhava todos os blocos de recurso primeiro e só
 * depois explicava o problema, a solução e como funciona. O visitante
 * atravessava ~15 seções de funcionalidade antes de entender POR QUE o
 * produto existe. A nova ordem segue o encadeamento de conversão lido da
 * página de referência enviada pelo usuário (`print de referencia/`):
 *
 *   1. Hero ............... promessa + nome do produto + CTA + interface real
 *   2. Marquee ............ faixa de capacidades (respiro visual)
 *   3. Dashboard .......... demonstração: o que o painel entrega
 *   4. Problema ........... a dor, para criar urgência
 *   5. Solução ............ o produto como resposta à dor
 *   6. Movimentos ......... CRIE · PUBLIQUE · CONVERSE · CRESÇA (o mapa)
 *   7. ComoFunciona ....... do zero à estratégia em 4 passos
 *   8. Camadas de produto . IA, diagnóstico, estratégia, calendário, ideias,
 *                           copy, XP, rank, hábitos, perfil, histórico
 *   9. Confiança .......... redes, automações, segurança
 *  10. Planos ............. oferta
 *  11. Faq ................ objeções, logo após o preço
 *  12. CtaFinal ........... fechamento
 *
 * O QUE NÃO ESTÁ MAIS RENDERIZADO (componentes seguem EXPORTADOS, nada foi
 * apagado dos arquivos):
 *   • Conquistas, AnaliseConteudos (sections-c), Score, Nichos, Calendario,
 *     Ideias (sections-b). As TELAS correspondentes continuam intactas no
 *     aplicativo; saiu apenas a divulgação na página de venda, porque a
 *     versão enxuta ficou mais fácil de ler — que é o pedido desta rodada.
 *
 * Preserva a identidade visual aprovada: paleta, gradientes, tipografia,
 * animações e estilo premium. Dados numéricos sempre rotulados como exemplo.
 */

export const metadata: Metadata = {
  title: "Inst Acessor — Inteligência para o crescimento do seu Instagram",
  description:
    "Planeje, publique e acompanhe o Instagram em um só lugar. IA, calendário inteligente, central de publicação, análise de desempenho e score — com os dados reais do seu perfil.",
};

/**
 * A landing passa a ser renderizada por requisição.
 *
 * Motivo: a seção "Planos" mostra a PRÉ-VENDA vigente (preço promocional e
 * contador) lida de `SystemSetting`. Isso é configuração do ADMIN e muda sem
 * deploy — se a página ficasse estática, o valor anunciado poderia continuar
 * exibindo a promoção já encerrada, ou escondendo uma recém-ligada.
 *
 * O contador em si é atualizado no navegador pelo componente cliente; este
 * `force-dynamic` garante que o ESTADO inicial (preço, rótulo, se a promoção
 * está de pé) também venha atualizado do servidor.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <main className="lnd-root">
      <LandingClient />

      {/* Background spotlight sutil que segue o cursor */}
      <div className="lnd-spotlight" aria-hidden="true" />

      <Nav />

      {/* 1 — HERO: promessa, nome do produto, CTA e a janela com a
          interface real logo abaixo (componente DemoApp, dentro do Hero). */}
      <Hero />

      {/* 2 — Faixa animada de capacidades: respiro entre o Hero e o
          conteúdo, conforme a apresentação aprovada. */}
      <Marquee />

      {/* 3 — DEMONSTRAÇÃO: a seção escura com o gráfico de evolução de
          alcance. Vem logo depois do Hero porque é o que prova que o
          produto entrega análise — a promessa feita uma tela acima. */}
      <Dashboard />

      {/* 4 e 5 — a dor e a resposta. Antes vinham muito depois de uma
          sequência longa de recursos; agora chegam enquanto a atenção
          ainda está no topo da página. */}
      <Problema />
      <Solucao />

      {/* 6 — O PRODUTO EM QUATRO VERBOS: o mapa da página inteira. */}
      <Movimentos />

      {/* 7 — Como funciona, do zero à estratégia. */}
      <ComoFunciona />

      {/* 8 — Camadas de produto, detalhando o que os verbos entregam. */}
      <IaAcessor />
      <Diagnostico />
      <Estrategia />
      <GeradorCopy />
      <Xp />
      <Rank />
      <Badges />
      <Metas />
      <Perfil />
      <Historico />

      {/* 9 — Confiança: onde os dados ficam, o que é automatizado e o que
          NÃO é feito sem autorização. */}
      <RedesSociais />
      <Automacoes />
      <Seguranca />

      {/* 10, 11 e 12 — oferta, objeções e fechamento. */}
      <Planos />
      <Faq />
      <CtaFinal />

      <Footer />
    </main>
  );
}
