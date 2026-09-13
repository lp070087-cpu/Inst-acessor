/**
 * REGISTRO DE ADAPTERS — Fase 7
 * =============================
 * Mapeia plataforma → adapter de publicação. Fonte única de resolução.
 */

import type { PublishingAdapter } from "../types";
import { instagramAdapter } from "./instagram";
import { tiktokAdapter } from "./tiktok";

export { instagramAdapter } from "./instagram";
export { tiktokAdapter } from "./tiktok";

const ADAPTERS: Record<string, PublishingAdapter> = {
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
};

/** Retorna o adapter da plataforma, ou null se não suportada. */
export function getAdapter(platform: string): PublishingAdapter | null {
  return ADAPTERS[platform] ?? null;
}

/** Lista os nomes das plataformas com adapter registrado. */
export function listAdapters(): string[] {
  return Object.keys(ADAPTERS);
}
