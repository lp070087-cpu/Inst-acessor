/**
 * RECORTE DE IMAGEM — regras compartilhadas por prévia, editor e exportação.
 *
 * O quadro (frame) tem a proporção escolhida; a imagem cobre o quadro depois da
 * rotação, recebe o zoom e é deslocada em fração do quadro. A mesma geometria
 * desenha o card do celular e o arquivo final, então o que se aprova na prévia
 * é exatamente o que é exportado.
 */
/** Cobre o quadro depois da rotação e aplica o zoom; devolve o tamanho exibido da imagem. */
export function imageGeometry(width: number, height: number, frameWidth: number, frameHeight: number, rotation: number, zoom: number) {
  const radians = rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(radians)), s = Math.abs(Math.sin(radians));
  // Cobre o quadro no sistema girado da imagem; evita cantos vazios.
  const scale = Math.max((frameWidth*c + frameHeight*s)/width, (frameWidth*s + frameHeight*c)/height) * zoom;
  return { width: width*scale, height: height*scale, radians };
}

export type CropRatio = "original" | "free" | "1:1" | "4:5" | "9:16" | "16:9";
export type CropFormat = "post" | "carrossel" | "reel" | "story";

export const FIXED_RATIO: Record<Exclude<CropRatio, "original" | "free">, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
};

/** Faixa aceita pelo Instagram: feed de 4:5 a 1,91:1; Story/Reel em 9:16. */
export function aspectRange(format: CropFormat): [number, number] {
  return format === "story" || format === "reel" ? [9 / 16, 9 / 16] : [4 / 5, 1.91];
}

export function ratioAllowed(format: CropFormat, ratio: CropRatio): boolean {
  if (format === "story" || format === "reel") return ratio === "9:16";
  return ratio !== "9:16";
}

export function clampAspect(format: CropFormat, aspect: number): number {
  const [min, max] = aspectRange(format);
  return Math.min(max, Math.max(min, aspect));
}

/** Proporção (largura/altura) da imagem já girada, por múltiplos de 90°. */
export function rotatedAspect(width: number, height: number, rotation: number): number {
  const quarter = Math.round(rotation / 90) % 2 !== 0;
  return quarter ? height / width : width / height;
}

/** Proporção efetiva do quadro para uma escolha de recorte. */
export function resolveAspect(format: CropFormat, ratio: CropRatio, natural: { width: number; height: number } | null, rotation: number, freeAspect?: number): number {
  if (ratio === "original") return clampAspect(format, natural ? rotatedAspect(natural.width, natural.height, rotation) : 4 / 5);
  if (ratio === "free") return clampAspect(format, freeAspect ?? 4 / 5);
  return FIXED_RATIO[ratio];
}

export interface CropFraming {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export const CROP_MIN_ZOOM = 1;
export const CROP_MAX_ZOOM = 5;
export const CROP_MAX_OFFSET = 4;

/** Verdadeiro quando os quatro cantos do quadro ficam dentro da imagem girada. */
function covers(natW: number, natH: number, aspect: number, rotation: number, f: CropFraming): boolean {
  const W = 1, H = 1 / aspect;
  const g = imageGeometry(natW, natH, W, H, rotation, f.zoom);
  const cos = Math.cos(-g.radians), sin = Math.sin(-g.radians);
  const ox = f.offsetX * W, oy = f.offsetY * H;
  for (const [cx, cy] of [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]) {
    const x = cx - ox, y = cy - oy;
    const rx = x * cos - y * sin, ry = x * sin + y * cos;
    if (Math.abs(rx) > g.width / 2 + 1e-9 || Math.abs(ry) > g.height / 2 + 1e-9) return false;
  }
  return true;
}

/**
 * Mantém a imagem cobrindo o quadro inteiro (sem cantos vazios nem faixas).
 * O deslocamento zero sempre cobre; o conjunto válido é convexo, então a busca
 * ao longo do segmento até o centro encontra o ponto válido mais próximo.
 */
export function clampFraming(natW: number, natH: number, aspect: number, rotation: number, framing: CropFraming): CropFraming {
  const zoom = Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, framing.zoom));
  const f = { zoom, offsetX: framing.offsetX, offsetY: framing.offsetY };
  if (!natW || !natH || covers(natW, natH, aspect, rotation, f)) return f;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (covers(natW, natH, aspect, rotation, { zoom, offsetX: f.offsetX * mid, offsetY: f.offsetY * mid })) lo = mid; else hi = mid;
  }
  return { zoom, offsetX: f.offsetX * lo, offsetY: f.offsetY * lo };
}

/** Limites do Instagram para imagens: largura de 320 a 1440 px. */
export const MIN_EXPORT_WIDTH = 320;
export const MAX_EXPORT_WIDTH = 1440;

/**
 * Tamanho do arquivo final: usa os pixels REAIS da área recortada, sem ampliar
 * além do original (exceto o mínimo exigido pela plataforma) e sem passar do
 * máximo aceito. A altura segue a proporção exata do quadro.
 */
export function exportSize(natW: number, natH: number, aspect: number, rotation: number, zoom: number): { width: number; height: number } {
  const g = imageGeometry(natW, natH, 1, 1 / aspect, rotation, zoom);
  const sourcePixelsAcross = natW / g.width; // pixels do original que cabem na largura do quadro
  const width = Math.round(Math.min(MAX_EXPORT_WIDTH, Math.max(MIN_EXPORT_WIDTH, sourcePixelsAcross)));
  return { width, height: Math.round(width / aspect) };
}

export interface CropAdjustments {
  framing: CropFraming;
  rotation: number;
  brightness?: number;
  contrast?: number;
}

/** Desenha o recorte num canvas do tamanho dado. Usado pela exportação e pela prévia do arquivo final. */
export function drawCrop(canvas: HTMLCanvasElement, image: CanvasImageSource & { naturalWidth: number; naturalHeight: number }, aspect: number, edit: CropAdjustments) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Exportação de imagem indisponível neste navegador.");
  const { width, height } = canvas;
  const g = imageGeometry(image.naturalWidth, image.naturalHeight, width, width / aspect, edit.rotation, edit.framing.zoom);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(width * (0.5 + edit.framing.offsetX), height * (0.5 + edit.framing.offsetY));
  ctx.rotate(g.radians);
  ctx.filter = `brightness(${edit.brightness ?? 1}) contrast(${edit.contrast ?? 1})`;
  ctx.drawImage(image, -g.width / 2, -g.height / 2, g.width, g.height);
  ctx.restore();
}
