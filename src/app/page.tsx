import type { Metadata } from "next";

import "./landing.css";

import { LandingClient } from "@/components/landing/landing-client";
import {
  Nav,
  Hero,
  Marquee,
  Movimentos,
  Dashboard,
} from "@/components/landing/sections-a";
import { Diagnostico, GeradorCopy } from "@/components/landing/sections-b";
import { Xp, Rank, Badges, AnaliseConteudos, PreviewSocial } from "@/components/landing/sections-c";
import {
  RedesSociais,
  Planos,
  Faq,
  CtaFinal,
  Footer,
} from "@/components/landing/sections-d";

/**
 * Página de venda oficial do Inst Acessor.
 *
 * ============================================================
 * ESTRUTURA — definida pela pasta de referência `pasta da ordem/`
 * ============================================================
 * A pasta contém 10 imagens (01–10) que definem o NÚCLEO da página.
 * A **imagem 04 é a versão ATUAL** (substituída pelo usuário) e representa
 * "O produto em quatro verbos" — que no código é a seção `Movimentos`.
 *
 * A ordem das 10 apresentações é EXATAMENTE a da pasta:
 *
 *   01 Dashboard ............ números, KPIs e evolução de alcance
 *   02 Diagnóstico .......... a saúde do perfil, item por item
 *   03 Gerador de Copy ...... copy pronta no tom da marca
 *   04 Movimentos ........... o produto em 4 verbos (o mapa)
 *   05 XP ................... cada evolução vira progresso
 *   06 Rank ................. evolução reconhecida, nível por nível
 *   07 Badges ............... cinco níveis de reconhecimento
 *   08 Análise de desempenho  o que funciona — e repita
 *   09 Preview Social ....... veja antes de publicar
 *   10 Redes Sociais ........ conecte e centralize
 *
 * Fora do núcleo, apenas a abertura e o fechamento comercial:
 *
 *   • Hero ......... promessa + CTA + interface real (abertura)
 *   • Marquee ...... faixa de capacidades (respiro visual)
 *   • Planos / Faq / CtaFinal / Footer ..... oferta, objeções, fechamento
 *
 * O QUE NÃO É MAIS RENDERIZADO (os componentes seguem EXPORTADOS nos
 * arquivos — nada foi apagado; as funções continuam dentro do aplicativo,
 * apenas não aparecem na página de venda):
 *   • Problema, Solucao — repetiam a mensagem do Hero.
 *   • ComoFunciona, IaAcessor, Estrategia — seções grandes de apoio.
 *   • Capacidades — cards compactos que agregavam Metas, Perfil, Histórico,
 *     Automações e Segurança.
 *   • Metas, Perfil, Historico, Automacoes, Seguranca — seções separadas.
 *   • Analise/Score/Nichos/Calendario/Ideias/Conquistas — nunca renderizados
 *     nesta versão.
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

      <Hero />
      <Marquee />

      {/* ===== NÚCLEO — ordem EXATA da pasta de referência (01 → 10) =====
          Estas 10 são o CORPO da página. Nenhuma seção antiga é
          renderizada entre elas. Os componentes removidos continuam
          exportados nos arquivos (funções do app intactas) — só não
          aparecem mais na apresentação de venda. */}
      <Dashboard />          {/* 01 */}
      <Diagnostico />        {/* 02 */}
      <GeradorCopy />        {/* 03 */}
      <Movimentos />         {/* 04 — "O produto em quatro verbos" */}
      <Xp />                 {/* 05 */}
      <Rank />               {/* 06 */}
      <Badges />             {/* 07 */}
      <AnaliseConteudos />   {/* 08 */}
      <PreviewSocial />      {/* 09 */}
      <RedesSociais />       {/* 10 */}

      {/* ===== FECHAMENTO COMERCIAL — só o necessário ===== */}
      <Planos />
      <Faq />
      <CtaFinal />

      <Footer />
    </main>
  );
}
