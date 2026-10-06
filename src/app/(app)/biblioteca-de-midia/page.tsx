import type { Metadata } from "next";
import { Images } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { MediaLibrary } from "@/components/media-library/media-library-client";

export const metadata: Metadata = {
  title: "Biblioteca de Mídia",
  description:
    "Envie fotos e vídeos uma vez e reaproveite em quantos conteúdos quiser — posts, carrosséis e Reels.",
};

export const dynamic = "force-dynamic";

/**
 * BIBLIOTECA DE MÍDIA.
 *
 * A lista NÃO é carregada aqui no servidor de propósito: ela é paginada e
 * filtrada pelo cliente (aba Todas/Fotos/Vídeos + "carregar mais"), então uma
 * consulta no servidor seria trabalho jogado fora na primeira troca de filtro.
 * A tela recebe apenas o `userId` — o isolamento por usuário acontece na API,
 * que lê o `userId` da SESSÃO (nunca do cliente).
 */
export default async function MediaLibraryPage() {
  const { session } = await requireOnboardedSession();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Images}
        title="Biblioteca de Mídia"
        description="Sua galeria dentro do Inst Acessor. Envie uma vez, reutilize sempre — no Preview Social, no Calendário e nos carrosséis."
      />

      <MediaLibrary userId={session.user.id} />
    </div>
  );
}
