import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { listDrafts, listCopies } from "@/lib/ai/services";
import { getMediaAsset } from "@/lib/media-library";
import { PageHeader } from "@/components/layout/page-header";
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
export default async function PreviewSocialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireOnboardedSession();
  // A mídia escolhida na Biblioteca chega por `?mid=<id>` (ver `.../biblioteca`,
  // em `media-library-client.tsx`). Assim a seleção sobrevive ao recarregar — e
  // evita o `sessionStorage`, que se perde em aba nova.
  //
  // `searchParams` torna esta página DINÂMICA. Isso não é custo novo aqui: ela
  // já declara `force-dynamic` e depende da sessão do usuário, então já era
  // renderizada por requisição.
  const params = (await searchParams) ?? {};
  const mid = params.mid;
  const mediaId = typeof mid === "string" && mid.length > 0 ? mid : null;
  // Formato sugerido pela Biblioteca ("Criar carrossel" → "carrossel").
  const fmt = params.formato;
  const initialFormat =
    typeof fmt === "string" && ["post", "reel", "story", "carrossel"].includes(fmt)
      ? fmt
      : null;
  const userId = session.user.id;

  const [drafts, configured] = await Promise.all([listDrafts(userId), aiConfigured()]);
  const saved = configured ? await listCopies(userId) : [];

  // Mídia vinda da Biblioteca: busca no SERVIDOR, já isolada pelo `userId` da
  // sessão (`getMediaAsset` só devolve o que é do usuário).
  //
  // Por que aqui e não no cliente: a página já renderiza por requisição, então
  // a mídia chega junto com o HTML — sem um fetch a mais, sem tela vazia e sem
  // depender de estado do navegador para saber o que o usuário escolheu.
  const media = mediaId ? await getMediaAsset(userId, mediaId) : null;
  const initialMedia = media
    ? { id: media.id, url: media.url, type: media.type }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Sparkles}
        title="Preview Social"
        description="Escolha plataforma e formato, gere a legenda com IA, edite, veja como ficaria e salve o rascunho. Tudo local — nada é publicado nem enviado a Meta/TikTok."
      />

      <PreviewSocial
        userId={userId}
        aiConfigured={configured}
        initialMedia={initialMedia}
        initialFormat={initialFormat}
        initialDrafts={drafts.map((d) => ({
          id: d.id,
          platform: d.platform,
          mediaType: d.mediaType,
          mediaUrl: d.mediaUrl ?? "",
          caption: d.caption ?? "",
          hashtags: d.hashtags ?? "",
          format: d.format ?? "",
          framing: d.framing ?? "",
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
