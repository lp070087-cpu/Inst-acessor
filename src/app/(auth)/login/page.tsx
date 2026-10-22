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
  searchParams?: Promise<{ from?: string }>;
}) {
  // Guarda equivalente à do middleware (defesa em profundidade): quando o
  // usuário chega pelo botão "Entrar" da landing (`?from=landing`), a tela de
  // login é SEMPRE exibida — mesmo que já exista sessão no navegador. Sem isso
  // o servidor redirecionava para /dashboard e o login nunca aparecia.
  const explicitLogin = (await searchParams)?.from === "landing";

  const session = await getSession();
  if (session?.user && !explicitLogin) {
    redirect("/dashboard");
  }

  // A moldura visual própria (LoginExperience) substitui a do layout `(auth)`;
  // as demais telas do grupo continuam usando o AuthShell claro.
  return (
    <LoginExperience>
      <h1 className="lgn-title">Bem-vindo de volta</h1>
      <p className="lgn-sub">Entre para acompanhar a evolução do seu Instagram.</p>

      <LoginForm />

      <p className="lgn-foot">
        Ainda não tem conta? <a href="/cadastro">Criar conta</a>
      </p>
    </LoginExperience>
  );
}
