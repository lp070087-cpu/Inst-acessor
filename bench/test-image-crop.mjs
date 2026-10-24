import assert from 'node:assert/strict';
import { clampFraming, exportSize, resolveAspect, ratioAllowed, clampAspect, imageGeometry } from '../src/lib/media-editor/image-crop.ts';
import { editorProjectSchema } from '../src/lib/media-editor/project.ts';

let checks = 0;
const check = (cond, label) => { assert.ok(cond, label); checks++; console.log(`ok ${label}`); };
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// Proporções por formato (limites do Instagram)
check(ratioAllowed('post', '1:1') && ratioAllowed('post', '4:5') && !ratioAllowed('post', '9:16'), 'Feed accepts 1:1 and 4:5 but not 9:16');
check(ratioAllowed('story', '9:16') && !ratioAllowed('reel', '4:5'), 'Story and Reel are 9:16 only');
check(close(clampAspect('post', 0.3), 0.8) && close(clampAspect('post', 3), 1.91), 'Feed aspect clamped to 4:5..1.91:1');
check(close(resolveAspect('post', 'original', { width: 3000, height: 2000 }, 0), 1.5), 'Original keeps a landscape 3:2 aspect');
check(close(resolveAspect('post', 'original', { width: 3000, height: 2000 }, 90), 0.8), 'Original of a rotated landscape is clamped to 4:5');
check(close(resolveAspect('carrossel', 'free', null, 0, 1.2), 1.2), 'Free aspect is kept inside the allowed range');

// A imagem sempre cobre o quadro (sem faixas vazias), em qualquer rotação
const corners = (natW, natH, aspect, rot, f) => {
  const W = 1, H = 1 / aspect, g = imageGeometry(natW, natH, W, H, rot, f.zoom), c = Math.cos(-g.radians), s = Math.sin(-g.radians);
  return [[-W/2,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]].every(([x,y]) => { const dx = x - f.offsetX*W, dy = y - f.offsetY*H; const rx = dx*c - dy*s, ry = dx*s + dy*c; return Math.abs(rx) <= g.width/2 + 1e-6 && Math.abs(ry) <= g.height/2 + 1e-6; });
};
for (const [w, h, label] of [[4000, 3000, 'horizontal'], [3000, 4000, 'vertical'], [2000, 2000, 'square']]) {
  for (const rot of [0, 17, 90, -135]) {
    const f = clampFraming(w, h, 0.8, rot, { zoom: 1.3, offsetX: 3, offsetY: -3 });
    check(corners(w, h, 0.8, rot, f), `${label} image at ${rot}° still covers the frame after an extreme drag`);
  }
  const centered = clampFraming(w, h, 1, 0, { zoom: 2, offsetX: 0.2, offsetY: 0 });
  check(close(centered.offsetX, 0.2), `${label} valid offset is preserved untouched`);
}
const panned = clampFraming(4000, 1000, 0.8, 0, { zoom: 1, offsetX: 5, offsetY: 0 });
check(panned.offsetX > 0.5 && corners(4000, 1000, 0.8, 0, panned), 'Panoramas can pan past the old ±0.5 limit while staying covered');

// Resolução de saída: pixels nativos, dentro de 320–1440 px, proporção exata
const big = exportSize(6000, 4000, 4/5, 0, 1);
check(big.width === 1440 && big.height === 1800, 'Large photo exports at the 1440px maximum, 4:5 exact');
const native = exportSize(1200, 1200, 1, 0, 1);
check(native.width === 1200 && native.height === 1200, 'Square 1200px photo keeps its native resolution, no upscaling');
const zoomed = exportSize(1200, 1200, 1, 0, 2);
check(zoomed.width === 600, 'Zoom 2x exports the 600 real pixels of the crop instead of inventing detail');
const tiny = exportSize(200, 200, 1, 0, 1);
check(tiny.width === 320, 'Tiny image is raised to the 320px platform minimum');
const story = exportSize(3000, 4000, 9/16, 0, 1);
check(close(story.width / story.height, 9/16, 0.002), 'Story export keeps 9:16');

// Persistência do rascunho
const base = { version: 1, kind: 'media-editor', slides: [{ id: 'a', originalUrl: 'https://x.public.blob.vercel-storage.com/a.jpg', type: 'image', framing: { zoom: 2.5, offsetX: 1.2, offsetY: -0.7 }, rotation: 17 }] };
check(editorProjectSchema.safeParse({ ...base, aspectRatio: 'free', aspectValue: 1.25 }).success, 'Free crop with numeric aspect is persisted');
check(!editorProjectSchema.safeParse({ ...base, aspectRatio: 'original' }).success, 'Custom crop without numeric aspect is rejected');
check(editorProjectSchema.safeParse({ ...base, aspectRatio: '4:5' }).success, 'Preset crop still validates');
console.log(`${checks} image crop assertions passed`);
