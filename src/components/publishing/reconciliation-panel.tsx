"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Item = { id: string; platform: string; externalId: string | null; content: { title: string } };
export function ReconciliationPanel() {
  const router = useRouter();
  const [items, setItems] = React.useState<Item[]>([]);
  const [selected, setSelected] = React.useState("");
  const [externalId, setExternalId] = React.useState("");
  const [reviewed, setReviewed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const selectedItem = items.find(item => item.id === selected);
  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/publishing/reconciliation", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar.");
      setItems(data.items);
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : "Falha ao carregar."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  React.useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function confirm(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/publishing/reconciliation", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId: selected, externalId: externalId.trim(), reviewedContent: reviewed }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Resultado não confirmado. A publicação permanece em conferência; confira a conta e o ID.");
      setMessage("Publicação confirmada e histórico atualizado. Nenhuma publicação foi reenviada.");
      setSelected(""); setExternalId(""); setReviewed(false); await load(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível conferir."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-border-soft bg-surface p-4 sm:p-6" aria-labelledby="reconciliation-title">
    <h2 id="reconciliation-title" className="text-lg font-semibold">Conferência administrativa</h2>
    <p className="mt-2 text-sm text-ink-muted">Publicações com resultado incerto ficam protegidas contra reenvio. Confira o conteúdo na conta correta. Instagram exige o ID da mídia publicada, não do container; TikTok usa o publish_id do processamento.</p>
    <p className="mt-2 text-sm text-ink-muted">O botão consulta a plataforma externa usando a conexão do proprietário. Execute somente em ambiente e conta autorizados. Essa conferência não envia publicações.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Carregando conferências…</p> : items.length === 0 ? <p className="mt-4 text-sm">Nenhum item aguardando conferência.</p> :
      <form onSubmit={confirm} className="mt-4 grid gap-4">
        <label className="grid gap-1 text-sm">Publicação aguardando conferência
          <select className="min-w-0 w-full rounded-lg border border-border-soft bg-surface p-2" value={selected} disabled={busy}
            onChange={event => { const item = items.find(row => row.id === event.target.value); setSelected(event.target.value); setExternalId(item?.externalId ?? ""); setReviewed(false); setMessage(""); }} required>
            <option value="">Selecione uma publicação</option>{items.map(item => <option key={item.id} value={item.id}>{item.platform} · {item.content.title.slice(0, 80)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">{selectedItem?.platform === "tiktok" ? "publish_id do processamento TikTok" : "ID da mídia publicada no Instagram"}
          <input className="min-w-0 w-full rounded-lg border border-border-soft bg-surface p-2" value={externalId} onChange={event => { setExternalId(event.target.value); setReviewed(false); }} required maxLength={200} pattern={"[a-zA-Z0-9_.~\\-]{1,200}"} disabled={busy || !!selectedItem?.externalId} />
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={busy || !selected} required />Conferi manualmente a conta, a mídia e a legenda; este ID corresponde ao conteúdo selecionado.</label>
        <Button type="submit" disabled={busy || !selected || !reviewed || !externalId.trim()}>{busy ? "Conferindo…" : "Conferir publicação"}</Button>
        <p className="text-xs text-ink-muted">Exibidos até 50 itens mais antigos. Se a plataforma não confirmar o resultado, o item continua protegido.</p>
      </form>}
    {message && <p role="status" className="mt-4 break-words text-sm">{message}</p>}
    <Button type="button" variant="ghost" className="mt-3" disabled={busy || loading} onClick={() => void load()}>Atualizar conferências</Button>
  </section>;
}
