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

      {/* Background spotlight sutil que segue o cursor */}
      <div className="lnd-spotlight" aria-hidden="true" />

      <Nav />

      <Hero />

      <Marquee />

      <Problema />

      <Solucao />

      <ComoFunciona />

      <Dashboard />

      <Score />

      <IaAcessor />

      <Diagnostico />

      <Alertas />

      <Estrategia />

      <Nichos />

      <Calendario />

      <Ideias />

      <GeradorCopy />

      <Mentoria />

      <Metas />

      <Xp />

      <Rank />

      <Conquistas />

      <Badges />

      <Timeline />

      <AnaliseConteudos />

      <Perfil />

      <Historico />

      <Diferencial />

      <PreviewSocial />

      <CentralPublicacao />

      <Automacoes />

      <RedesSociais />

      <Seguranca />

      <Planos />

      <Faq />

      <CtaFinal />

      <Footer />
    </main>
  );
}
