"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, Info, Link2, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TRIGGER_TYPE_LABEL,
  type TriggerType,
} from "@/lib/comment-direct/triggers";

/**
 * PONTE DE AUTOMAÇÕES (ex-"/automacoes" legado)
 * =============================================
 * Esta tela NÃO cria mais regras próprias. O motor real de Comentário → Direct
 * vive em `CommentDirectRule`, avaliado por `evaluateComment`. Aqui mostramos,
 * SOMENTE LEITURA, o que esse motor tem (regras e histórico) e apontamos para a
 * tela onde se cria/edita/ativa: Respostas Inteligentes → Automações.
 *
 * As regras antigas (`AutomationRule`) e seus registros (`AutomationExecution`)
 * continuam visíveis como ARQUIVO HISTÓRICO — nada foi apagado — com o aviso de
 * que NÃO disparam. Duplicar um segundo motor foi evitado de propósito.
 */

interface RealRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerTerms: string[];
  messageText: string;
  dailyLimit: number;
  onePerUser: boolean;
  pausedUntil: string | null;
}

interface RealLog {
  id: string;
  commenterUsername: string | null;
  originalComment: string;
  matchedTrigger: string | null;
  status: string;
  reason: string | null;
  createdAt: string;
}

interface LegacyRule {
  id: string;
  name: string;
  trigger: string;
  platform: string;
  keywords: string[];
  action: string;
  enabled: boolean;
  createdAt: string;
}

interface LegacyExecution {
  id: string;
  status: string;
  detail: string;
  createdAt: string;
}

interface AutomationsBridgeClientProps {
  realRules: RealRule[];
  logs: RealLog[];
  legacyRules: LegacyRule[];
  legacyExecutions: LegacyExecution[];
  directAutomationsHref: string;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  SENT: "success",
  SKIPPED: "neutral",
  BLOCKED: "warning",
  DUPLICATE: "info",
  ERROR: "danger",
  PENDING: "info",
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "Enviada",
  SKIPPED: "Ignorada",
  BLOCKED: "Bloqueada",
  DUPLICATE: "Já enviada",
  ERROR: "Erro",
  PENDING: "Simulação",
  RECEIVED: "Recebido",
  EVALUATED: "Registrado",
};

function fmt(dateIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(dateIso)
  );
}

export function AutomationsBridgeClient({
  realRules,
  logs,
  legacyRules,
  legacyExecutions,
  directAutomationsHref,
}: AutomationsBridgeClientProps) {
  const hasLegacy = legacyRules.length > 0 || legacyExecutions.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso de ponte */}
      <div className="rounded-[12px] bg-ai-soft border border-purple/20 px-4 py-3 flex items-start gap-2">
        <Link2 size={16} className="text-purple flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          <span className="font-semibold text-purple">Esta tela é uma ponte.</span> O motor que
          ENVIA a mensagem privada (Comentário → Direct) é único e vive em{" "}
          <strong className="text-ink">Respostas Inteligentes → Automações</strong>. Crie, teste,
          ative e acompanhe por lá. Abaixo ficam visíveis as regras reais desse motor (somente
          leitura) e as regras antigas que não disparam.
        </p>
      </div>

      {/* Regras REAIS (motor Comentário → Direct) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[17px] font-bold text-ink">Regras Comentário → Direct</h2>
            <p className="text-[12.5px] text-ink-soft">
              {realRules.length} {realRules.length === 1 ? "regra ativa" : "regras"} no motor real de
              envio
            </p>
          </div>
          <Link href={directAutomationsHref} className={buttonClass({ size: "sm", className: "gap-1.5" })}>
            Gerenciar <ArrowRight size={14} />
          </Link>
        </div>

        {realRules.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Nenhuma regra de envio criada"
            description="As regras que realmente enviam mensagem privada são criadas em Respostas Inteligentes → Automações. Elas nascem desligadas e só disparam depois de você ativar."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {realRules.map((r) => {
              const paused = r.pausedUntil && new Date(r.pausedUntil) > new Date();
              return (
                <div key={r.id} className="rounded-md bg-card border border-border-soft p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-ink">{r.name}</span>
                        {r.enabled ? (
                          <Badge size="xs" tone="success">Ativa</Badge>
                        ) : (
                          <Badge size="xs" tone="neutral">Desligada</Badge>
                        )}
                        {paused && <Badge size="xs" tone="warning">Pausada</Badge>}
                      </div>
                      <p className="text-[12px] text-ink-muted mt-1">
                        {TRIGGER_TYPE_LABEL[r.triggerType as TriggerType] ?? r.triggerType}
                        {r.triggerType !== "ANY_COMMENT" && r.triggerTerms.length > 0
                          ? `: ${r.triggerTerms.join(", ")}`
                          : ""}{" "}
                        · {r.dailyLimit}/dia · {r.onePerUser ? "1 por pessoa" : "sem limite por pessoa"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md bg-surface/60 border border-border-soft px-3 py-2">
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-0.5">
                      Mensagem privada
                    </p>
                    <p className="text-[12.5px] text-ink-soft break-words">{r.messageText}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11.5px] text-ink-muted">
          Somente leitura nesta tela. Para criar, testar ou ativar, abra{" "}
          <a href={directAutomationsHref} className="text-purple font-semibold hover:underline">
            Respostas Inteligentes → Automações
          </a>
          .
        </p>
      </div>

      {/* Histórico REAL de disparos */}
      <div>
        <h3 className="font-display text-[15px] font-bold text-ink mb-2">Histórico de disparos</h3>
        {logs.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">Nenhum disparo registrado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-md bg-card border border-border-soft px-3 py-2.5 flex items-start gap-3">
                {log.status === "SENT" ? (
                  <CheckCircle2 size={15} className="text-success flex-none mt-0.5" />
                ) : log.status === "ERROR" || log.status === "BLOCKED" ? (
                  <AlertTriangle size={15} className="text-warn flex-none mt-0.5" />
                ) : (
                  <XCircle size={15} className="text-ink-muted flex-none mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={STATUS_TONE[log.status] ?? "neutral"} size="xs">
                      {STATUS_LABEL[log.status] ?? log.status}
                    </Badge>
                    <span className="text-[11.5px] text-ink-muted">
                      {log.commenterUsername ? `@${log.commenterUsername}` : "comentário"} · {fmt(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-soft mt-1 break-words">“{log.originalComment}”</p>
                  {log.reason && <p className="text-[11.5px] text-ink-muted mt-0.5">{log.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ARQUIVO HISTÓRICO — regras antigas (não disparam) */}
      {hasLegacy && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border-soft">
          <div className="flex items-start gap-2">
            <Info size={15} className="text-ink-muted flex-none mt-0.5" />
            <div>
              <h3 className="font-display text-[15px] font-bold text-ink">Registro histórico (não disparam)</h3>
              <p className="text-[12px] text-ink-muted">
                Regras antigas de comentário→DM e eventos recebidos. São mantidos para consulta e
                NÃO enviam nada — o envio real é feito pelas regras acima.
              </p>
            </div>
          </div>

          {legacyRules.length > 0 && (
            <div className="flex flex-col gap-2">
              {legacyRules.map((r) => (
                <div key={r.id} className="rounded-md bg-bg border border-border-soft p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-ink">{r.name}</span>
                    <Badge size="xs" tone="neutral">Arquivada</Badge>
                  </div>
                  <span className="text-[11.5px] text-ink-muted">
                    {r.trigger} · {r.platform} · ação: {r.action}
                  </span>
                  {r.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.keywords.map((k) => (
                        <Badge key={k} size="xs" tone="neutral">{k}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {legacyExecutions.length > 0 && (
            <div className="flex flex-col gap-2">
              {legacyExecutions.map((e) => (
                <div key={e.id} className="rounded-md bg-bg border border-border-soft px-3 py-2 flex items-center gap-2">
                  <Info size={13} className="text-ink-muted flex-none" />
                  <span className="text-[11.5px] text-ink-soft min-w-0 break-words">
                    <Badge tone={STATUS_TONE[e.status] ?? "neutral"} size="xs" className="mr-1.5">
                      {STATUS_LABEL[e.status] ?? e.status}
                    </Badge>
                    {e.detail || e.status} · {fmt(e.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
