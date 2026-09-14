"use client";

import * as React from "react";
import { KeyRound, Mail, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export interface AccessGrantRow {
  id: string;
  email: string;
  planName: string | null;
  origin: string;
  status: string;
  startAt: string | null;
  expiresAt: string | null;
  firstAccessCompleted: boolean;
  firstAccessCompletedAt: string | null;
  createdAt: string;
}

// GATEWAY OFICIAL = ASAAS. O rótulo de origem acompanha isso: "Compra" para o
// Asaas (fluxo ativo) e "InfinitePay (histórico)" para liberações antigas —
// o registro antigo continua legível, mas sem sugerir gateway ativo.
const ORIGIN_LABEL: Record<string, string> = {
  ASAAS: "Compra (Asaas)",
  INFINITEPAY: "InfinitePay (histórico)",
  ADMIN_MANUAL: "Liberação manual",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING_FIRST_ACCESS: {
    label: "Aguardando ativação",
    cls: "bg-warn-soft text-warn border border-warn/20",
  },
  ACTIVE: {
    label: "Ativo",
    cls: "bg-success-soft text-success border border-success/20",
  },
  EXPIRED: {
    label: "Expirado",
    cls: "bg-surface text-ink-soft border border-border-soft",
  },
  CANCELED: {
    label: "Cancelado",
    cls: "bg-surface text-ink-soft border border-border-soft",
  },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AdminAccessGrantsTable({ grants: initial }: { grants: AccessGrantRow[] }) {
  const [query, setQuery] = React.useState("");
  const [grants, setGrants] = React.useState<AccessGrantRow[]>(initial);

  React.useEffect(() => {
    setGrants(initial);
  }, [initial]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grants;
    return grants.filter((g) => g.email.toLowerCase().includes(q));
  }, [grants, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por e-mail..."
          className="w-full pl-9 pr-3 py-2.5 rounded-[11px] border border-border bg-card text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30 focus:border-purple/50"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Nenhum acesso liberado"
          description="As liberações de acesso aparecerão aqui."
        />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          {/* min-w garante que as 6 colunas não sejam esmagadas: abaixo disso
              a tabela ROLA dentro do card em vez de quebrar o layout. */}
          <table className="w-full min-w-[820px] text-left text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                <th className="py-2.5 pr-4 font-semibold">E-mail</th>
                <th className="py-2.5 pr-4 font-semibold">Origem</th>
                <th className="py-2.5 pr-4 font-semibold">Plano</th>
                <th className="py-2.5 pr-4 font-semibold">Período</th>
                <th className="py-2.5 pr-4 font-semibold">Status</th>
                <th className="py-2.5 pr-4 font-semibold">1º acesso</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const faLabel = g.firstAccessCompleted
                  ? `Feito em ${fmt(g.firstAccessCompletedAt)}`
                  : "Pendente";
                return (
                  <tr key={g.id} className="border-b border-border-soft/60 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="flex items-center gap-1.5 font-medium text-ink">
                        <Mail size={13} className="text-ink-muted" />
                        {g.email}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {ORIGIN_LABEL[g.origin] ?? g.origin}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{g.planName ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {fmt(g.startAt)} → {fmt(g.expiresAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-pill font-semibold text-[11px] uppercase tracking-wider px-2.5 py-1 whitespace-nowrap " +
                          (STATUS_META[g.status]?.cls ??
                            "bg-surface text-ink-soft border border-border-soft")
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                        {STATUS_META[g.status]?.label ?? g.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={
                          g.firstAccessCompleted
                            ? "text-[12.5px] text-success font-medium"
                            : "text-[12.5px] text-warn font-medium"
                        }
                      >
                        {faLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
