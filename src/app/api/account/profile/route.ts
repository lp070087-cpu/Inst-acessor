import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { normalizeUsername, isValidUsername, USERNAME_RULE } from "@/lib/profile/account";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/account/profile — edição dos dados da CONTA.
 *
 * REGRA CENTRAL: CAMPO AUSENTE ≠ CAMPO LIMPO
 * ------------------------------------------
 * A tela envia apenas os campos que o usuário realmente mexeu. Por isso cada
 * chave é testada com `Object.prototype.hasOwnProperty` antes de entrar no
 * `data` do update:
 *
 *   { "name": "Yasmin" }                 → muda só o nome. Nicho, subnicho e
 *                                          objetivo NÃO são tocados.
 *   { "niche": "" }                      → o usuário APAGOU o nicho de
 *                                          propósito: grava null.
 *
 * Sem essa distinção, um PATCH parcial viraria `null` silencioso em todos os
 * campos que a tela não mandou — o jeito clássico de perder dados.
 *
 * O que NÃO é editável por aqui:
 *   - e-mail  → não existe fluxo seguro de verificação/troca de posse. Fica
 *               somente leitura (ver Etapa J). Trocar e-mail sem prova de posse
 *               permitiria tomar a conta.
 *   - senha   → tem rota própria (`/api/account/password`), que exige a atual.
 *   - nicho/subnicho/objetivo são a MESMA fonte do Perfil de Inteligência
 *     (`UserProfile`), reutilizada aqui em vez de duplicada.
 */

interface Body {
  name?: unknown;
  displayName?: unknown;
  username?: unknown;
  niche?: unknown;
  subNiche?: unknown;
  objective?: unknown;
}

/** Converte um campo de texto: string vazia (ou só espaços) = limpar → null. */
function toNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function has(body: Body, key: keyof Body): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    // ---- Nome da conta (`User.name`) ----
    let userName: string | null | undefined;
    if (has(body, "name")) {
      const value = toNullableText(body.name);
      if (value === null) {
        return NextResponse.json(
          { error: "Informe seu nome.", field: "name" },
          { status: 400 }
        );
      }
      if (value.length > 120) {
        return NextResponse.json(
          { error: "Nome muito longo.", field: "name" },
          { status: 400 }
        );
      }
      userName = value;
    }

    // ---- Campos de `UserProfile` ----
    const profileData: {
      displayName?: string | null;
      username?: string | null;
      niche?: string | null;
      subNiche?: string | null;
      objective?: string | null;
    } = {};

    if (has(body, "displayName")) {
      const value = toNullableText(body.displayName);
      if (value && value.length > 60) {
        return NextResponse.json(
          { error: "Nome de exibição muito longo (máximo 60 caracteres).", field: "displayName" },
          { status: 400 }
        );
      }
      profileData.displayName = value;
    }

    if (has(body, "username")) {
      const value = toNullableText(body.username);
      if (value === null) {
        // Limpar o @ é permitido: o perfil público cai para o @ do Instagram
        // (o Rank já usa esse fallback) ou deixa de existir o link próprio.
        profileData.username = null;
      } else {
        const slug = normalizeUsername(value);
        if (!isValidUsername(slug)) {
          return NextResponse.json(
            { error: USERNAME_RULE, field: "username" },
            { status: 400 }
          );
        }
        // Conflito real: o slug identifica o perfil público, então não pode
        // apontar para duas contas.
        const taken = await prisma.userProfile.findFirst({
          where: {
            username: { equals: slug, mode: "insensitive" },
            userId: { not: userId },
          },
          select: { userId: true },
        });
        if (taken) {
          return NextResponse.json(
            { error: `O @${slug} já está em uso. Escolha outro.`, field: "username" },
            { status: 409 }
          );
        }
        profileData.username = slug;
      }
    }

    if (has(body, "niche")) {
      const value = toNullableText(body.niche);
      if (value === null) {
        return NextResponse.json(
          { error: "Informe seu nicho.", field: "niche" },
          { status: 400 }
        );
      }
      if (value.length > 80) {
        return NextResponse.json(
          { error: "Nicho muito longo.", field: "niche" },
          { status: 400 }
        );
      }
      profileData.niche = value;
    }

    if (has(body, "subNiche")) {
      const value = toNullableText(body.subNiche);
      if (value && value.length > 80) {
        return NextResponse.json(
          { error: "Subnicho muito longo.", field: "subNiche" },
          { status: 400 }
        );
      }
      profileData.subNiche = value;
    }

    if (has(body, "objective")) {
      const value = toNullableText(body.objective);
      if (value === null) {
        return NextResponse.json(
          { error: "Informe seu objetivo.", field: "objective" },
          { status: 400 }
        );
      }
      if (value.length > 60) {
        return NextResponse.json(
          { error: "Objetivo muito longo.", field: "objective" },
          { status: 400 }
        );
      }
      profileData.objective = value;
    }

    // ---- Gravação ----
    if (userName !== undefined) {
      await prisma.user.update({ where: { id: userId }, data: { name: userName } });
    }

    if (Object.keys(profileData).length > 0) {
      // `upsert`: a linha de perfil sempre existe após o onboarding, mas um
      // usuário legado sem perfil não pode receber um erro aqui.
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });
    }

    // Devolve o estado REAL gravado, para a UI revalidar com a fonte da verdade.
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          avatar: true,
          displayName: true,
          username: true,
          niche: true,
          subNiche: true,
          objective: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      user: { name: user?.name ?? null },
      profile: {
        avatar: profile?.avatar ?? null,
        displayName: profile?.displayName ?? null,
        username: profile?.username ?? null,
        niche: profile?.niche ?? null,
        subNiche: profile?.subNiche ?? null,
        objective: profile?.objective ?? null,
      },
    });
  } catch (err) {
    console.error("[account/profile] erro ao salvar", err);
    return NextResponse.json(
      { error: "Não foi possível salvar suas alterações. Tente novamente." },
      { status: 500 }
    );
  }
}
