/**
 * CONFETE LEVE (canvas, sem biblioteca)
 * =====================================
 * Usado só no estado de sucesso da lista de espera, depois que o servidor
 * confirma o cadastro. Um canvas fixo cobre a viewport com
 * `pointer-events: none`, roda ~1,5 s e se remove sozinho.
 *
 * - Até 80 partículas no desktop e 36 em telas ≤ 640px.
 * - Não roda nada quando a pessoa prefere movimento reduzido.
 * - Cores da identidade: magenta, roxo e azul do gradiente da marca.
 */

const COLORS = ["#be185d", "#7e22ce", "#4338ca", "#4f46e5"];
const DURATION_MS = 1500;
const FADE_MS = 450;

type Particle = { x: number; y: number; vx: number; vy: number; w: number; h: number; angle: number; spin: number; color: string; round: boolean };

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Dispara uma explosão de confete a partir de `origin` (coordenadas da
 * viewport). Retorna uma função que interrompe e remove o canvas.
 */
export function launchConfetti(origin?: { x: number; y: number }): () => void {
  if (typeof window === "undefined" || prefersReducedMotion()) return () => {};
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return () => {};

  const width = window.innerWidth, height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.wlConfetti = "true";
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: `${width}px`, height: `${height}px`,
    pointerEvents: "none", zIndex: "1001", display: "block", maxWidth: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  context.scale(ratio, ratio);
  document.body.appendChild(canvas);

  const small = window.matchMedia("(max-width: 640px)").matches;
  const count = small ? 36 : 80;
  const ox = origin?.x ?? width / 2, oy = origin?.y ?? height * 0.35;
  const speed = small ? 7 : 9.5;
  const particles: Particle[] = Array.from({ length: count }, () => {
    // Leque voltado para cima (de ~200° a ~340°), com variação de força.
    const theta = (Math.PI * (1.1 + Math.random() * 0.8));
    const force = speed * (0.45 + Math.random() * 0.75);
    return {
      x: ox, y: oy, vx: Math.cos(theta) * force, vy: Math.sin(theta) * force,
      w: 5 + Math.random() * 5, h: 7 + Math.random() * 6, angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35, color: COLORS[Math.floor(Math.random() * COLORS.length)], round: Math.random() < 0.3,
    };
  });

  let frame = 0, stopped = false;
  const start = performance.now();
  let last = start;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    canvas.remove();
  };
  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = now - start;
    if (elapsed >= DURATION_MS) { stop(); return; }
    const step = Math.min((now - last) / 16.67, 3);
    last = now;
    context.clearRect(0, 0, width, height);
    context.globalAlpha = elapsed > DURATION_MS - FADE_MS ? Math.max(0, (DURATION_MS - elapsed) / FADE_MS) : 1;
    for (const p of particles) {
      p.vy += 0.28 * step;
      p.vx *= 0.985 ** step;
      p.vy *= 0.985 ** step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.angle += p.spin * step;
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.fillStyle = p.color;
      if (p.round) { context.beginPath(); context.arc(0, 0, p.w / 2, 0, Math.PI * 2); context.fill(); }
      else context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.6);
      context.restore();
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}
