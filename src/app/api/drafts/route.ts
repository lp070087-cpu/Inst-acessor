import { NextResponse } from "next/server";
import { parseEditorProject, validateEditorOwnership } from "@/lib/media-editor/project";
import { ownedBlobPath } from "@/lib/media/upload-policy";
import { withSessionApi } from "@/lib/auth/session-api";

import { requireSession } from "@/lib/auth/guard";
import { saveDraftSchema } from "@/lib/validators/ai";
import { listDrafts, saveDraft, updateDraft, deleteDraft } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * GET    /api/drafts — lista rascunhos do usuário
 * POST   /api/drafts — salva um rascunho
 * PATCH  /api/drafts?id=... — atualiza um rascunho
 * DELETE /api/drafts?id=... — exclui
 */
async function GETHandler() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rows = await listDrafts(userId);
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        mediaType: r.mediaType,
        mediaUrl: r.mediaUrl ?? "",
        caption: r.caption ?? "",
        hashtags: r.hashtags ?? "",
        format: r.format ?? "",
        framing: r.framing ?? "",
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[drafts] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar os rascunhos." }, { status: 500 });
  }
}

async function POSTHandler(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    if (!validDraftMedia(parsed.data, userId)) return NextResponse.json({error:"Mídia ou projeto inválido para esta conta."},{status:400});
    const created = await saveDraft(userId, parsed.data);
    const row = created as unknown as {
      id: string;
      platform: string;
      mediaType: string;
      mediaUrl: string | null;
      caption: string | null;
      hashtags: string | null;
      format: string | null;
      framing: string | null;
      updatedAt: Date;
    };

    return NextResponse.json({
      ok: true,
      draft: {
        id: row.id,
        platform: row.platform,
        mediaType: row.mediaType,
        mediaUrl: row.mediaUrl ?? "",
        caption: row.caption ?? "",
        hashtags: row.hashtags ?? "",
        format: row.format ?? "",
        framing: row.framing ?? "",
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[drafts] erro ao salvar", err);
    return NextResponse.json({ error: "Não foi possível salvar o rascunho." }, { status: 500 });
  }
}

async function PATCHHandler(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const body = await request.json();
    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    if (!validDraftMedia(parsed.data, userId)) return NextResponse.json({error:"Mídia ou projeto inválido para esta conta."},{status:400});
    const updated = await updateDraft(userId, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Rascunho não encontrado" }, { status: 404 });
    }
    const row = await listDrafts(userId);
    const saved = row.find(d=>d.id===id);
    return NextResponse.json({ ok: true, draft: saved ? {...saved,updatedAt:saved.updatedAt.toISOString()} : undefined });
  } catch (err) {
    console.error("[drafts] erro ao atualizar", err);
    return NextResponse.json({ error: "Erro ao atualizar rascunho." }, { status: 500 });
  }
}

async function DELETEHandler(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const ok = await deleteDraft(userId, id);
    if (!ok) return NextResponse.json({ error: "Rascunho não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[drafts] erro ao excluir", err);
    return NextResponse.json({ error: "Erro ao excluir rascunho." }, { status: 500 });
  }
}

export const GET = withSessionApi(GETHandler);
export const POST = withSessionApi(POSTHandler);
export const PATCH = withSessionApi(PATCHHandler);
export const DELETE = withSessionApi(DELETEHandler);

function validDraftMedia(data:{mediaUrl?:string;framing?:string},userId:string){
 if(data.mediaUrl&&!ownedBlobPath(data.mediaUrl,userId))return false;
 if(!data.framing)return true;
 const project=parseEditorProject(data.framing);if(project)return validateEditorOwnership(project,userId);
 try{const legacy=JSON.parse(data.framing);return Object.keys(legacy).every(k=>['zoom','offsetX','offsetY'].includes(k))&&Number.isFinite(legacy.zoom)&&legacy.zoom>=1&&legacy.zoom<=3&&Number.isFinite(legacy.offsetX)&&Math.abs(legacy.offsetX)<=0.5&&Number.isFinite(legacy.offsetY)&&Math.abs(legacy.offsetY)<=0.5;}catch{return false;}
}
