"use client";

import * as React from "react";
import { AnimatePresence, m } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { contentMotion, overlayMotion, useIsDesktop } from "./segmented";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof sizes;
  hideClose?: boolean;
  className?: string;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="size-4" />
    </button>
  );
}

const TITLE_CLASS =
  "text-[20px] font-semibold leading-tight tracking-[-0.015em] text-foreground";

/**
 * Dialog on a pointer device, draggable bottom sheet on a phone. One API, so a
 * screen never branches on viewport.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
  className,
}: ModalProps) {
  const isDesktop = useIsDesktop(768);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  if (!isDesktop) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/45" />
          <Drawer.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-border bg-card focus:outline-none",
            )}
          >
            <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
              <div className="min-w-0">
                <Drawer.Title className={title ? TITLE_CLASS : "sr-only"}>
                  {title ?? "Dialog"}
                </Drawer.Title>
                {description && (
                  <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </Drawer.Description>
                )}
              </div>
              {!hideClose && <CloseButton onClose={close} />}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-3">{children}</div>
            {footer && (
              <div className="border-t border-border px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
                {footer}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <m.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
                {...overlayMotion}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content forceMount asChild>
              <m.div
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex max-h-[86dvh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
                  "rounded-2xl border border-border bg-card shadow-[var(--shadow-sheet)]",
                  "focus:outline-none",
                  sizes[size],
                  className,
                )}
                {...contentMotion}
              >
                <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-6">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className={title ? TITLE_CLASS : "sr-only"}>
                      {title ?? "Dialog"}
                    </DialogPrimitive.Title>
                    {description && (
                      <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                  {!hideClose && <CloseButton onClose={close} />}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">{children}</div>
                {footer && (
                  <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
                    {footer}
                  </div>
                )}
              </m.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
