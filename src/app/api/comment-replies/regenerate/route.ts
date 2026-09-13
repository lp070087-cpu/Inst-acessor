import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { getAIProfile } from "@/lib/ai/services/profile";
import { prisma } from "@/lib/db";
import { generateReply } from "@/lib/comment-replies/generator";
import { isTooSimilar } from "@/lib/comment-replies/generator";
import { resolvePriority } from "@/lib/comment-replies/priority";
import { findLogById, listSpecialProfiles, listTemplates, recentSentReplies, updateLog } from "@/lib/comment-replies/db";
import { regenerateSchema } from "@/lib/validators/comment-replies";
import type { CommentCategory } from "@/lib/comment-replies/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-replies/regenerate
 *
 * Gera uma NOVA sugestão para um comentário já analisado.
 *
 * A regeneração recebe as respostas recentes do próprio usuário (incluindo a
 * sugestão anterior) como "não repita isto" — é aqui que o caso "10 pessoas
 * comentaram 'linda'" é resolvido com respostas diferentes entre si.
 *
 * Não envia nada. O comentário continua PENDING até aprovação explícita.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const body = await request.json();
    const parsed = regenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const log = await findLogById(userId, parsed.data.logId);
    if (!log) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }
    if (log.status === "SENT") {
      return NextResponse.json(
        { error: "Esta resposta já foi enviada. Regerar não alteraria o que está publicado." },
        { status: 409 }
      );
    }

    const [templates, specialProfiles, aiProfile, userProfile, available] = await Promise.all([
      listTemplates(userId),
      listSpecialProfiles(userId),
      getAIProfile(userId),
      prisma.userProfile.findUnique({ where: { userId } }),
      aiConfigured(),
    ]);

    const decision = resolvePriority({
      commentText: log.originalComment,
      commenterUsername: log.commenterUsername,
      category: (log.commentCategory ?? "outro") as CommentCategory,
      // A regeneração não reclassifica o risco: a categoria já foi decidida na
      // análise. Um comentário sensível continua sensível.
      reviewTrigger: null,
      specialProfiles: specialProfiles.map((p) => ({
        id: p.id,
        instagramUsername: p.instagramUsername,
        displayName: p.displayName,
        customInstructions: p.customInstructions,
        fixedReply: p.fixedReply,
        useAI: p.useAI,
        priority: p.priority,
        active: p.active,
      })),
      templates: templates.map((t) => ({
        id: t.id,
        text: t.text,
        category: t.category,
        exactReply: t.exactReply,
        active: t.active,
      })),
      tone: aiProfile?.voiceTone ?? null,
    });

    // A sugestão anterior entra na lista de "não repita".
    const previous = [log.generatedReply, log.finalReply].filter(Boolean) as string[];
    const recent = [...previous, ...(await recentSentReplies(userId, 10))];

    const generated = await generateReply({
      decision,
      commentText: log.originalComment,
      commenterUsername: log.commenterUsername,
      mediaCaption: null,
      mediaType: null,
      aiProfile,
      profileNiche: (userProfile as unknown as { niche: string | null } | null)?.niche ?? null,
      profileObjective: (userProfile as unknown as { objective: string | null } | null)?.objective ?? null,
      recentReplies: recent,
    });

    if (!generated.ok || !generated.reply) {
      return NextResponse.json(
        {
          error: generated.reason ?? "Não foi possível gerar uma nova sugestão.",
          aiConfigured: available,
        },
        { status: 502 }
      );
    }

    // Se a nova sugestão ficou praticamente igual à anterior, avisa — em vez de
    // fingir que variou.
    const repeated = previous.some((p) => isTooSimilar(p, generated.reply as string));

    await updateLog(userId, log.id, { generatedReply: generated.reply, status: "PENDING" });

    return NextResponse.json({
      ok: true,
      generatedReply: generated.reply,
      repeated,
      source: decision.source,
    });
  } catch (err) {
    console.error("[comment-replies/regenerate] erro", err);
    return NextResponse.json({ error: "Não foi possível regerar a resposta." }, { status: 500 });
  }
}
