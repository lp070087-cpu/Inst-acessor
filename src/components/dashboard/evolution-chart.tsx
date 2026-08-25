"use client";

/**
 * Estrutura mínima que o gráfico lê de cada ponto.
 * União dos campos numéricos opcionais presentes nos pontos
 * do Instagram e do TikTok. Nada é inventado: campos ausentes → null.
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

/** Métricas exibíveis no gráfico (chaves numéricas de ChartEvolutionPoint). */
export type ChartMetricKey = Exclude<
  keyof ChartEvolutionPoint,
  "label" | "capturedAt"
>;

interface EvolutionChartProps {
  points: ChartEvolutionPoint[];
  metric: ChartMetricKey;
}

/**
 * Gráfico de evolução em SVG nativo — sem dependências externas.
 * Segue a identidade visual (gradiente brand, linhas suaves, sem exageros).
 */
export function EvolutionChart({ points, metric }: EvolutionChartProps) {
  const values = points
    .map((p) => p[metric])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (values.length < 2) {
    return (
      <div className="h-56 rounded-[16px] bg-surface/40 border border-dashed border-[#D0D4DB] flex items-center justify-center">
        <p className="text-[13px] text-ink-soft">
          Ainda não há pontos suficientes para este gráfico.
        </p>
      </div>
    );
  }

  const W = 720;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  // 10% de respiro acima/abaixo
  const lower = min - span * 0.1;
  const upper = max + span * 0.1;
  const ySpan = upper - lower || 1;

  const x = (i: number) =>
    PAD.left + (i / (values.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + ((upper - v) / ySpan) * (H - PAD.top - PAD.bottom);

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(values.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`;

  // Pontos de destaque: máximo e mínimo
  const maxIdx = values.indexOf(max);
  const start = values[0];
  const end = values[values.length - 1];
  const delta = end - start;
  const deltaPct = start !== 0 ? (delta / Math.abs(start)) * 100 : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-data font-bold text-[22px] text-ink">
          {formatCompact(end)}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[12.5px] font-semibold px-2 py-0.5 rounded-pill ${
            delta >= 0
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
          {formatCompact(delta)}
          {deltaPct != null ? ` (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)` : ""}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto rounded-[16px]"
        role="img"
        aria-label="Gráfico de evolução"
      >
        <defs>
          <linearGradient id="evArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="evLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F43F8E" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>

        {/* Grid horizontal */}
        {[0, 1, 2, 3].map((t) => {
          const gy = PAD.top + (t / 3) * (H - PAD.top - PAD.bottom);
          const gv = upper - (t / 3) * ySpan;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={gy}
                y2={gy}
                stroke="#E5E7EB"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 8}
                y={gy + 3}
                textAnchor="end"
                fontSize="10.5"
                fill="#9CA3AF"
              >
                {formatCompact(gv)}
              </text>
            </g>
          );
        })}

        {/* Área + linha */}
        <path d={areaPath} fill="url(#evArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#evLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ponto de início */}
        <circle cx={x(0)} cy={y(start)} r="4" fill="#fff" stroke="#A855F7" strokeWidth="2" />
        {/* Ponto máximo */}
        <circle cx={x(maxIdx)} cy={y(max)} r="4.5" fill="#F43F8E" stroke="#fff" strokeWidth="2" />

        {/* Rótulos do eixo X (primeiro, meio, último) */}
        {[0, Math.floor((values.length - 1) / 2), values.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"}
            fontSize="10.5"
            fill="#9CA3AF"
          >
            {points[i]?.label ?? ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return String(n);
}
