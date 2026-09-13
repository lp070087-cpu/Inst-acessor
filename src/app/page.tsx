import type { Metadata } from "next";

import "./landing.css";

import { LandingClient } from "@/components/landing/landing-client";
import {
  Nav,
  Hero,
  Marquee,
  Problema,
  Solucao,
  ComoFunciona,
  Dashboard,
} from "@/components/landing/sections-a";
import { IaAcessor, Diagnostico, Estrategia, GeradorCopy } from "@/components/landing/sections-b";
import {
  Metas,
  Xp,
  Rank,
  Conquistas,
  Badges,
  AnaliseConteudos,
  Perfil,
  Historico,
} from "@/components/landing/sections-c";
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
 * Apresentação comercial portada da apresentação aprovada (`apresentacao/`) e
 * ampliada com as seções da Fase 10.
 *
 * O QUE NÃO ESTÁ MAIS AQUI (removido a pedido — enxugamento da landing):
 *   • Mentoria             — "Direcionamento de quem entende de dados"
 *   • PreviewSocial        — "Veja como vai ficar antes de publicar"
 *   • Timeline             — "Os momentos que marcaram sua evolução"
 *   • Diferencial          — "Mais do que métricas. Inteligência para agir."
 *   • CentralPublicacao    — "Publique com organização e segurança"
 *   • Bloco Antes/Depois   — "Números soltos, sem direção" (dentro de Problema)
 *
 * O Dashboard (bloco de métricas) foi REMOVIDO POR ENGANO no mesmo
 * enxugamento e VOLTOU nesta rodada como 2ª seção — é a seção de fundo
 * escuro com o gráfico de evolução de alcance. A implementação é a
 * ORIGINAL (recuperada do histórico), de volta ao seu lugar em
 * `sections-a.tsx`.
 *
 * As FUNCIONALIDADES correspondentes continuam intactas no aplicativo
 * (dashboard, preview social, publicação, rank, conquistas…). Apenas a
 * divulgação delas na página de venda foi retirada.
 *
 * Preserva a identidade visual aprovada: paleta, gradientes, tipografia,
 * animações e estilo premium. Dados simulados sempre rotulados.
 */

export const metadata: Metadata = {
  title: "Inst Acessor — Inteligência para o crescimento do seu Instagram",
  description:
    "Transforme dados do Instagram em decisões de crescimento. IA, estratégia, metas e XP — tudo em um só lugar.",
};

export default function HomePage() {
  return (
    <main className="lnd-root">
      <LandingClient />

      {/* Background spotlight sutil que segue o cursor */}
      <div className="lnd-spotlight" aria-hidden="true" />

      <Nav />

      <Hero />

      {/* ============================================================
          2ª SEÇÃO — DASHBOARD INTELIGENTE (fundo escuro).
          É a seção escura com o GRÁFICO de evolução de alcance.
          Voltou nesta rodada: tinha sido removida por engano junto
          com o enxugamento. Posição conforme a apresentação aprovada
          (`apresentacao/_parts/04-dashboard.html`).
          ============================================================ */}
      <Dashboard />

      <Marquee />

      {/* Diagnóstico */}
      <Diagnostico />

      {/* Gerador de Copy */}
      <GeradorCopy />

      {/* XP */}
      <Xp />

      {/* Rank */}
      <Rank />

      <Badges />

      <AnaliseConteudos />

      <RedesSociais />

      <Problema />

      <Solucao />

      <ComoFunciona />

      <IaAcessor />

      <Estrategia />

      <Metas />

      <Conquistas />

      <Perfil />

      <Historico />

      <Automacoes />

      <Seguranca />

      <Planos />

      <Faq />

      <CtaFinal />

      <Footer />
    </main>
  );
}
