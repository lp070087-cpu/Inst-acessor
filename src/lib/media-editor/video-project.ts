/** Browser-renderable, non destructive video project. No binary media in JSON. */
export type VideoLayout = "sequence" | "side-by-side" | "stacked" | "picture-in-picture";
export type VideoRatio = "9:16" | "1:1" | "16:9";
export interface VideoClip {
  id: string;
  url: string;
  name: string;
  duration: number;
  start: number;
  end: number;
  zoom: number;
  x: number;
  y: number;
  volume: number;
  /** Seconds from the beginning of the composition, for split layouts. */
  offset: number;
}
export interface VideoText {
  id: string;
  text: string;
  start: number;
  end: number;
  x: number;
  y: number;
}
export interface VideoProject {
  version: 1;
  kind: "video-editor";
  ratio: VideoRatio;
  layout: VideoLayout;
  clips: VideoClip[];
  texts: VideoText[];
  transition: "none" | "fade";
  coverTime: number;
}
export const VIDEO_LIMITS = { clips: 12, texts: 20, fileBytes: 100 * 1024 * 1024, duration: 180, sourceDuration: 600 } as const;
export function emptyVideoProject(): VideoProject {
  return { version: 1, kind: "video-editor", ratio: "9:16", layout: "sequence", clips: [], texts: [], transition: "none", coverTime: 0 };
}
export function videoDuration(project: VideoProject): number {
  return project.layout === "sequence"
    ? project.clips.reduce((sum, clip) => sum + clip.end - clip.start, 0)
    : Math.max(0, ...project.clips.slice(0, 2).map((clip) => clip.offset + clip.end - clip.start));
}
export function clipAtTime(project: VideoProject, time: number): { clip: VideoClip; sourceTime: number; localTime: number }[] {
  if (!Number.isFinite(time) || time < 0 || time >= videoDuration(project)) return [];
  let cursor = 0;
  return project.clips.slice(0, project.layout === "sequence" ? VIDEO_LIMITS.clips : 2).flatMap((clip) => {
    const begin = project.layout === "sequence" ? cursor : clip.offset;
    const length = clip.end - clip.start;
    cursor += length;
    return time >= begin && time < begin + length
      ? [{ clip, sourceTime: clip.start + time - begin, localTime: time - begin }]
      : [];
  });
}
export function videoDimensions(ratio: VideoRatio, width = 720): { width: number; height: number } {
  const [x, y] = ratio.split(":").map(Number);
  return { width, height: Math.round(width * y / x / 2) * 2 };
}
export function validateVideoProject(value: unknown, allowLocal = false): VideoProject {
  if (!value || typeof value !== "object") throw new Error("Projeto de vídeo inválido.");
  const p = value as VideoProject;
  if (p.version !== 1 || p.kind !== "video-editor" || !["9:16", "1:1", "16:9"].includes(p.ratio) ||
      !["sequence", "side-by-side", "stacked", "picture-in-picture"].includes(p.layout) ||
      !["none", "fade"].includes(p.transition) || !Array.isArray(p.clips) || p.clips.length > VIDEO_LIMITS.clips ||
      !Array.isArray(p.texts) || p.texts.length > VIDEO_LIMITS.texts) throw new Error("Estrutura do vídeo inválida.");
  const numeric = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
  const ids = new Set<string>();
  for (const c of p.clips) {
    if (!c || typeof c.id !== "string" || c.id.length > 100 || ids.has(c.id) || typeof c.name !== "string" || c.name.length > 240 ||
        typeof c.url !== "string" || c.url.length > 2048 || !(c.url.startsWith("https://") || (allowLocal && c.url.startsWith("blob:"))) ||
        !numeric(c.duration, 0.1, VIDEO_LIMITS.sourceDuration) || !numeric(c.start, 0, c.duration) || !numeric(c.end, c.start + 0.05, c.duration) ||
        !numeric(c.zoom, 1, 3) || !numeric(c.x, -0.5, 0.5) || !numeric(c.y, -0.5, 0.5) || !numeric(c.volume, 0, 1) || !numeric(c.offset, 0, VIDEO_LIMITS.duration)) {
      throw new Error("Trecho inválido ou fora dos limites do editor local.");
    }
    ids.add(c.id);
  }
  if (p.layout !== "sequence" && p.clips.length !== 2) throw new Error("Tela dividida exige exatamente dois trechos.");
  if (!numeric(videoDuration(p), 0, VIDEO_LIMITS.duration) || !numeric(p.coverTime, 0, videoDuration(p))) throw new Error("Vídeo final deve ter até três minutos; confira a capa.");
  for (const t of p.texts) {
    if (!t || typeof t.id !== "string" || t.id.length > 100 || typeof t.text !== "string" || t.text.length > 160 ||
        !numeric(t.start, 0, videoDuration(p)) || !numeric(t.end, t.start, videoDuration(p)) || !numeric(t.x, 0, 1) || !numeric(t.y, 0, 1)) throw new Error("Texto ou duração inválidos.");
  }
  return p;
}
/** Geometry shared by preview and the exported video. */
export function videoRect(layout: VideoLayout, index: number, width: number, height: number): [number, number, number, number] {
  if (layout === "side-by-side") return [index * width / 2, 0, width / 2, height];
  if (layout === "stacked") return [0, index * height / 2, width, height / 2];
  if (layout === "picture-in-picture" && index === 1) return [width * 0.63, height * 0.05, width * 0.32, height * 0.32];
  return [0, 0, width, height];
}
