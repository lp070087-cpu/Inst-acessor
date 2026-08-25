import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    // Se autenticado e tentando acessar páginas de auth, vai para o app
    if (token && req.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/app/dashboard", req.url));
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

export const config = {
  matcher: ["/app/:path*", "/login", "/cadastro", "/onboarding"],
};
