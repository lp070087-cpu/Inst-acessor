"use client";
import * as React from "react";
import { ArrowRight } from "lucide-react";
import { WAITLIST_HASH, WaitlistModal } from "./waitlist-modal";

/**
 * CTA de plano que abre o modal da lista de espera com o plano pré-selecionado.
 * O clique é tratado pela delegação de `WaitlistModal` (qualquer link para
 * `#lista-de-espera`); `data-waitlist-plan` informa o plano escolhido.
 */
export function WaitlistPlanLink({ slug, label, primary = false }: { slug: string; label: string; primary?: boolean }) {
  return <a href={WAITLIST_HASH} data-waitlist-plan={slug} aria-haspopup="dialog"
    className={`lnd-btn lnd-btn-block ${primary ? "lnd-btn-primary" : "lnd-btn-ghost"} lnd-waitlist-plan`}
    aria-label={`Entrar na lista de espera — ${label}`}>Entrar na lista de espera <ArrowRight size={17} aria-hidden="true" /></a>;
}

/**
 * Compatibilidade: a lista de espera não é mais uma seção da landing.
 * `LaunchWaitlist` agora monta apenas o host do modal (sem formulário inline).
 */
export function LaunchWaitlist() {
  return <WaitlistModal />;
}
