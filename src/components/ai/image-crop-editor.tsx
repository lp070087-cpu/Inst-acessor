"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Plus, RotateCcw, RotateCw, Undo2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import {
  CROP_MAX_ZOOM,
  CROP_MIN_ZOOM,
  aspectRange,
  clampAspect,
  clampFraming,
  drawCrop,
  exportSize,
  imageGeometry,
  ratioAllowed,
  resolveAspect,
  type CropFormat,
  type CropFraming,
  type CropRatio,
} from "@/lib/media-editor/image-crop";

/**
 * EDITOR DE IMAGEM NA MOLDURA DO CELULAR
 *
 * Trabalha numa cópia local do enquadramento: nada muda no conteúdo até
 * "Aplicar"; "Cancelar" (ou Esc) descarta. Arrastar reposiciona, pinça e roda
 * do mouse ampliam, e a prévia do arquivo final é desenhada pela MESMA função
 * da exportação — o arquivo publicado corresponde ao que se vê aqui.
 */
export interface CropValue {
  ratio: CropRatio;
  aspect: number;
  framing: CropFraming;
  rotation: number;
}

interface Props {
  open: boolean;
  imageUrl: string;
  format: CropFormat;
  value: CropValue;
  brightness?: number;
  contrast?: number;
  onApply: (value: CropValue) => void;
  onClose: () => void;
}

const RATIOS: { id: CropRatio; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "free", label: "Livre" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "9:16", label: "9:16" },
];

const NEUTRAL: CropFraming = { zoom: 1, offsetX: 0, offsetY: 0 };

export function ImageCropEditor({ open, imageUrl, format, value, brightness = 1, contrast = 1, onApply, onClose }: Props) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const resultRef = React.useRef<HTMLCanvasElement>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const titleId = React.useId();
  const [natural, setNatural] = React.useState<{ width: number; height: number } | null>(null);
  const [draft, setDraft] = React.useState<CropValue>(value);
  const [interacting, setInteracting] = React.useState(false);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  useDialogFocus(open, dialogRef, onClose);

  // Cada abertura parte do valor salvo, já no primeiro render (sem piscar o
  // estado cancelado); re-renders do pai com o editor aberto não apagam a edição.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => { if (alive) { imageRef.current = image; setNatural({ width: image.naturalWidth, height: image.naturalHeight }); } };
    image.src = imageUrl;
    document.body.style.overflow = "hidden";
    return () => { alive = false; document.body.style.overflow = ""; };
  }, [open, imageUrl]);

  /** Recalcula proporção e limites sempre que algo muda, mantendo a imagem cobrindo o quadro. */
  const normalize = React.useCallback((next: CropValue): CropValue => {
    const aspect = resolveAspect(format, next.ratio, natural, next.rotation, next.aspect);
    const framing = natural ? clampFraming(natural.width, natural.height, aspect, next.rotation, next.framing) : next.framing;
    return { ...next, aspect, framing };
  }, [format, natural]);

  React.useEffect(() => { if (natural) setDraft((d) => normalize(d)); }, [natural, normalize]);

  const update = React.useCallback((patch: Partial<CropValue> | ((d: CropValue) => Partial<CropValue>)) => {
    setDraft((d) => normalize({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, [normalize]);

  // Prévia do ARQUIVO FINAL, com a mesma função da exportação.
  React.useEffect(() => {
    const canvas = resultRef.current, image = imageRef.current;
    if (!open || !canvas || !image || !natural) return;
    const raf = requestAnimationFrame(() => {
      canvas.width = 216;
      canvas.height = Math.round(216 / draft.aspect);
      drawCrop(canvas, image, draft.aspect, { framing: draft.framing, rotation: draft.rotation, brightness, contrast });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, natural, draft, brightness, contrast]);

  // ---------- Gestos: 1 ponteiro arrasta, 2 ponteiros fazem pinça ----------
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const gesture = React.useRef<{ start: CropValue; rect: DOMRect; mid: { x: number; y: number }; dist: number } | null>(null);

  function snapshot() {
    const rect = stageRef.current!.getBoundingClientRect();
    const pts = [...pointers.current.values()];
    const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { rect, mid, dist };
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ponteiro sem captura: o gesto segue pelo próprio elemento */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { start: draftRef.current, ...snapshot() };
    setInteracting(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current, now = snapshot();
    const zoom = g.dist && now.dist ? g.start.framing.zoom * (now.dist / g.dist) : g.start.framing.zoom;
    update({ framing: {
      zoom: Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, zoom)),
      offsetX: g.start.framing.offsetX + (now.mid.x - g.mid.x) / g.rect.width,
      offsetY: g.start.framing.offsetY + (now.mid.y - g.mid.y) / g.rect.height,
    } });
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    // Ao tirar um dedo da pinça, o gesto recomeça do estado atual sem saltos.
    gesture.current = pointers.current.size ? { start: draftRef.current, ...snapshot() } : null;
    if (!pointers.current.size) setInteracting(false);
  }
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      update((d) => ({ framing: { ...d.framing, zoom: Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, d.framing.zoom * Math.exp(-e.deltaY * 0.0015))) } }));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [open, update, natural]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); const [dx, dy] = moves[e.key]; update((d) => ({ framing: { ...d.framing, offsetX: d.framing.offsetX + dx, offsetY: d.framing.offsetY + dy } })); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.1); }
    if (e.key === "-") { e.preventDefault(); zoomBy(1 / 1.1); }
  }
  function zoomBy(factor: number) {
    update((d) => ({ framing: { ...d.framing, zoom: Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, d.framing.zoom * factor)) } }));
  }

  // ---------- Modo livre: alça no canto ajusta a proporção do quadro ----------
  function onHandleDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const stage = stageRef.current!.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, w: stage.width, h: stage.height };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* idem */ }
    const move = (ev: PointerEvent) => {
      const w = Math.max(40, start.w + (ev.clientX - start.x)), h = Math.max(40, start.h + (ev.clientY - start.y));
      update({ ratio: "free", aspect: clampAspect(format, w / h) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (!open) return null;

  const quarter = Math.round(draft.rotation / 90) * 90;
  const fine = Math.round((draft.rotation - quarter) * 10) / 10;
  const rotate = (deg: number) => update((d) => ({ rotation: ((((d.rotation + deg) % 360) + 540) % 360) - 180 }));
  const out = natural ? exportSize(natural.width, natural.height, draft.aspect, draft.rotation, draft.framing.zoom) : null;
  const geometry = natural ? imageGeometry(natural.width, natural.height, 1, 1 / draft.aspect, draft.rotation, draft.framing.zoom) : null;
  const [minAspect, maxAspect] = aspectRange(format);
  const lowRes = out && natural && out.width > natural.width && out.width === 320;

  // Portal: ancestrais com transform/sticky quebrariam o `position: fixed`.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6 animate-[fade-slide_.25s_ease-out_both]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[100dvh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[28px] bg-card shadow-lg sm:rounded-[28px]"
      >
        <header className="flex items-center gap-3 border-b border-border-soft px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[18px] font-bold text-ink">Editar imagem</h2>
            <p className="text-[12.5px] text-ink-muted">Arraste para reposicionar · pinça ou roda do mouse para zoom</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cancelar edição" className="ml-auto grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface">
            <X size={20} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_280px]">
          {/* ---------- MOLDURA DO CELULAR ---------- */}
          <div className="flex min-w-0 flex-col items-center gap-3">
            <div role="radiogroup" aria-label="Proporção do recorte" className="flex max-w-full flex-wrap justify-center gap-1.5">
              {RATIOS.map((r) => {
                const enabled = r.id === "original" || r.id === "free" ? minAspect !== maxAspect : ratioAllowed(format, r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.ratio === r.id}
                    disabled={!enabled}
                    title={!enabled ? (format === "story" || format === "reel" ? "Story e Reel usam 9:16" : "O feed aceita de 4:5 a 1,91:1") : undefined}
                    onClick={() => update({ ratio: r.id })}
                    className={cn(
                      "min-h-[36px] rounded-full border px-3.5 text-[13px] font-semibold transition-all",
                      draft.ratio === r.id ? "border-purple/40 bg-ai-soft text-purple" : "border-border bg-card text-ink-soft hover:text-ink",
                      "disabled:cursor-not-allowed disabled:opacity-40"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <div className="w-full max-w-[340px] rounded-[42px] border-[10px] border-ink bg-ink p-0 shadow-brand-lg">
              <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[30px] bg-[#0f1115] px-3 py-10 sm:min-h-[520px]">
                <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" aria-hidden="true" />
                <div
                  ref={stageRef}
                  role="application"
                  tabIndex={0}
                  aria-label="Área de recorte. Use as setas para mover e + ou - para zoom."
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onKeyDown}
                  className="relative cursor-grab touch-none overflow-hidden rounded-[6px] bg-surface outline-none ring-purple/60 transition-[aspect-ratio] duration-300 ease-out focus-visible:ring-4 active:cursor-grabbing"
                  style={{ aspectRatio: String(draft.aspect), width: `min(100%, calc(min(62vh, 470px) * ${draft.aspect}))` }}
                  data-testid="crop-stage"
                >
                  {natural && geometry ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="Imagem em edição"
                      draggable={false}
                      className="pointer-events-none absolute max-w-none select-none"
                      style={{
                        width: `${geometry.width * 100}%`,
                        height: `${geometry.height * draft.aspect * 100}%`,
                        left: `${50 + draft.framing.offsetX * 100}%`,
                        top: `${50 + draft.framing.offsetY * 100}%`,
                        transform: `translate(-50%,-50%) rotate(${draft.rotation}deg)`,
                        filter: `brightness(${brightness}) contrast(${contrast})`,
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-[13px] text-ink-muted">Carregando imagem…</div>
                  )}
                  {/* Grade dos terços: aparece durante o gesto para ajudar a compor. */}
                  <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 transition-opacity duration-200", interacting ? "opacity-100" : "opacity-0")}>
                    {[1, 2].map((i) => <span key={`v${i}`} className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${(i * 100) / 3}%` }} />)}
                    {[1, 2].map((i) => <span key={`h${i}`} className="absolute inset-x-0 h-px bg-white/70" style={{ top: `${(i * 100) / 3}%` }} />)}
                  </div>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[6px] ring-1 ring-inset ring-white/60" />
                  {draft.ratio === "free" && (
                    <button
                      type="button"
                      aria-label="Redimensionar recorte livre"
                      onPointerDown={onHandleDown}
                      className="absolute bottom-1 right-1 z-10 h-7 w-7 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-purple shadow"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ---------- CONTROLES ---------- */}
          <div className="flex min-w-0 flex-col gap-5">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-[13px] font-semibold text-ink">Zoom</legend>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => zoomBy(1 / 1.15)} aria-label="Diminuir zoom" className="grid h-10 w-10 flex-none place-items-center rounded-full border border-border hover:bg-surface"><Minus size={16} /></button>
                <input type="range" aria-label="Zoom" min={CROP_MIN_ZOOM} max={CROP_MAX_ZOOM} step={0.01} value={draft.framing.zoom} onChange={(e) => update((d) => ({ framing: { ...d.framing, zoom: Number(e.target.value) } }))} className="min-w-0 flex-1 accent-purple" />
                <button type="button" onClick={() => zoomBy(1.15)} aria-label="Aumentar zoom" className="grid h-10 w-10 flex-none place-items-center rounded-full border border-border hover:bg-surface"><Plus size={16} /></button>
              </div>
              <p className="text-right text-[12px] tabular-nums text-ink-muted">{draft.framing.zoom.toFixed(2)}×</p>
            </fieldset>

            <fieldset className="min-w-0 space-y-2">
              <legend className="text-[13px] font-semibold text-ink">Rotação</legend>
              <div className="flex gap-2">
                <button type="button" aria-label="Girar 90° à esquerda" onClick={() => rotate(-90)} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full border border-border text-[13px] font-semibold hover:bg-surface"><RotateCcw size={16} /> 90°</button>
                <button type="button" aria-label="Girar 90° à direita" onClick={() => rotate(90)} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full border border-border text-[13px] font-semibold hover:bg-surface"><RotateCw size={16} /> 90°</button>
              </div>
              <label className="block text-[12.5px] text-ink-soft">
                Endireitar ({fine.toFixed(1)}°)
                <input type="range" aria-label="Endireitar" min={-45} max={45} step={0.5} value={fine} onChange={(e) => update({ rotation: quarter + Number(e.target.value) })} className="mt-1 w-full accent-purple" />
              </label>
            </fieldset>

            <div className="rounded-2xl border border-border-soft bg-surface/60 p-3">
              <p className="mb-2 text-[12.5px] font-semibold text-ink">Arquivo final</p>
              <div className="flex items-start gap-3">
                <canvas ref={resultRef} aria-label="Prévia do arquivo exportado" data-testid="crop-result" className="w-[96px] flex-none rounded-md border border-border bg-white" />
                <p className="text-[12px] leading-5 text-ink-muted">
                  {out ? <>JPEG <b className="text-ink">{out.width} × {out.height}px</b>, gerado a partir do original, sem deformação.</> : "Calculando…"}
                  {lowRes && <span className="mt-1 block text-warn">Imagem pequena: ampliada até o mínimo de 320 px exigido pela plataforma.</span>}
                </p>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => update({ framing: { ...NEUTRAL }, rotation: 0, ratio: format === "story" || format === "reel" ? "9:16" : "4:5" })} className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-ink-soft hover:bg-surface"><Undo2 size={16} /> Redefinir</button>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={onClose} className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-semibold text-ink hover:bg-surface">Cancelar</button>
                <button type="button" disabled={!natural} onClick={() => { onApply(normalize(draft)); onClose(); }} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-grad px-5 text-[14px] font-semibold text-white shadow-brand transition-transform hover:-translate-y-0.5 disabled:opacity-60"><Check size={16} /> Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}
