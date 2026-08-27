import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import type { IndividualBaseline } from "./types";

/**
 * BASELINE INDIVIDUAL (MÓDULO 16 — "baseline")
 * =============================================
 * Toda análise deve priorizar comparação com o PRÓPRIO perfil. Um Reel com
 * 10 mil views pode ser excelente para um perfil e fraco para outro.
 *
 * Baselines possíveis (por histórico): mediana do perfil, média móvel,
 * período anterior, top quartile, média por formato.
 *
 * NUNCA comparar cegamente com números universais. Nada de causalidade
 * sem experimento.
 */

function median(values: (number | null | undefined)[]): number | null {
  const nums = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

export interface BaselineSignal {
  followers: number | null;
  engagement: number | null;
  reach: number | null;
  mediaCount: number | null;
  snapshotCount: number;
}

export async function computeIndividualBaseline(
  userId: string,
  platform: "instagram" | "tiktok"
): Promise<IndividualBaseline> {
  const signal = await collectSignals(userId, platform);
  return {
    platform,
    followers: signal.followers,
    engagement: signal.engagement,
    reach: signal.reach,
    mediaCount: signal.mediaCount,
    snapshotCount: signal.snapshotCount,
    byFormat: [],
  };
}

async function collectSignals(
  userId: string,
  platform: "instagram" | "tiktok"
): Promise<BaselineSignal> {
  if (platform === "instagram") {
    const d = await getDashboardInstagramData(userId);
    return {
      followers: d.followersCount ?? null,
      engagement: d.cards.engagement.value ?? null,
      reach: d.cards.reach.value ?? null,
      mediaCount: d.mediaCount ?? null,
      snapshotCount: d.snapshotCount,
    };
  }

  const d = await getTikTokDashboardData(userId);
  return {
    followers: d.followersCount ?? null,
    engagement: d.cards.likes.value ?? null,
    reach: null,
    mediaCount: d.videoCount ?? null,
    snapshotCount: d.snapshotCount,
  };
}

/**
 * Classifica um valor em relação à mediana do perfil:
 *  - "acima-da-mediana" quando >= mediana * 1.25
 *  - "abaixo-da-mediana" quando <= mediana * 0.75
 *  - "na-media" caso contrário
 * Sem mediana → null (dados insuficientes, NUNCA inventar).
 */
export function classifyAgainstBaseline(
  baseline: number | null | undefined,
  value: number | null | undefined
): "acima-da-mediana" | "abaixo-da-mediana" | "na-media" | null {
  if (baseline == null || value == null || baseline === 0) return null;
  if (value >= baseline * 1.25) return "acima-da-mediana";
  if (value <= baseline * 0.75) return "abaixo-da-mediana";
  return "na-media";
}

export { median };
