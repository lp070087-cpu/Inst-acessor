"use client";

import { clipAtTime, validateVideoProject, videoDimensions, videoDuration, videoRect, type VideoProject } from "./video-project";

export function recordingMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  // Generic MP4 does not prove H.264/AAC; unsupported encoders get WebM download only.
  return ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"]
    .find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null;
}
export async function loadVideo(url: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); video.removeAttribute("src"); video.load(); reject(new Error("Tempo limite ao abrir o vídeo.")); }, 15000);
    const stop = () => { cleanup(); video.removeAttribute("src"); video.load(); reject(new DOMException("Cancelado", "AbortError")); };
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", stop); video.onloadeddata = null; video.onerror = null; };
    video.onloadeddata = () => { cleanup(); resolve(); };
    video.onerror = () => { cleanup(); reject(new Error("Vídeo incompatível, inacessível ou sem permissão CORS.")); };
    signal?.addEventListener("abort", stop, { once: true });
    if (signal?.aborted) { stop(); return; }
    video.src = url;
  });
  return video;
}
export function drawVideoFrame(canvas: HTMLCanvasElement, project: VideoProject, videos: Map<string, HTMLVideoElement>, time: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  const { width, height } = canvas;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  const active = clipAtTime(project, time);
  for (const { clip, localTime } of active) {
    const video = videos.get(clip.url);
    if (!video?.videoWidth) continue;
    const index = project.layout === "sequence" ? 0 : project.clips.indexOf(clip);
    const [x, y, w, h] = videoRect(project.layout, index, width, height);
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight) * clip.zoom;
    const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (project.transition === "fade") ctx.globalAlpha = Math.max(0, Math.min(1, localTime / 0.2, (clip.end - clip.start - localTime) / 0.2));
    ctx.drawImage(video, x + (w - dw) / 2 + clip.x * w, y + (h - dh) / 2 + clip.y * h, dw, dh);
    ctx.restore();
  }
  for (const text of project.texts) {
    if (time < text.start || time >= text.end) continue;
    ctx.save();
    ctx.font = `600 ${Math.round(width / 22)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, width / 160); ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    ctx.strokeText(text.text, text.x * width, text.y * height, width * 0.94);
    ctx.fillText(text.text, text.x * width, text.y * height, width * 0.94);
    ctx.restore();
  }
}
export async function seekFrame(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.015 && video.readyState >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Tempo limite ao ler trecho do vídeo.")); }, 5000);
    const cleanup = () => { clearTimeout(timer); video.removeEventListener("seeked", done); video.removeEventListener("error", failed); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Não foi possível ler o vídeo.")); };
    video.addEventListener("seeked", done, { once: true }); video.addEventListener("error", failed, { once: true });
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.001));
  });
}
/** Bounded real-time local rendering; no serverless CPU or third-party service. */
export async function renderVideo(project: VideoProject, options: { signal: AbortSignal; onProgress: (progress: number) => void }): Promise<{ file: File; cover: Blob }> {
  validateVideoProject(project, true);
  // Reject unsupported simultaneous decoders before allocating media/audio resources.
if (project.layout !== "sequence" && project.clips[0].url === project.clips[1].url) throw new Error("Para tela dividida, selecione dois arquivos distintos.");
  const duration = videoDuration(project);
  if (!duration) throw new Error("Adicione pelo menos um trecho.");
  if (document.visibilityState === "hidden") throw new Error("Mantenha a aba visível durante a exportação.");
  const mime = recordingMime();
  if (!mime) throw new Error("Exportação indisponível neste navegador. Use um navegador com MediaRecorder.");
  const videos = new Map<string, HTMLVideoElement>();
  const canvas = document.createElement("canvas");
  Object.assign(canvas, videoDimensions(project.ratio));
  const audio = new AudioContext();
  const destination = audio.createMediaStreamDestination();
  const gains = new Map<string, GainNode>();
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = async () => {
    if (timer) clearTimeout(timer);
    for (const video of videos.values()) { video.pause(); video.removeAttribute("src"); video.load(); }
    stream?.getTracks().forEach((track) => track.stop());
    destination.stream.getTracks().forEach((track) => track.stop());
    if (audio.state !== "closed") await audio.close();
  };
  try {
    await audio.resume();
    // Sequential loading bounds decoder pressure and permits cancellation.
    for (const clip of project.clips) {
      if (videos.has(clip.url)) continue;
      options.signal.throwIfAborted();
      const video = await loadVideo(clip.url, options.signal);
      videos.set(clip.url, video);
      video.muted = false;
      const source = audio.createMediaElementSource(video);
      const gain = audio.createGain(); gain.gain.value = 0;
      source.connect(gain).connect(destination); gains.set(clip.url, gain);
    }
    const coverTime = Math.min(project.coverTime, Math.max(0, duration - 0.03));
    for (const entry of clipAtTime(project, coverTime)) await seekFrame(videos.get(entry.clip.url)!, entry.sourceTime);
    drawVideoFrame(canvas, project, videos, coverTime);
    const cover = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar capa.")), "image/jpeg", 0.92));
    stream = canvas.captureStream(30);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    let bytes = 0;
    const done = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = ({ data }) => {
        bytes += data.size;
        if (bytes > 125 * 1024 * 1024) { reject(new Error("Exportação excedeu o limite de memória local.")); if (recorder!.state !== "inactive") recorder!.stop(); }
        else if (data.size) chunks.push(data);
      };
      recorder!.onerror = () => reject(new Error("O navegador não conseguiu exportar o vídeo."));
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    });
    // Attach rejection immediately to avoid a transient unhandled promise.
    void done.catch(() => {});
    const abort = () => { if (recorder?.state !== "inactive") recorder?.stop(); };
    options.signal.addEventListener("abort", abort, { once: true });
    try {
      // Prime the first frame before the recording clock starts.
      for (const entry of clipAtTime(project, 0)) await seekFrame(videos.get(entry.clip.url)!, entry.sourceTime);
      drawVideoFrame(canvas, project, videos, 0);
      recorder.start(500);
      const started = performance.now();
      let previousTick = started;
      await new Promise<void>((resolve, reject) => {
        const step = async () => {
          try {
            options.signal.throwIfAborted();
            const now = performance.now();
            if (document.visibilityState === "hidden" || now - previousTick > 300) throw new Error("Exportação interrompida: a aba ou o dispositivo não acompanhou os quadros. Tente reduzir o projeto e manter a aba visível.");
            previousTick = now;
            const time = (now - started) / 1000;
            if (time >= duration) { resolve(); return; }
            const active = clipAtTime(project, time);
            for (const [url, video] of videos) {
              const entry = active.find((item) => item.clip.url === url);
              const gain = gains.get(url)!;
              if (!entry) { video.pause(); gain.gain.value = 0; continue; }
              gain.gain.value = entry.clip.volume;
              if (Math.abs(video.currentTime - entry.sourceTime) > 0.15) await seekFrame(video, entry.sourceTime);
              if (video.paused) await video.play();
            }
            drawVideoFrame(canvas, project, videos, time);
            options.onProgress(Math.min(99, Math.round(time / duration * 100)));
            timer = setTimeout(() => { void step(); }, 1000 / 30);
          } catch (error) { reject(error); }
        };
        void step();
      });
      if (recorder.state !== "inactive") recorder.stop();
      const blob = await done;
      options.signal.throwIfAborted();
      options.onProgress(100);
      return { file: new File([blob], `video-editado-${Date.now()}.${mime.startsWith("video/mp4") ? "mp4" : "webm"}`, { type: blob.type }), cover };
    } finally { options.signal.removeEventListener("abort", abort); }
  } finally {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    await release();
  }
}
