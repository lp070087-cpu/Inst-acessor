import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { z } from "zod";

import { requireSession } from "@/lib/auth/guard";
import {
  countMediaAssets,
  deleteMediaAsset,
  listMediaAssets,
  registerMediaAsset,
  type MediaType,
} from "@/lib/media-library";

export const dynamic = "force-dynamic";

/**
 * BIBLIOTECA DE MÍDIA — API
 * =========================
 * GET    /api/media-library            → lista paginada do PRÓPRIO usuário
 * GET    /api/media-library?counts=1   → contagens por tipo (rótulos das abas)
 * POST   /api/media-library            → registra um upload JÁ concluído no Blob
 * DELETE /api/media-library?id=...     → exclui (com trava se estiver em uso)
 *
 * Todas as rotas exigem sessão e operam SOMENTE sobre o `userId` da sessão.
 * O `userId` NUNCA vem do cliente.
 */

const registerSchema = z.object({
  url: z.string().min(1, "URL da mídia é obrigatória."),
  pathname: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  originalName: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);

    // Contagens das abas: consulta leve, indexada, separada da listagem para
    // que rolar a grade não recarregue os rótulos.
    if (url.searchParams.get("counts") === "1") {
      const counts = await countMediaAssets(userId);
      return NextResponse.json({ counts });
    }

    const typeParam = url.searchParams.get("type");
    const type: MediaType | undefined =
      typeParam === "IMAGE" || typeParam === "VIDEO" ? typeParam : undefined;

    const page = await listMediaAssets(userId, {
      type,
      before: url.searchParams.get("before") ?? undefined,
      unused: url.searchParams.get("unused") === "1",
    });

    return NextResponse.json(page);
  } catch (err) {
    console.error("[media-library] erro ao listar", err);
    return NextResponse.json(
      { error: "Não foi possível carregar a biblioteca." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const asset = await registerMediaAsset(userId, parsed.data);
    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    // Erros de VALIDAÇÃO de pasta/URL são do usuário (400) e a mensagem é
    // segura — o texto não revela nada do servidor. Os demais são 500.
    const message = err instanceof Error ? err.message : "";
    const isValidation = message.includes("não pertence") || message.includes("obrigatória") || message.includes("inválida");
    if (isValidation) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[media-library] erro ao registrar", err);
    return NextResponse.json(
      { error: "Não foi possível registrar a mídia." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Mídia não informada." }, { status: 400 });
    }

    const result = await deleteMediaAsset(userId, id);

    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
    }
    if (!result.ok && result.reason === "in_use") {
      // 409: o registro NÃO foi apagado. A mensagem diz quantos rascunhos
      // dependem do arquivo — o usuário decide, nada é removido em cascata.
      return NextResponse.json(
        {
          error:
            result.usedBy === 1
              ? "Esta mídia está em 1 rascunho. Remova-a do rascunho antes de excluir."
              : `Esta mídia está em ${result.usedBy} rascunhos. Remova-a deles antes de excluir.`,
          usedBy: result.usedBy,
        },
        { status: 409 }
      );
    }

    // ---- remove o binário do Blob ----
    // Só DEPOIS de o registro sair com segurança do banco, e usando a URL que
    // o BANCO devolveu. O `id` recebido do cliente nunca é tratado como URL:
    // se fosse, o `del` viraria um alvo arbitrário escolhido pelo cliente.
    // Se a remoção do Blob falhar, o registro já foi — o pior caso é um
    // arquivo órfão no armazenamento, nunca um rascunho apontando para mídia
    // que não existe mais.
    try {
      await del(result.url);
    } catch (blobErr) {
      console.warn("[media-library] binário não removido do Blob", blobErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[media-library] erro ao excluir", err);
    return NextResponse.json(
      { error: "Não foi possível excluir a mídia." },
      { status: 500 }
    );
  }
}
