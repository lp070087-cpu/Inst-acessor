import { Instagram, Music2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Identificação da conta conectada (Instagram ou TikTok).
 *
 * Mostra SEMPRE dados reais vindos da integração:
 *   - avatar real (quando a plataforma fornece) + fallback premium;
 *   - @username da conta social;
 *   - nome da rede;
 *   - status de conexão;
 *   - última sincronização.
 *
 * O nome pessoal ("Olá, Lucas") NÃO vem daqui — pertence ao usuário
 * autenticado no Inst Acessor e é passado pelo chamador em `greeting`.
 *
 * Nada é inventado: campo ausente → não renderiza aquele pedaço.
 */

type Platform = "instagram" | "tiktok";

interface ConnectedAccountCardProps {
  platform: Platform;
  /** @username real da conta conectada. */
  username?: string | null;
  /** Nome de exibição devolvido pela plataforma (opcional). */
  displayName?: string | null;
  /** URL real do avatar. null/undefined → fallback com inicial. */
  avatarUrl?: string | null;
  lastSyncAt?: Date | null;
  /** Saudação ao usuário autenticado (ex.: "Olá, Lucas"). Opcional. */
  greeting?: string | null;
  className?: string;
}

const PLATFORM_META: Record<Platform, { label: string; Icon: typeof Instagram }> = {
  instagram: { label: "Instagram", Icon: Instagram },
  tiktok: { label: "TikTok", Icon: Music2 },
};

/** Data/hora local no formato dd/mm/aaaa hh:mm. */
function formatLastSync(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ConnectedAccountCard({
  platform,
  username,
  displayName,
  avatarUrl,
  lastSyncAt,
  greeting,
  className,
}: ConnectedAccountCardProps) {
  const { label, Icon } = PLATFORM_META[platform];
  const lastSync = formatLastSync(lastSyncAt);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-lg border border-border-soft",
        "bg-brand-grad-card shadow-sm p-5 sm:p-6",
        className
      )}
    >
      {/* Brilho de marca — discreto, não compete com o conteúdo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-brand-grad-soft blur-2xl"
      />

      <div className="relative flex items-center gap-4 flex-wrap sm:flex-nowrap">
        <Avatar
          name={username ?? displayName ?? label}
          src={avatarUrl ?? null}
          size="lg"
        />

        <div className="min-w-0 flex-1">
          {greeting && (
            <p className="font-display text-[17px] sm:text-[19px] font-bold text-ink truncate">
              {greeting}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[14px] font-semibold text-ink-soft truncate max-w-full">
              {username ? `@${username}` : "Conta conectada"}
            </span>
          </div>

          <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft">
              <Icon size={14} className="text-purple flex-none" />
              {label}
            </span>

            <span
              aria-hidden
              className="hidden sm:inline-block w-1 h-1 rounded-full bg-ink-muted/50"
            />

            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-none" />
              Conectado
            </span>
          </div>

          {lastSync && (
            <p className="text-[12.5px] text-ink-muted mt-1">
              Última sincronização: <span className="text-ink-soft font-medium">{lastSync}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
