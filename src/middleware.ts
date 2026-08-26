import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    // Se autenticado e tentando acessar páginas de auth, vai para o dashboard
    if (token && req.nextUrl.pathname.startsWith("/login")) {
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
          pathname.startsWith("/onboarding")
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
    "/gerador-de-anuncios/:path*",
    "/analise-de-desempenho/:path*",
    "/assinatura/:path*",
    "/perfil/:path*",
    "/configuracoes/:path*",
    "/sobre/:path*",
    "/login",
    "/cadastro",
    "/onboarding",
  ],
};
