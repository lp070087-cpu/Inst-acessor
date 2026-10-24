"use client";

import * as React from "react";
import { ExternalLink, Save, X, Pencil, Trash2, AlertTriangle, Check } from "lucide-react";

type CheckoutUrlMap = Record<string, string>;

const SELLABLE_SLUGS = ["semanal", "start", "essencial", "pro", "elite", "master"] as const;

function isValidHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" && v.trim().length <= 500;
  } catch {
    return false;
  }
}

export function WebhooksCheckoutEditor({
  initialCheckoutUrls,
  provider,
}: {
  initialCheckoutUrls: CheckoutUrlMap;
  provider: "kiwify" | "kacto";
}) {
  const [urls, setUrls] = React.useState<CheckoutUrlMap>(initialCheckoutUrls);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ slug: string; text: string; ok: boolean } | null>(null);

  const label = provider === "kiwify" ? "Kiwify" : "Kacto";

  async function save(slug: string) {
    const trimmed = draft.trim();
    if (trimmed && !isValidHttpsUrl(trimmed)) {
      setMsg({ slug, text: "URL deve ser https:// (max 500 caracteres).", ok: false });
      return;
    }
    if (trimmed.length > 500) {
      setMsg({ slug, text: "URL muito longa (max 500).", ok: false });
      return;
    }
    setSaving(slug);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-checkout-url", plan: slug, checkoutUrl: trimmed }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: { checkoutUrls?: CheckoutUrlMap } };
      if (!res.ok || data.error) throw new Error(data.error ?? "Falha ao salvar.");
      const next = (data.config?.checkoutUrls ?? {}) as CheckoutUrlMap;
      setUrls(next);
      setEditing(null);
      setMsg({ slug, text: trimmed ? "Salvo." : "Removido.", ok: true });
    } catch (e) {
      const m = e instanceof Error ? e.message : "Falha ao salvar.";
      setMsg({ slug, text: m, ok: false });
    } finally {
      setSaving(null);
    }
  }

  async function clear(slug: string) {
    setSaving(slug);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-checkout-url", plan: slug, checkoutUrl: "" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: { checkoutUrls?: CheckoutUrlMap } };
      if (!res.ok || data.error) throw new Error(data.error ?? "Falha ao remover.");
      setUrls((data.config?.checkoutUrls ?? {}) as CheckoutUrlMap);
      setMsg({ slug, text: "Removido.", ok: true });
    } catch (e) {
      setMsg({ slug, text: e instanceof Error ? e.message : "Falha ao remover.", ok: false });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex gap-2.5">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-amber-800">
          Checkout externo ({label}) é opcional e usado apenas quando o gateway externo hospeda a página de pagamento. A URL deve ser <code className="font-data">https://</code> (max 500). Usada como redirect no checkout — nunca como rota interna.
        </p>
      </div>

      <div className="grid gap-2.5">
        {SELLABLE_SLUGS.map((slug) => {
          const current = urls[slug] ?? "";
          const isEditing = editing === slug;
          return (
            <div key={slug} className="rounded-[10px] border border-border-soft bg-surface/30 px-3.5 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-ink">{slug}</p>
                  {current ? (
                    <a
                      href={current}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-purple hover:underline inline-flex items-center gap-1 truncate max-w-[min(420px,65vw)]"
                    >
                      <span className="truncate">{current}</span>
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                  ) : (
                    <p className="text-[12px] text-ink-muted">Sem checkout externo configurado.</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(slug);
                          setDraft(current);
                          setMsg(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-[8px] border border-border-soft bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:border-purple/30 hover:text-purple"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      {current ? (
                        <button
                          type="button"
                          onClick={() => clear(slug)}
                          disabled={saving === slug}
                          className="inline-flex items-center gap-1 rounded-[8px] border border-border-soft bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:border-danger/30 hover:text-danger disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Remover
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="flex flex-col gap-2 border-t border-border-soft/60 pt-3">
                  <label className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                    URL do checkout ({label}) — https://
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 min-w-0 rounded-[9px] border border-border-soft bg-card px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple/40"
                    />
                  </div>
                  {msg && msg.slug === slug ? (
                    <p className={"text-[12px] flex items-center gap-1 " + (msg.ok ? "text-success" : "text-danger")}>
                      {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {msg.text}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => save(slug)}
                      disabled={saving === slug}
                      className="inline-flex items-center gap-1.5 rounded-[9px] bg-purple text-white px-3.5 py-2 text-[13px] font-semibold hover:bg-purple-600 disabled:opacity-50"
                    >
                      <Save size={14} /> {saving === slug ? "Salvando…" : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setDraft("");
                        setMsg(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[9px] border border-border-soft bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft hover:border-border"
                    >
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : msg && msg.slug === slug ? (
                <p className={"text-[12px] flex items-center gap-1 " + (msg.ok ? "text-success" : "text-danger")}>
                  {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {msg.text}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
