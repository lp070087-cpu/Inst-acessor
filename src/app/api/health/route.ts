import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check público para monitoramento de produção (uptime/probes).
 *
 * - Retorna 200 quando o app está de pé.
 * - NÃO expõe variáveis de ambiente, tokens, segredos, versões internas
 *   ou caminhos de infraestrutura.
 * - `database` tenta um SELECT mínimo para indicar conectividade com o
 *   banco; se falhar, o endpoint ainda responde 200 (a indisponibilidade
 *   do banco é degradada e observada via logs), para não derrubar probes.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "ok";

  try {
    // `prisma` é importado dinamicamente para não custar nada no arranque
    // quando este endpoint é chamado por probes com frequência.
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }

  return NextResponse.json(
    {
      status: "ok",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
