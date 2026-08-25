"use client";

import { Instagram, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlatformId = "instagram" | "tiktok";

const OPTIONS: {
  id: PlatformId;
  label: string;
  icon: typeof Instagram;
}[] = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: Music2 },
];

/**
 * Seletor de plataforma do Dashboard (Instagram | TikTok).
 * Visual pill idêntico às abas da apresentação (fundo surface, ativo com card).
 */
export function PlatformSelector({
  active,
  onChange,
}: {
  active: PlatformId;
  onChange: (platform: PlatformId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Plataforma"
      className="inline-flex gap-1.5 bg-surface border border-border-soft rounded-pill p-1.5"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-2 text-[13.5px] font-semibold px-4 py-2 rounded-pill transition-all duration-300 cursor-pointer",
              isActive ? "bg-card text-ink shadow-xs" : "text-ink-soft hover:text-ink"
            )}
          >
            <Icon size={15} className={isActive ? "text-purple" : "text-ink-muted"} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
