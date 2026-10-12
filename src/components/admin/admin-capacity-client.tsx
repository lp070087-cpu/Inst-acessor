"use client";

import * as React from "react";
import {
  Loader2,
  Save,
  RotateCcw,
  Send,
  XCircle,
  CheckCircle2,
  Trash2,
  Users,
  Ticket,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { CapacityConfig, CapacityDecision } from "@/lib/billing/capacity";

/**
 * CAPACIDADE + LISTA DE ESPERA — PAINEL DO ADMIN
 * ================================================
 * Edita a configuração que o SERVIDOR usa para decidir se há vaga, e gerencia a
 * lista de espera. Regras de honestidade visíveis:
 *
 *  1. O número de "vagas usadas" vem do SERVIDOR (pagantes + reservas +
 *     convites), não de uma estimativa local.
 *  2. Fechar as vendas (`signupsOpen=false`) bloqueia TODA compra nova — e a
 *     tela avisa. Renovações continuam funcionando (não passam por aqui).
 *  3. "Liberar vaga" é um CONVITE vigente: ele SEGURA uma vaga e permite à
 *     pessoa comprar mesmo com a loja lotada. Expira sozinho.
 */

interface WaitlistRow {
  id: string;
  name: string | null;
  email: string;
  status: string;
  invitedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  convertedAt: string | null;
}

interface Counts {
  WAITING: number;
  INVITED: number;
  CONVERTED: number;
  EXPIRED: number;
}

const STATUS_META: Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info" }> = {
  WAITING: { label: "Aguardando", tone: "info" },
  INVITED: { label: "Convidado", tone: "brand" },
  CONVERTED: { label: "Convertido", tone: "success" },
  EXPIRED: { label: "Expirado", tone: "neutral" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-purple"
      />
      <span className="text-[13px] text-ink">{label}</span>
    </label>
  );
}

export function AdminCapacityClient({
  initialConfig,
  initialCounts,
  initialDecision,
  defaultConfig,
  initialEntries,
}: {
  initialConfig: CapacityConfig;
  initialCounts: Counts;
  initialDecision: CapacityDecision;
  defaultConfig: CapacityConfig;
  initialEntries: WaitlistRow[];
}) {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<CapacityConfig>(initialConfig);
  const [counts, setCounts] = React.useState<Counts>(initialCounts);
  const [decision, setDecision] = React.useState<CapacityDecision>(initialDecision);
  const [entries, setEntries] = React.useState<WaitlistRow[]>(initialEntries);
  const [busy, setBusy] = React.useState(false);
  const [actionId, setActionId] = React.useState<string | null>(null);

  const unlimited = config.maxPayers == null;

  const setMax = (raw: string) => {
    const digits = raw.replace(/\D+/g, "");
    if (!digits) {
      setConfig((c) => ({ ...c, maxPayers: null }));
      return;
    }
    const n = Math.min(Number(digits), 1_000_000);
    setConfig((c) => ({ ...c, maxPayers: n }));
  };

  const reload = async () => {
    try {
      const res = await fetch("/api/admin/waitlist");
      const data = (await res.json()) as {
        counts?: Counts;
        capacity?: CapacityConfig;
        decision?: CapacityDecision;
      };
      if (data.counts) setCounts(data.counts);
      if (data.capacity) setConfig(data.capacity);
      if (data.decision) setDecision(data.decision);
    } catch {
      /* silencioso: o dado anterior segue na tela */
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: CapacityConfig };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      if (data.config) setConfig(data.config);
      toast("Capacidade salva.", "success");
      await reload();
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(false);
    }
  };

  const restoreDefaults = () => {
    setConfig(defaultConfig);
    toast("Valores padrão carregados. Clique em Salvar para aplicar.", "info");
  };

  const runAction = async (
    id: string,
    action: "invite" | "expire" | "convert" | "remove"
  ) => {
    setActionId(id);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível concluir a ação.", "error");
        return;
      }
      const labels: Record<string, string> = {
        invite: "Convite enviado — vaga reservada.",
        expire: "Entrada expirada.",
        convert: "Marcada como convertida.",
        remove: "Entrada removida.",
      };
      toast(labels[action], "success");
      await reload();
      // Remove localmente quando a ação foi remover.
      if (action === "remove") setEntries((e) => e.filter((x) => x.id !== id));
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Vendas fechadas — aviso em destaque. */}
      {!config.signupsOpen && (
        <div className="rounded-md bg-danger-soft border border-danger/20 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-none mt-0.5 text-danger" />
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            <b className="text-ink">As vendas estão FECHADAS.</b> Nenhuma compra nova
            é aceita no checkout — o comprador é encaminhado para a lista de espera.
            Renovações de assinaturas ativas continuam funcionando.
          </p>
        </div>
      )}

      {/* ---------------- CONFIGURAÇÃO ---------------- */}
      <SectionCard
        title="Capacidade de vendas"
        description="Teto de clientes ativos e disponibilidade das vendas. Aplicado no servidor."
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={config.signupsOpen}
            onChange={(v) => setConfig((c) => ({ ...c, signupsOpen: v }))}
            label="Vendas abertas"
          />
          {!config.signupsOpen && (
            <p className="text-[12px] text-ink-muted">
              Desligado: toda compra nova passa a mostrar a lista de espera.
            </p>
          )}

          <label className="flex flex-col gap-1 min-w-0 max-w-[280px]">
            <span className="text-[12.5px] font-semibold text-ink-soft">
              Máximo de clientes ativos
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={unlimited ? "" : String(config.maxPayers)}
              placeholder="ilimitado"
              onChange={(e) => setMax(e.target.value)}
              className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] font-data text-ink outline-none focus:border-purple/40"
            />
            <span className="text-[11.5px] text-ink-muted leading-relaxed">
              Deixe vazio para ilimitado. Conta PESSOAS (e-mails distintos), não
              cobranças — o mesmo cliente que renova não ocupa duas vagas.
            </span>
          </label>

          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[12.5px] font-semibold text-ink-soft">
              Mensagem quando não há vaga
            </span>
            <textarea
              rows={2}
              maxLength={240}
              value={config.message}
              onChange={(e) => setConfig((c) => ({ ...c, message: e.target.value }))}
              className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-purple/40 resize-none"
            />
            <span className="text-[11.5px] text-ink-muted leading-relaxed">
              Mostrada no checkout quando as vendas fecham ou o teto é atingido.
              Máximo de 240 caracteres.
            </span>
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="primary" size="sm" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {busy ? "Salvando…" : "Salvar capacidade"}
            </Button>
            <Button variant="ghost" size="sm" onClick={restoreDefaults} disabled={busy}>
              <RotateCcw size={14} />
              Restaurar padrão
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ---------------- STATUS (do SERVIDOR) ---------------- */}
      <SectionCard
        title="Ocupação agora"
        description="Medido no servidor: pagantes ativos + reservas de checkout + convites vigentes."
        className="p-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
              Ocupadas
            </p>
            <p className="font-data text-[26px] font-bold text-ink mt-0.5">
              {decision.used}
            </p>
          </div>
          <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
              Teto
            </p>
            <p className="font-data text-[26px] font-bold text-ink mt-0.5">
              {decision.maxPayers == null ? "∞" : decision.maxPayers}
            </p>
          </div>
          <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
              Vagas restantes
            </p>
            <p
              className={cn(
                "font-data text-[26px] font-bold mt-0.5",
                decision.seatsRemaining === 0 ? "text-danger" : "text-purple"
              )}
            >
              {decision.seatsRemaining == null ? "∞" : decision.seatsRemaining}
            </p>
          </div>
        </div>
        <p className="text-[11.5px] text-ink-muted mt-3 border-t border-border-soft pt-3">
          Estado atual:{" "}
          <b className="text-ink-soft">
            {decision.allowed
              ? "vendas aceitando novos clientes."
              : "sem vaga — checkout envia para a lista de espera."}
          </b>
        </p>
      </SectionCard>

      {/* ---------------- LISTA DE ESPERA ---------------- */}
      <SectionCard
        title="Lista de espera"
        description="Interessados que aguardam uma vaga. Convidar RESERVA uma vaga por tempo limitado."
        className="p-5"
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {(["WAITING", "INVITED", "CONVERTED", "EXPIRED"] as const).map((k) => (
            <Badge key={k} tone={STATUS_META[k].tone} size="sm" dot>
              {STATUS_META[k].label}: {counts[k]}
            </Badge>
          ))}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Ninguém na lista ainda"
            description="Quando as vendas fecharem, os interessados aparecem aqui."
          />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                  <th className="py-2.5 pr-4 font-semibold">Nome</th>
                  <th className="py-2.5 pr-4 font-semibold">E-mail</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Entrou em</th>
                  <th className="py-2.5 pr-4 font-semibold">Convite expira</th>
                  <th className="py-2.5 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const meta = STATUS_META[e.status] ?? { label: e.status, tone: "neutral" as const };
                  const busyRow = actionId === e.id;
                  return (
                    <tr key={e.id} className="border-b border-border-soft/60 last:border-0">
                      <td className="py-3 pr-4 font-medium text-ink">{e.name ?? "—"}</td>
                      <td className="py-3 pr-4 text-ink-soft break-all">{e.email}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={meta.tone} size="xs" dot>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">{fmtDate(e.createdAt)}</td>
                      <td className="py-3 pr-4 text-ink-muted">
                        {e.status === "INVITED" ? (
                          <span className="inline-flex items-center gap-1 text-purple">
                            <Clock size={12} /> {fmtDate(e.expiresAt)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {busyRow ? (
                            <Loader2 size={15} className="animate-spin text-ink-muted" />
                          ) : (
                            <>
                              {(e.status === "WAITING" || e.status === "EXPIRED") && (
                                <button
                                  type="button"
                                  onClick={() => runAction(e.id, "invite")}
                                  className="inline-flex items-center gap-1 rounded-[8px] border border-purple/30 bg-ai-soft px-2 py-1 text-[11.5px] font-semibold text-purple hover:bg-purple/10 cursor-pointer"
                                  title="Convidar e reservar uma vaga"
                                >
                                  <Send size={12} /> Convidar
                                </button>
                              )}
                              {e.status === "INVITED" && (
                                <button
                                  type="button"
                                  onClick={() => runAction(e.id, "expire")}
                                  className="inline-flex items-center gap-1 rounded-[8px] border border-border-soft bg-surface px-2 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-card cursor-pointer"
                                  title="Encerrar o convite agora"
                                >
                                  <XCircle size={12} /> Expirar
                                </button>
                              )}
                              {e.status !== "CONVERTED" && (
                                <button
                                  type="button"
                                  onClick={() => runAction(e.id, "convert")}
                                  className="inline-flex items-center gap-1 rounded-[8px] border border-success/30 bg-success-soft px-2 py-1 text-[11.5px] font-semibold text-success hover:bg-success/10 cursor-pointer"
                                  title="Marcar como convertido (virou cliente)"
                                >
                                  <CheckCircle2 size={12} /> Convertido
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => runAction(e.id, "remove")}
                                className="inline-flex items-center gap-1 rounded-[8px] border border-danger/20 bg-danger-softMid px-2 py-1 text-[11.5px] font-semibold text-danger hover:bg-danger/10 cursor-pointer"
                                title="Remover da lista"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-surface/40 border border-border-soft px-4 py-3">
          <Ticket size={15} className="flex-none mt-0.5 text-ink-muted" />
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Um convite vigente <b className="text-ink">segura uma vaga</b> e libera a
            compra para essa pessoa mesmo com a loja lotada. Convites vencidos são
            marcados como expirados automaticamente e deixam de segurar vaga.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
