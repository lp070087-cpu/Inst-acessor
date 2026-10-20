import { NextResponse } from "next/server";
import { withPremiumApi } from "@/lib/auth/premium-api";
import { requireSession } from "@/lib/auth/guard";
import { resolvePublishConnection } from "@/lib/publishing/connection";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";
import { hasTikTokPublishScope, queryTikTokCreatorInfo } from "@/lib/integrations/tiktok/creator-info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function GETHandler() {
  if (process.env.TIKTOK_PUBLISHING_ENABLED !== "true") return NextResponse.json({ error: "Publicação TikTok desativada neste ambiente." }, { status: 503 });
  const session = await requireSession();
  if (!await dbRateLimiter.check(`tiktok-creator-info:${session.user.id}`, { windowMs: 60_000, max: 10 })) return NextResponse.json({ error: "Aguarde antes de atualizar as opções." }, { status: 429 });
  const connection = await resolvePublishConnection(session.user.id, "tiktok");
  if (!connection.ok || !hasTikTokPublishScope(connection.scopes)) return NextResponse.json({ error: "Conecte o TikTok com permissão de publicação.", reconnect: true }, { status: 409 });
  try {
    return NextResponse.json({ creator: await queryTikTokCreatorInfo(connection.accessToken, connection.externalAccountId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "O TikTok não permitiu carregar as opções atuais. Tente novamente mais tarde." }, { status: 503 });
  }
}
export const GET = withPremiumApi(GETHandler);
