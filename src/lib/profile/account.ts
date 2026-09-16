import { prisma } from "@/lib/db";

/**
 * DADOS DA CONTA DO INST ACESSOR
 * ===============================
 * Fonte única do que representa a conta do usuário no app (nome, e-mail,
 * foto, @usuário do perfil, nicho, subnicho, objetivo e a preferência de nome
 * exibido). Usado por `/perfil`, pela sidebar e pelo admin — assim a mesma
 * identidade aparece em todos os lugares sem duas implementações.
 *
 * SEPARAÇÃO IMPORTANTE (regra do projeto)
 * ---------------------------------------
 * Isto é a conta do INST ACESSOR. NÃO se confunde com a conta do Instagram ou
 * do TikTok conectada — aquela vive em `SocialConnection` + `InstagramProfile`/
 * `TikTokProfile` e é exibida pelo `ConnectedAccountCard`. Nunca copiamos a foto
 * do Instagram para a conta, nem o contrário: são identidades diferentes.
 *
 * Nada é inventado: campo ausente continua `null` e a UI decide o fallback.
 */

export interface AccountData {
  userId: string;
  /** Nome da conta (`User.name`). null quando nunca foi informado. */
  name: string | null;
  email: string;
  /** Foto da conta (`UserProfile.avatar`). null → a UI usa as iniciais. */
  avatar: string | null;
  /** Apelido usado no Rank/perfil público (`UserProfile.displayName`). */
  displayName: string | null;
  /** @ do perfil público (`UserProfile.username`). null → não configurado. */
  username: string | null;
  niche: string | null;
  subNiche: string | null;
  objective: string | null;
  /** Preferência de origem do nome exibido (JSON `UserPreferences.dashboard`). */
  displayNameSource: "profile" | "instagram";
  createdAt: Date;
}

/** Lê os dados da conta. `null` apenas se o usuário não existir. */
export async function getAccountData(userId: string): Promise<AccountData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          avatar: true,
          displayName: true,
          username: true,
          niche: true,
          subNiche: true,
          objective: true,
        },
      },
      preferences: { select: { dashboard: true } },
    },
  });

  if (!user) return null;

  const dashboard =
    user.preferences?.dashboard && typeof user.preferences.dashboard === "object"
      ? (user.preferences.dashboard as Record<string, unknown>)
      : {};

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    avatar: user.profile?.avatar ?? null,
    displayName: user.profile?.displayName ?? null,
    username: user.profile?.username ?? null,
    niche: user.profile?.niche ?? null,
    subNiche: user.profile?.subNiche ?? null,
    objective: user.profile?.objective ?? null,
    displayNameSource: dashboard.displayNameSource === "instagram" ? "instagram" : "profile",
    createdAt: user.createdAt,
  };
}

/**
 * Nome a ser exibido na interface para a conta do Inst Acessor.
 *
 * Regra de fallback (honesta, sem "Usuário" genérico quando há nome real):
 *   1. nome da conta (`User.name`);
 *   2. apelido do perfil (`displayName`);
 *   3. literal "Minha conta" — NUNCA inventamos um nome.
 *
 * O resultado do Rank (`resolveDisplayName`) continua preferindo o apelido; aqui
 * a ordem é a inversa de propósito, porque a interface da CONTA mostra o nome
 * real, e o Rank mostra o apelido escolhido para aparecer publicamente.
 */
export function accountDisplayName(account: {
  name?: string | null;
  displayName?: string | null;
}): string {
  return account.name?.trim() || account.displayName?.trim() || "Minha conta";
}

/**
 * Slug de @usuário: minúsculas, sem acento, apenas letras/números/ponto/underscore.
 *
 * O `.normalize("NFD")` decompõe as letras acentuadas ("ç" → "c" + cedilha) e o
 * filtro `[^a-z0-9._]` descarta o sinal diacrítico — que é justamente um
 * caractere fora dessa lista. Assim "José" vira "jose" sem precisar de um
 * intervalo de escapes Unicode no arquivo-fonte.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "");
}

/**
 * Regra de aceitação do @ do perfil público.
 *
 * O slug é comparado com `equals`/`mode: "insensitive"` em `loadPublicProfile`,
 * então NÃO restringimos a maiúsculas — só a forma. O mínimo de 3 evita @ de
 * uma letra e o máximo de 30 cabe com folga na coluna `username`.
 */
export function isValidUsername(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 30 && /^[a-z0-9][a-z0-9._]*$/.test(slug);
}

/** Mensagem única para @ inválido — usada pela validação e pela rota. */
export const USERNAME_RULE =
  "O @ do perfil deve ter de 3 a 30 caracteres, começando por letra ou número, usando apenas letras, números, ponto e underline.";

