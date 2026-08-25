import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rect" | "circle";
  lines?: number;
}

/** Skeleton suave — feedback de carregamento discreto (identidade clara). */
export function Skeleton({
  variant = "rect",
  lines = 1,
  className,
  style,
  ...props
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded bg-surface animate-pulse"
            style={{ width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-surface animate-pulse",
        variant === "circle" ? "rounded-full" : "rounded-md",
        className
      )}
      style={style}
      {...props}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

/** Card esqueleto — usado no dashboard enquanto carrega. */
export function SkeletonCard({ lines = 2, className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border-soft rounded-md shadow-xs p-5",
        className
      )}
    >
      <Skeleton className="w-1/3 h-4 mb-3" />
      <Skeleton className="w-2/3 h-8 mb-3" />
      <Skeleton lines={lines} variant="text" />
    </div>
  );
}
