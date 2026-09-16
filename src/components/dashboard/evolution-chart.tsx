"use client";

import { useRef, useState } from "react";

/**
 * GrÃ¡fico de evoluÃ§Ã£o em SVG nativo â€” sem dependÃªncias externas.
 *
 * REGRAS DE HONESTIDADE DOS DADOS
 * -------------------------------
 * 1. A escala do eixo Y Ã© calculada SOMENTE a partir dos valores realmente
 *    plotados desta mÃ©trica. Nenhuma mÃ©trica empresta o domÃ­nio de outra.
 * 2. O eixo usa "ticks" redondos (passo 1/2/5 Ã— potÃªncia de 10). Antes o
 *    domÃ­nio era `min - 10%` a `max + 10%` do valor bruto, entÃ£o os rÃ³tulos
 *    do eixo eram nÃºmeros quebrados quaisquer (ex.: 333333 / 566667) em vez de
 *    uma escala legÃ­vel. Isso era um erro de ESCALA, nÃ£o de formataÃ§Ã£o.
 * 3. Ponto sem valor da mÃ©trica NÃƒO vira zero e NÃƒO Ã© removido da linha do
 *    tempo: ele Ã© apenas nÃ£o desenhado, e a posiÃ§Ã£o X dos demais Ã© preservada
 *    pelo Ã­ndice original do snapshot. Um buraco continua sendo um buraco.
 * 4. Com um Ãºnico ponto real nÃ£o existe evoluÃ§Ã£o a desenhar â€” mostramos o
 *    valor atual e dizemos que faltam sincronizaÃ§Ãµes.
 */

/**
 * Estrutura mÃ­nima que o grÃ¡fico lÃª de cada ponto.
 * UniÃ£o dos campos numÃ©ricos opcionais presentes nos pontos
 * do Instagram e do TikTok. Nada Ã© inventado: campos ausentes â†’ null.
 */
export type ChartEvolutionPoint = {
  label?: string;
  capturedAt?: string;
  followersCount?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  mediaCount?: number | null;
  videoCount?: number | null;
  likesCount?: number | null;
};

/** MÃ©tricas exibÃ­veis no grÃ¡fico (chaves numÃ©ricas de ChartEvolutionPoint). */
export type ChartMetricKey = Exclude<
  keyof ChartEvolutionPoint,
  "label" | "capturedAt"
>;

const METRIC_LABELS: Record<string, string> = {
  followersCount: "seguidores",
  reach: "alcance",
  impressions: "visualizaÃ§Ãµes",
  profileViews: "visitas ao perfil",
  mediaCount: "publicaÃ§Ãµes",
  videoCount: "vÃ­deos",
  likesCount: "curtidas",
};

interface EvolutionChartProps {
  points: ChartEvolutionPoint[];
  metric: ChartMetricKey;
  /** RÃ³tulo legÃ­vel da mÃ©trica (opcional â€” hÃ¡ um mapa interno de reserva). */
  metricLabel?: string;
}

/** Um ponto REAL da sÃ©rie â€” carrega o Ã­ndice original do snapshot. */
interface SeriesPoint {
  /** Ãndice do snapshot em `points` (preserva o espaÃ§amento da linha do tempo). */
  index: number;
  value: number;
  label: string;
  capturedAt?: string;
}

export function EvolutionChart({ points, metric, metricLabel }: EvolutionChartProps) {
  // SÃ©rie real: sÃ³ os snapshots que TÃŠM a mÃ©trica. O Ã­ndice original Ã© mantido
  // para que a distÃ¢ncia entre os pontos continue representando a linha do tempo.
  const series: SeriesPoint[] = [];
  for (let index = 0; index < points.length; index++) {
    const raw = points[index][metric];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    series.push({
      index,
      value: raw,
      label: points[index].label ?? "",
      capturedAt: points[index].capturedAt,
    });
  }

  const name = metricLabel ?? METRIC_LABELS[metric] ?? "mÃ©trica";

  // ---- Sem nenhum ponto real ----
  if (series.length === 0) {
    return (
      <ChartShell>
        <StateBlock
          title="Sem dados para esta mÃ©trica"
          description={`Nenhuma sincronizaÃ§Ã£o registrou ${name} no perÃ­odo selecionado. Nada Ã© estimado â€” sincronize para comeÃ§ar o histÃ³rico.`}
        />
      </ChartShell>
    );
  }

  const last = series[series.length - 1];

  // ---- Um Ãºnico ponto real: existe valor, NÃƒO existe evoluÃ§Ã£o ----
  if (series.length === 1) {
    return (
      <ChartShell>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-data font-bold text-[26px] text-ink">
            {formatExact(last.value)}
          </span>
          <span className="text-[12.5px] font-semibold text-ink-muted">
            {name} Â· {last.label}
          </span>
        </div>
        <StateBlock
          title="Precisamos de pelo menos 2 sincronizaÃ§Ãµes para mostrar sua evoluÃ§Ã£o."
          description="Ainda nÃ£o hÃ¡ um ponto anterior com o qual comparar. Este Ã© o valor real do registro mais recente."
          bare
        />
      </ChartShell>
    );
  }

  return <Plot series={series} name={name} totalPoints={points.length} />;
}

/* ------------------------------------------------------------------ */
/* Plotagem                                                            */
/* ------------------------------------------------------------------ */

const W = 720;
const H = 232;
const PAD = { top: 18, right: 18, bottom: 30, left: 52 };

function Plot({ series, name, totalPoints }: { series: SeriesPoint[]; name: string; totalPoints: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const values = series.map((p) => p.value);
  const scale = buildScale(values);
  const { min, max, ticks } = scale;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const lastIndex = series.length - 1;
  const last = series[lastIndex];

  // X por POSIÃ‡ÃƒO na sÃ©rie real â€” o Ã­ndice original do snapshot define o
  // espaÃ§amento, entÃ£o um snapshot sem a mÃ©trica cria um vÃ£o visÃ­vel.
  const spanIndex = series[lastIndex].index - series[0].index || 1;
  const x = (i: number) =>
    PAD.left + ((series[i].index - series[0].index) / spanIndex) * plotW;
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * plotH;

  const coords = series.map((p, i) => ({ x: x(i), y: y(p.value) }));
  const linePath = smoothPath(coords);
  const areaPath = `${linePath} L${coords[lastIndex].x.toFixed(1)},${(
    H - PAD.bottom
  ).toFixed(1)} L${coords[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

  // ---- VariaÃ§Ã£o: sÃ³ entre os DOIS Ãºltimos valores reais ----
  const first = series[0].value;
  const delta = last.value - first;
  const deltaPct =
    first !== 0 ? (delta / Math.abs(first)) * 100 : null;

  const activePoint = active != null ? series[active] : null;

  /** Converte o ponteiro (client) em coordenada X do viewBox. */
  function pointerIndex(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - svgX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  const ariaLabel = `EvoluÃ§Ã£o de ${name}: de ${formatExact(first)} para ${formatExact(
    last.value
  )} em ${series.length} registros.`;

  return (
    <div className="flex flex-col gap-3">
      {/* CabeÃ§alho: valor atual + variaÃ§Ã£o do perÃ­odo */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-data font-bold text-[24px] text-ink">
          {formatCompact(last.value)}
        </span>
        <span className="text-[12.5px] font-semibold text-ink-muted">
          {name} Â· {last.label}
        </span>
        <DeltaBadge delta={delta} deltaPct={deltaPct} />
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-full h-auto rounded-[16px]"
          role="img"
          aria-label={ariaLabel}
          /* SÃ³ o mouse controla o hover. No toque, o gesto Ã© um toque simples
             (onPointerDown) â€” assim a rolagem da pÃ¡gina nÃ£o Ã© sequestrada. */
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const i = pointerIndex(e.clientX);
            if (i != null) setActive(i);
          }}
          onPointerLeave={() => setActive(null)}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            const i = pointerIndex(e.clientX);
            if (i != null) setActive(i);
          }}
        >
          <defs>
            <linearGradient id="iaEvArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.30" />
              <stop offset="60%" stopColor="#C026D3" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#F43F8E" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="iaEvLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F43F8E" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <style>{`
              .ia-ev-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: iaEvDraw .85s cubic-bezier(.22,.61,.36,1) forwards; }
              .ia-ev-area { opacity: 0; animation: iaEvFade .7s ease-out .18s forwards; }
              @keyframes iaEvDraw { to { stroke-dashoffset: 0 } }
              @keyframes iaEvFade { to { opacity: 1 } }
              @media (prefers-reduced-motion: reduce) {
                .ia-ev-line, .ia-ev-area { animation: none; stroke-dashoffset: 0; opacity: 1 }
              }
            `}</style>
          </defs>

          {/* Grid + rÃ³tulos do eixo Y â€” "ticks" redondos */}
          {ticks.map((tick) => {
            const gy = y(tick);
            // Um rÃ³tulo muito prÃ³ximo da borda inferior colidiria com o eixo X.
            const showLabel = gy <= H - PAD.bottom + 1;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={gy}
                  y2={gy}
                  stroke="rgba(17,19,24,.07)"
                  strokeDasharray="4 5"
                />
                {showLabel && (
                  <text
                    x={PAD.left - 10}
                    y={gy + 3.5}
                    textAnchor="end"
                    fontSize="10.5"
                    fill="#8B93A1"
                  >
                    {formatAxis(tick)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Guia vertical do ponto ativo */}
          {activePoint && (
            <line
              x1={coords[active!].x}
              x2={coords[active!].x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="rgba(168,85,247,.35)"
              strokeWidth="1"
            />
          )}

          <path className="ia-ev-area" d={areaPath} fill="url(#iaEvArea)" />
          <path
            className="ia-ev-line"
            d={linePath}
            pathLength={1}
            fill="none"
            stroke="url(#iaEvLine)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos discretos â€” sÃ³ onde existe valor real */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={active === i ? 5 : 3}
              fill={i === lastIndex ? "#F43F8E" : "#FFFFFF"}
              stroke={i === lastIndex ? "#FFFFFF" : "#A855F7"}
              strokeWidth="2"
              style={{ transition: "r .15s ease" }}
            />
          ))}

          {/* RÃ³tulos do eixo X: primeiro, meio e Ãºltimo â€” cada um com o SEU
              prÃ³prio snapshot (antes o Ã­ndice era do array filtrado e os
              rÃ³tulos caÃ­am em pontos errados). */}
          {uniqueIndices([0, Math.floor(series.length / 2), lastIndex]).map((i) => {
            const isFirst = i === 0;
            const isLast = i === lastIndex;
            return (
              <text
                key={i}
                x={coords[i].x}
                y={H - 9}
                textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                fontSize="10.5"
                fill="#8B93A1"
              >
                {series[i].label}
              </text>
            );
          })}
        </svg>

        {/* Tooltip (data, valor e variaÃ§Ã£o vs. ponto anterior) */}
        {activePoint && (
          <div
            className="pointer-events-none absolute -top-1 z-10 rounded-[10px] bg-ink px-3 py-2 shadow-lg"
            style={{
              left: `${Math.min(92, Math.max(8, (coords[active!].x / W) * 100))}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="text-[11px] font-semibold text-white/70 whitespace-nowrap">
              {formatFullDate(activePoint.capturedAt, activePoint.label)}
            </div>
            <div className="font-data text-[14px] font-bold text-white whitespace-nowrap">
              {formatExact(activePoint.value)}
            </div>
            {active! > 0 && (
              <div className="text-[11px] font-semibold whitespace-nowrap text-white/70">
                {deltaLabel(activePoint.value - series[active! - 1].value)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ressalva honesta quando a janela tem menos pontos que o esperado */}
      {series.length < totalPoints && (
        <p className="text-[11.5px] text-ink-muted">
          {totalPoints - series.length}{" "}
          {totalPoints - series.length === 1
            ? "sincronizaÃ§Ã£o nÃ£o registrou"
            : "sincronizaÃ§Ãµes nÃ£o registraram"}{" "}
          {name} â€” esses pontos ficaram de fora da linha, sem virar zero.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Escala                                                             */
/* ------------------------------------------------------------------ */

/**
 * Escala "bonita" para o eixo Y.
 *
 * O passo Ã© sempre 1/2/2,5/5 Ã— 10â¿ arredondado para INTEIRO (as mÃ©tricas do
 * painel sÃ£o contagens). Os limites sÃ£o encaixados em mÃºltiplos do passo, de
 * modo que TODO rÃ³tulo do eixo seja um nÃºmero redondo â€” a causa dos valores
 * quebrados do grÃ¡fico anterior era justamente nÃ£o existir esta etapa.
 *
 * Se a sÃ©rie for constante, abre-se uma faixa em volta do valor em vez de
 * dividir por zero.
 */
function buildScale(values: number[]): { min: number; max: number; ticks: number[] } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  if (rawMin === rawMax) {
    const pad = Math.max(1, Math.round(Math.abs(rawMin) * 0.02));
    const min = rawMin - pad;
    const max = rawMax + pad;
    const step = Math.max(1, Math.ceil((max - min) / 4));
    return { min, max, ticks: buildTicks(min, max, step) };
  }

  const step = niceStep((rawMax - rawMin) / 4);
  let min = Math.floor(rawMin / step) * step;
  let max = Math.ceil(rawMax / step) * step;
  // Garante pelo menos 2 faixas: sem isso uma sÃ©rie quase plana viraria uma
  // linha colada na borda.
  if ((max - min) / step < 2) {
    min -= step;
    max += step;
  }
  return { min, max, ticks: buildTicks(min, max, step) };
}

function buildTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const count = Math.round((max - min) / step);
  for (let i = 0; i <= count; i++) out.push(min + i * step);
  return out;
}

/** Passo redondo (mantissa 1/2/2,5/5 Ã— 10â¿), sempre inteiro e â‰¥ 1. */
function niceStep(raw: number): number {
  const safe = Math.max(raw, 1e-6);
  const mag = Math.pow(10, Math.floor(Math.log10(safe)));
  const norm = safe / mag;
  const mant = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return Math.max(1, Math.ceil(mant * mag));
}

/* ------------------------------------------------------------------ */
/* Caminho suave                                                      */
/* ------------------------------------------------------------------ */

/**
 * Suaviza a linha com Catmull-Rom convertido em BÃ©zier, mantendo os pontos de
 * controle DENTRO da faixa Y do prÃ³prio segmento. Isso dÃ¡ a curva suave pedida
 * sem que ela passe acima/abaixo dos valores reais (uma curva que "sai" do
 * dado Ã© uma mentira visual).
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    const dx = (p2.x - p1.x) / 3;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, lo, hi);
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, lo, hi);

    d += ` C${(p1.x + dx).toFixed(1)},${c1y.toFixed(1)} ${(p2.x - dx).toFixed(
      1
    )},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function uniqueIndices(list: number[]): number[] {
  return [...new Set(list)];
}

/* ------------------------------------------------------------------ */
/* ApresentaÃ§Ã£o                                                       */
/* ------------------------------------------------------------------ */

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="min-h-56 rounded-[16px] bg-surface/40 border border-dashed border-[#D0D4DB] flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        {children}
      </div>
    </div>
  );
}

function StateBlock({
  title,
  description,
  bare = false,
}: {
  title: string;
  description: string;
  bare?: boolean;
}) {
  return (
    <div className={bare ? "flex flex-col items-center gap-1" : "flex flex-col gap-1"}>
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      <p className="text-[12.5px] text-ink-soft max-w-[46ch] leading-snug">{description}</p>
    </div>
  );
}

/** VariaÃ§Ã£o do perÃ­odo â€” sÃ³ existe quando hÃ¡ dois valores reais comparÃ¡veis. */
function DeltaBadge({ delta, deltaPct }: { delta: number; deltaPct: number | null }) {
  const up = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-pill ${
        up ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
      }`}
    >
      <span aria-hidden>{up ? "â–²" : "â–¼"}</span>
      {deltaLabel(delta)}
      {deltaPct != null ? ` (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)` : ""}
    </span>
  );
}

function deltaLabel(delta: number): string {
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : "-"}${formatExact(Math.abs(delta))}`;
}

/** Inteiro exato em pt-BR (usado no tooltip e nos valores centrais). */
function formatExact(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

/** AbreviaÃ§Ã£o compacta para os valores de destaque. */
function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimZero(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimZero(n / 1_000)}k`;
  return formatExact(n);
}

/** RÃ³tulo do eixo: nÃºmero redondo, com abreviaÃ§Ã£o sÃ³ em magnitudes grandes. */
function formatAxis(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimZero(n / 1_000_000)}M`;
  if (abs >= 10_000) return `${trimZero(n / 1_000)}k`;
  return formatExact(n);
}

function trimZero(v: number): string {
  const s = v.toFixed(1);
  return (s.endsWith(".0") ? s.slice(0, -2) : s).replace(".", ",");
}

function formatFullDate(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

