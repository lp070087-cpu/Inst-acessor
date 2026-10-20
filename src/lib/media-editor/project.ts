import { z } from "zod";
import { validateVideoProject } from "./video-project";
import { ownedBlobPath } from "@/lib/media/upload-policy";
import { tiktokPublishingOptionsSchema } from "@/lib/integrations/tiktok/creator-info";

export const MAX_EDITOR_SLIDES = 7;
export const framingSchema = z.object({ zoom: z.number().min(1).max(3), offsetX: z.number().min(-0.5).max(0.5), offsetY: z.number().min(-0.5).max(0.5) }).strict();
export const editorSlideSchema = z.object({
  id: z.string().min(1).max(120), originalUrl: z.string().url().max(2048), exportedUrl: z.string().url().max(2048).optional(),
  type: z.enum(["image", "video"]), framing: framingSchema,
  rotation: z.number().min(-180).max(180).default(0), brightness: z.number().min(0.25).max(2).default(1), contrast: z.number().min(0.25).max(2).default(1),
}).strict();
export const editorProjectSchema = z.object({ version: z.literal(1), kind: z.literal("media-editor"), aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]), slides: z.array(editorSlideSchema).max(MAX_EDITOR_SLIDES), videoRendered: z.boolean().optional(), videoProject: z.string().max(40000).optional(), tiktokOptions: tiktokPublishingOptionsSchema.optional() }).strict().refine(p => new Set(p.slides.map(s => s.id)).size === p.slides.length, "Slides duplicados");
export type EditorProject = z.infer<typeof editorProjectSchema>;
export type EditorSlide = z.infer<typeof editorSlideSchema>;
export function parseEditorProject(raw?: string | null): EditorProject | null {
  if (!raw || raw.length > 65536) return null;
  try { const parsed = editorProjectSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : null; } catch { return null; }
}
export function validateEditorOwnership(project: EditorProject, userId: string): boolean {
  if(project.videoProject){try{const video=validateVideoProject(JSON.parse(project.videoProject));if(!video.clips.every(c=>ownedBlobPath(c.url,userId)))return false;}catch{return false;}}
  return project.slides.every(s => !!ownedBlobPath(s.originalUrl, userId) && (!s.exportedUrl || !!ownedBlobPath(s.exportedUrl, userId)));
}
/** Publishing must use this order, never the singular legacy cover field. */
export function editorMediaItems(project: EditorProject) { return project.slides.map(s => ({ url: s.exportedUrl || s.originalUrl, type: s.type })); }
