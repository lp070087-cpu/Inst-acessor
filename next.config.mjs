/** @type {import('next').NextConfig} */
const nextConfig = {
  // NextAuth v4 lê NEXTAUTH_URL; mapeamos AUTH_URL (padrão de env do projeto).
  env: {
    NEXTAUTH_URL: process.env.AUTH_URL || "http://localhost:3000",
  },
  eslint: {
    // Lint será executado explicitamente (npm run lint), sem travar o build.
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  // Headers de segurança básicos (Parte 32).
  // CSP não é imposto aqui para não quebrar o app (avaliado separadamente).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
