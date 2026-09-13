"use client";

import * as React from "react";
import {
  Check,
  Pencil,
  X,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Zap,
  Lock,
  MessageSquareText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * CAIXA DE APROVAÇÃO
 * ==================
 * Cada comentário analisado aparece com a sugestão da IA e quatro ações:
 * Aprovar · Editar · Ignorar · Regenerar.
 *
 * O que a interface deixa explícito:
 *  • Por que um comentário NÃO pode ser enviado automaticamente (motivo real).
 *  • De onde veio a resposta (resposta fixa, perfil especial, emoji ou IA).
 *  • Quando a IA não está configurada, a sugestão fica indisponível e o usuário
 *    pode escrever manualmente — a ação de aprovar continua funcionando.
 */

export interface ReviewItem {
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
}

interface ApprovalBoxProps {
  items: ReviewItem[];
  onItemsChange: (items: ReviewItem[]) => void;
  onAfterAction: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  emoji: "Emoji",
  elogio: "Elogio",
  agradecimento: "Agradecimento",
  pergunta_simples: "Pergunta simples",
  duvida_produto: "Dúvida de produto",
  reclamacao: "Reclamação",
  critica: "Crítica",
  ofensivo: "Ofensivo",
  sensivel: "Sensível",
  spam: "Spam",
  outro: "Outro",
};

const SOURCE_LABEL: Record<string, string> = {
  PERFIL_ESPECIAL: "Regra do perfil",
  TEMPLATE_FIXO: "Resposta fixa",
  EMOJI: "Resposta para emoji",
  IA: "Gerada pela IA",
};

function categoryTone(category: string): "success" | "warning" | "danger" | "neutral" {
  if (category === "emoji" || category === "elogio" || category === "agradecimento") return "success";
  if (category === "duvida_produto" || category === "pergunta_simples") return "warning";
  if (category === "reclamacao" || category === "critica" || category === "ofensivo" || category === "sensivel") return "danger";
  return "neutral";
}

export function ApprovalBox({ items, onItemsChange, onAfterAction }: ApprovalBoxProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function updateLocal(commentId: string, patch: Partial<ReviewItem>) {
    onItemsChange(items.map((i) => (i.commentId === commentId ? { ...i, ...patch } : i)));
  }

  function removeLocal(commentId: string) {
    onItemsChange(items.filter((i) => i.commentId !== commentId));
  }

  async function approve(item: ReviewItem, text: string) {
    if (!item.logId) {
      toast("Este comentário não possui registro para envio.", "error");
      return;
    }
    if (!text.trim()) {
      toast("Escreva uma resposta antes de aprovar.", "warning");
      return;
    }

    setPendingId(item.commentId);
    try {
      const res = await fetch("/api/comment-replies/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: item.logId, finalReply: text.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Motivo real (limite, conexão, permissão) — nunca um erro genérico.
        toast(data?.error ?? "Não foi possível enviar a resposta.", "error");
        updateLocal(item.commentId, { status: "ERROR", error: data?.error });
        return;
      }

      toast("Resposta publicada no Instagram.");
      removeLocal(item.commentId);
      setEditingId(null);
      onAfterAction();
    } catch {
      toast("Não foi possível enviar a resposta.", "error");
    } finally {
      setPendingId(null);
    }
  }

  async function ignore(item: ReviewItem) {
    if (!item.logId) {
      removeLocal(item.commentId);
      return;
    }
    setPendingId(item.commentId);
    try {
      const res = await fetch("/api/comment-replies/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: item.logId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível ignorar.", "error");
        return;
      }
      toast("Comentário ignorado.");
      removeLocal(item.commentId);
      onAfterAction();
    } catch {
      toast("Não foi possível ignorar o comentário.", "error");
    } finally {
      setPendingId(null);
    }
  }

  async function regenerate(item: ReviewItem) {
    if (!item.logId) return;
    setPendingId(item.commentId);
    try {
      const res = await fetch("/api/comment-replies/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: item.logId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível gerar outra sugestão.", "error");
        return;
      }
      updateLocal(item.commentId, {
        generatedReply: data.generatedReply,
        source: data.source ?? item.source,
        error: undefined,
      });
      // Aviso honesto quando a nova sugestão ficou praticamente igual.
      toast(
        data.repeated
          ? "A nova sugestão ficou parecida com a anterior — edite se quiser variar."
          : "Nova sugestão gerada.",
        data.repeated ? "warning" : "success"
      );
    } catch {
      toast("Não foi possível gerar outra sugestão.", "error");
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Nenhuma resposta aguardando aprovação"
        description="Analise uma publicação na aba Publicações para ver aqui as sugestões de resposta."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const isEditing = editingId === item.commentId;
        const isPending = pendingId === item.commentId;
        const replyText = isEditing ? draft : item.generatedReply ?? "";

        return (
          <div
            key={item.commentId}
            className="bg-card border border-border-soft rounded-md shadow-xs overflow-hidden"
          >
            {/* Comentário original */}
            <div className="px-5 pt-4 pb-3.5 border-b border-border-soft">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-semibold text-ink">
                  {item.username ? `@${item.username}` : "Comentário"}
                </span>
                <Badge tone={categoryTone(item.category)} size="xs">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </Badge>
                {item.autoSendable ? (
                  <Badge tone="brand" size="xs">
                    <Zap size={10} />
                    Pode enviar automaticamente
                  </Badge>
                ) : item.reviewReasonLabel ? (
                  <Badge tone="warning" size="xs">
                    <ShieldAlert size={10} />
                    {item.reviewReasonLabel}
                  </Badge>
                ) : null}
              </div>
              <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed">
                {item.text}
              </p>
            </div>

            {/* Sugestão */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                  Resposta sugerida
                </span>
                <Badge tone="neutral" size="xs">
                  {SOURCE_LABEL[item.source] ?? item.source}
                </Badge>
              </div>

              {isEditing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  maxLength={280}
                  autoFocus
                  className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-purple/50 resize-none"
                />
              ) : item.generatedReply ? (
                <p className="text-[13.5px] text-ink bg-surface border border-border-soft rounded-md px-3.5 py-2.5 leading-relaxed">
                  {item.generatedReply}
                </p>
              ) : (
                <div className="flex items-start gap-2.5 bg-warn-soft border border-warn/20 rounded-md px-3.5 py-2.5">
                  <Lock size={15} className="text-warn flex-none mt-0.5" />
                  <p className="text-[12.5px] text-ink-soft leading-relaxed">
                    {item.error ??
                      "Nenhuma sugestão disponível. Escreva a resposta manualmente."}
                  </p>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                size="xs"
                onClick={() => approve(item, replyText)}
                disabled={isPending}
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aprovar e enviar
              </Button>

              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setEditingId(null);
                      setDraft("");
                    }}
                    disabled={isPending}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setEditingId(item.commentId);
                    setDraft(item.generatedReply ?? "");
                  }}
                  disabled={isPending}
                >
                  <Pencil size={13} />
                  Editar
                </Button>
              )}

              <Button
                variant="ghost"
                size="xs"
                onClick={() => regenerate(item)}
                disabled={isPending || !item.logId}
                title={item.logId ? "Gera outra sugestão, evitando repetir as anteriores" : "Sem registro para regenerar"}
              >
                <RefreshCw size={13} className={cn(isPending && "animate-spin")} />
                Regenerar
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => ignore(item)}
                disabled={isPending}
                className="ml-auto text-danger hover:text-danger"
              >
                <X size={13} />
                Ignorar
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
