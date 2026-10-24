import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/config";
import { resolvePremiumAccess } from "@/lib/access/premium";
import { isOwnedUploadPath, UPLOAD_CONTENT_TYPES } from "@/lib/media/upload-policy";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";
import { isSameOriginMutation } from "@/lib/auth/request-origin";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  try {
    // Somente usuário autenticado pode solicitar autorização de upload.
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!(await resolvePremiumAccess(session.user.id)).hasAccess) return NextResponse.json({ error: "Acesso ao plano necessário." }, { status: 403 });
    const userId = session.user.id;
    // Seven carousel originals plus seven non-destructive exports need 14 tokens.
    // Keep a bounded per-user limit while allowing one complete editor save.
    if (!(await dbRateLimiter.check(`upload:${userId}`, { windowMs: 60_000, max: 20 }))) {
      return NextResponse.json({ error: "Muitos uploads. Tente novamente em instantes." }, { status: 429 });
    }

    const body = (await request.json()) as HandleUploadBody;

    const response = await handleUpload({
      request,
      body,

    async onBeforeGenerateToken(pathname) {
  // Cada usuário fica isolado dentro da própria pasta no Blob.
if (!isOwnedUploadPath(pathname, userId)) {
  throw new Error("Destino de upload não autorizado.");
}

return {
  allowedContentTypes: UPLOAD_CONTENT_TYPES,
  maximumSizeInBytes: MAX_UPLOAD_SIZE,
  addRandomSuffix: true,
  allowOverwrite: false,
};
},
});

    return NextResponse.json(response);
  } catch (error) {
    console.error("[upload/media] falha ao autorizar upload");

    return NextResponse.json(
      { error: "Não foi possível autorizar o upload da mídia." },
      { status: 400 }
    );
  }
}
