"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Zap,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  BookOpen,
  Link2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Divider } from "@/components/ui/divider";
import { FIELD_CLASS_FILLED, SELECT_CLASS_FILLED } from "@/lib/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  TRIGGER_TYPES,
  TRIGGER_TYPE_LABEL,
  TRIGGER_TYPE_HINT,
  type TriggerType,
} from "@/lib/comment-direct/triggers";
import {
  TRIGGER_SUPPORT,
  TRIGGER_SUPPORT_LEVEL_LABEL,
  type TriggerSupportLevel,
} from "@/lib/comment-direct/trigger-support";

/**
 * AUTOMAÇÕES — COMENTÁRIO → DIRECT, FAQ E IA
 * ==========================================
 * Três blocos DENTRO da seção Respostas Inteligentes:
 *   • Comentário → Direct: gatilho determinístico + mensagem privada. O
 *     casamento NUNCA usa IA — só `matchesTrigger`. Ação = enviar DM.
 *   • FAQ automático: base de respostas autorizadas usada pela IA no Direct.
 *   • Histórico: cada disparo com o MOTIVO (enviado, ignorado, bloqueado…).
 *
 * Nenhuma automação nasce ligada. O teste de gatilho NÃO envia nada — só mostra
 * o que aconteceria.
 */

type TabId = "regras" | "faq" | "historico";

interface RuleItem {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  mediaId: string | null;
  mediaCaption: string | null;
  triggerType: string;
  triggerTerms: string[];
  messageText: string;
  dailyLimit: number;
  onePerUser: boolean;
  pausedUntil: string | null;
  createdAt: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  active: boolean;
}

interface LogItem {
  id: string;
  ruleId: string | null;
  mediaId: string;
  commentId: string;
  commenterUsername: string | null;
  originalComment: string;
  matchedTrigger: string | null;
  status: string;
  reason: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface DirectAutomationsProps {
  connected: boolean;
  aiConfigured: boolean;
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
};

export function DirectAutomations({ connected, aiConfigured }: DirectAutomationsProps) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<TabId>("regras");

  const [rules, setRules] = React.useState<RuleItem[]>([]);
  const [faqs, setFaqs] = React.useState<FaqItem[]>([]);
  const [logs, setLogs] = React.useState<LogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const [ruleModal, setRuleModal] = React.useState(false);
  const [testModal, setTestModal] = React.useState<{ open: boolean; rule: RuleItem | null }>({
    open: false,
    rule: null,
  });
  const [faqModal, setFaqModal] = React.useState(false);

  // form de regra
  const [name, setName] = React.useState("");
  const [triggerType, setTriggerType] = React.useState<TriggerType>("EXACT_WORD");
  const [terms, setTerms] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [dailyLimit, setDailyLimit] = React.useState(50);
  const [onePerUser, setOnePerUser] = React.useState(true);

  // form de FAQ
  const [faqQuestion, setFaqQuestion] = React.useState("");
  const [faqAnswer, setFaqAnswer] = React.useState("");
  const [faqKeywords, setFaqKeywords] = React.useState("");

  // teste
  const [testText, setTestText] = React.useState("");
  const [testResult, setTestResult] = React.useState<
    { ruleName: string; matched: boolean; matchedTerm: string | null; wouldSendMessage: string | null }[] | null
  >(null);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, fRes, lRes] = await Promise.all([
        fetch("/api/comment-direct/rules", { cache: "no-store" }),
        fetch("/api/comment-direct/faq", { cache: "no-store" }),
        fetch("/api/comment-direct/logs", { cache: "no-store" }),
      ]);
      if (rRes.ok) setRules((await rRes.json()).rules ?? []);
      if (fRes.ok) setFaqs((await fRes.json()).faqs ?? []);
      if (lRes.ok) setLogs((await lRes.json()).logs ?? []);
    } catch {
      toast("Não foi possível carregar as automações.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function createRule() {
    const termList = terms.split(",").map((t) => t.trim()).filter(Boolean);
    if (!name.trim() || !message.trim()) {
      toast("Preencha o nome e a mensagem.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/comment-direct/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scope: "all",
          triggerType,
          triggerTerms: termList,
          messageText: message.trim(),
          dailyLimit,
          onePerUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível criar a automação.", "error");
        return;
      }
      toast("Automação criada (desligada). Ative quando estiver pronto.");
      setRuleModal(false);
      setName("");
      setTerms("");
      setMessage("");
      await loadAll();
    } catch {
      toast("Não foi possível criar a automação.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: RuleItem) {
    setBusy(true);
    try {
      const res = await fetch(`/api/comment-direct/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      setRules((prev) => prev.map((r) => (r.id === rule.id ? data.rule : r)));
      toast(!rule.enabled ? "Automação ativada." : "Automação desligada.");
    } catch {
      toast("Não foi possível salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRule(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/comment-direct/rules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Não foi possível excluir.", "error");
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast("Automação excluída.");
    } catch {
      toast("Não foi possível excluir.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function createFaq() {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast("Preencha a pergunta e a resposta.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/comment-direct/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          keywords: faqKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      toast("Resposta salva.");
      setFaqModal(false);
      setFaqQuestion("");
      setFaqAnswer("");
      setFaqKeywords("");
      await loadAll();
    } catch {
      toast("Não foi possível salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFaq(id: string) {
    try {
      const res = await fetch(`/api/comment-direct/faq/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch {
      toast("Não foi possível excluir.", "error");
    }
  }

  async function runTest() {
    if (!testModal.rule || !testText.trim()) return;
    setBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/comment-direct/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível testar.", "error");
        return;
      }
      setTestResult(data.results ?? []);
    } catch {
      toast("Não foi possível testar.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-[13.5px] text-ink-soft py-16">
        <Loader2 size={17} className="animate-spin" /> Carregando automações…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-md border border-purple/20 bg-ai-soft px-4 py-3.5">
        <Zap size={17} className="text-purple flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          <strong className="text-ink">Comentário → Direct.</strong> Quando alguém
          comentar com a palavra do gatilho, o Inst Acessor responde em uma{" "}
          <strong className="text-ink">mensagem privada no Direct</strong> — uma única vez
          por comentário. O gatilho é comparado de forma determinística (sem IA) e cada
          disparo respeita o limite diário e a política de mensagens do Instagram.
        </p>
      </div>

      <Tabs
        tabs={[
          { id: "regras", label: "Comentário → Direct" },
          { id: "faq", label: "FAQ automático" },
          { id: "historico", label: "Histórico" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
        className="self-start"
      />

      {/* ---------------- Regras ---------------- */}
      {tab === "regras" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-soft">
              {rules.length} {rules.length === 1 ? "automação" : "automações"}
            </p>
            <Button size="sm" variant="primary" onClick={() => setRuleModal(true)} className="gap-1.5">
              <Plus size={14} /> Nova automação
            </Button>
          </div>

          {rules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="Nenhuma automação ainda"
              description="Crie um gatilho (ex.: comentários com a palavra QUERO) e a mensagem privada que a pessoa receberá. A automação nasce desligada."
              action={
                <Button size="sm" variant="primary" onClick={() => setRuleModal(true)} className="gap-1.5">
                  <Plus size={14} /> Criar primeira automação
                </Button>
              }
            />
          ) : (
            rules.map((rule) => {
              const paused = rule.pausedUntil && new Date(rule.pausedUntil) > new Date();
              return (
                <div key={rule.id} className="rounded-md border border-border-soft bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-ink">{rule.name}</span>
                        {rule.enabled ? (
                          <Badge tone="success" dot size="xs">Ativa</Badge>
                        ) : (
                          <Badge tone="neutral" dot size="xs">Desligada</Badge>
                        )}
                        {paused && <Badge tone="warning" size="xs">Pausada</Badge>}
                      </div>
                      <p className="text-[12px] text-ink-muted mt-1">
                        {TRIGGER_TYPE_LABEL[rule.triggerType as TriggerType] ?? rule.triggerType}
                        {rule.triggerType !== "ANY_COMMENT" && rule.triggerTerms.length > 0
                          ? `: ${rule.triggerTerms.join(", ")}`
                          : ""}{" "}
                        · {rule.dailyLimit}/dia · {rule.onePerUser ? "1 por pessoa" : "sem limite por pessoa"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-none">
                      <Button size="xs" variant="ghost" onClick={() => setTestModal({ open: true, rule })} disabled={busy}>
                        <FlaskConical size={13} /> Testar
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => void toggleRule(rule)} disabled={busy}>
                        {rule.enabled ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => void deleteRule(rule.id)} disabled={busy} className="text-danger">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md bg-surface/60 border border-border-soft px-3 py-2">
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-0.5">
                      Mensagem privada enviada
                    </p>
                    <p className="text-[12.5px] text-ink-soft break-words">{rule.messageText}</p>
                  </div>
                </div>
              );
            })
          )}

          {/* Reconciliação com o outro subsistema de automações */}
          <div className="flex items-start gap-3 rounded-md border border-border-soft bg-surface/40 px-4 py-3.5">
            <Link2 size={17} className="text-ink-muted flex-none mt-0.5" />
            <p className="text-[12px] text-ink-soft leading-relaxed min-w-0 break-words">
              Estas automações <strong className="text-ink">enviam mensagem privada</strong> e
              são avaliadas pelo motor de Direct do Inst Acessor. As{" "}
              <a href="/automacoes" className="text-purple font-semibold hover:underline">Automações</a>{" "}
              de comentário→DM criadas noutra tela são a base antiga — elas não disparam
              sozinhas. Para enviar de verdade, use as regras desta tela.
            </p>
          </div>

          {/* Gatilhos — o que é oficialmente suportado hoje, sem prometer além */}
          <div className="rounded-md border border-border-soft bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-purple" />
              <h3 className="font-display text-[14px] font-bold text-ink">Gatilhos suportados</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {TRIGGER_SUPPORT.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <Badge
                    size="xs"
                    tone={
                      t.level === "supported"
                        ? "success"
                        : t.level === "pending"
                          ? "info"
                          : "neutral"
                    }
                    className="flex-none mt-0.5"
                  >
                    {TRIGGER_SUPPORT_LEVEL_LABEL[t.level as TriggerSupportLevel]}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-ink">{t.label}</p>
                    <p className="text-[11.5px] text-ink-soft leading-relaxed">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- FAQ ---------------- */}
      {tab === "faq" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info-soft px-4 py-3.5">
            <BookOpen size={17} className="text-info flex-none mt-0.5" />
            <p className="text-[12.5px] text-ink-soft leading-relaxed">
              Cadastre as perguntas frequentes (preço, horário, serviços…). A IA usa{" "}
              <strong className="text-ink">somente</strong> o que estiver aqui para sugerir
              respostas no Direct — o que não estiver cadastrado ela não inventa.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-soft">{faqs.length} resposta(s)</p>
            <Button size="sm" variant="primary" onClick={() => setFaqModal(true)} className="gap-1.5">
              <Plus size={14} /> Nova resposta
            </Button>
          </div>

          {faqs.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhuma resposta cadastrada"
              description="Sem FAQ, a IA se limita a respostas genéricas e seguras. Cadastre as principais dúvidas para respostas mais precisas."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {faqs.map((f) => (
                <div key={f.id} className="rounded-md border border-border-soft bg-card p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{f.question}</span>
                      {!f.active && <Badge tone="neutral" size="xs">Inativa</Badge>}
                    </div>
                    <p className="text-[12.5px] text-ink-soft mt-1 break-words">{f.answer}</p>
                    {f.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {f.keywords.map((k) => (
                          <Badge key={k} size="xs" tone="neutral">{k}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => void deleteFaq(f.id)} className="text-danger flex-none">
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!aiConfigured && (
            <div className="flex items-start gap-3 rounded-md border border-warn/25 bg-warn-soft px-4 py-3.5">
              <AlertTriangle size={17} className="text-warn flex-none mt-0.5" />
              <p className="text-[12.5px] text-ink-soft leading-relaxed">
                A IA ainda não está configurada. Mesmo assim, a resposta de FAQ mais
                próxima é sugerida no Direct — mas só é enviada com a sua aprovação.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Histórico ---------------- */}
      {tab === "historico" && (
        <div className="flex flex-col gap-3">
          {logs.length === 0 ? (
            <EmptyState
              icon={Info}
              title="Nenhum disparo registrado"
              description="Quando um comentário casar um gatilho, o resultado aparece aqui com o motivo — enviada, ignorada, bloqueada ou simulada."
            />
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-md border border-border-soft bg-card p-3.5 flex items-start gap-3">
                {log.status === "SENT" ? (
                  <CheckCircle2 size={16} className="text-success flex-none mt-0.5" />
                ) : log.status === "ERROR" || log.status === "BLOCKED" ? (
                  <AlertTriangle size={16} className="text-warn flex-none mt-0.5" />
                ) : (
                  <XCircle size={16} className="text-ink-muted flex-none mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={STATUS_TONE[log.status] ?? "neutral"} size="xs">
                      {STATUS_LABEL[log.status] ?? log.status}
                    </Badge>
                    <span className="text-[12px] text-ink-muted">
                      {log.commenterUsername ? `@${log.commenterUsername}` : "comentário"} ·{" "}
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                        new Date(log.createdAt)
                      )}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-ink-soft mt-1 break-words">
                    <span className="text-ink-muted">Comentário:</span> “{log.originalComment}”
                  </p>
                  {log.matchedTrigger && (
                    <p className="text-[11.5px] text-ink-muted mt-0.5">
                      Gatilho casado: “{log.matchedTrigger}”
                    </p>
                  )}
                  {log.reason && (
                    <p className="text-[11.5px] text-ink-muted mt-0.5">{log.reason}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ---------------- Modal: nova regra ---------------- */}
      <Modal open={ruleModal} onClose={() => setRuleModal(false)} title="Nova automação Comentário → Direct" size="lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Enviar tabela de preços" className={FIELD_CLASS_FILLED} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Gatilho</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className={SELECT_CLASS_FILLED}
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t} value={t}>{TRIGGER_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <p className="text-[11.5px] text-ink-muted">{TRIGGER_TYPE_HINT[triggerType]}</p>
          </div>

          {triggerType !== "ANY_COMMENT" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink-soft">
                {triggerType === "ANY_OF_LIST" ? "Palavras (separadas por vírgula)" : "Palavra ou expressão"}
              </label>
              <input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder={triggerType === "ANY_OF_LIST" ? "QUERO, LINK, MANDA" : "QUERO"}
                className={FIELD_CLASS_FILLED}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Mensagem privada</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={900}
              placeholder="Ex.: Oi! Mandei os detalhes aqui no Direct. Qualquer dúvida é só chamar."
              className={`${FIELD_CLASS_FILLED} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-ink-soft">Limite diário</label>
              <input
                type="number"
                min={1}
                max={200}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className={FIELD_CLASS_FILLED}
              />
            </div>
            <label className="flex items-end gap-2 pb-2.5 cursor-pointer">
              <input type="checkbox" checked={onePerUser} onChange={(e) => setOnePerUser(e.target.checked)} />
              <span className="text-[12.5px] text-ink-soft">Uma mensagem por pessoa</span>
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-surface/60 border border-border-soft px-3 py-2">
            <Info size={14} className="text-ink-muted flex-none mt-0.5" />
            <p className="text-[11.5px] text-ink-soft">
              A automação é criada <strong className="text-ink">desligada</strong>. Teste o
              gatilho e ative quando estiver pronto.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={() => void createRule()} disabled={busy} className="gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Criar automação
            </Button>
            <Button variant="ghost" onClick={() => setRuleModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- Modal: testar gatilho ---------------- */}
      <Modal open={testModal.open} onClose={() => { setTestModal({ open: false, rule: null }); setTestResult(null); setTestText(""); }} title="Testar gatilho (não envia nada)" size="md">
        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-ink-soft">
            Digite um comentário como se alguém tivesse escrito. Mostramos o que{" "}
            <strong className="text-ink">aconteceria</strong> — nenhuma mensagem é enviada.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Comentário de teste</label>
            <input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="QUERO" className={FIELD_CLASS_FILLED} />
          </div>
          <Button onClick={() => void runTest()} disabled={busy || !testText.trim()} className="gap-2 self-start">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
            Testar
          </Button>

          {testResult && (
            <div className="flex flex-col gap-2">
              <Divider />
              {testResult.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Nenhuma regra ativa para testar.</p>
              ) : (
                testResult.map((r) => (
                  <div key={r.ruleName} className="flex items-start gap-2">
                    {r.matched ? (
                      <CheckCircle2 size={15} className="text-success flex-none mt-0.5" />
                    ) : (
                      <XCircle size={15} className="text-ink-muted flex-none mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-ink">
                        <strong>{r.ruleName}</strong> — {r.matched ? "casaria o gatilho" : "não casaria"}
                        {r.matchedTerm ? ` (termo: “${r.matchedTerm}”)` : ""}
                      </p>
                      {r.wouldSendMessage && (
                        <p className="text-[11.5px] text-ink-muted">Enviaria: “{r.wouldSendMessage}”</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------- Modal: nova FAQ ---------------- */}
      <Modal open={faqModal} onClose={() => setFaqModal(false)} title="Nova resposta frequente" size="md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Pergunta / assunto</label>
            <input value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder="Ex.: Preço" className={FIELD_CLASS_FILLED} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Resposta</label>
            <textarea value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} rows={3} maxLength={900} placeholder="A resposta que pode ser usada no Direct." className={`${FIELD_CLASS_FILLED} resize-none`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-ink-soft">Palavras-chave (separadas por vírgula)</label>
            <input value={faqKeywords} onChange={(e) => setFaqKeywords(e.target.value)} placeholder="preço, valor, quanto custa" className={FIELD_CLASS_FILLED} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => void createFaq()} disabled={busy} className="gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Salvar resposta
            </Button>
            <Button variant="ghost" onClick={() => setFaqModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {!connected && (
        <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info-soft px-4 py-3.5">
          <Info size={17} className="text-info flex-none mt-0.5" />
          <p className="text-[12.5px] text-ink-soft">
            Conecte o Instagram em Redes Sociais para que as automações possam enviar as
            mensagens privadas.
          </p>
        </div>
      )}
    </div>
  );
}
