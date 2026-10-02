"use client";

import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export function DropdownMenu({
  trigger,
  children,
  align = "end",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align}
          sideOffset={8}
          className={cn(
            "z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-sheet)]",
          )}
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function MenuItem({
  children,
  onSelect,
  destructive,
  icon,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none",
        "data-[highlighted]:bg-muted",
        destructive ? "text-danger" : "text-foreground",
      )}
    >
      {icon && <span className="text-muted-foreground">{icon}</span>}
      {children}
    </Menu.Item>
  );
}

export function MenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}
