"use client";

import * as React from "react";
import { Loader2, UserRound, Target, Palette, Layers, AtSign, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface PerfilClientProps {
  user: {
    name: string | null;
    email: string | null;
  };
  profile: {
    displayName: string | null;
    username: string | null;
    niche: string | null;
    subNiche: string | null;
    objective: string | null;
  } | null;
}

/**
 * PERFIL — Fase 10 (#156)
 * =======================
 * Edição dos dados pessoais e de perfil do usuário autenticado.
 *
 * - Campos editáveis: nome de exibição, usuário, nicho, subnicho, objetivo.
 * - E-mail é exibido como leitura (identidade de login).
 * - Salva via `PATCH /api/perfil` (owner-check + validação Zod no servidor).
 * - Feedback via toast; estado de carregamento no botão.
 */
export function PerfilClient({ user, profile }: PerfilClientProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const [displayName, setDisplayName] = React.useState(profile?.displayName ?? "");
  const [username, setUsername] = React.useState(profile?.username ?? "");
  const [niche, setNiche] = React.useState(profile?.niche ?? "");
  const [subNiche, setSubNiche] = React.useState(profile?.subNiche ?? "");
  const [objective, setObjective] = React.useState(profile?.objective ?? "");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, niche, subNiche, objective }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      toast("Perfil atualizado.", "success");
    } catch {
      toast("Erro de rede ao salvar.", "error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-11 w-full rounded-[12px] border border-border bg-bg-ice px-3.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow";

  const Field = ({
    label,
    icon: Icon,
    children,
  }: {
    label: string;
    icon: typeof UserRound;
    children: React.ReactNode;
  }) => (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icon size={15} className="text-ink-muted" />
        {label}
      </span>
      {children}
    </label>
  );

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Nome de exibição" icon={UserRound}>
          <input
            className={inputCls}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
          />
        </Field>

        <Field label="Usuário (@)" icon={AtSign}>
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="seu_usuario"
          />
        </Field>

        <Field label="Nicho" icon={Palette}>
          <input
            className={inputCls}
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Ex.: Moda, Fitness, Gastronomia"
          />
        </Field>

        <Field label="Subnicho" icon={Layers}>
          <input
            className={inputCls}
            value={subNiche}
            onChange={(e) => setSubNiche(e.target.value)}
            placeholder="Ex.: Moda feminina plus size"
          />
        </Field>
      </div>

      <Field label="Objetivo principal" icon={Target}>
        <input
          className={inputCls}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Ex.: Aumentar seguidores, engajamento, vendas"
        />
      </Field>

      <div className="flex items-center gap-3 rounded-[12px] border border-border-soft bg-surface/40 px-4 py-3">
        <Lock size={16} className="text-ink-muted flex-none" />
        <p className="text-[12.5px] text-ink-soft">
          E-mail de login: <span className="font-medium text-ink">{user.email}</span> — não é possível alterar por aqui.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="md" disabled={loading}>
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
          {loading ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
