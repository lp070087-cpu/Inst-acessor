"use client";

import * as React from "react";
import { BrainCircuit, Info } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface AIProfileData {
  id: string;
  summary: string;
  niche: string;
  subNiche: string;
  objectives: string;
  communicationStyle: string;
  observedPatterns: string;
  preferredFormats: string;
  ctaPatterns: string;
  hookPatterns: string;
  postingFrequency: string;
  voiceTone: string;
  writingStyle: string;
  notes: string;
  updatedAt: string;
}

interface PerfilInteligenciaProps {
  profile: AIProfileData | null;
}

const FIELDS: { key: keyof AIProfileData; label: string }[] = [
  { key: "summary", label: "Resumo" },
  { key: "niche", label: "Nicho" },
  { key: "subNiche", label: "Subnicho" },
  { key: "objectives", label: "Objetivos" },
  { key: "communicationStyle", label: "Estilo de comunicação" },
  { key: "observedPatterns", label: "Padrões observados" },
  { key: "preferredFormats", label: "Formatos preferidos" },
  { key: "ctaPatterns", label: "Padrões de CTA" },
  { key: "hookPatterns", label: "Padrões de gancho" },
  { key: "postingFrequency", label: "Frequência de postagem" },
  { key: "voiceTone", label: "Tom de voz" },
  { key: "writingStyle", label: "Estilo de escrita" },
  { key: "notes", label: "Anotações" },
];

export function PerfilInteligenciaClient({ profile }: PerfilInteligenciaProps) {
  if (!profile) {
    return (
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
        <EmptyState
          icon={BrainCircuit}
          title="Aguardando mais dados para aprender sobre seu perfil"
          description="Conforme você usa a IA Acessor (chat, gerador de copy, ideias), ela poderá aprender seus padrões. Nada é inventado — sem dados, nada é gravado."
        />
      </div>
    );
  }

  const present = FIELDS.filter((f) => profile[f.key]?.trim());

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-3">
        <h3 className="font-display text-[15.5px] font-bold text-ink">Resumo</h3>
        {present.length === 0 ? (
          <p className="text-[13.5px] text-ink-soft">
            Aguardando mais dados para aprender sobre seu perfil.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {present.map(({ key, label }) => (
              <div key={key} className="rounded-[12px] bg-bg-ice border border-border-soft p-4 flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                  {label}
                </span>
                <p className="text-[13.5px] text-ink leading-relaxed">{profile[key]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-[12.5px] text-ink-muted px-1">
        <Info size={14} className="mt-0.5 flex-none" />
        Atualizado em{" "}
        {new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(profile.updatedAt))}
        . Este perfil é interno e usado apenas para personalizar suas respostas.
      </p>
    </div>
  );
}
