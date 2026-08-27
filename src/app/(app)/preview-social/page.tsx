import type { Metadata } from "next";
import { Eye } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { listDrafts } from "@/lib/ai/services";
import { PreviewSocial } from "@/components/ai/preview-social-client";

export const metadata: Metadata = {
  title: "Preview Social",
  description: "Visualize seus posts antes de publicar — preview local, sem envio a redes sociais.",
};

export const dynamic = "force-dynamic";

export default async function PreviewSocialPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const drafts = await listDrafts(userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Eye size={26} className="text-purple" />
          Preview Social
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Monte seu post e veja como ele ficaria no Instagram ou TikTok.
          Tudo fica local — nada é publicado.
        </p>
      </div>

      <PreviewSocial
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
      />
    </div>
  );
}
