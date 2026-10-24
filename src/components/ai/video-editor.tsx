"use client";

import * as React from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/components/media-library/media-picker";
import { ownedBlobPath } from "@/lib/media/upload-policy";
import { emptyVideoProject, validateVideoProject, videoDuration, videoDimensions, clipAtTime, VIDEO_LIMITS, type VideoProject, type VideoClip } from "@/lib/media-editor/video-project";
import { drawVideoFrame, loadVideo, seekFrame, recordingMime, renderVideo } from "@/lib/media-editor/video-renderer";

interface Props {
  userId: string;
  initialProject?: string;
  sources?: { url: string; name: string }[];
  onProjectChange: (project: string) => void;
  onExport: (file: File) => void;
  onDirty?: () => void;
  onBusyChange?: (busy: boolean) => void;
}
function readProject(raw?: string): VideoProject {
  try { if (raw) return validateVideoProject(JSON.parse(raw)); } catch { /* Invalid drafts are never executed. */ }
  return emptyVideoProject();
}
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Local bounded editor. Original sources and the exported file remain distinct. */
export function VideoEditor({ userId, initialProject, sources = [], onProjectChange, onExport, onDirty, onBusyChange }: Props) {
  const [project, setProject] = React.useState(() => readProject(initialProject));
  const [selected, setSelected] = React.useState(0);
  const [time, setTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState("");
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const originals = React.useRef(new Map<string, File>());
  const videos = React.useRef(new Map<string, HTMLVideoElement>());
  const loading = React.useRef(new Map<string, { controller: AbortController; promise: Promise<HTMLVideoElement> }>());
  const controller = React.useRef<AbortController | null>(null);
  const lastEmitted = React.useRef(initialProject);
  const duration = videoDuration(project);
  const clip = project.clips[selected];
  const duplicateSplitSource = project.layout !== "sequence" && project.clips.length === 2 && project.clips[0].url === project.clips[1].url;
  const update = (next: VideoProject) => {
    const length = videoDuration(next);
    next = { ...next, coverTime: Math.min(next.coverTime, Math.max(0, length)),
      texts: length ? next.texts.map((item) => ({ ...item, start: Math.min(item.start, length), end: Math.max(Math.min(item.start, length), Math.min(item.end, length)) })) : [] };
    onDirty?.();
    setPlaying(false); setProject(next); setMessage("Alterações pendentes de exportação. Salve o projeto de vídeo antes do rascunho.");
    // Propagate edits only with durable source URLs. This invalidates the parent's prior export.
    if (next.clips.every((c) => c.url.startsWith("https://"))) {
      lastEmitted.current = JSON.stringify(next);
      onProjectChange(lastEmitted.current);
    }
  };
  const patchClip = (patch: Partial<VideoClip>) => update({ ...project, clips: project.clips.map((item, i) => i === selected ? { ...item, ...patch } : item) });

  React.useEffect(() => {
    if (initialProject === lastEmitted.current) return;
    lastEmitted.current = initialProject;
    const next = readProject(initialProject);
    setProject(next); setSelected(0); setTime(0); setPlaying(false);
  }, [initialProject]);
  React.useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  React.useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  React.useEffect(() => () => {
    controller.current?.abort();
    for (const pending of loading.current.values()) pending.controller.abort();
    loading.current.clear();
    for (const [url] of originals.current) URL.revokeObjectURL(url);
    for (const video of videos.current.values()) { video.pause(); video.removeAttribute("src"); video.load(); }
  }, []);
  React.useEffect(() => {
    const used = new Set(project.clips.map((item) => item.url));
    for (const [url, pending] of loading.current) if (!used.has(url)) { pending.controller.abort(); loading.current.delete(url); }
    for (const [url] of originals.current) if (!used.has(url)) { originals.current.delete(url); URL.revokeObjectURL(url); }
    for (const [url, video] of videos.current) if (!used.has(url)) { video.pause(); video.removeAttribute("src"); video.load(); videos.current.delete(url); }
  }, [project]);
  React.useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let stopped = false;
    const paint = async () => {
      Object.assign(target, videoDimensions(project.ratio));
      if (project.layout !== "sequence" && project.clips.length === 2 && project.clips[0].url === project.clips[1].url) return;
      for (const entry of clipAtTime(project, Math.min(time, Math.max(0, duration - 0.01)))) {
        let video = videos.current.get(entry.clip.url);
        if (!video) {
          const url = entry.clip.url;
          let pending = loading.current.get(url);
          if (!pending) {
            const controller = new AbortController();
            const promise = loadVideo(url, controller.signal).then((loaded) => {
              controller.signal.throwIfAborted();
              videos.current.set(url, loaded);
              return loaded;
            });
            pending = { controller, promise };
            loading.current.set(url, pending);
          }
          try { video = await pending.promise; }
          finally { if (loading.current.get(url) === pending) loading.current.delete(url); }
        }
        if (stopped) return;
        if (!playing || Math.abs(video.currentTime - entry.sourceTime) > 0.2) await seekFrame(video, entry.sourceTime);
        if (stopped) return;
        video.volume = entry.clip.volume;
        video.muted = !playing || entry.clip.volume === 0;
        if (playing && video.paused) await video.play();
      }
      if (stopped) return;
      const activeUrls = new Set(clipAtTime(project, time).map((entry) => entry.clip.url));
      for (const [url, video] of videos.current) if (!playing || !activeUrls.has(url)) video.pause();
      if (!stopped) drawVideoFrame(target, project, videos.current, Math.min(time, Math.max(0, duration - 0.01)));
    };
    void paint().catch((error: unknown) => { if (!stopped) setMessage(error instanceof Error ? error.message : "Falha na prévia."); });
    return () => { stopped = true; };
  }, [project, time, duration, playing]);
  React.useEffect(() => {
    if (!playing) return;
    const start = performance.now(), initial = time;
    const interval = setInterval(() => {
      const next = initial + (performance.now() - start) / 1000;
      if (next >= duration) { setTime(0); setPlaying(false); }
      else setTime(next);
    }, 100);
    return () => clearInterval(interval);
    // Playback starts from the current scrubber position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  async function add(url: string, name: string) {
    if (busy) return false;
    if (project.clips.length >= VIDEO_LIMITS.clips) { setMessage("Limite de doze trechos."); return false; }
    // Temporary loading blocks parent actions without invalidating a valid prior export.
    setBusy(true); setMessage(""); controller.current = new AbortController();
    try {
      const video = await loadVideo(url, controller.current.signal);
      const length = video.duration;
      video.removeAttribute("src"); video.load();
      if (!Number.isFinite(length) || length <= 0 || length > VIDEO_LIMITS.sourceDuration) throw new Error("Original deve ter duração conhecida de até dez minutos.");
      const next: VideoClip = { id: crypto.randomUUID(), url, name: name.slice(0, 240), duration: length, start: 0, end: Math.min(length, 30), zoom: 1, x: 0, y: 0, volume: 1, offset: 0 };
      update({ ...project, layout: "sequence", clips: [...project.clips, next] });
      setSelected(project.clips.length);
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Vídeo inválido."); return false; }
    finally { setBusy(false); }
  }
  async function onLocal(file?: File) {
    if (!file) return;
    if (!["video/mp4", "video/quicktime"].includes(file.type) || file.size > VIDEO_LIMITS.fileBytes) {
      setMessage("Use MP4/MOV de até 100 MB por original. Arquivos maiores exigem renderizador dedicado."); return;
    }
    const url = URL.createObjectURL(file); originals.current.set(url, file);
    if (!await add(url, file.name)) { originals.current.delete(url); URL.revokeObjectURL(url); }
  }
  async function persistSources(): Promise<VideoProject> {
    validateVideoProject(project, true);
    let next = project;
    for (const [url, file] of originals.current) {
      if (!next.clips.some((c) => c.url === url)) continue;
      const blob = await upload(`inst-acessor/${userId}/${file.name.replace(/[^\w.-]/g, "-")}`, file, {
        access: "public", handleUploadUrl: "/api/upload/media", abortSignal: controller.current?.signal,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const response = await fetch("/api/media-library", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.current?.signal,
        body: JSON.stringify({ url: blob.url, pathname: blob.pathname, mimeType: file.type, size: file.size, originalName: file.name }),
      });
      if (!response.ok) throw new Error("Original enviado, mas não registrado na Biblioteca. Nenhum arquivo foi apagado; tente registrar novamente.");
      next = { ...next, clips: next.clips.map((c) => c.url === url ? { ...c, url: blob.url } : c) };
    }
    validateVideoProject(next);
    setProject(next); lastEmitted.current = JSON.stringify(next); onProjectChange(lastEmitted.current);
    return next;
  }
  async function saveProject() {
    setPlaying(false); setBusy(true); controller.current = new AbortController(); setMessage("");
    try {
      const next = await persistSources();
      saveFile(new Blob([JSON.stringify(next, null, 2)], { type: "application/json" }), "projeto-video.json");
      setMessage("Projeto preparado. Salve também o rascunho para manter as edições no aplicativo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar projeto."); }
    finally { setBusy(false); }
  }
  async function openProject(file?: File) {
    if (!file) return;
    try {
      if (file.size > 40000) throw new Error("Projeto deve ter até 40 KB, sem arquivos de mídia embutidos.");
      const next = validateVideoProject(JSON.parse(await file.text()));
      if (next.layout !== "sequence" && next.clips[0].url === next.clips[1].url) throw new Error("Para tela dividida, selecione dois arquivos distintos.");
      if (!next.clips.every((item) => ownedBlobPath(item.url, userId))) throw new Error("O projeto precisa usar somente originais da sua Biblioteca.");
      lastEmitted.current = JSON.stringify(next); onDirty?.(); onProjectChange(lastEmitted.current);
      setProject(next); setSelected(0); setTime(0); setPlaying(false); setMessage("Projeto reaberto. Exporte novamente para usar o vídeo final.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Projeto inválido."); }
  }
  async function exportVideo() {
    setPlaying(false); setBusy(true); setProgress(0); setMessage(""); controller.current = new AbortController();
    try {
      const result = await renderVideo(project, { signal: controller.current.signal, onProgress: setProgress });
      saveFile(result.file, result.file.name);
      saveFile(result.cover, "capa-video.jpg");
      if (result.file.type !== "video/mp4") {
        setMessage("Vídeo WebM e capa exportados para download. Este navegador não exporta MP4 compatível; o arquivo não foi enviado à publicação. Use renderizador MP4 dedicado para essa etapa.");
        return;
      }
      await persistSources();
      onExport(result.file);
      setMessage("MP4 e capa exportados. Vídeo final enviado ao editor principal; salve o rascunho. Capa é download separado, sem promessa de envio à Meta.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na exportação."); }
    finally { setBusy(false); }
  }
  function split() {
    if (!clip) return;
    const at = project.layout === "sequence" ? time - project.clips.slice(0, selected).reduce((n, c) => n + c.end - c.start, 0) + clip.start : time - clip.offset + clip.start;
    if (at <= clip.start + 0.05 || at >= clip.end - 0.05 || project.clips.length >= VIDEO_LIMITS.clips) { setMessage("Posicione o cursor dentro do trecho selecionado para dividir."); return; }
    const clips = [...project.clips];
    clips.splice(selected, 1, { ...clip, end: at }, { ...clip, id: crypto.randomUUID(), start: at });
    update({ ...project, layout: "sequence", clips });
  }
  const number = (label: string, value: number, change: (n: number) => void, min: number, max: number, step = 0.1) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">{label}<input className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-ink" type="number" min={min} max={max} step={step} value={value} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) change(Math.max(min, Math.min(max, n))); }} /></label>
  );
  return <section aria-label="Editor de vídeo" className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
    <div><h3 className="font-semibold">Editor de vídeo</h3><p className="text-xs text-ink-muted">Processamento no dispositivo, até 3 minutos finais e 100 MB por original. Exportação em tempo real; mantenha a aba visível. A prévia usa os mesmos enquadramentos do arquivo final.</p></div>
    <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
      <label className="text-sm">Importar MP4/MOV<input className="mt-1 block w-full text-xs" type="file" accept="video/mp4,video/quicktime" onChange={(e) => { void onLocal(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <Button type="button" variant="outline" onClick={() => setLibraryOpen(true)}>Adicionar vídeo da Biblioteca</Button>
      <label className="text-sm">Reabrir projeto JSON<input className="mt-1 block w-full text-xs" type="file" accept="application/json,.json" onChange={(e) => { void openProject(e.target.files?.[0]); e.target.value = ""; }} /></label>
      {sources.length > 0 && <label className="text-sm">Da Biblioteca<select className="mt-1 w-full rounded-lg border border-border bg-surface p-2" defaultValue="" onChange={(e) => { const source = sources.find((s) => s.url === e.target.value); if (source) void add(source.url, source.name); e.target.value = ""; }}><option value="">Adicionar vídeo selecionado no editor</option>{sources.map((source) => <option key={source.url} value={source.url}>{source.name}</option>)}</select></label>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm">Layout<select className="mt-1 w-full rounded-lg border border-border bg-surface p-2" value={project.layout} onChange={(e) => { const layout = e.target.value as VideoProject["layout"]; if (layout !== "sequence" && project.clips.length !== 2) { setMessage("Adicione exatamente dois trechos para tela dividida."); return; } if (layout !== "sequence" && project.clips[0].url === project.clips[1].url) { setMessage("Para tela dividida, selecione dois arquivos distintos."); return; } update({ ...project, layout }); }}><option value="sequence">Sequência / juntar trechos</option><option value="side-by-side">Lado a lado</option><option value="stacked">Em cima / embaixo</option><option value="picture-in-picture">Vídeo em janela</option></select></label>
      <label className="text-sm">Proporção<select className="mt-1 w-full rounded-lg border border-border bg-surface p-2" value={project.ratio} onChange={(e) => update({ ...project, ratio: e.target.value as VideoProject["ratio"] })}><option>9:16</option><option>1:1</option><option>16:9</option></select></label></div>
      <canvas ref={canvas} aria-label="Prévia da composição de vídeo" className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl bg-black" />
      <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={!duration || duplicateSplitSource} onClick={() => setPlaying(!playing)}>{playing ? "Pausar prévia" : "Reproduzir prévia"}</Button><span className="text-xs">{time.toFixed(1)} / {duration.toFixed(1)} s</span></div>
      <label className="text-xs">Posição na composição<input className="w-full" type="range" min="0" max={Math.max(0.01, duration)} step="0.05" value={Math.min(time, duration)} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} /></label>
      <ol className="flex flex-col gap-2">{project.clips.map((item, index) => <li key={item.id} className={`flex min-w-0 flex-wrap items-center gap-2 rounded-lg border p-2 ${index === selected ? "border-purple" : "border-border"}`}><button className="min-w-0 flex-1 truncate text-left text-sm" type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{index + 1}. {item.name}</button><Button type="button" variant="ghost" disabled={index === 0} aria-label={`Mover trecho ${index + 1} para antes`} onClick={() => { const clips = [...project.clips]; [clips[index - 1], clips[index]] = [clips[index], clips[index - 1]]; update({ ...project, clips }); setSelected(index - 1); }}>↑</Button><Button type="button" variant="ghost" aria-label={`Remover trecho ${index + 1}`} onClick={() => { update({ ...project, layout: "sequence", clips: project.clips.filter((c) => c.id !== item.id) }); setSelected(0); }}>Remover</Button></li>)}</ol>
      {clip && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {number("Início (s)", clip.start, (start) => patchClip({ start }), 0, clip.end - 0.1)}
        {number("Fim (s)", clip.end, (end) => patchClip({ end }), clip.start + 0.1, clip.duration)}
        {number("Sincronização (s)", clip.offset, (offset) => patchClip({ offset }), 0, 180)}
        {number("Zoom", clip.zoom, (zoom) => patchClip({ zoom }), 1, 3)}
        {number("Posição X", clip.x, (x) => patchClip({ x }), -0.5, 0.5, 0.01)}
        {number("Posição Y", clip.y, (y) => patchClip({ y }), -0.5, 0.5, 0.01)}
        {number("Volume (0 = mudo)", clip.volume, (volume) => patchClip({ volume }), 0, 1, 0.05)}
      </div>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" type="button" disabled={!clip} onClick={split}>Dividir no cursor</Button><label className="text-sm">Transição<select className="ml-2 rounded border border-border bg-surface p-2" value={project.transition} onChange={(e) => update({ ...project, transition: e.target.value as VideoProject["transition"] })}><option value="none">Corte</option><option value="fade">Fade curto para preto</option></select></label></div>
      <Button type="button" variant="outline" disabled={!duration || project.texts.length >= VIDEO_LIMITS.texts} onClick={() => update({ ...project, texts: [...project.texts, { id: crypto.randomUUID(), text: "Seu texto", start: 0, end: duration, x: 0.5, y: 0.8 }] })}>Inserir texto</Button>
      {project.texts.map((text) => <div key={text.id} className="rounded-lg border border-border p-3"><label className="text-xs">Texto sobre o vídeo<input aria-label="Texto sobre o vídeo" className="mt-1 w-full rounded border border-border bg-surface p-2" maxLength={160} value={text.text} onChange={(e) => update({ ...project, texts: project.texts.map((t) => t.id === text.id ? { ...t, text: e.target.value } : t) })} /></label><div className="mt-2 grid grid-cols-2 gap-2">{([['Início texto', 'start', 0, duration], ['Fim texto', 'end', 0, duration], ['Texto X', 'x', 0, 1], ['Texto Y', 'y', 0, 1]] as const).map(([label, key, min, max]) => <React.Fragment key={key}>{number(label, text[key], (value) => update({ ...project, texts: project.texts.map((t) => t.id === text.id ? { ...t, [key]: value } : t) }), min, max)}</React.Fragment>)}</div><Button type="button" variant="ghost" onClick={() => update({ ...project, texts: project.texts.filter((t) => t.id !== text.id) })}>Remover texto</Button></div>)}
      {number("Instante da capa (s)", project.coverTime, (coverTime) => update({ ...project, coverTime }), 0, duration)}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!duration} onClick={() => void saveProject()}>Salvar projeto editável</Button><Button type="button" disabled={!duration || duplicateSplitSource} onClick={() => void exportVideo()}>Exportar vídeo e capa</Button></div>
    </fieldset>
    {busy && <div><progress className="w-full" max={100} value={progress} aria-label="Progresso da exportação" /><Button variant="outline" type="button" onClick={() => controller.current?.abort()}>Cancelar</Button></div>}
    <p className="text-xs text-ink-muted">{typeof window !== "undefined" && recordingMime()?.startsWith("video/mp4") ? "MP4 disponível neste navegador; compatibilidade final será validada no upload." : "MP4 pode não estar disponível: WebM é somente para download, sem publicação automática."}</p>
    {duplicateSplitSource && <p role="status" className="text-sm">Para tela dividida, selecione dois arquivos distintos ou volte ao layout Sequência.</p>}
    {message && <p role="status" className="break-words text-sm">{message}</p>}
    <MediaPicker open={libraryOpen} onClose={() => setLibraryOpen(false)} multiple={false} onlyType="VIDEO" onConfirm={(items) => { setLibraryOpen(false); const item = items[0]; if (item) void add(item.url, item.originalName || "Vídeo da Biblioteca"); }} />
  </section>;
}
