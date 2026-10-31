"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FIELD_CLASS_FILLED, SELECT_CLASS_FILLED } from "@/lib/ui/field";

type Filters = { q: string; planSlug: string; status: string; source: string; sort: string };
type Entry = { id: string; name: string | null; email: string; whatsapp: string | null; planSlug: string; source: string; status: string; emailConsent: boolean; whatsappConsent: boolean; createdAt: string; verifiedAt: string | null };
type Group = { count: number; planSlug?: string; source?: string; status?: string };
type NotificationCount = { channel: string; status: string; count: number };
type ListData = { items: Entry[]; page: number; pageSize: number; total: number; counters: { total: number; today: number; dayTimezone?: string; byPlan: Group[]; bySource: Group[]; byStatus: Group[]; emailConsent: number; whatsappConsent: number }; campaigns: Campaign[] };
type Campaign = { id: string; key: string; channel: string; kind: string | null; status: string; createdAt: string; notificationCount: number; deliveryCounts?: NotificationCount[] };
const campaignStatuses: Record<string, string> = { PREPARED: "Preparada (nada enviado)", SENDING: "Envio confirmado", COMPLETED: "Concluída" };
const kindLabels: Record<string, string> = { LAUNCH: "Abertura dos planos", NEWS: "Novidades do app" };
const initialFilters: Filters = { q: "", planSlug: "", status: "", source: "", sort: "newest" };
const statuses: Record<string, string> = { PENDING: "Pendente de confirmação", VERIFIED: "Confirmado", UNSUBSCRIBED: "Descadastrado" };
function date(value: string | null) { return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Não confirmado"; }
function query(filters: Filters, page: number) { const params = new URLSearchParams({ page: String(page) }); for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim()); return params; }

/** Barras dos últimos 30 dias; a tabela oculta mantém os valores acessíveis a leitores de tela. */
function DailyChart({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map(day => day.count));
  const sum = days.reduce((total, day) => total + day.count, 0);
  return <figure className="m-0">
    <div aria-hidden="true" className="flex h-32 items-end gap-[3px] rounded-xl bg-surface p-2">
      {days.map(day => <div key={day.day} title={`${day.day}: ${day.count}`} className="min-w-0 flex-1 rounded-t bg-brand-grad opacity-85 transition-opacity hover:opacity-100 motion-safe:animate-fade-slide" style={{ height: `${Math.max(day.count ? 6 : 2, (day.count / max) * 100)}%` }} />)}
    </div>
    <figcaption className="mt-2 flex justify-between gap-3 text-xs text-ink-muted"><span>{days[0]?.day}</span><span>{sum} no período · pico {max === 1 && !sum ? 0 : max}/dia</span><span>{days[days.length - 1]?.day}</span></figcaption>
    <table className="sr-only"><caption>Inscrições por dia, últimos 30 dias em UTC</caption><thead><tr><th scope="col">Dia</th><th scope="col">Inscrições</th></tr></thead><tbody>{days.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.count}</td></tr>)}</tbody></table>
  </figure>;
}

const planLabels: Record<string, string> = { semanal: "Semanal", mensal: "Mensal", anual: "Anual" };
/** Participação de cada plano no interesse total da lista. */
function PlanShare({ rows, total }: { rows: Group[]; total: number }) {
  return <section aria-label="Interesse por plano" className="grid gap-3 sm:grid-cols-3">{["semanal", "mensal", "anual"].map(slug => {
    const count = rows.find(row => row.planSlug === slug)?.count ?? 0;
    const share = total ? Math.round((count / total) * 100) : 0;
    return <div key={slug} className="min-w-0 rounded-2xl border border-border-soft bg-card p-4">
      <div className="flex items-baseline justify-between gap-3"><p className="text-sm font-semibold text-ink">{planLabels[slug]}</p><p className="text-xs text-ink-muted">{count} inscrição(ões)</p></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Participação do plano ${planLabels[slug]}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}><div className="h-full rounded-full bg-brand-grad transition-[width] duration-700 ease-out" style={{ width: `${share}%` }} /></div>
      <p className="mt-2 text-2xl font-bold text-ink">{share}%</p>
    </div>;
  })}</section>;
}

export function LaunchWaitlistClient() {
  const [draftFilters, setDraftFilters] = React.useState(initialFilters);
  const [filters, setFilters] = React.useState(initialFilters);
  const [page, setPage] = React.useState(1);
  const [refresh, setRefresh] = React.useState(0);
  const [data, setData] = React.useState<(ListData & { recentDays: { day: string; count: number }[]; notificationCounts: NotificationCount[] }) | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [channel, setChannel] = React.useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [confirmed, setConfirmed] = React.useState(false);
  const [queuing, setQueuing] = React.useState(false);
  const [queueError, setQueueError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<"LAUNCH" | "NEWS">("NEWS");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [ctaUrl, setCtaUrl] = React.useState("");
  const [saleUrl, setSaleUrl] = React.useState("");
  const [sending, setSending] = React.useState<Campaign | null>(null);
  const [typedKey, setTypedKey] = React.useState("");
  const [presaleApproved, setPresaleApproved] = React.useState(false);
  const [sendBusy, setSendBusy] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setData(null);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/launch-waitlist?${query(filters, page)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const result: ListData & { recentDays: { day: string; count: number }[]; notificationCounts: NotificationCount[] } = await response.json();
        if (!Array.isArray(result.items) || !result.counters || !Array.isArray(result.campaigns) || !Array.isArray(result.recentDays) || !Array.isArray(result.notificationCounts)) throw new Error();
        if (!controller.signal.aborted) setData(result);
      } catch { if (!controller.signal.aborted) setError("Não foi possível carregar as inscrições. Verifique o acesso e a configuração da lista."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [filters, page, refresh]);

  async function exportCsv() {
    setExporting(true); setError(null);
    try {
      const params = query(filters, 1); params.set("format", "csv");
      const response = await fetch(`/api/admin/launch-waitlist?${params}`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/csv")) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pre-lancamento.csv"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Não foi possível exportar o CSV. Nenhum arquivo de inscrições foi gerado."); }
    finally { setExporting(false); }
  }

  async function queue(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed || !/^[a-zA-Z0-9_-]{3,80}$/.test(key.trim()) || queuing) return;
    setQueuing(true); setQueueError(null);
    try {
      const content = kind === "LAUNCH" ? { saleUrl: saleUrl.trim() } : { ...(subject.trim() ? { subject: subject.trim() } : {}), ...(body.trim() ? { body: body.trim() } : {}), ...(ctaUrl.trim() ? { ctaUrl: ctaUrl.trim() } : {}) };
      const response = await fetch("/api/admin/launch-waitlist/campaigns", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key.trim(), channel, kind, confirmQueue: true, ...content }) });
      const result: { ok?: boolean; queued?: number; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || typeof result.queued !== "number") { setQueueError(result.error ?? "Não foi possível confirmar a preparação da fila. Confira o histórico antes de tentar novamente e reutilize o mesmo identificador para a mesma campanha."); return; }
      setNotice(`Fila preparada: ${result.queued} registro(s). Nenhuma mensagem foi enviada; o envio exige uma segunda confirmação no histórico.`);
      setCampaignOpen(false); setConfirmed(false); setRefresh(value => value + 1);
    } catch { setQueueError("Não foi possível confirmar a preparação da fila. Confira o histórico antes de tentar novamente e reutilize o mesmo identificador para a mesma campanha."); }
    finally { setQueuing(false); }
  }

  async function confirmSend(event: React.FormEvent) {
    event.preventDefault();
    if (!sending || typedKey !== sending.key || sendBusy || (sending.kind === "LAUNCH" && !presaleApproved)) return;
    setSendBusy(true); setSendError(null);
    try {
      const response = await fetch("/api/admin/launch-waitlist/campaigns/send", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: sending.key, confirmKey: typedKey, confirmSend: true, ...(sending.kind === "LAUNCH" ? { presaleApproved: true } : {}) }) });
      const result: { ok?: boolean; eligible?: number; cancelled?: number; status?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) { setSendError(result.error ?? "Não foi possível confirmar o envio. Nada foi enviado."); return; }
      setNotice(result.status === "COMPLETED" ? "Campanha sem destinatários elegíveis; nada a enviar." : `Envio confirmado para ${result.eligible ?? 0} destinatário(s) elegível(is)${result.cancelled ? ` (${result.cancelled} cancelado(s) por perda de consentimento)` : ""}. O processamento ocorre em lotes com limite de taxa.`);
      setSending(null); setRefresh(value => value + 1);
    } catch { setSendError("Resultado não confirmado. Atualize o histórico antes de tentar novamente."); }
    finally { setSendBusy(false); }
  }

  async function processBatch(item: Campaign) {
    if (processing) return;
    setProcessing(item.id); setError(null);
    try {
      const response = await fetch("/api/admin/launch-waitlist/campaigns/process", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: item.key }) });
      const result: { ok?: boolean; configured?: boolean; sent?: number; uncertain?: number; released?: number; cancelled?: number; stopped?: string | null; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) { setError(result.error ?? "Não foi possível processar o lote."); return; }
      setNotice(!result.configured ? "Canal não configurado/ativado: nada foi enviado e a fila continua retida." : `Lote processado: ${result.sent ?? 0} aceito(s) pelo provedor, ${result.uncertain ?? 0} incerto(s), ${result.released ?? 0} devolvido(s) à fila, ${result.cancelled ?? 0} cancelado(s)${result.stopped ? ` · interrompido (${result.stopped})` : ""}.`);
      setRefresh(value => value + 1);
    } catch { setError("Resultado do lote não confirmado. Atualize o histórico antes de tentar novamente."); }
    finally { setProcessing(null); }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="min-w-0 space-y-6">
    <aside className="rounded-xl border border-purple/20 bg-ai-soft p-4 text-sm leading-6 text-ink-soft"><strong className="text-purple">Envio em duas etapas.</strong> Preparar uma campanha cria apenas registros retidos para inscritos confirmados com consentimento do canal. O envio só começa depois de uma segunda confirmação, digitando o identificador da campanha, e somente se o canal estiver configurado. Nada é enviado automaticamente.</aside>
    {notice && <p role="status" className="rounded-xl border border-purple/20 bg-ai-soft p-4 text-sm text-ink">{notice}</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading || exporting} onClick={() => void exportCsv()} className="whitespace-normal">{exporting ? "Preparando CSV..." : "Exportar CSV filtrado"}</Button><Button onClick={() => { setQueueError(null); setConfirmed(false); setCampaignOpen(true); }} className="whitespace-normal">Preparar campanha</Button><Button variant="ghost" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Atualizar</Button></div>
    <p className="text-xs leading-5 text-ink-muted">O CSV contém dados pessoais e é limitado a 1.000 registros. Restrinja seu compartilhamento. Os horários da lista são exibidos em Brasília.</p>
    <form onSubmit={event => { event.preventDefault(); setPage(1); setFilters({ ...draftFilters }); }} className="grid min-w-0 gap-3 rounded-2xl border border-border-soft bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm">Pesquisar<input aria-label="Pesquisar inscrições" className={FIELD_CLASS_FILLED} value={draftFilters.q} maxLength={200} onChange={event => setDraftFilters(current => ({ ...current, q: event.target.value }))} placeholder="Nome, email ou contato" /></label>
      <label className="space-y-1 text-sm">Plano<select className={SELECT_CLASS_FILLED} value={draftFilters.planSlug} onChange={event => setDraftFilters(current => ({ ...current, planSlug: event.target.value }))}><option value="">Todos</option>{["semanal", "mensal", "anual"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="space-y-1 text-sm">Status<select className={SELECT_CLASS_FILLED} value={draftFilters.status} onChange={event => setDraftFilters(current => ({ ...current, status: event.target.value }))}><option value="">Todos</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">Origem<select className={SELECT_CLASS_FILLED} value={draftFilters.source} onChange={event => setDraftFilters(current => ({ ...current, source: event.target.value }))}><option value="">Todas</option><option value="landing">Landing</option><option value="landing-plan">Escolha de plano</option></select></label>
      <label className="space-y-1 text-sm">Ordem<select className={SELECT_CLASS_FILLED} value={draftFilters.sort} onChange={event => setDraftFilters(current => ({ ...current, sort: event.target.value }))}><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option></select></label>
      <div className="flex flex-wrap items-end gap-2"><Button type="submit" variant="outline">Filtrar</Button><Button type="button" variant="ghost" onClick={() => { setDraftFilters(initialFilters); setFilters(initialFilters); setPage(1); }}>Limpar filtros</Button></div>
    </form>
    {error && <p role="alert" className="rounded-xl border border-danger/30 p-4 text-sm text-danger">{error}</p>}
    {loading && <p role="status" className="text-sm text-ink-muted">Carregando inscrições...</p>}
    {data && <>
      <p className="text-sm text-ink-muted">Os indicadores e as distribuições abaixo consideram toda a lista, independentemente dos filtros. “Hoje” segue o dia em UTC; as datas individuais são exibidas em Brasília.</p>
      <section aria-label="Indicadores globais da lista" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total cadastrado", data.counters.total], ["Hoje (UTC)", data.counters.today], ["Consentimento email", data.counters.emailConsent], ["Consentimento WhatsApp", data.counters.whatsappConsent]].map(([label, value]) => <div key={label} className="min-w-0 rounded-2xl border border-border-soft bg-card p-4"><p className="text-xs leading-5 text-ink-muted">{label}</p><p className="mt-2 break-words text-2xl font-bold text-ink">{value}</p></div>)}</section>
      <PlanShare rows={data.counters.byPlan} total={data.counters.total} />
      <details className="rounded-2xl border border-border-soft bg-card p-4"><summary className="cursor-pointer rounded font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Distribuição por plano, origem e status</summary><div className="mt-4 grid gap-5 sm:grid-cols-3">{[["Planos", data.counters.byPlan], ["Origens", data.counters.bySource], ["Status", data.counters.byStatus]].map(([label, rows]) => <div key={label as string}><h2 className="mb-2 text-sm font-semibold">{label as string}</h2><ul className="space-y-2 text-sm">{(rows as Group[]).map(row => { const key = row.planSlug || row.source || row.status || "Sem informação"; return <li key={key} className="flex justify-between gap-3"><span className="break-words">{statuses[key] || key}</span><span>{row.count}</span></li>; })}</ul></div>)}</div></details>
      <details open className="rounded-2xl border border-border-soft bg-card p-4"><summary className="cursor-pointer rounded font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Inscrições por dia e notificações</summary><div className="mt-4 grid gap-6 sm:grid-cols-2"><div><h2 className="mb-3 text-sm font-semibold">Últimos 30 dias (UTC)</h2><DailyChart days={data.recentDays} /></div><div><h2 className="mb-3 text-sm font-semibold">Fila por canal e estado</h2><p className="mb-3 text-xs leading-5 text-ink-muted">HELD: envio retido. SENT: aceitação pelo provedor, não prova de entrega. UNCERTAIN: conferir antes de reprocessar. O envio só ocorre em campanhas confirmadas.</p><ul className="space-y-2 text-sm">{data.notificationCounts.map(row => <li key={`${row.channel}:${row.status}`} className="flex justify-between gap-3"><span>{row.channel} · {row.status}</span><span>{row.count}</span></li>)}</ul></div></div></details>
      <section className="min-w-0 rounded-2xl border border-border-soft bg-card p-4"><h2 className="mb-3 font-semibold text-ink">Inscrições ({data.total} resultado(s))</h2>{!data.items.length ? <p className="text-sm text-ink-muted">Nenhuma inscrição corresponde aos filtros.</p> : <><p className="mb-2 text-xs text-ink-muted">A tabela pode ser rolada horizontalmente em telas menores.</p><div role="region" aria-label="Tabela de inscrições" tabIndex={0} className="overflow-x-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr>{["Nome", "Email", "WhatsApp", "Plano", "Origem", "Status", "Email autorizado", "WhatsApp autorizado", "Cadastro", "Confirmação"].map(label => <th key={label} scope="col" className="border-b border-border p-3 font-semibold">{label}</th>)}</tr></thead><tbody>{data.items.map(item => <tr key={item.id}>{[item.name || "Não informado", item.email, item.whatsapp || "Não informado", item.planSlug, item.source, statuses[item.status] || item.status, item.emailConsent ? "Sim" : "Não", item.whatsappConsent ? "Sim" : "Não", date(item.createdAt), date(item.verifiedAt)].map((value, index) => <td key={index} className="max-w-[260px] break-words border-b border-border-soft p-3 align-top">{value}</td>)}</tr>)}</tbody></table></div></>}
        <nav aria-label="Paginação das inscrições" className="mt-4 flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</Button><span className="text-sm">Página {data.page} de {pages}</span><Button variant="outline" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Próxima</Button></nav>
      </section>
      <section className="rounded-2xl border border-border-soft bg-card p-4"><h2 className="mb-3 font-semibold">Histórico de campanhas</h2>{!data.campaigns.length ? <p className="text-sm text-ink-muted">Nenhuma campanha preparada.</p> : <ul className="space-y-3 text-sm">{data.campaigns.map(item => <li key={item.id} className="min-w-0 space-y-2 break-words border-b border-border-soft pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><strong>{item.key}</strong><p>{kindLabels[item.kind ?? ""] ?? "Sem destinatários"} · {item.channel === "WHATSAPP" ? "WhatsApp" : "Email"} · {campaignStatuses[item.status] ?? item.status} · {item.notificationCount} registro(s) · {date(item.createdAt)}</p></div>
          <div className="flex flex-wrap gap-2">{item.status === "PREPARED" && <Button size="sm" onClick={() => { setSendError(null); setTypedKey(""); setPresaleApproved(false); setSending(item); }} className="whitespace-normal">Enviar…</Button>}{item.status === "SENDING" && <Button size="sm" variant="outline" disabled={!!processing} onClick={() => void processBatch(item)} className="whitespace-normal">{processing === item.id ? "Processando..." : "Processar próximo lote"}</Button>}</div></div>
        {!!item.deliveryCounts?.length && <ul aria-label={`Entregas da campanha ${item.key}`} className="flex flex-wrap gap-2 text-xs">{item.deliveryCounts.map(row => <li key={`${row.channel}:${row.status}`} className="rounded-full border border-border-soft px-2 py-1">{row.channel} · {row.status}: {row.count}</li>)}</ul>}
      </li>)}</ul>}<p className="mt-3 text-xs text-ink-muted">SENT indica aceitação pelo provedor, não prova de entrega. UNCERTAIN nunca é reenviado automaticamente. O cron e o botão de lote respeitam limite de taxa.</p></section>
    </>}
    <Modal open={campaignOpen} onClose={() => { if (!queuing) setCampaignOpen(false); }} title="Preparar campanha" description="Somente enfileiramento; nenhum envio externo será realizado nesta etapa.">
      <form onSubmit={queue} className="space-y-4">
        {queueError && <p role="alert" className="text-sm text-danger">{queueError}</p>}
        <fieldset disabled={queuing} className="min-w-0 space-y-4 border-0 p-0">
          <label className="block space-y-1 text-sm">Identificador da campanha<input required minLength={3} maxLength={80} pattern={"[a-zA-Z0-9_\\-]{3,80}"} title="Use de 3 a 80 letras sem acentos, números, hífen ou sublinhado." value={key} onChange={event => setKey(event.target.value)} placeholder="launch-abertura" className={FIELD_CLASS_FILLED} /></label>
          <p className="text-xs leading-5 text-ink-muted">Use o mesmo identificador para repetir a mesma operação com segurança. A fila considera os inscritos elegíveis do canal, não apenas esta página de resultados.</p>
          <label className="block space-y-1 text-sm">Tipo<select className={SELECT_CLASS_FILLED} value={kind} onChange={event => setKind(event.target.value as "LAUNCH" | "NEWS")}><option value="NEWS">Novidades do app</option><option value="LAUNCH">Abertura dos planos (pré-venda)</option></select></label>
          <label className="block space-y-1 text-sm">Canal<select className={SELECT_CLASS_FILLED} value={channel} onChange={event => setChannel(event.target.value as "EMAIL" | "WHATSAPP")}><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option></select></label>
          {kind === "LAUNCH" ? <label className="block space-y-1 text-sm">Link dos planos (site oficial)<input required type="url" maxLength={500} value={saleUrl} onChange={event => setSaleUrl(event.target.value)} placeholder="https://unitrixapp.com.br/planos" className={FIELD_CLASS_FILLED} /></label>
            : channel === "EMAIL" ? <>
              <label className="block space-y-1 text-sm">Assunto<input required minLength={3} maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} className={FIELD_CLASS_FILLED} /></label>
              <label className="block space-y-1 text-sm">Mensagem (texto simples)<textarea required minLength={10} maxLength={2000} rows={6} value={body} onChange={event => setBody(event.target.value)} className={FIELD_CLASS_FILLED} /><span className="block text-xs text-ink-muted">{body.length}/2000 · HTML não é interpretado. O link de descadastro e de preferências é incluído automaticamente.</span></label>
              <label className="block space-y-1 text-sm">Link “Saiba mais” (opcional, site oficial)<input type="url" maxLength={500} value={ctaUrl} onChange={event => setCtaUrl(event.target.value)} className={FIELD_CLASS_FILLED} /></label>
            </> : <p className="text-xs leading-5 text-ink-muted">No WhatsApp o texto é o do modelo aprovado pela Meta (WHATSAPP_TEMPLATE_NEWS); não há texto livre.</p>}
          <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /><span>Confirmo preparar somente a fila para inscritos confirmados que autorizaram este canal. Isso não envia mensagens.</span></label>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCampaignOpen(false)}>Cancelar</Button><Button type="submit" disabled={!confirmed || !key.trim() || queuing} className="whitespace-normal">{queuing ? "Preparando..." : "Confirmar fila, sem enviar"}</Button></div>
        </fieldset>
      </form>
    </Modal>
    <Modal open={!!sending} onClose={() => { if (!sendBusy) setSending(null); }} title="Confirmar envio da campanha" description="Esta ação envia mensagens reais aos inscritos elegíveis.">
      {sending && <form onSubmit={confirmSend} className="space-y-4">
        {sendError && <p role="alert" className="text-sm text-danger">{sendError}</p>}
        <fieldset disabled={sendBusy} className="min-w-0 space-y-4 border-0 p-0">
          <p className="text-sm leading-6">{kindLabels[sending.kind ?? ""] ?? "Campanha"} por {sending.channel === "WHATSAPP" ? "WhatsApp (modelo aprovado)" : "email"} para até {sending.notificationCount} inscrito(s). Quem perdeu o consentimento ou se descadastrou é cancelado automaticamente.</p>
          {sending.kind === "LAUNCH" && <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={presaleApproved} onChange={event => setPresaleApproved(event.target.checked)} className="mt-1" /><span>Confirmo que a pré-venda está aprovada e o link dos planos está publicado.</span></label>}
          <label className="block space-y-1 text-sm">Digite o identificador <strong className="break-all">{sending.key}</strong> para confirmar<input required autoComplete="off" spellCheck={false} value={typedKey} onChange={event => setTypedKey(event.target.value)} className={FIELD_CLASS_FILLED} /></label>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSending(null)}>Cancelar</Button><Button type="submit" disabled={typedKey !== sending.key || (sending.kind === "LAUNCH" && !presaleApproved) || sendBusy} className="whitespace-normal">{sendBusy ? "Confirmando..." : "Enviar campanha"}</Button></div>
        </fieldset>
      </form>}
    </Modal>
  </div>;
}
