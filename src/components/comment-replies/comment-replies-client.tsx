"use client";

import * as React from "react";
import Link from "next/link";
import {
  Instagram,
  MessageSquareText,
  ShieldCheck,
  Play,
  Pause,
  AlertTriangle,
  ChevronRight,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/components/ui/toast";
import { Divider } from "@/components/ui/divider";

import type { ReplyMode } from "@/lib/comment-replies/types";
import { REPLY_MODE_LABEL } from "@/lib/comment-replies/types";

import { MediaList, type MediaItem } from "./media-list";
import { ApprovalBox, type ReviewItem } from "./approval-box";
import { HistoryPanel } from "./history-panel";
import { RulesPanel } from "./rules-panel";

/**
 * TELA PRINCIPAL — RESPOSTAS INTELIGENTES
 * ========================================
 * Quatro áreas: Publicações · Aprovações · Regras · Histórico.
 *
 * Regras de interface que esta tela segue:
 *  • Sem Instagram conectado → CTA para /redes-sociais (não existe segundo OAuth).
 *  • Sem IA configurada → avisa, mas a tela continua utilizável (as travas
 *    determinísticas e as respostas fixas funcionam sem IA).
 *  • Nenhuma métrica é inventada: os números vêm de /stats, calculados a partir
 *    de registros reais.
 *  • Pausa global sempre acessível.
 */

export interface InitialRule {
  id: string;
  enabled: boolean;
  paused: boolean;
  replyMode: ReplyMode;
  maxRepliesPerRun: number;
  maxRepliesPerHour: number;
  maxRepliesPerDay: number;
  minimumIntervalSeconds: number;
  targetType: string;
  mediaId: string | null;
}

interface CommentRepliesClientProps {
  connected: boolean;
  instagramUsername: string | null;
  aiConfigured: boolean;
  mediaCount: number;
  initialRule: InitialRule | null;
}

interface StatsResponse {
  automation: { enabled: boolean; paused: boolean; mode: ReplyMode; active: boolean };
  stats: {
    analyzed: number;
    sent: number;
    pending: number;
    ignored: number;
    error: number;
    auto: number;
    manual: number;
    approvalRate: number | null;
  };
  pendingCount: number;
}

type TabId = "publicacoes" | "aprovacoes" | "regras" | "historico";

export function CommentRepliesClient({
  connected,
  instagramUsername,
  aiConfigured,
  mediaCount,
  initialRule,
}: CommentRepliesClientProps) {
  const { toast } = useToast();

  const [tab, setTab] = React.useState<TabId>("publicacoes");
  const [rule, setRule] = React.useState<InitialRule | null>(initialRule);
  const [stats, setStats] = React.useState<StatsResponse | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [media, setMedia] = React.useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = React.useState(false);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = React.useState<string | null>(null);

  const [reviews, setReviews] = React.useState<ReviewItem[]>([]);
  const [analyzedMedia, setAnalyzedMedia] = React.useState<string | null>(null);
  const [mediaSyncing, setMediaSyncing] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  // `null` = nunca sincronizamos comentários · `false` = a Meta recusou o escopo.
  const [commentsAvailable, setCommentsAvailable] = React.useState<boolean | null>(null);

  const refreshStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/comment-replies/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as StatsResponse;
      setStats(data);
      if (data.automation) {
        setRule((prev) =>
          prev
            ? {
                ...prev,
                enabled: data.automation.enabled,
                paused: data.automation.paused,
                replyMode: data.automation.mode,
              }
            : prev
        );
      }
    } catch {
      // Métricas são informativas — falha aqui não bloqueia a tela.
    }
  }, []);

  const loadMedia = React.useCallback(async () => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      const res = await fetch("/api/comment-replies/media", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMediaError(data?.error ?? "Não foi possível carregar as publicações.");
        return;
      }
      setMedia(data.media ?? []);
      setConnectionIssue(data.connected ? null : data.connectionIssue ?? null);
      setLastSyncAt(data.lastSyncAt ?? null);
      setCommentsAvailable(
        typeof data.commentsAvailable === "boolean" ? data.commentsAvailable : null
      );
    } catch {
      setMediaError("Não foi possível carregar as publicações.");
    } finally {
      setMediaLoading(false);
    }
  }, []);

  /**
   * Sincroniza os dados do Instagram sob demanda (mesma rota usada pelo
   * Dashboard). Necessário aqui porque a lista de publicações vem do banco: sem
   * uma sincronização recente ela fica vazia mesmo com a conta conectada.
   * NUNCA publica nem responde nada — apenas relê os dados da conta.
   */
  const syncNow = React.useCallback(async () => {
    setMediaSyncing(true);
    setMediaError(null);
    try {
      const res = await fetch("/api/integrations/instagram/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (data as { code?: string }).code;
        toast(
          code === "cooldown"
            ? "Sincronização recente. Aguarde alguns segundos e tente de novo."
            : (data as { error?: string }).error ?? "Não foi possível sincronizar agora.",
          "error"
        );
        return;
      }
      await loadMedia();
      await refreshStats();
    } catch {
      toast("Não foi possível sincronizar agora.", "error");
    } finally {
      setMediaSyncing(false);
    }
  }, [loadMedia, refreshStats, toast]);

  React.useEffect(() => {
    if (!connected) return;
    void refreshStats();
    void loadMedia();
  }, [connected, refreshStats, loadMedia]);

  async function patchRule(patch: Partial<InitialRule>) {
    setBusy(true);
    try {
      const res = await fetch("/api/comment-replies/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      setRule({
        ...data.rule,
        replyMode: data.rule.replyMode as ReplyMode,
      });
      toast("Configuração atualizada.");
      void refreshStats();
    } catch {
      toast("Não foi possível salvar a configuração.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!rule) return;
    const next = !rule.paused;
    await patchRule({ paused: next });
    toast(next ? "Respostas Inteligentes pausadas." : "Respostas Inteligentes reativadas.");
  }

  /** Analisa uma publicação: lê comentários e gera sugestões (não envia nada). */
  async function analyze(item: MediaItem) {
    setBusy(true);
    setAnalyzedMedia(item.id);
    try {
      const res = await fetch("/api/comment-replies/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: item.id, onlyUnanswered: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Erro de capacidade da Meta é mostrado com o motivo real.
        setReviews([]);
        toast(data?.error ?? "Não foi possível analisar os comentários.", "error");
        if (data?.code === "capability") {
          setConnectionIssue(data.error);
        }
        return;
      }

      const items: ReviewItem[] = (data.items ?? []).map(
        (raw: {
          commentId: string;
          username: string;
          text: string;
          timestamp: string | null;
          category: string;
          generatedReply: string | null;
          status: string;
          reviewReasonLabel: string | null;
          autoSendable: boolean;
          source: string;
          logId: string | null;
          error?: string;
        }) => ({
          commentId: raw.commentId,
          username: raw.username,
          text: raw.text,
          timestamp: raw.timestamp,
          category: raw.category,
          generatedReply: raw.generatedReply,
          status: raw.status,
          reviewReasonLabel: raw.reviewReasonLabel,
          autoSendable: raw.autoSendable,
          source: raw.source,
          logId: raw.logId,
          error: raw.error,
        })
      );

      setReviews(items);
      if (items.length === 0) {
        toast("Nenhum comentário novo nesta publicação.", "info");
      } else {
        toast(`${items.length} comentário(s) analisado(s).`);
        setTab("aprovacoes");
      }
      void refreshStats();
    } catch {
      toast("Não foi possível analisar os comentários.", "error");
    } finally {
      setBusy(false);
      setAnalyzedMedia(null);
    }
  }

  /** Executa o ciclo automático (respeita modo, ativação e limites). */
  async function runAutomation() {
    setBusy(true);
    try {
      const res = await fetch("/api/comment-replies/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível executar.", "error");
        return;
      }
      if (data.code && data.code !== "limit") {
        toast(data.reason ?? "A automação não pôde ser executada.", "warning");
      } else if (data.sent > 0) {
        toast(`${data.sent} resposta(s) enviada(s) automaticamente.`);
      } else {
        toast(data.reason ?? "Nada novo para responder.", "info");
      }
      void refreshStats();
      void loadMedia();
    } catch {
      toast("Não foi possível executar a automação.", "error");
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- sem conexão

  if (!connected) {
    return (
      <EmptyState
        icon={Instagram}
        title="Conecte seu Instagram para começar"
        description="As Respostas Inteligentes usam a conexão que você já tem em Redes Sociais. Não é preciso autorizar nada de novo — se o Instagram já estiver conectado lá, ele aparece aqui automaticamente."
        action={
          <Link href="/redes-sociais">
            <Button variant="primary" size="md">
              Ir para Redes Sociais
              <ChevronRight size={16} />
            </Button>
          </Link>
        }
      />
    );
  }

  // ---------------------------------------------------------------- tela principal

  const s = stats?.stats;

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de estado + pausa global */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border-soft bg-card px-5 py-4 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-[12px] bg-ai-soft text-purple grid place-items-center flex-none">
            <MessageSquareText size={19} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-semibold text-ink">
                {instagramUsername ? `@${instagramUsername}` : "Instagram conectado"}
              </p>
              {rule?.enabled && !rule.paused ? (
                <Badge tone="success" dot size="xs">Ativa</Badge>
              ) : rule?.paused ? (
                <Badge tone="warning" dot size="xs">Pausada</Badge>
              ) : (
                <Badge tone="neutral" dot size="xs">Desativada</Badge>
              )}
            </div>
            <p className="text-[12.5px] text-ink-soft mt-0.5">
              {rule ? REPLY_MODE_LABEL[rule.replyMode] : "Carregando configuração…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={rule?.paused ? "success" : "ghost"}
            size="sm"
            onClick={togglePause}
            disabled={busy || !rule}
          >
            {rule?.paused ? <Play size={15} /> : <Pause size={15} />}
            {rule?.paused ? "Reativar" : "Pausar tudo"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={runAutomation}
            disabled={busy || !rule?.enabled || rule?.paused}
            title={
              !rule?.enabled
                ? "Ative a automação e escolha o modo Automático para usar este botão."
                : rule?.paused
                  ? "As Respostas Inteligentes estão pausadas."
                  : "Executa o ciclo automático respeitando os limites."
            }
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Executar agora
          </Button>
        </div>
      </div>

      {/* Avisos honestos sobre o estado do ambiente */}
      {!aiConfigured && (
        <div className="flex items-start gap-3 rounded-md border border-warn/25 bg-warn-soft px-4 py-3.5">
          <AlertTriangle size={18} className="text-warn flex-none mt-0.5" />
          <div className="text-[12.5px] text-ink-soft leading-relaxed">
            <strong className="text-ink">IA ainda não configurada.</strong> As respostas
            fixas, os templates e o tratamento de emoji continuam funcionando, mas a
            geração inteligente precisa de uma chave ativa. Peça ao administrador para
            configurar em <span className="font-mono">Admin → IA</span>.
          </div>
        </div>
      )}

      {connectionIssue && (
        <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info-soft px-4 py-3.5">
          <Lock size={18} className="text-info flex-none mt-0.5" />
          <div className="text-[12.5px] text-ink-soft leading-relaxed">
            <strong className="text-ink">Permissão de comentários indisponível no momento.</strong>{" "}
            {connectionIssue} Toda a configuração abaixo continua válida e passa a
            funcionar assim que o Instagram liberar o acesso.
          </div>
        </div>
      )}

      {/* A Meta recusou a LEITURA de comentários: dizemos isso em vez de exibir
          "0 comentários", que seria um dado falso. */}
      {!connectionIssue && commentsAvailable === false && (
        <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info-soft px-4 py-3.5">
          <Lock size={18} className="text-info flex-none mt-0.5" />
          {/* BLOCO 5 — o nome do escopo é um token único de 35 caracteres sem
              nenhum ponto de quebra. Como este div é filho de um flex e herda
              `min-width: auto`, ele era o responsável por alargar a página em
              320px. `min-w-0` deixa a coluna encolher e o `[overflow-wrap:anywhere]`
              permite quebrar o próprio identificador. */}
          <div className="text-[12.5px] text-ink-soft leading-relaxed min-w-0 flex-1 break-words">
            <strong className="text-ink">Comentários indisponíveis pela API do Instagram.</strong>{" "}
            As publicações foram sincronizadas, mas a Meta não autorizou a leitura de
            comentários para este app (escopo{" "}
            <span className="font-mono [overflow-wrap:anywhere]">instagram_business_manage_comments</span> sem
            acesso avançado). Os comentários aparecem automaticamente quando o acesso
            for concedido — nada foi inventado no lugar deles.
          </div>
        </div>
      )}

      {/* Cards de métrica — todos derivados de registros reais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Comentários analisados"
          value={s ? s.analyzed : "—"}
          hint="Últimos 30 dias"
        />
        <MetricCard
          label="Respostas enviadas"
          value={s ? s.sent : "—"}
          hint={
            s ? `${s.auto} automáticas · ${s.manual} manuais` : "Últimos 30 dias"
          }
        />
        <MetricCard
          label="Aguardando aprovação"
          value={stats ? stats.pendingCount : "—"}
          hint="Pendentes agora"
        />
        <MetricCard
          label="Taxa de aprovação"
          value={s?.approvalRate !== null && s?.approvalRate !== undefined ? `${s.approvalRate}%` : "—"}
          hint={
            s?.approvalRate === null || s?.approvalRate === undefined
              ? "Sem decisões registradas ainda"
              : "Enviadas ÷ decididas"
          }
        />
      </div>

      {/* Abas */}
      <Tabs
        tabs={[
          { id: "publicacoes", label: "Publicações" },
          { id: "aprovacoes", label: `Aprovações${reviews.length ? ` (${reviews.length})` : ""}` },
          { id: "regras", label: "Regras e limites" },
          { id: "historico", label: "Histórico" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "publicacoes" && (
        <div className="flex flex-col gap-5">
          {/* Última sincronização REAL — deixa claro se os dados estão antigos. */}
          {connected && lastSyncAt && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[12px] text-ink-muted">
                Última sincronização:{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(lastSyncAt))}
              </p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void syncNow()}
                disabled={mediaSyncing}
              >
                {mediaSyncing ? (
                  <><Loader2 size={13} className="animate-spin" /> Sincronizando…</>
                ) : (
                  <><RefreshCw size={13} /> Atualizar</>
                )}
              </Button>
            </div>
          )}
          {mediaLoading ? (
            <div className="flex items-center gap-3 text-[13.5px] text-ink-soft py-10 justify-center">
              <Loader2 size={17} className="animate-spin" />
              Carregando publicações…
            </div>
          ) : mediaError ? (
            <ErrorState description={mediaError} retry={() => void loadMedia()} />
          ) : media.length === 0 ? (
            <EmptyState
              icon={Instagram}
              title="Nenhuma publicação sincronizada"
              description={
                mediaCount === 0
                  ? "Sincronize sua conta em Redes Sociais para que suas publicações apareçam aqui."
                  : "A conta está conectada, mas nenhuma publicação foi encontrada no Instagram."
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void syncNow()}
                    disabled={mediaSyncing}
                  >
                    {mediaSyncing ? (
                      <><Loader2 size={14} className="animate-spin" /> Sincronizando…</>
                    ) : (
                      <><RefreshCw size={14} /> Sincronizar agora</>
                    )}
                  </Button>
                  <Link href="/redes-sociais">
                    <Button variant="ghost" size="sm">Ir para Redes Sociais</Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <MediaList
              media={media}
              onAnalyze={analyze}
              busyId={analyzedMedia}
              busy={busy}
            />
          )}
        </div>
      )}

      {tab === "aprovacoes" && (
        <ApprovalBox
          items={reviews}
          onItemsChange={setReviews}
          onAfterAction={() => void refreshStats()}
        />
      )}

      {tab === "regras" && rule && (
        <RulesPanel rule={rule} onPatch={patchRule} busy={busy} aiConfigured={aiConfigured} />
      )}

      {tab === "historico" && <HistoryPanel />}

      {/* Rodapé de segurança — deixa explícito o que o sistema faz e não faz */}
      <Divider />
      <div className="flex items-start gap-3 rounded-md border border-border-soft bg-surface/40 px-4 py-3.5">
        <ShieldCheck size={18} className="text-success flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed min-w-0 break-words">
          O Inst Acessor nunca responde um comentário duas vezes e nunca publica nada
          automaticamente sem que a automação esteja ativa, o modo seja Automático e o
          comentário esteja em uma categoria segura. Preço, pagamento, pedido, saúde,
          jurídico, política, ofensa e promessas sempre passam por revisão humana.
          Desconectar o Instagram pausa a automação sem apagar seu histórico.
        </p>
      </div>
    </div>
  );
}
