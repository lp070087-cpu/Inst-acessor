"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do Inst Acessor (`/public/sw.js`).
 *
 * Por que existe: o registro do service worker é um dos requisitos para o
 * navegador oferecer a instalação do PWA (o outro é o manifest).
 *
 * O que ele NÃO faz: cache de dados. O SW é conservador — só estáticos
 * (ícones/manifest/favicon). Ver o cabeçalho de `public/sw.js`.
 *
 * Comportamento:
 *  • Registra apenas em produção e apenas em contexto seguro (https/localhost);
 *  • Falha em silêncio — nunca quebra a página por causa do SW;
 *  • Em desenvolvimento não registra (evita cache atrapalhando o HMR).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Contexto seguro é obrigatório (https, ou localhost em dev).
    if (!window.isSecureContext) return;

    // Em dev o SW só atrapalha o hot reload.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Silencioso de propósito: se o SW não registrar, o app segue
        // funcionando normalmente — apenas sem instalabilidade completa.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
