import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/auth/admin-api";
import { readLaunchBody } from "@/lib/launch-waitlist/validation";
import { launchCampaignSendSchema } from "@/lib/launch-waitlist/admin-validation";
import { LaunchCampaignError, type LaunchCampaignErrorCode, confirmLaunchCampaignSend } from "@/lib/launch-waitlist/campaigns";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
export const dynamic = "force-dynamic";

const MESSAGES: Record<LaunchCampaignErrorCode, [number, string]> = {
  NOT_FOUND: [404, "Campanha não encontrada."],
  NOT_PREPARED: [409, "A campanha não está preparada para envio."],
  TRANSPORT_NOT_CONFIGURED: [409, "O canal desta campanha não está configurado/ativado. Nada foi enviado e a fila continua retida."],
  PRESALE_APPROVAL_REQUIRED: [400, "Confirme explicitamente a abertura da pré-venda."],
  CONTENT_MISSING: [409, "A campanha não tem conteúdo válido. Prepare uma nova campanha com outro identificador."],
  URL_NOT_OFFICIAL: [409, "O link da campanha não aponta para o site oficial."],
  CAMPAIGN_CONFLICT: [409, "Conteúdo da campanha inconsistente."],
};

/**
 * Step 2: explicit send. Requires confirmSend=true and the campaign key retyped exactly
 * (and presaleApproved=true for LAUNCH). Only this moves a campaign to SENDING.
 */
const handler = withAdminApi(async (request: Request) => {
  if (!await dbRateLimiter.check(`launch:campaign-send:${clientIp(request)}`, { max: 5, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429 });
  const parsed = launchCampaignSendSchema.safeParse(await readLaunchBody(request));
  if (!parsed.success) return NextResponse.json({ error: "Digite exatamente o identificador da campanha e confirme o envio." }, { status: 400 });
  try {
    const result = await confirmLaunchCampaignSend({ key: parsed.data.key, presaleApproved: parsed.data.presaleApproved });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof LaunchCampaignError) { const [status, message] = MESSAGES[error.code]; return NextResponse.json({ error: message, code: error.code }, { status }); }
    throw error;
  }
});
export async function POST(request: Request) {
  try { const response = await handler(request); response.headers.set("Cache-Control", "no-store"); return response; }
  catch { return NextResponse.json({ error: "Não foi possível confirmar o envio." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
