import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "ai";
type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft border border-border-soft",
  brand: "bg-ai-soft text-purple border border-purple/20",
  success: "bg-success-soft text-success border border-success/20",
  warning: "bg-warn-soft text-warn border border-warn/20",
  danger: "bg-danger-soft text-danger border border-danger/20",
  info: "bg-info-soft text-info border border-info/20",
  ai: "bg-ai-soft text-purple border border-purple/20",
};

const sizes: Record<BadgeSize, string> = {
  xs: "text-[10.5px] px-2 py-0.5",
  sm: "text-[11.5px] px-2.5 py-1",
  md: "text-[12.5px] px-3 py-1.5",
};

export function Badge({
  tone = "neutral",
  size = "sm",
  dot,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill font-semibold tracking-wide whitespace-nowrap",
        tones[tone],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warn",
            tone === "danger" && "bg-danger",
            tone === "info" && "bg-info",
            tone === "brand" && "bg-purple",
            tone === "ai" && "bg-purple",
            tone === "neutral" && "bg-ink-muted"
          )}
        />
      )}
      {children}
    </span>
  );
}

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const statusLabel: Record<string, string> = {
  CONNECTED: "Conectado",
  CONNECTING: "Conectando",
  DISCONNECTED: "Desconectado",
  ERROR: "Erro",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  ADMIN: "Admin",
  USER: "Usuário",
  // Pagamentos
  PAID: "Pago",
  PENDING: "Pendente",
  FAILED: "Falhou",
  REFUNDED: "Reembolsado",
  EXPIRED: "Expirado",
  // Fila de publicação
  AGENDADO: "Agendado",
  PROCESSANDO: "Processando",
  PUBLICADO: "Publicado",
  FALHOU: "Falhou",
  CANCELADO: "Cancelado",
  // Automações / ações
  COMPLETED: "Concluído",
  IN_PROGRESS: "Em andamento",
  DISMISSED: "Ignorado",
  done: "Concluído",
  inprogress: "Em andamento",
  locked: "Bloqueado",
  high: "Alta",
  med: "Média",
  low: "Baixa",
  strong: "Forte",
  opp: "Oportunidade",
  weak: "Fraco",
  warn: "Atenção",
};

const statusTone: Record<string, StatusTone> = {
  CONNECTED: "success",
  CONNECTING: "info",
  DISCONNECTED: "neutral",
  ERROR: "danger",
  ACTIVE: "success",
  SUSPENDED: "danger",
  ADMIN: "info",
  USER: "neutral",
  // Pagamentos
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
  EXPIRED: "neutral",
  // Fila de publicação
  AGENDADO: "info",
  PROCESSANDO: "warning",
  PUBLICADO: "success",
  FALHOU: "danger",
  CANCELADO: "neutral",
  // Automações / ações
  COMPLETED: "success",
  IN_PROGRESS: "info",
  DISMISSED: "neutral",
  done: "success",
  inprogress: "info",
  locked: "neutral",
  high: "danger",
  med: "warning",
  low: "neutral",
  strong: "success",
  opp: "info",
  weak: "danger",
  warn: "warning",
};

const toneClass: Record<StatusTone, string> = {
  success: "bg-success-soft text-success border border-success/20",
  warning: "bg-warn-soft text-warn border border-warn/20",
  danger: "bg-danger-soft text-danger border border-danger/20",
  info: "bg-info-soft text-info border border-info/20",
  neutral: "bg-surface text-ink-soft border border-border-soft",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Badge semântico de status: CONNECTED/ACTIVE/ERROR/done/high... */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = statusLabel[status] ?? status;
  const tone = statusTone[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill font-semibold text-[11px] uppercase tracking-wider px-2.5 py-1 whitespace-nowrap",
        toneClass[tone],
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
