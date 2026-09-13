/**
 * CONFIG DE SITE — Base URL centralizada (server-side).
 * ======================================================
 * Domínio público oficial: https://unitrixapp.com.br
 *   - www.unitrixapp.com.br também está configurado.
 *   - O domínio da Vercel (inst-acessor.vercel.app) continua válido apenas
 *     para uso TÉCNICO (previews, verificação da Meta em ambiente de dev),
 *     nunca como URL pública oficial apresentada ao usuário.
 *
 * Nenhum valor de secret vive aqui. Esta camada apenas resolve URLs.
 *
 * Ordem de resolução (server-side):
 *   1. SITE_URL            → override explícito (ex.: preview/local)
 *   2. AUTH_URL            → alias usado pelo next-auth no projeto
 *   3. NEXTAUTH_URL        → alias next-auth v4 (injeta em next.config)
 *   4. VERCEL_URL          → domínio técnico da Vercel (quando disponível)
 *   5. Oficial             → https://unitrixapp.com.br
 */

export const OFFICIAL_SITE_URL = "https://unitrixapp.com.br";
export const OFFICIAL_SITE_DOMAIN = "unitrixapp.com.br";

/**
 * CNPJ da Unitrixapp exibido no rodapé da landing.
 * ================================================
 * Como definir: usar EXATAMENTE o número oficial (formato `00.000.000/0000-00`),
 * vindo de uma variável de ambiente pública — nunca de um chute. Variável:
 *
 *     NEXT_PUBLIC_UNITRIXAPP_CNPJ=00.000.000/0000-00
 *
 * Enquanto não estiver configurada, o valor é `null` e o rodapé simplesmente
 * NÃO mostra a linha de CNPJ — nenhum número é inventado ou reaproveitado de
 * terceiros.
 */
export const UNITRIXAPP_CNPJ: string | null =
  (process.env.NEXT_PUBLIC_UNITRIXAPP_CNPJ ?? "").trim() || null;

function clean(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * URL base do ambiente ATUAL (dev/preview/produção).
 * Usada para redirecionamentos internos, callbacks OAuth e links de ativação
 * que precisam apontar para o ambiente em que o usuário está.
 */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.SITE_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (explicit) return clean(explicit);

  // Preview/Vercel → domínio técnico real do deploy (nunca localhost em nuvem).
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return clean(`https://${vercelUrl}`);

  return "http://localhost:3000";
}

/**
 * URL pública OFICIAL (marketing/canonical/webhooks exibidos).
 * Em produção sem override explícito, prefere SEMPRE o domínio oficial
 * unitrixapp.com.br — nunca o domínio técnico da Vercel.
 */
export function getOfficialSiteUrl(): string {
  // Em ambiente local/preview com override explícito, respeita o override
  // (necessário para testar canonical/OG localmente).
  if (process.env.NODE_ENV !== "production") {
    const explicit =
      process.env.SITE_URL?.trim() || process.env.AUTH_URL?.trim();
    if (explicit) return clean(explicit);
  }
  return OFFICIAL_SITE_URL;
}

/**
 * Alias enxuto usado pelas rotas de integração (redirects internos).
 */
export const APP_BASE = process.env.AUTH_URL || "http://localhost:3000";
