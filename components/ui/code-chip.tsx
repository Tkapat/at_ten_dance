"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { spring, tween } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { cn } from "@/lib/utils";

/**
 * The institute code, and one tap to copy it.
 *
 * This chip is on every screen, so it earns its space: an admin shows it to a
 * hundred students, and a student checks it against the poster on the wall. That
 * is why it is the tap target rather than a separate "copy" button — a code that
 * is hard to copy gets copied by photographing it instead.
 *
 * The confirmation is an icon that becomes a check and reverts after 1.2 s. A
 * toast for this would be a piece of UI on top of a piece of UI, and it would
 * cover the roster on a phone.
 */

const REVERT_MS = 1200;

export function CodeChip({
  code,
  className,
  size = "md",
}: {
  code: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { reduced } = useMotionPref();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // A browser without the async clipboard, which is most of them over plain
        // http on a phone. The old trick still works, and failing to copy is worse
        // than copying through a hidden textarea.
        const field = document.createElement("textarea");
        field.value = code;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), REVERT_MS);
  }

  return (
    <m.button
      type="button"
      onClick={copy}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      aria-label={`Copy institute code ${code.split("").join(" ")}`}
      // The check is announced, not just drawn: colour alone is not a status.
      aria-live="polite"
      className={cn(
        "group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/60",
        "font-mono uppercase tracking-[0.14em] text-muted-foreground",
        "transition-colors hover:border-primary/30 hover:text-foreground",
        size === "sm" ? "h-6 px-1.5 text-[10px]" : "h-7 px-2 text-[11px]",
        className,
      )}
    >
      <span className="tabular-nums">{code}</span>
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <m.span
              key="done"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={reduced ? tween.instant : spring.pop}
              className="text-success"
            >
              <Check className="size-3.5" strokeWidth={2.6} />
            </m.span>
          ) : (
            <m.span
              key="copy"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={reduced ? tween.instant : tween.tick}
              className="opacity-70 group-hover:opacity-100"
            >
              <Copy className="size-3.5" />
            </m.span>
          )}
        </AnimatePresence>
      </span>
    </m.button>
  );
}