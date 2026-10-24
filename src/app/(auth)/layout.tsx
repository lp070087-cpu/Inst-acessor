import { AuthShell } from "@/components/layout/auth-shell";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesse sua conta",
  description:
    "Entre no Inst Acessor para acompanhar a evolução do seu Instagram.",
};

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
