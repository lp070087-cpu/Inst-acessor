import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
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
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${sora.variable} ${plusJakarta.variable} ${spaceGrotesk.variable}`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
