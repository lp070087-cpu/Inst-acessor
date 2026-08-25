import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressBarSize = "xs" | "sm" | "md";
type ProgressBarGradient = "brand" | "green" | "blue" | "magenta";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0..100
  size?: ProgressBarSize;
  gradient?: ProgressBarGradient;
}

const sizes: Record<ProgressBarSize, string> = {
  xs: "h-[5px]",
  sm: "h-[6px]",
  md: "h-[10px]",
};

const gradients: Record<ProgressBarGradient, string> = {
  brand: "bg-brand-grad",
  green: "bg-[linear-gradient(90deg,#10B981,#059669)]",
  blue: "bg-[linear-gradient(90deg,#6366F1,#3B82F6)]",
  magenta: "bg-[linear-gradient(90deg,#F43F8E,#A855F7)]",
};

export function ProgressBar({
  value,
  size = "md",
  gradient = "brand",
  className,
  ...props
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full rounded-pill bg-surface overflow-hidden",
        sizes[size],
        className
      )}
      {...props}
    >
      <div
        className={cn("h-full rounded-pill", gradients[gradient])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
