import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadPublicProfile } from "@/lib/gamification";
import { PublicProfileView } from "@/components/gamification/public-profile-view";

/**
 * PERFIL PÚBLICO — `/p/[slug]`
 * ============================
 * Rota PÚBLICA de verdade: vive FORA do grupo `(app)`, então NÃO herda o
 * layout autenticado nem o middleware de sessão. Abre sem login.
 *
 * Resolve o mesmo slug que o Rank gera em "Copiar link do perfil"
 * (`UserName` → `@username` do Instagram conectado). Quando não existe
 * usuário para o slug, mostra o 404 do sistema (`not-found`), nunca um
 * redirecionamento para o login.
 *
 * O que aparece aqui é SOMENTE o que `loadPublicProfile` devolve: nome,
 * @, nível, XP, posição, progresso para o próximo nível e conquistas
 * públicas desbloqueadas. Sem e-mail, sem token, sem id interno.
 */

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const payload = await loadPublicProfile(params.slug);
  if (!payload) {
    return {
      title: "Perfil não encontrado",
      robots: { index: false, follow: false },
    };
  }

  const title = `${payload.name} — nível ${payload.level} com ${payload.xp} XP`;
  const description = `Veja a evolução de ${payload.name} no Inst Acessor: nível ${payload.level}, ${payload.xp} XP acumulados e as conquistas desbloqueadas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Inst Acessor",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: RouteParams) {
  const payload = await loadPublicProfile(params.slug);
  if (!payload) notFound();

  return (
    <main className="min-h-dvh bg-bg px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        {/* Marca discreta — dá contexto de "onde estou" sem competir com o
            perfil público. */}
        <div className="mb-6 flex items-center justify-center">
          <span className="text-[13px] font-semibold tracking-tight text-ink-soft">
            Inst <span className="text-purple">Acessor</span>
            <span className="mx-2 text-ink-muted">·</span>
            <span className="text-ink-muted">Perfil público</span>
          </span>
        </div>

        <PublicProfileView payload={payload} />

        {/* CTA opcional — convida quem chegou pelo link a conhecer o produto,
            sem parecer propaganda dentro do perfil de outra pessoa. */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-purple hover:underline"
          >
            Conheça o Inst Acessor — inteligência para crescer no Instagram
          </a>
        </div>
      </div>
    </main>
  );
}
