import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { listDrafts, listCopies } from "@/lib/ai/services";
import { PreviewSocial } from "@/components/ai/preview-social-client";

export const metadata: Metadata = {
  title: "Preview Social",
  description:
    "Crie a legenda com IA, edite, veja como ficaria e salve — preview local, sem envio a redes sociais.",
};

export const dynamic = "force-dynamic";

/**
 * Central de criação.
 * O módulo Gerador de Copy foi incorporado AQUI: esta página carrega tanto os
 * rascunhos quanto as legendas já salvas na biblioteca, e o componente usa a
 * mesma rota de geração (`/api/ai/generate-copy`) que o Gerador usava.
 */
export default async function PreviewSocialPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const [drafts, configured] = await Promise.all([listDrafts(userId), aiConfigured()]);
  const saved = configured ? await listCopies(userId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Sparkles size={26} className="text-purple" />
          Preview Social
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Escolha plataforma e formato, gere a legenda com IA, edite, veja como
          ficaria e salve o rascunho. Tudo local — nada é publicado nem enviado
          a Meta/TikTok.
        </p>
      </div>

      <PreviewSocial
        aiConfigured={configured}
        initialDrafts={drafts.map((d) => ({
          id: d.id,
          platform: d.platform,
          mediaType: d.mediaType,
          mediaUrl: d.mediaUrl ?? "",
          caption: d.caption ?? "",
          hashtags: d.hashtags ?? "",
          format: d.format ?? "",
          updatedAt: d.updatedAt.toISOString(),
        }))}
        initialSaved={saved.map((c) => ({
          id: c.id,
          platform: c.platform,
          format: c.format,
          content: c.content,
          isFavorite: c.isFavorite,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
