import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validators/auth";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";
import { createHash } from "node:crypto";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    newUser: "/cadastro",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const forwarded = request.headers?.["x-forwarded-for"];
        const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "unknown";
        if (!(await dbRateLimiter.check(`login-ip:${ip}`, { windowMs: 60_000, max: 10 }))) return null;
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        if (!(await dbRateLimiter.check(`login-email:${email.toLowerCase()}`, { windowMs: 60_000, max: 10 }))) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            profile: {
              select: { onboardingCompleted: true },
            },
          },
        });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
      }
      if (token.id) {
        const current = await prisma.user.findUnique({ where: { id: String(token.id) }, select: { status: true, role: true, passwordHash: true } });
        if (!current || current.status !== "ACTIVE") return { ...token, id: "", role: "USER", revoked: true };
        const authVersion = createHash("sha256").update(current.passwordHash ?? "").digest("hex");
        if (!user && token.authVersion !== authVersion) return { ...token, id: "", role: "USER", revoked: true };
        token.authVersion = authVersion;
        token.role = current.role;
        token.revoked = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as "USER" | "ADMIN" | undefined) ?? "USER";
      }
      return session;
    },
  },
};

/** Sessão do servidor tipada (App Router). */
export function getSession() {
  return getServerSession(authOptions).then((session) => session?.user?.id ? session : null);
}
