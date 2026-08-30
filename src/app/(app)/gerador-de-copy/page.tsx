import type { Metadata } from "next";
import { PenSquare } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { listCopies } from "@/lib/ai/services";
import { CopyGenerator } from "@/components/ai/copy-generator";

export const metadata: Metadata = {
  title: "Gerador de Copy",
  description:
    "Crie legendas, textos e chamadas para suas redes sociais com a IA Acessor.",
};

export const dynamic = "force-dynamic";

export default async function GeradorCopyPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const configured = await aiConfigured();

  const saved = configured
    ? await listCopies(userId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <PenSquare size={26} className="text-purple" />
          Gerador de Copy
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Legendas, Reels, Stories, anúncios e mais — gerados com base no seu
          perfil real. Nada é simulado.
        </p>
      </div>

      <CopyGenerator
        aiConfigured={configured}
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
