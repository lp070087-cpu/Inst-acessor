import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Inst Acessor — Inteligência para o crescimento do seu Instagram",
    template: "%s | Inst Acessor",
  },
  description:
    "O Inst Acessor analisa seu perfil, acompanha sua evolução e transforma métricas do Instagram em estratégias práticas para crescer de forma inteligente.",
  applicationName: "Inst Acessor",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Inst Acessor",
    // "default" mantém a barra de status legível sobre o fundo claro do app.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    // iOS/iPadOS não leem o manifest: dependem deste link para o ícone da
    // Tela de Início. O SVG funciona em iOS 16+; versões antigas caem no
    // favicon padrão, sem quebrar a instalação.
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
  },
};

/**
 * BLOCO 5 — `viewportFit: "cover"` é o que faz `env(safe-area-inset-*)`
 * devolver um valor real no iPhone. Sem ele, o Next injeta a meta viewport
 * padrão (sem `viewport-fit=cover`), o navegador mantém o conteúdo dentro da
 * área segura e o `env()` fica sempre 0 — as regras de safe area que este
 * bloco adicionou no header do app, nos drawers e no menu da landing não
 * teriam efeito nenhum.
 *
 * `width: "device-width"` e `initialScale: 1` são o padrão que o Next já
 * aplicava, mantidos aqui de forma explícita para não haver dúvida.
 * Nada de `userScalable: false`: bloquear o zoom prejudica acessibilidade.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* theme-color: barra do navegador / barra de status do PWA instalado
            acompanham o roxo da marca. Mesmo valor do manifest. */}
        <meta name="theme-color" content="#8B5CF6" />
        {/* Instalação em tela cheia no iOS (o manifest não cobre iOS). */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Inst Acessor" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`${sora.variable} ${plusJakarta.variable} ${spaceGrotesk.variable}`}
      >
        <ToastProvider>{children}</ToastProvider>
        {/* Registra o service worker (só em produção/https). Não renderiza nada. */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
