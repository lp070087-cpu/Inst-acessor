import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    // LOGIN — usuário já autenticado que abre /login de propósito vai direto
    // para o app. Isso é conveniente (o login não faz sentido para quem já tem
    // sessão), MAS só pode acontecer quando a intenção é realmente entrar.
    //
    // O botão "Entrar" da LANDING aponta para `/login?from=landing`. Sem esta
    // guarda, um visitante com sessão ainda válida no navegador clicava em
    // "Entrar" e era jogado direto no dashboard, sem nunca ver a tela de login
    // — exatamente o problema relatado. Com `from=landing` o redirect é
    // suprimido e a tela de login é exibida de fato.
    const isLogin = req.nextUrl.pathname.startsWith("/login");
    const explicitLogin = req.nextUrl.searchParams.get("from") === "landing";

    if (token && isLogin && !explicitLogin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;
        // Páginas públicas de auth
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/cadastro") ||
          pathname.startsWith("/onboarding") ||
          // Tela de bloqueio por falta de plano: o usuário está autenticado,
          // mas não tem direito de acesso — não pode ser tratado como visitante.
          pathname.startsWith("/acesso-restrito") ||
          pathname.startsWith("/expirado") ||
          pathname.startsWith("/primeiro-acesso")
        ) {
          return true;
        }
        // Requer autenticação para o app
        return !!token;
      },
    },
  }
);

// Matcher 100% estático — Next.js 14 exige que `config.matcher` seja
// estaticamente analisável (sem .map, spreads, funções ou CallExpression).
// URLs públicas reais do route group `(app)` + páginas públicas de auth.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ia-acessor/:path*",
    "/gerador-de-copy/:path*",
    "/ideias/:path*",
    "/preview-social/:path*",
    "/rank/:path*",
    "/mentoria/:path*",
    "/redes-sociais/:path*",
    "/respostas-inteligentes/:path*",
    "/analise-de-desempenho/:path*",
    "/assinatura/:path*",
    "/perfil/:path*",
    "/configuracoes/:path*",
    "/sobre/:path*",
    "/p/:path*",
    "/publishing/:path*",
    "/growth/:path*",
    "/automacoes/:path*",
    "/calendario/:path*",
    "/calendario-inteligente/:path*",
    "/score/:path*",
    "/perfil-de-inteligencia/:path*",
    "/acesso-restrito",
    "/expirado",
    "/primeiro-acesso",
    "/login",
    "/cadastro",
    "/onboarding",
  ],
};
