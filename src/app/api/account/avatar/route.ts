import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { validateAvatarDataUrl, MAX_AVATAR_BYTES } from "@/lib/profile/avatar";

export const dynamic = "force-dynamic";

/**
 * FOTO DA CONTA DO INST ACESSOR
 * ==============================
 *   PUT    /api/account/avatar → grava a nova foto
 *   DELETE /api/account/avatar → remove a foto (volta para as iniciais)
 *
 * ONDE A FOTO É ARMAZENADA (ver `src/lib/profile/avatar.ts`)
 * ---------------------------------------------------------
 * No campo `UserProfile.avatar`, que JÁ EXISTE no schema — como data URL de uma
 * imagem reduzida no navegador. O projeto não tem storage de arquivos (nenhuma
 * dependência e nenhuma rota de upload), então não se inventou infraestrutura:
 * usou-se o campo existente com um teto pequeno. Quando houver storage real,
 * apenas o VALOR gravado muda — campo, rota e UI continuam iguais.
 *
 * VALIDAÇÃO NO SERVIDOR
 * ---------------------
 * O `accept="image/*"` do <input> é conveniência de UI e não é confiável. Aqui:
 *   - limite de corpo da requisição checado pelo `Content-Length` ANTES de ler;
 *   - tipo real da imagem decidido pelos MAGIC BYTES, não pelo que o cliente diz;
 *   - arquivo vazio recusado; tamanho decodificado reconferido.
 *
 * NÃO CONFUNDIR COM A FOTO DO INSTAGRAM
 * -------------------------------------
 * Isto é a foto da conta do Inst Acessor. A foto da conta do Instagram/TikTok
 * conectada vive na integração e NUNCA é copiada para cá (nem o contrário) —
 * são identidades diferentes.
 */

/** Folga sobre o teto: um data URL de N bytes ocupa ~N*4/3 em base64 + cabeçalho. */
const MAX_BODY_BYTES = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 1024;

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Recusa cedo um corpo obviamente grande, sem materializá-lo em memória.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error: `A imagem é muito grande. O limite é ${Math.round(
            MAX_AVATAR_BYTES / 1024
          )} KB — escolha um arquivo menor.`,
        },
        { status: 413 }
      );
    }

    const body = (await request.json().catch(() => null)) as { image?: unknown } | null;
    if (!body || typeof body.image !== "string") {
      return NextResponse.json(
        { error: "Nenhuma imagem foi enviada." },
        { status: 400 }
      );
    }

    const result = validateAvatarDataUrl(body.image);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, avatar: result.dataUrl },
      update: { avatar: result.dataUrl },
    });

    // A resposta devolve o que foi REALMENTE gravado (data URL reconstruído a
    // partir dos bytes validados), para a UI renderizar exatamente isso.
    return NextResponse.json({
      ok: true,
      avatar: result.dataUrl,
      mime: result.mime,
      bytes: result.bytes,
    });
  } catch (err) {
    console.error("[account/avatar] erro ao salvar", err);
    return NextResponse.json(
      { error: "Não foi possível salvar sua foto. Tente novamente." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // `updateMany` só afeta a linha do próprio usuário (mesma cláusula `where`),
    // sem criar perfil novo se ele não existir.
    await prisma.userProfile.updateMany({
      where: { userId },
      data: { avatar: null },
    });

    return NextResponse.json({ ok: true, avatar: null });
  } catch (err) {
    console.error("[account/avatar] erro ao remover", err);
    return NextResponse.json(
      { error: "Não foi possível remover sua foto. Tente novamente." },
      { status: 500 }
    );
  }
}
