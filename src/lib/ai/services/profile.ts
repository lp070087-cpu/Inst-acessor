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
