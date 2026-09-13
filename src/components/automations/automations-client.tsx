"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Zap,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

interface RuleItem {
  id: string;
  name: string;
  trigger: string;
  platform: string;
  keywords: string[];
  action: string;
  enabled: boolean;
  createdAt: string;
}

interface ExecutionItem {
  id: string;
  ruleId: string | null;
  eventId: string | null;
  status: string;
  detail: string;
  createdAt: string;
}

interface AutomationsClientProps {
  initial: {
    rules: RuleItem[];
    executions: ExecutionItem[];
  };
}

export function AutomationsClient({ initial }: AutomationsClientProps) {
  const { toast } = useToast();
  const [rules, setRules] = React.useState<RuleItem[]>(initial.rules);
  const [executions, setExecutions] = React.useState<ExecutionItem[]>(initial.executions);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [name, setName] = React.useState("");
  const [trigger, setTrigger] = React.useState("comment.keyword");
  const [platform, setPlatform] = React.useState<"instagram" | "tiktok">("instagram");
  const [keywords, setKeywords] = React.useState("");
  const [enabled, setEnabled] = React.useState(false);

  async function createRule() {
    if (!name.trim() || !trigger.trim()) {
      toast("Preencha nome e gatilho.", "error");
      return;
    }
    setLoading(true);
    try {
      const kw = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          trigger: trigger.trim(),
          platform,
          keywords: kw,
          action: "dm",
          enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao criar regra.", "error");
        return;
      }
      toast("Regra criada (sem envio automático).");
      setRules((prev) => [data.rule, ...prev]);
      setModalOpen(false);
      setName("");
      setKeywords("");
    } catch {
      toast("Não foi possível criar a regra.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRule(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Erro ao excluir regra.", "error");
        return;
      }
      toast("Regra excluída.");
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast("Não foi possível excluir.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Info de fundação */}
      <div className="rounded-[12px] bg-ai-soft border border-purple/20 px-4 py-3 flex items-start gap-2">
        <Zap size={16} className="text-purple flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-soft">
          <span className="font-semibold text-purple">Fundação preparada.</span> Quando a
          integração real de comentários estiver disponível, estas regras serão usadas
          para responder automaticamente. Nada é enviado nesta fase.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[17px] font-bold text-ink">Regras</h2>
          <p className="text-[12.5px] text-ink-soft">
            {rules.length} {rules.length === 1 ? "regra" : "regras"} de resposta automática
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus size={14} /> Nova regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma regra de automação"
          description="Crie regras de resposta automática para comentários. A estrutura fica salva; o envio real será habilitado em uma fase futura."
          action={
            <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
              <Plus size={14} /> Criar primeira regra
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-md bg-card border border-border-soft p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-ink">{r.name}</span>
                    <Badge size="xs" tone={r.enabled ? "success" : "neutral"}>
                      {r.enabled ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <span className="text-[12px] text-ink-muted">
                    {r.trigger} · {r.platform} · ação: {r.action}
                  </span>
                  {r.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {r.keywords.map((k) => (
                        <Badge key={k} size="xs" tone="neutral">{k}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="xs" variant="ghost" onClick={() => deleteRule(r.id)} disabled={loading} className="text-danger">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execuções recentes */}
      <div className="mt-4">
        <h3 className="font-display text-[15px] font-bold text-ink mb-2">Avaliações recentes</h3>
        {executions.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            Nenhuma avaliação registrada ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {executions.map((e) => (
              <div key={e.id} className="rounded-md bg-bg border border-border-soft px-3 py-2 flex items-center gap-2">
                {e.status === "EVALUATED" ? (
                  <CheckCircle2 size={14} className="text-success flex-none" />
                ) : (
                  <AlertCircle size={14} className="text-warn flex-none" />
                )}
                <span className="text-[12px] text-ink-soft min-w-0 break-words">
                  {e.detail || e.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de nova regra */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova regra de automação" size="md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Nome interno</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Responder menção de preço"
              className="rounded-[10px] border border-border bg-bg-ice px-3 py-2 text-[13px] text-ink outline-none focus:border-purple/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink-soft">Gatilho</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="rounded-[10px] border border-border bg-bg-ice px-3 py-2 text-[13px] text-ink outline-none focus:border-purple/40"
              >
                <option value="comment.keyword">Comentário com palavra-chave</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink-soft">Plataforma</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as "instagram" | "tiktok")}
                className="rounded-[10px] border border-border bg-bg-ice px-3 py-2 text-[13px] text-ink outline-none focus:border-purple/40"
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">
              Palavras-chave <span className="text-ink-muted">(separadas por vírgula)</span>
            </label>
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="preço, quanto custa, valores"
              className="rounded-[10px] border border-border bg-bg-ice px-3 py-2 text-[13px] text-ink outline-none focus:border-purple/40"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className="flex items-center gap-1.5"
            >
              {enabled ? (
                <ToggleRight size={20} className="text-success" />
              ) : (
                <ToggleLeft size={20} className="text-ink-muted" />
              )}
              <span className="text-[12.5px] font-semibold text-ink-soft">
                {enabled ? "Regra ativa" : "Regra inativa"}
              </span>
            </button>
          </label>

          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={createRule} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Salvar regra
            </Button>
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
