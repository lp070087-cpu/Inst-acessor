import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: Request) {
  try {
    // Somente usuário autenticado pode solicitar autorização de upload.
    const session = await requireSession();
    const userId = session.user.id;

    const body = (await request.json()) as HandleUploadBody;

    const response = await handleUpload({
      request,
      body,

    async onBeforeGenerateToken(pathname) {
  // Cada usuário fica isolado dentro da própria pasta no Blob.
  const safePathname = pathname
  .replace(/^\/+/, "")
  .replace(/[^a-zA-Z0-9._/-]/g, "-");

if (!safePathname) {
  throw new Error("Nome de arquivo inválido.");
}

const expectedPrefix = `inst-acessor/${userId}/`;

if (!safePathname.startsWith(expectedPrefix)) {
  throw new Error("Destino de upload não autorizado.");
}

return {
  allowedContentTypes: ["image/*", "video/*"],
  maximumSizeInBytes: MAX_UPLOAD_SIZE,
  addRandomSuffix: true,
  allowOverwrite: false,
};
},
});

    return NextResponse.json(response);
  } catch (error) {
    console.error("[upload/media] falha no upload", error);

    return NextResponse.json(
      { error: "Não foi possível autorizar o upload da mídia." },
      { status: 400 }
    );
  }
}