"use client";

import { Gauge, Info, AlertTriangle, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * PAINEL DE CONSUMO — "Minha Assinatura"
 * ======================================
 * Mostra, para cada capacidade medida, quanto foi USADO hoje / neste ciclo e
 * qual é a franquia do plano. É uma LEITURA do medidor do servidor
 * (`getUsageSummary`), passada como PROP pelo Server Component — o navegador
 * só exibe, nunca calcula saldo.
 *
 * Honestidade obrigatória:
 *  • franquia `null` (sem teto) → "ilimitado"/"—", nunca um "0" inventado.
 *  • enquanto `LIMITS_ENFORCEMENT_ENABLED` for falso, a franquia está sendo
 *    MEDIDA e NÃO bloqueia: o rodapé diz isso explicitamente.
 *  • sem assinatura ativa → estado explícito, sem franquia fabricada.
 *
 * A forma dos dados espelha `getUsageSummary` em `@/lib/billing/usage/meter`.
 */

export interface FeatureUsage {
  feature: string;
  usedToday: number;
  usedThisCycle: number;
  dailyLimit: number | null;
  cycleLimit: number | null;
  remainingToday: number | null;
  remainingThisCycle: number | null;
}

export interface UsageSummaryView {
  planSlug: string | null;
  cycleActive: boolean;
  cycleStart: string;
  cycleEndsAt: string | null;
  dailyResetsAt: string;
  features: FeatureUsage[];
}

/** Uma linha do histórico de consumo — espelha `listUsageHistory` no medidor. */
export interface UsageHistoryItem {
  id: string;
  feature: string;
  amount: number;
  origin: string | null;
  createdAt: string;
}

const FEATURE_LABEL: Record<string, string> = {
  ai_generation: "Gerações de IA",
  auto_reply: "Respostas automáticas",
  profile_analysis: "Análises de perfil",
  publication: "Publicações",
};

const FEATURE_HINT: Record<string, string> = {
  ai_generation: "Copy, ideias, chat, diagnóstico e priorização por IA.",
  auto_reply: "Respostas a comentários e mensagens privadas enviadas.",
  profile_analysis: "Análises de desempenho e diagnósticos de perfil.",
  publication: "Publicações efetivamente executadas nas redes.",
};

/**
 * Rótulo HUMANO da origem do evento (o campo curto gravado no medidor).
 * Origem desconhecida cai no próprio valor — nunca inventamos um rótulo.
 */
const ORIGIN_LABEL: Record<string, string> = {
  copy: "Geração de copy",
  ideias: "Geração de ideias",
  chat: "Chat com a IA",
  diagnostico: "Diagnóstico por IA",
  "perfil-aprendido": "Perfil aprendido por IA",
  "dashboard-insights": "Insights do dashboard",
  "plano-semanal": "Plano semanal por IA",
  "comment-auto": "Resposta automática a comentário",
  "comment-manual": "Resposta a comentário (manual)",
  direct: "Resposta em Direct",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Número formatado ou travessão quando não há teto. */
function limitText(limit: number | null): string {
  return limit == null ? "ilimitado" : String(limit);
}

/**
 * PRÓXIMA RENOVAÇÃO — as DUAS janelas em uma frase:
 *   • o fim do ciclo contratado (renovação do plano);
 *   • a virada do dia (00:00 de Brasília), que reinicia a franquia diária.
 * Sem ciclo em aberto, o trecho do ciclo vira "—" (estado honesto).
 */
function renewalText(summary: UsageSummaryView): string {
  const cycle = summary.cycleEndsAt
    ? `ciclo em ${formatDateTime(summary.cycleEndsAt)}`
    : summary.cycleActive
      ? "ciclo em aberto"
      : "sem ciclo";
  return `${cycle} · diário em ${formatDateTime(summary.dailyResetsAt)} (Brasília)`;
}

/** "% usada" honesta — só quando existe teto e ele é > 0. */
function percentUsed(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function ConsumoPanel({
  summary,
  history = [],
  enforcementEnabled,
}: {
  summary: UsageSummaryView;
  history?: UsageHistoryItem[];
  enforcementEnabled: boolean;
}) {
  return (
    <section className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Gauge size={16} className="text-purple" />
        <h2 className="font-display text-[17px] font-semibold text-ink">Consumo do plano</h2>
        <Badge tone="neutral" size="xs">
          {enforcementEnabled ? "Limites ativos" : "Em medição"}
        </Badge>
      </div>

      {/* Janelas de tempo — sempre rotuladas. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoBox
          label="Plano"
          value={summary.planSlug ?? (summary.cycleActive ? "Plano ativo" : "Sem assinatura ativa")}
        />
        <InfoBox
          label="Ciclo"
          value={
            summary.cycleEndsAt
              ? `${formatDateTime(summary.cycleStart)} → ${formatDateTime(summary.cycleEndsAt)}`
              : summary.cycleActive
                ? `${formatDateTime(summary.cycleStart)} → em aberto`
                : "—"
          }
        />
        <InfoBox
          label="Limite diário reinicia"
          value={`${formatDateTime(summary.dailyResetsAt)} (Brasília)`}
        />
      </div>

      {!summary.cycleActive && (
        <div className="rounded-[10px] bg-surface px-4 py-3 flex items-start gap-2 text-[13px] text-ink-soft">
          <Info size={15} className="flex-none mt-0.5 text-purple" />
          Não há assinatura ativa, então não há franquia contratada. O consumo continua sendo
          registrado para diagnóstico — sem teto e sem bloqueio.
        </div>
      )}

      {/* Por capacidade: usado hoje/ciclo e o teto correspondente. */}
      <div className="flex flex-col gap-3">
        {summary.features.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Nenhuma capacidade medida disponível no momento.
          </p>
        ) : (
          summary.features.map((f) => {
            const label = FEATURE_LABEL[f.feature] ?? f.feature;
            const hint = FEATURE_HINT[f.feature] ?? null;
            return (
              <div
                key={f.feature}
                className="rounded-[10px] border border-border-soft bg-bg-ice px-4 py-3 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-semibold text-ink">{label}</span>
                  {hint && <span className="text-[11.5px] text-ink-muted">{hint}</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UsageBar
                    windowLabel="Hoje"
                    used={f.usedToday}
                    limit={f.dailyLimit}
                    remaining={f.remainingToday}
                    percent={percentUsed(f.usedToday, f.dailyLimit)}
                  />
                  <UsageBar
                    windowLabel="Neste ciclo"
                    used={f.usedThisCycle}
                    limit={f.cycleLimit}
                    remaining={f.remainingThisCycle}
                    percent={percentUsed(f.usedThisCycle, f.cycleLimit)}
                  />
                </div>

                {/* FRANQUIA / UTILIZADO / SALDO / PRÓXIMA RENOVAÇÃO, em texto. */}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-ink-soft tabular-nums">
                  <span>
                    Franquia (ciclo): <strong className="font-semibold text-ink">{limitText(f.cycleLimit)}</strong>
                  </span>
                  <span>
                    Utilizado: <strong className="font-semibold text-ink">{f.usedThisCycle}</strong>
                  </span>
                  <span>
                    Saldo restante:{" "}
                    <strong className="font-semibold text-ink">
                      {f.remainingThisCycle == null ? "—" : f.remainingThisCycle}
                    </strong>
                  </span>
                  <span>Renova: {renewalText(summary)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* HISTÓRICO — o LOG de auditoria, mais recente primeiro. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <History size={14} className="text-purple" />
          <h3 className="text-[13px] font-semibold text-ink">Histórico recente</h3>
        </div>
        {history.length === 0 ? (
          <div className="rounded-[10px] bg-surface px-4 py-3 flex items-start gap-2 text-[12.5px] text-ink-soft">
            <Info size={14} className="flex-none mt-0.5 text-purple" />
            Nenhum consumo registrado ainda. Cada geração, resposta ou publicação medida
            aparece aqui com data e hora.
          </div>
        ) : (
          <div className="rounded-[10px] border border-border-soft overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1.4fr_1fr_auto_auto] gap-2 bg-bg-ice px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <span>Capacidade</span>
              <span>Origem</span>
              <span className="text-right">Qtd.</span>
              <span className="text-right">Quando</span>
            </div>
            <ul className="divide-y divide-border-soft">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto_auto] gap-x-2 gap-y-0.5 px-3 py-2 text-[12.5px] text-ink"
                >
                  <span className="font-medium">{FEATURE_LABEL[h.feature] ?? h.feature}</span>
                  <span className="text-ink-soft truncate">
                    {h.origin ? ORIGIN_LABEL[h.origin] ?? h.origin : "—"}
                  </span>
                  <span className="sm:text-right tabular-nums text-ink-soft">{h.amount}</span>
                  <span className="sm:text-right tabular-nums text-ink-muted">
                    {formatDateTime(h.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* NOTA DE HONESTIDADE — o estado real do mecanismo. */}
      {enforcementEnabled ? (
        <div className="rounded-[10px] bg-warn-soft px-4 py-3 flex items-start gap-2 text-[12.5px] text-warn">
          <AlertTriangle size={14} className="flex-none mt-0.5" />
          Os limites de franquia estão ATIVOS: ao atingir o teto diário ou do ciclo, a capacidade
          correspondente é bloqueada até a virada da janela.
        </div>
      ) : (
        <div className="rounded-[10px] bg-surface px-4 py-3 flex items-start gap-2 text-[12.5px] text-ink-soft">
          <Info size={14} className="flex-none mt-0.5 text-purple" />
          <p className="min-w-0 flex-1">
          Os limites de franquia estão sendo{" "}
          <strong className="font-semibold text-ink">medidos</strong>, mas ainda{" "}
          <strong className="font-semibold text-ink">não bloqueiam</strong> nenhuma operação. Os
          números acima são reais (contagem de uso), servem para diagnóstico e serão aplicados
          somente após a ativação comercial oficial.
          </p>
        </div>
      )}
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border-soft bg-bg-ice px-3 sm:px-3.5 py-2.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted break-words">
        {label}
      </span>
      <div className="text-[13px] text-ink font-medium break-words">{value}</div>
    </div>
  );
}

function UsageBar({
  windowLabel,
  used,
  limit,
  remaining,
  percent,
}: {
  windowLabel: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
          {windowLabel}
        </span>
        <span className="text-[12.5px] text-ink tabular-nums">
          {used} / {limitText(limit)}
        </span>
      </div>
      {/* Sem teto não há barra de progresso — uma barra vazia sugeriria um limite que não existe. */}
      {percent == null ? (
        <div className="h-1.5 rounded-pill bg-surface overflow-hidden" aria-hidden />
      ) : (
        <div className="h-1.5 rounded-pill bg-surface overflow-hidden">
          <div
            className={cn(
              "h-full rounded-pill",
              percent >= 100 ? "bg-danger" : percent >= 80 ? "bg-warn" : "bg-purple"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      <span className="text-[11.5px] text-ink-soft">
        Restante: {remaining == null ? "—" : remaining}
      </span>
    </div>
  );
}
