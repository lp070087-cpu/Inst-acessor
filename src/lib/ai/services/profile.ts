import { ai } from "@/lib/ai/db";

/**
 * Perfil de Inteligência ("A IA aprendeu sobre você").
 *
 * A persistência está preparada (model AIProfile). A IA ainda não grava
 * automaticamente neste modelo — apenas lemos o que existir. Sem dados,
 * a UI mostra o estado controlado "Aguardando mais dados para aprender
 * sobre seu perfil".
 */

export interface AIProfileData {
  id: string;
  summary?: string | null;
  niche?: string | null;
  subNiche?: string | null;
  objectives?: string | null;
  communicationStyle?: string | null;
  observedPatterns?: string | null;
  preferredFormats?: string | null;
  ctaPatterns?: string | null;
  hookPatterns?: string | null;
  postingFrequency?: string | null;
  voiceTone?: string | null;
  writingStyle?: string | null;
  notes?: string | null;
  updatedAt: Date;
}

/** Retorna o perfil de inteligência do usuário, se existir. */
export async function getAIProfile(userId: string): Promise<AIProfileData | null> {
  const row = await ai.profile.findUnique({ where: { userId } });
  if (!row) return null;
  return row as AIProfileData;
}

/** Campos de `AIProfile` que o próprio usuário pode corrigir. */
const PROFILE_WRITABLE_FIELDS = [
  "summary",
  "niche",
  "subNiche",
  "objectives",
  "communicationStyle",
  "observedPatterns",
  "preferredFormats",
  "ctaPatterns",
  "hookPatterns",
  "postingFrequency",
  "voiceTone",
  "writingStyle",
  "notes",
] as const;

export type AIProfileWritableField = (typeof PROFILE_WRITABLE_FIELDS)[number];

/**
 * CORREÇÃO do perfil pelo próprio usuário.
 *
 * Sempre escopado por `userId`: a rota só passa o id da sessão, então um
 * usuário JAMAIS escreve no perfil de outro. Cria a linha quando ainda não
 * existe (primeira correção) e faz upsert campo a campo — só os campos
 * enviados são tocados, o resto permanece.
 */
export async function updateAIProfile(
  userId: string,
  fields: Partial<Record<AIProfileWritableField, string>>
): Promise<AIProfileData | null> {
  const data: Record<string, string | null> = {};
  for (const key of PROFILE_WRITABLE_FIELDS) {
    const value = fields[key];
    if (value === undefined) continue;
    const trimmed = value.trim();
    data[key] = trimmed.length ? trimmed : null;
  }

  const existing = await ai.profile.findUnique({ where: { userId } });
  const row = existing
    ? await ai.profile.update({ where: { userId }, data })
    : await ai.profile.create({ data: { userId, ...data } });
  return row as AIProfileData;
}

/** Lista os campos corrigíveis — usado pela validação da rota. */
export const AI_PROFILE_WRITABLE_FIELDS: readonly AIProfileWritableField[] =
  PROFILE_WRITABLE_FIELDS;
