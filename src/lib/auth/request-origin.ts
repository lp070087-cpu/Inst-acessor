import { OFFICIAL_SITE_DOMAIN } from "@/lib/config/site";

function originOf(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  try { return new URL(value.trim()).origin; } catch { return null; }
}

/**
 * Origens aceitas para mutações vindas do navegador: o próprio host da
 * requisição (same-origin de fato), as URLs configuradas do app e o domínio
 * oficial com e sem `www`. Comparar só com AUTH_URL rejeitava o site oficial
 * quando a variável apontava para o domínio técnico da Vercel.
 */
function trustedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  for (const candidate of [
    request.url,
    host ? `${proto}://${host}` : null,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    `https://${OFFICIAL_SITE_DOMAIN}`,
    `https://www.${OFFICIAL_SITE_DOMAIN}`,
  ]) {
    const origin = originOf(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function isSameOriginMutation(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser API clients still need authentication.
  try {
    return trustedOrigins(request).has(new URL(origin).origin);
  } catch { return false; }
}
