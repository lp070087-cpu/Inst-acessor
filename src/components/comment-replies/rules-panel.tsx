"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Lock,
  Heart,
  Info,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Divider } from "@/components/ui/divider";
import { cn } from "@/lib/utils";

import { REPLY_MODES, REPLY_MODE_LABEL, COMMENT_CATEGORIES } from "@/lib/comment-replies/types";
// Importado do arquivo folha (sem imports) — não traz código de servidor para
// o bundle do cliente. A gravação continua validada no servidor.
import { LIMIT_BOUNDS } from "@/lib/comment-replies/limits-config";
import type { ReplyMode } from "@/lib/comment-replies/types";
import type { InitialRule } from "./comment-replies-client";

/**
 * REGRAS E LIMITES
 * ================
 * Quatro blocos: modo de resposta · limites de envio · respostas próprias
 * (templates) · pessoas especiais (perfis).
 *
 * Duas regras de produto ficam visíveis nesta tela:
 *  • Limites têm faixas seguras — o servidor rejeita qualquer valor fora delas,
 *    e a interface mostra os limites de cada campo.
 *  • "Não inferir gênero automaticamente": não existe campo de gênero. O que a
 *    IA sabe sobre uma pessoa vem do texto que o usuário escreve.
 */

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

interface TemplateRow {
  id: string;
  text: string;
  category: string;
  exactReply: boolean;
  active: boolean;
}

interface SpecialProfileRow {
  id: string;
  instagramUsername: string;
  displayName: string | null;
  customInstructions: string;
  fixedReply: string | null;
  useAI: boolean;
  priority: number;
  active: boolean;
}

interface RulesPanelProps {
  rule: InitialRule;
  onPatch: (patch: Partial<InitialRule>) => Promise<void> | void;
  busy: boolean;
  aiConfigured: boolean;
}

export function RulesPanel({ rule, onPatch, busy, aiConfigured }: RulesPanelProps) {
  const { toast } = useToast();

  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [profiles, setProfiles] = React.useState<SpecialProfileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Formulário de template
  const [tplText, setTplText] = React.useState("");
  const [tplCategory, setTplCategory] = React.useState("outro");
  const [tplExact, setTplExact] = React.useState(false);

  // Formulário de perfil especial
  const [spUsername, setSpUsername] = React.useState("");
  const [spName, setSpName] = React.useState("");
  const [spInstructions, setSpInstructions] = React.useState("");
  const [spFixed, setSpFixed] = React.useState("");
  const [spUseAI, setSpUseAI] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const [tRes, pRes] = await Promise.all([
          fetch("/api/comment-replies/templates", { cache: "no-store" }),
          fetch("/api/comment-replies/special-profiles", { cache: "no-store" }),
        ]);
        if (tRes.ok) setTemplates((await tRes.json()).templates ?? []);
        if (pRes.ok) setProfiles((await pRes.json()).profiles ?? []);
      } catch {
        // Silencioso: a tela funciona mesmo se a lista não carregar.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addTemplate() {
    if (!tplText.trim()) {
      toast("Escreva a resposta.", "warning");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/comment-replies/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tplText.trim(), category: tplCategory, exactReply: tplExact }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      setTemplates((prev) => [...prev, data.template]);
      setTplText("");
      setTplExact(false);
      toast("Resposta salva.");
    } catch {
      toast("Não foi possível salvar a resposta.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/comment-replies/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Não foi possível remover.", "error");
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast("Resposta removida.");
    } catch {
      toast("Não foi possível remover.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addSpecialProfile() {
    if (spUsername.trim().length < 2) {
      toast("Informe o @ do perfil.", "warning");
      return;
    }
    if (spInstructions.trim().length < 3) {
      toast("Descreva como a IA deve responder esta pessoa.", "warning");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/comment-replies/special-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramUsername: spUsername.trim(),
          displayName: spName.trim() || null,
          customInstructions: spInstructions.trim(),
          fixedReply: spFixed.trim() || null,
          useAI: spUseAI,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      setProfiles((prev) => [...prev, data.profile]);
      setSpUsername("");
      setSpName("");
      setSpInstructions("");
      setSpFixed("");
      setSpUseAI(true);
      toast("Pessoa especial salva.");
    } catch {
      toast("Não foi possível salvar o perfil.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeSpecialProfile(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/comment-replies/special-profiles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Não foi possível remover.", "error");
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      toast("Perfil removido.");
    } catch {
      toast("Não foi possível remover.", "error");
    } finally {
      setSaving(false);
    }
  }

  const isDisabled = busy || saving;

  return (
    <div className="flex flex-col gap-5">

      {/* ------------------------------------------------ MODO DE RESPOSTA */}
      <section className="bg-card border border-border-soft rounded-md shadow-xs p-5">
        <h2 className="font-display text-[16px] font-semibold text-ink">Modo de resposta</h2>
        <p className="text-[12.5px] text-ink-soft mt-1">
          Define o quanto a automação pode agir sozinha.
        </p>

        <div className="mt-4 flex flex-col gap-2.5">
          {REPLY_MODES.map((mode) => {
            const active = rule.replyMode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={isDisabled}
                onClick={() => void onPatch({ replyMode: mode as ReplyMode, enabled: mode !== "MANUAL" ? true : rule.enabled })}
                className={cn(
                  "text-left rounded-md border px-4 py-3 transition-all duration-300 cursor-pointer disabled:opacity-60",
                  active
                    ? "border-purple/40 bg-ai-soft"
                    : "border-border-soft bg-surface/40 hover:border-purple/25"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex-none grid place-items-center",
                      active ? "border-purple" : "border-[#C9CDD6]"
                    )}
                  >
                    {active && <span className="w-2 h-2 rounded-full bg-purple" />}
                  </span>
                  <span className="text-[13.5px] font-semibold text-ink">
                    {mode === "MANUAL" ? "Manual" : mode === "APPROVAL" ? "Aprovação" : "Automático"}
                  </span>
                  {mode === "AUTO" && (
                    <Badge tone="warning" size="xs">
                      <ShieldAlert size={10} />
                      Só categorias seguras
                    </Badge>
                  )}
                </div>
                <p className="text-[12.5px] text-ink-soft mt-1.5 ml-6.5">
                  {REPLY_MODE_LABEL[mode]}
                </p>
              </button>
            );
          })}
        </div>

        <Divider className="my-4" />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={isDisabled}
            onChange={(e) => void onPatch({ enabled: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-[#A855F7] cursor-pointer"
          />
          <span className="text-[13px] text-ink-soft">
            <strong className="text-ink">Automação ativa.</strong> Desligada, o sistema
            apenas sugere — nada é enviado sem sua aprovação.
          </span>
        </label>
      </section>

      {/* ------------------------------------------------ LIMITES */}
      <section className="bg-card border border-border-soft rounded-md shadow-xs p-5">
        <h2 className="font-display text-[16px] font-semibold text-ink">Limites de envio</h2>
        <p className="text-[12.5px] text-ink-soft mt-1">
          Protegem sua conta contra bloqueios. Os valores são aplicados no servidor
          dentro de faixas seguras.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { key: "maxRepliesPerRun", label: "Máximo por execução", bounds: LIMIT_BOUNDS.maxRepliesPerRun, suffix: "respostas" },
              { key: "maxRepliesPerHour", label: "Máximo por hora", bounds: LIMIT_BOUNDS.maxRepliesPerHour, suffix: "respostas" },
              { key: "maxRepliesPerDay", label: "Máximo por dia", bounds: LIMIT_BOUNDS.maxRepliesPerDay, suffix: "respostas" },
              { key: "minimumIntervalSeconds", label: "Intervalo mínimo", bounds: LIMIT_BOUNDS.minimumIntervalSeconds, suffix: "segundos" },
            ] as const
          ).map((field) => (
            <div key={field.key}>
              <label className="block text-[12.5px] font-semibold text-ink-soft mb-1.5">
                {field.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={field.bounds.min}
                  max={field.bounds.max}
                  value={rule[field.key]}
                  disabled={isDisabled}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isFinite(value)) return;
                    void onPatch({ [field.key]: value } as Partial<InitialRule>);
                  }}
                  className="w-24 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-purple/50"
                />
                <span className="text-[12px] text-ink-muted">{field.suffix}</span>
              </div>
              <p className="text-[11.5px] text-ink-muted mt-1">
                Permitido: {field.bounds.min}–{field.bounds.max}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ RESPOSTAS PRÓPRIAS */}
      <section className="bg-card border border-border-soft rounded-md shadow-xs p-5">
        <h2 className="font-display text-[16px] font-semibold text-ink">Respostas próprias</h2>
        <p className="text-[12.5px] text-ink-soft mt-1">
          A IA usa estas frases como <strong>referência de estilo</strong> — ela não
          repete sempre a mesma. Marque &ldquo;usar exatamente&rdquo; quando quiser a
          frase literal, sem variação.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <textarea
            value={tplText}
            onChange={(e) => setTplText(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Ex.: Obrigada pelo carinho! ❤️"
            className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-purple/50 resize-none"
          />

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-purple/50 cursor-pointer"
            >
              {COMMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] ?? c}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 cursor-pointer text-[12.5px] text-ink-soft">
              <input
                type="checkbox"
                checked={tplExact}
                onChange={(e) => setTplExact(e.target.checked)}
                className="w-4 h-4 accent-[#A855F7] cursor-pointer"
              />
              Usar exatamente esta resposta
            </label>

            <Button
              variant="primary"
              size="xs"
              onClick={addTemplate}
              disabled={isDisabled}
              className="ml-auto"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </Button>
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <p className="text-[13px] text-ink-muted text-center py-6">Carregando…</p>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhuma resposta própria ainda"
              description="Sem respostas próprias, a IA escreve livremente com base no seu perfil e no tom configurado."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-md border border-border-soft bg-surface/40 px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    {/* BLOCO 5 — a resposta própria é escrita à mão pelo
                        usuário e pode conter um link longo sem espaços.
                        `break-words` faz o texto quebrar dentro do card em vez
                        de alargar a linha. */}
                    <p className="text-[13.5px] text-ink leading-relaxed break-words">{t.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge tone="neutral" size="xs">
                        {CATEGORY_LABEL[t.category] ?? t.category}
                      </Badge>
                      {t.exactReply && (
                        <Badge tone="brand" size="xs">
                          <Lock size={10} />
                          Exata
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeTemplate(t.id)}
                    disabled={isDisabled}
                    aria-label="Remover resposta"
                    className="text-ink-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-50 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ PESSOAS ESPECIAIS */}
      <section className="bg-card border border-border-soft rounded-md shadow-xs p-5">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2">
          <Heart size={17} className="text-purple" />
          Pessoas especiais
        </h2>
        <p className="text-[12.5px] text-ink-soft mt-1">
          Regra mais prioritária do sistema: quando esta pessoa comenta, ela vence
          qualquer outra regra. Você descreve como responder — o sistema não presume
          nada sobre a relação nem infere gênero.
        </p>

        {!aiConfigured && (
          <div className="mt-3 flex items-start gap-2.5 rounded-md border border-warn/25 bg-warn-soft px-3.5 py-2.5">
            <Info size={15} className="text-warn flex-none mt-0.5" />
            <p className="text-[12px] text-ink-soft">
              Sem IA configurada, a instrução personalizada não pode ser interpretada.
              Use &ldquo;resposta fixa&rdquo; para que o perfil ainda funcione.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-ink-soft mb-1.5">
                @ do perfil
              </label>
              <input
                value={spUsername}
                onChange={(e) => setSpUsername(e.target.value)}
                placeholder="@amiga"
                className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-purple/50"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-ink-soft mb-1.5">
                Apelido (opcional)
              </label>
              <input
                value={spName}
                onChange={(e) => setSpName(e.target.value)}
                placeholder="Como você chama esta pessoa"
                className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-purple/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-ink-soft mb-1.5">
              Como a IA deve responder
            </label>
            <textarea
              value={spInstructions}
              onChange={(e) => setSpInstructions(e.target.value)}
              rows={2}
              maxLength={1200}
              placeholder="Ex.: Responda de forma descontraída e carinhosa, como falo com amigos próximos."
              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-purple/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-ink-soft mb-1.5">
              Resposta fixa (opcional)
            </label>
            <input
              value={spFixed}
              onChange={(e) => setSpFixed(e.target.value)}
              maxLength={280}
              placeholder="Se preenchida, é usada sempre — sem passar pela IA."
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-purple/50"
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-[12.5px] text-ink-soft">
              <input
                type="checkbox"
                checked={spUseAI}
                onChange={(e) => setSpUseAI(e.target.checked)}
                className="w-4 h-4 accent-[#A855F7] cursor-pointer"
              />
              Permitir que a IA escreva (quando não há resposta fixa)
            </label>

            <Button
              variant="primary"
              size="xs"
              onClick={addSpecialProfile}
              disabled={isDisabled}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar pessoa
            </Button>
          </div>
        </div>

        <div className="mt-5">
          {profiles.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Nenhuma pessoa especial cadastrada"
              description="Cadastre alguém para que a resposta tenha um tratamento próprio — mais próximo, mais formal ou com uma frase específica."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {profiles.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-md border border-border-soft bg-surface/40 px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold text-ink">
                        @{p.instagramUsername}
                      </span>
                      {p.displayName && (
                        <span className="text-[12.5px] text-ink-muted">{p.displayName}</span>
                      )}
                      {p.fixedReply ? (
                        <Badge tone="brand" size="xs">Resposta fixa</Badge>
                      ) : p.useAI ? (
                        <Badge tone="neutral" size="xs">IA com instruções</Badge>
                      ) : (
                        <Badge tone="warning" size="xs">Sem resposta automática</Badge>
                      )}
                    </div>
                    <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed break-words">
                      {p.customInstructions}
                    </p>
                    {p.fixedReply && (
                      <p className="text-[12px] text-ink-muted mt-1 italic break-words">
                        Resposta: {p.fixedReply}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeSpecialProfile(p.id)}
                    disabled={isDisabled}
                    aria-label="Remover pessoa"
                    className="text-ink-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-50 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
