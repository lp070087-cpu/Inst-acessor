import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
}

const sizes = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-[12px]",
  md: "w-11 h-11 text-[14px]",
  lg: "w-16 h-16 text-[20px]",
};

const gradients = [
  "bg-brand-grad",
  "bg-[linear-gradient(135deg,#A855F7,#6366F1)]",
  "bg-[linear-gradient(135deg,#F43F8E,#A855F7)]",
  "bg-[linear-gradient(135deg,#6366F1,#3B82F6)]",
];

/** Avatar com iniciais ou imagem. Sem imagem → gradiente + inicial. */
export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const initials = React.useMemo(() => {
    if (!name) return "IA";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
    return (first + last).toUpperCase();
  }, [name]);

  const gradient = React.useMemo(() => {
    if (!name) return gradients[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return gradients[h % gradients.length];
  }, [name]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Avatar"}
        className={cn("rounded-full object-cover flex-none border-2 border-card shadow-xs", sizes[size], className)}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full grid place-items-center text-white font-display font-bold flex-none border-2 border-card shadow-xs",
        gradient,
        sizes[size],
        className
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
