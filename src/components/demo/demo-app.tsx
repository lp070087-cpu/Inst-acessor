"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { BarChart3, CalendarDays, Check, ChevronRight, FileText, Instagram, Link2, Plus, Sparkles, X } from "lucide-react";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import "./demo.css";

const tabs = [
  { id: "dashboard", label: "Início", icon: BarChart3 },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "publicacoes", label: "Publicações", icon: FileText },
  { id: "integracoes", label: "Integrações", icon: Link2 },
] as const;
const posts = [
  { title: "Pequenos hábitos, grandes resultados", type: "Carrossel", day: 19, time: "09:00", status: "Agendado", color: "rose" },
  { title: "Os bastidores da nossa semana", type: "Reels", day: 21, time: "18:30", status: "Rascunho", color: "violet" },
  { title: "Uma ideia para começar de novo", type: "Imagem", day: 23, time: "12:00", status: "Agendado", color: "blue" },
];

export function DemoApp({ screen }: { screen: string }) {
  const current = tabs.find((tab) => tab.id === screen)?.id ?? "dashboard";
  const [width, setWidth] = useState(390);
  const [day, setDay] = useState(19);
  const [filter, setFilter] = useState("Todos");
  const [modal, setModal] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(modal), dialog, () => setModal(null));
  const selectPost = (title: string) => { setDraft(title); setModal("Detalhe da publicação"); };
  const showDraft = () => { setDraft(""); setModal("Novo rascunho fictício"); };

  return <div className="inst-demo-stage" style={{ "--demo-width": `${width}px` } as CSSProperties}>
    <aside className="inst-demo-tools" aria-label="Visualização responsiva">
      <div><strong>Prévia local</strong><span>Inst Acessor · dados fictícios</span></div>
      <div className="inst-demo-widths" aria-label="Largura da prévia">{[320, 360, 390, 412].map((size) => <button key={size} type="button" aria-pressed={width === size} onClick={() => setWidth(size)}>{size}<span className="inst-demo-sr"> pixels</span></button>)}</div>
      <p>Salve os arquivos no VS Code para atualizar esta prévia.</p>
    </aside>
    <div className="inst-demo-phone">
      <div className="inst-demo-banner"><span className="inst-demo-dot" /> DEMONSTRAÇÃO LOCAL · SEM OPERAÇÕES REAIS</div>
      <header className="inst-demo-header"><Link href="/demo/dashboard" className="inst-demo-brand"><span className="inst-demo-logo">i</span><span>inst<span className="inst-demo-brand-light">acessor</span></span></Link><span className="inst-demo-avatar" aria-label="Perfil fictício de Marina">MA</span></header>
      <main className="inst-demo-main" id="demo-content">
        <p className="inst-demo-eyebrow">ESPAÇO DEMONSTRATIVO</p>
        <div className="inst-demo-title"><div><h1>{current === "dashboard" ? "Olá, Marina ✨" : current === "calendario" ? "Seu calendário" : current === "publicacoes" ? "Publicações" : "Integrações"}</h1><p>{current === "dashboard" ? "Vamos dar vida à sua próxima ideia?" : current === "calendario" ? "Um pouco de organização. Muito potencial." : current === "publicacoes" ? "Suas ideias, prontas para ganhar o mundo." : "Suas redes, em um só lugar."}</p></div></div>
        {current === "dashboard" && <>
          <section className="inst-demo-hero"><span className="inst-demo-chip"><Sparkles size={13} aria-hidden="true" /> SEU PRÓXIMO PASSO</span><h2>Consistência começa<br />com uma boa ideia.</h2><p>Seu planejamento da semana está tomando forma. Vamos criar juntos?</p><button className="inst-demo-white-button" onClick={showDraft}><Plus size={17} aria-hidden="true" /> Criar publicação</button><div className="inst-demo-hero-orbit" aria-hidden="true" /></section>
          <div className="inst-demo-section-heading"><h2>Seu crescimento</h2><span>Últimos 7 dias · fictício</span></div>
          <div className="inst-demo-metrics">{[{ label: "Seguidores", value: "2.840", change: "+8,2%" }, { label: "Engajamento", value: "4,8%", change: "+1,4%" }].map((metric) => <article className="inst-demo-card" key={metric.label}><span className="inst-demo-muted">{metric.label}</span><strong className="inst-demo-number">{metric.value}</strong><span className="inst-demo-positive">↗ {metric.change} <small>na semana</small></span><div className="inst-demo-bars" aria-hidden="true">{[30, 48, 40, 65, 53, 79, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article>)}</div>
          <div className="inst-demo-section-heading"><h2>A seguir</h2><Link href="/demo/calendario">Ver agenda <ChevronRight size={13} aria-hidden="true" /></Link></div>
          <PostCard post={posts[0]} onClick={() => selectPost(posts[0].title)} />
          <div className="inst-demo-tip"><Sparkles size={19} aria-hidden="true" /><div><strong>Uma dose de inspiração</strong><p>Mostre o processo, não só o resultado. Seus bastidores podem virar um ótimo conteúdo.</p><small>Sugestão fictícia · nenhuma IA foi consultada</small></div></div>
        </>}
        {current === "calendario" && <>
          <section className="inst-demo-card inst-demo-calendar"><div className="inst-demo-section-heading"><h2>Outubro de 2026</h2><CalendarDays size={18} aria-hidden="true" /></div><div className="inst-demo-week" aria-hidden="true">{["D", "S", "T", "Q", "Q", "S", "S"].map((label, i) => <span key={i}>{label}</span>)}</div><div className="inst-demo-days">{Array.from({ length: 4 }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: 31 }, (_, i) => i + 1).map((date) => <button key={date} onClick={() => setDay(date)} aria-pressed={day === date} aria-label={`${date} de outubro${posts.some((post) => post.day === date) ? ", possui publicação fictícia" : ""}`} className={posts.some((post) => post.day === date) ? "has-post" : ""}>{date}</button>)}</div></section>
          <div className="inst-demo-section-heading"><h2>{day} de outubro</h2><span>Agenda fictícia</span></div>
          {posts.filter((post) => post.day === day).map((post) => <PostCard key={post.title} post={post} onClick={() => selectPost(post.title)} />)}
          {!posts.some((post) => post.day === day) && <div className="inst-demo-empty"><CalendarDays size={28} aria-hidden="true" /><h3>Espaço para uma nova ideia</h3><p>Nenhuma publicação fictícia neste dia.</p></div>}
          <button className="inst-demo-primary" onClick={showDraft}><Plus size={17} aria-hidden="true" /> Planejar publicação</button>
        </>}
        {current === "publicacoes" && <>
          <button className="inst-demo-primary" onClick={showDraft}><Plus size={17} aria-hidden="true" /> Nova publicação</button>
          <div className="inst-demo-filters" aria-label="Filtrar publicações">{["Todos", "Agendado", "Rascunho"].map((item) => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <div className="inst-demo-section-heading"><h2>Sua biblioteca</h2><span>3 exemplos</span></div>
          {posts.filter((post) => filter === "Todos" || post.status === filter).map((post) => <PostCard key={post.title} post={post} onClick={() => selectPost(post.title)} />)}
          <p className="inst-demo-footnote">Nenhum conteúdo desta prévia será publicado ou agendado.</p>
        </>}
        {current === "integracoes" && <>
          <div className="inst-demo-tip"><Link2 size={21} aria-hidden="true" /><div><strong>Conexões de demonstração</strong><p>Os perfis abaixo são fictícios. Nenhuma conta real está conectada.</p></div></div>
          {[{ name: "Instagram", handle: "@studio.exemplo", symbol: "◎", connected: true }, { name: "TikTok", handle: "Seu próximo canal criativo", symbol: "♪", connected: false }, { name: "Meta", handle: "Página Studio Exemplo", symbol: "∞", connected: true }].map((network) => <article className="inst-demo-card inst-demo-network" key={network.name}><div className="inst-demo-network-top"><span className="inst-demo-network-icon" aria-hidden="true">{network.symbol}</span><div><h2>{network.name}</h2><p>{network.handle}</p></div><span className="inst-demo-status">{network.connected ? "Exemplo" : "Disponível"}</span></div><button className="inst-demo-secondary" onClick={() => { setDraft(""); setModal(`Simulação: ${network.name}`); }}>{network.connected ? "Ver conexão fictícia" : "Simular conexão"}<ChevronRight size={15} aria-hidden="true" /></button></article>)}
          <p className="inst-demo-footnote">Não há OAuth, chamadas de API, pagamentos ou sincronização nesta demonstração.</p>
        </>}
        <div className="inst-demo-notice" role="status">{notice}</div>
      </main>
      <nav className="inst-demo-nav" aria-label="Navegação da demonstração">{tabs.map(({ id, label, icon: Icon }) => <Link key={id} href={`/demo/${id}`} aria-current={current === id ? "page" : undefined}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}</nav>
    </div>
    {modal && <div className="inst-demo-overlay"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="inst-demo-dialog-title" tabIndex={-1} className="inst-demo-dialog"><button className="inst-demo-close" aria-label="Fechar" onClick={() => setModal(null)}><X size={20} /></button><span className="inst-demo-eyebrow">APENAS UMA SIMULAÇÃO</span><h2 id="inst-demo-dialog-title">{modal}</h2>{modal.startsWith("Simulação") ? <p>Uma conexão real pediria autorização da sua conta. Aqui nenhuma integração é iniciada e nenhum dado é enviado.</p> : <><label htmlFor="inst-demo-draft">Ideia da publicação</label><textarea id="inst-demo-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma ideia fictícia…" rows={4} /><p>Conteúdo temporário, mantido somente nesta tela. Não será salvo no banco nem publicado.</p></>}<button className="inst-demo-primary" onClick={() => { setNotice(modal.startsWith("Simulação") ? "Simulação concluída. Nenhuma conta foi conectada." : "Rascunho simulado. Nenhuma publicação foi criada ou enviada."); setModal(null); }}><Check size={17} aria-hidden="true" />{modal.startsWith("Simulação") ? "Concluir simulação" : "Simular salvar rascunho"}</button></div></div>}
  </div>;
}

function PostCard({ post, onClick }: { post: typeof posts[number]; onClick: () => void }) {
  return <button className="inst-demo-card inst-demo-post" onClick={onClick}><span className={`inst-demo-thumbnail ${post.color}`} aria-hidden="true"><Sparkles size={24} /></span><span className="inst-demo-post-body"><span className="inst-demo-post-meta"><Instagram size={12} aria-hidden="true" /> {post.type} · {post.day} out, {post.time}</span><strong>{post.title}</strong><span className="inst-demo-status">{post.status} · fictício</span></span><ChevronRight size={16} aria-hidden="true" /></button>;
}
