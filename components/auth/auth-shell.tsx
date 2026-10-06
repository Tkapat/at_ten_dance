"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { LogoMark } from "@/components/shell/app-shell";
import { tween } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The frame every entry screen sits in.
 *
 * Sign in, join, sign-up and the code reveal are four doors into the same
 * building. They share one layout on purpose: a person who lands on the join flow
 * from a poster link should recognise where they are, and the only thing that
 * changes between them is the question being asked.
 *
 * `AuthFrame` and `AuthCard` are separate because `/login` needs the tab strip to
 * live *inside* the card and to survive switching between two forms. Composing
 * them into one `AuthShell` is right for every screen with a single form, and
 * wrong for the one that has two.
 */

/** The page around a card: full height, centred, with an optional back and footer. */
export function AuthFrame({
  children,
  footer,
  onBack,
  width = "narrow",
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  width?: "narrow" | "wide";
}) {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:py-10">
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col justify-center",
          width === "narrow" ? "max-w-[400px]" : "max-w-[520px]",
        )}
      >
        {onBack && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back
            </button>
          </div>
        )}

        {children}

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

/** The card itself: the mark, the question being asked, and whatever is inside. */
export function AuthCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tween.enter}
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sheet)] sm:p-7",
        className,
      )}
    >
      <div className="mb-6 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10">
          <LogoMark className="size-7" />
        </span>
        <h1
          data-step-heading
          className="mt-4 text-[20px] font-semibold leading-tight tracking-[-0.015em]"
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </m.div>
  );
}

/** Frame plus card, for the screens that have exactly one form. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  onBack,
  width = "narrow",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  width?: "narrow" | "wide";
}) {
  return (
    <AuthFrame footer={footer} onBack={onBack} width={width}>
      <AuthCard title={title} subtitle={subtitle}>
        {children}
      </AuthCard>
    </AuthFrame>
  );
}

/** The line below an auth card: several small links, one sentence each. */
export function AuthFooter({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function AuthLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-block rounded font-medium text-primary underline-offset-4 transition-colors hover:underline"
    >
      {children}
    </Link>
  );
}