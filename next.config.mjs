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
};

export default nextConfig;
