"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

interface SidebarNavItemProps {
  item: NavItem;
  active?: boolean;
  collapsed?: boolean;
  isSignOut?: boolean;
}

export function SidebarNavItem({
  item,
  active,
  collapsed,
  isSignOut,
}: SidebarNavItemProps) {
  const Icon = item.icon;

  const content = (
    <>
      <Icon
        size={19}
        strokeWidth={2}
        className={cn(
          "flex-none transition-colors",
          active ? "text-purple" : isSignOut ? "text-danger" : "text-ink-soft"
        )}
      />
      {!collapsed && (
        <span
          className={cn(
            "text-[13.5px] font-medium transition-colors truncate",
            active ? "text-ink font-semibold" : isSignOut ? "text-danger" : "text-ink-soft"
          )}
        >
          {item.label}
        </span>
      )}
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-all duration-200 cursor-pointer",
    active
      ? "bg-ai-soft"
      : isSignOut
        ? "text-danger hover:bg-danger-softMid"
        : "hover:bg-surface",
    collapsed && "justify-center px-0"
  );

  if (isSignOut) {
    return (
      <Link href="/api/auth/signout" className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}
