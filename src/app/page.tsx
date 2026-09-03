import type { Metadata } from "next";

import "./landing.css";

import { LandingClient } from "@/components/landing/landing-client";
import { HorizontalScroll } from "@/components/landing/horizontal-scroll";
import {
  Nav,
  Hero,
  Marquee,
  Problema,
  Solucao,
  ComoFunciona,
  Dashboard,
} from "@/components/landing/sections-a";
import {
  Score,
  IaAcessor,
  Diagnostico,
  Alertas,
  Estrategia,
  Nichos,
  Calendario,
  Ideias,
  GeradorCopy,
  Mentoria,
} from "@/components/landing/sections-b";
import {
  Metas,
  Xp,
  Rank,
  Conquistas,
  Badges,
  Timeline,
  AnaliseConteudos,
  Perfil,
  Historico,
  Diferencial,
} from "@/components/landing/sections-c";
import {
  PreviewSocial,
  CentralPublicacao,
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
 * Substitui a antiga página placeholder (que tinha apenas o HERO) pela
 * apresentação comercial completa, portada da apresentação aprovada
 * (`apresentacao/`) e ampliada com as seções exigidas na Fase 10:
 * Solução, Preview Social, Central de Publicação, Automações,
 * Redes Sociais, Planos e FAQ.
 *
 * Preserva a identidade visual aprovada: paleta, gradientes, tipografia,
 * animações e estilo premium. Dados simulados sempre rotulados.
 */

export const metadata: Metadata = {
  title: "Inst Acessor — Inteligência para o crescimento do seu Instagram",
  description:
    "Transforme dados do Instagram em decisões de crescimento. Dashboard, IA, calendário, automações e score — tudo em um só lugar.",
};

export default function HomePage() {
  return (
    <main className="lnd-root">
      <LandingClient />
      <HorizontalScroll />

      {/* Background spotlight sutil que segue o cursor */}
      <div className="lnd-spotlight" aria-hidden="true" />

      <Nav />

      <Hero />

      <Marquee />

      {/* ============================================================
          Ordem da página de venda (fonte de verdade: pasta da ordem)
          Prints 01–10 → seções logo abaixo do Hero + letreiro.
          Demais seções preservadas, em sequência comercial coerente.
          ============================================================ */}

      {/* Print 01 — Dashboard */}
      <Dashboard />

      {/* Print 02 — Diagnóstico */}
      <Diagnostico />

      {/* Print 03 — Gerador de Copy */}
      <GeradorCopy />

      {/* Print 04 — Mentoria */}
      <Mentoria />

      {/* Print 05 — XP */}
      <Xp />

      {/* Print 06 — Rank */}
      <Rank />

      {/* ————— Storytelling horizontal (GSAP) —————
          Sequência pinada: Badges (“Cinco níveis...”) → Metas
          (“Objetivos claros...”). Encaixe das 15 seções na ordem atual,
          sem remover/reordenar conteúdo. Mobile e reduced-motion seguem
          verticais (fallback) — controlado pelo HorizontalScroll. */}
      <div className="lnd-h-pin">
        <div className="lnd-h-track">
          {/* Print 07 — Badges */}
          <Badges />

          {/* Print 08 — Análise de Conteúdo */}
          <AnaliseConteudos />

          {/* Print 09 — Preview Social */}
          <PreviewSocial />

          {/* Print 10 — Redes Sociais */}
          <RedesSociais />

          {/* ————— Restante das seções (preservadas, ordem comercial) ————— */}

          <Problema />

          <Solucao />

          <ComoFunciona />

          <Score />

          <IaAcessor />

          <Alertas />

          <Estrategia />

          <Nichos />

          <Calendario />

          <Ideias />

          <Metas />
        </div>
      </div>

      <Conquistas />

      <Timeline />

      <Perfil />

      <Historico />

      <Diferencial />

      <CentralPublicacao />

      <Automacoes />

      <Seguranca />

      <Planos />

      <Faq />

      <CtaFinal />

      <Footer />
    </main>
  );
}
