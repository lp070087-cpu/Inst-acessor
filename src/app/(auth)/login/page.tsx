import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { LoginForm } from "./login-form";
import { LoginExperience } from "./login-experience";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta no Inst Acessor.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  // Guarda equivalente à do middleware (defesa em profundidade): quando o
  // usuário chega pelo botão "Entrar" da landing (`?from=landing`), a tela de
  // login é SEMPRE exibida — mesmo que já exista sessão no navegador. Sem isso
  // o servidor redirecionava para /dashboard e o login nunca aparecia.
  const explicitLogin = searchParams?.from === "landing";

  const session = await getSession();
  if (session?.user && !explicitLogin) {
    redirect("/dashboard");
  }

  // Esta página NÃO usa o layout de `(auth)` como moldura visual: o palco
  // escuro da referência substitui a moldura clara daquele layout. O layout
  // continua existindo para as outras telas do grupo (cadastro, onboarding,
  // primeiro-acesso, expirado e acesso-restrito), que seguem claras.
  return (
    <LoginExperience>
      <h1 className="lgn-title">Login</h1>
      <p className="lgn-sub">Entre para acompanhar a evolução do seu Instagram.</p>

      <LoginForm />

      <p className="lgn-foot">
        Ainda não tem conta? <a href="/cadastro">Criar conta</a>
      </p>
    </LoginExperience>
  );
}
