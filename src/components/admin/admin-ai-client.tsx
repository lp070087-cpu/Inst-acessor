"use client";

import * as React from "react";
import { KeyRound, Trash2, CheckCircle2, Loader2, PlugZap } from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export interface AIProviderStatusView {
  configured: boolean;
  provider: "openai" | "gemini";
  model: string;
  keyMask: string;
  source: "db" | "env";
}

export interface AdminAIStatus {
  aiConfigured: boolean;
  activeProvider: "openai" | "gemini" | "";
  openai: AIProviderStatusView;
  gemini: AIProviderStatusView;
}

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"] as const;

interface ProviderFormProps {
  provider: "openai" | "gemini";
  status: AIProviderStatusView;
  onRefresh: () => void;
}

function ProviderForm({ provider, status, onRefresh }: ProviderFormProps) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState<string>(status.model || (provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash"));
  const [busy, setBusy] = React.useState<null | "save" | "test" | "remove">(null);

  const label = provider === "openai" ? "OpenAI" : "Gemini";

  const save = async () => {
    setBusy("save");
    try {
      const res = await fetch("/api/admin/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", provider, apiKey, model }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      toast(`${label} configurado com sucesso.`, "success");
      setApiKey("");
      onRefresh();
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const res = await fetch("/api/admin/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", provider, apiKey, model }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        toast(data.error ?? "Falha no teste.", "error");
        return;
      }
      toast(data.message ?? (data.ok ? "Conexão OK." : "Falha na conexão."), data.ok ? "success" : "error");
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      const res = await fetch("/api/admin/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", provider }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível remover.", "error");
        return;
      }
      toast(`${label} removido.`, "success");
      setApiKey("");
      onRefresh();
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const models = provider === "openai" ? OPENAI_MODELS : GEMINI_MODELS;

  return (
    <SectionCard
      title={`Provider ${label}`}
      description={
        status.configured
          ? `Configurado (${status.source === "db" ? "via admin" : "via variável de ambiente"}).`
          : "Não configurado."
      }
      action={
        status.configured ? (
          <Badge tone="success" dot>Ativo</Badge>
        ) : (
          <Badge tone="neutral" dot>Inativo</Badge>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {status.configured && status.keyMask && (
          <div className="flex items-center gap-2.5 rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
            <KeyRound size={16} className="text-ink-muted flex-none" />
            <span className="font-data text-[13px] text-ink-soft">Chave: {status.keyMask}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">
            Nova chave de API {status.configured && <span className="font-normal text-ink-muted">(deixe vazio para manter)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status.configured ? "••••••••••••" : "Cole a chave aqui..."}
            autoComplete="off"
            className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-card text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30 focus:border-purple/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-soft">Modelo</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-[11px] border border-border bg-card text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30 focus:border-purple/50 cursor-pointer"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" disabled={busy !== null} onClick={save}>
            {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Salvar
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null || !apiKey.trim() && !status.configured} onClick={test}>
            {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
            Testar
          </Button>
          {status.configured && (
            <Button size="sm" variant="danger" disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Remover
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export function AdminAIClient({ initialStatus }: { initialStatus: AdminAIStatus }) {
  const [status, setStatus] = React.useState<AdminAIStatus>(initialStatus);
  const [encryptionReady, setEncryptionReady] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ia/status");
      if (res.ok) {
        const data = (await res.json()) as { status: AdminAIStatus; encryptionReady?: boolean };
        setStatus(data.status);
        setEncryptionReady(typeof data.encryptionReady === "boolean" ? data.encryptionReady : null);
      }
    } catch {
      /* mantém o estado atual */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* `flex-wrap`: badge + botão têm `whitespace-nowrap` na base e não
          encolhem — lado a lado eles estouravam a linha em telas de 320px. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone={status.aiConfigured ? "success" : "warning"} dot size="md">
          {status.aiConfigured
            ? `IA ativa — ${status.activeProvider === "openai" ? "OpenAI" : "Gemini"}`
            : "Configuração pendente"}
        </Badge>
        <Button variant="ghost" size="xs" disabled={loading} onClick={refresh}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          Atualizar status
        </Button>
      </div>

      {encryptionReady === false && (
        <div className="rounded-[11px] border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] text-warn leading-relaxed">
          <strong>Salvar chave indisponível:</strong> a variável{" "}
          <code className="font-data">TOKEN_ENCRYPTION_KEY</code> não está configurada no
          servidor (mín. 32 caracteres). O teste de conexão funciona — ele não grava nada —
          mas salvar exige essa chave para criptografar. Adicione-a nas variáveis de ambiente
          do Vercel e clique em “Atualizar status”.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProviderForm provider="openai" status={status.openai} onRefresh={refresh} />
        <ProviderForm provider="gemini" status={status.gemini} onRefresh={refresh} />
      </div>

      <SectionCard title="Notas de segurança">
        <ul className="text-[13px] text-ink-soft leading-relaxed list-disc list-inside flex flex-col gap-1.5">
          <li>As chaves são armazenadas <strong>criptografadas</strong> (AES-256-GCM) e nunca aparecem completas na interface.</li>
          <li>Os clientes do Inst Acessor <strong>não configuram chave de API</strong> — apenas a administração.</li>
          <li>Quando você salva uma chave aqui, ela passa a valer para todos os usuários (fonte central).</li>
          <li>Testar uma chave não a salva — apenas valida a conexão.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
