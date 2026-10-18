import { fileURLToPath } from "node:url";
/** @type {import('next').NextConfig} */
const nextConfig = {
  // NextAuth v4 lê NEXTAUTH_URL; mapeamos AUTH_URL (padrão de env do projeto).
  env: {
    NEXTAUTH_URL: process.env.AUTH_URL || "http://localhost:3000",
  },
  distDir: process.env.NEXT_OUTPUT_DIR || ".next",
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  reactStrictMode: true,
};

export default nextConfig;
