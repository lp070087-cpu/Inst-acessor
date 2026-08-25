import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "outline" | "danger" | "success";
type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  // Gradiente oficial rosa/roxo da apresentação
  primary:
    "bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white shadow-brand hover:shadow-brand-lg hover:-translate-y-0.5 hover:bg-[position:100%_100%]",
  ghost:
    "bg-card text-ink border border-border shadow-xs hover:-translate-y-0.5 hover:border-[#D6D9E0] hover:shadow-sm",
  outline:
    "bg-transparent text-ink border border-border hover:border-purple/40 hover:text-purple",
  danger:
    "bg-danger text-white shadow-[0_8px_30px_rgba(239,68,68,.25)] hover:-translate-y-0.5",
  success:
    "bg-success text-white shadow-[0_8px_30px_rgba(16,185,129,.25)] hover:-translate-y-0.5",
};

const sizes: Record<ButtonSize, string> = {
  xs: "text-[12.5px] px-3 py-1.5 rounded-[10px]",
  sm: "text-[14px] px-4 py-2.5 rounded-pill",
  md: "text-[15px] px-6 py-3 rounded-pill",
  lg: "text-[16.5px] px-8 py-4 rounded-pill",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  block,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...props}
    />
  );
}
