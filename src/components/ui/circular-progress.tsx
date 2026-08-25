import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  showValue?: boolean;
  gradientId?: string;
  className?: string;
}

/**
 * Anel de progresso SVG com o gradiente oficial (magenta→roxo→azul).
 * Referência visual: anel de Score da apresentação.
 */
export function CircularProgress({
  value,
  size = 168,
  strokeWidth = 12,
  label,
  sublabel,
  showValue = true,
  gradientId = "ringGrad",
  className,
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * clamped) / 100;

  return (
    <div
      className={cn("inline-flex flex-col items-center", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F43F8E" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#F1F3F5"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-data font-bold text-[clamp(36px,6vw,56px)] leading-none tracking-tight text-ink">
                {Math.round(clamped)}
                <span className="text-ink-muted text-[.55em] font-medium">/100</span>
              </div>
              {label && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mt-1">
                  {label}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {sublabel && <p className="text-[13px] text-ink-soft mt-3">{sublabel}</p>}
    </div>
  );
}
