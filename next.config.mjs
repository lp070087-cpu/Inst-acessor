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
  // Bound worker pressure only for the isolated audit build.
  ...(process.env.NEXT_OUTPUT_DIR === "outputs/product-build" ? { experimental: { cpus: 1, webpackMemoryOptimizations: true } } : {}),
  // Preview indexing protection and isolated development demo restrictions.
  async headers() {
    // Preview must not be indexed; access protection is configured separately.
    const rules = process.env.VERCEL_ENV === "preview" ? [{
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
    }] : [];
    if (process.env.NODE_ENV !== "development" || process.env.INST_DEMO_MODE !== "1") return rules;
    rules.push({
      source: "/demo/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:3107 ws://localhost:3107; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    });
    return rules;
  },
};

export default nextConfig;
