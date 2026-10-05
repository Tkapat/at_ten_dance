import * as React from "react";
import { m } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tween } from "@/lib/motion";

type Variant = "primary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

// framer-motion redefines the drag and animation handlers on its own, so those
// DOM attributes are dropped from our props instead of fighting the typings.
type MotionButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  | "onDrag"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDragStart"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
>;

export interface ButtonProps extends MotionButtonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:bg-primary/50",
  outline:
    "border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50",
  ghost: "text-foreground hover:bg-muted disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:opacity-50",
  link: "text-primary underline-offset-4 hover:underline h-auto p-0",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
  icon: "h-11 w-11",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref,
  ) => (
    <m.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={tween.tap}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-medium",
        "transition-colors duration-150 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </m.button>
  ),
);
Button.displayName = "Button";

/** Icon-only button. `label` becomes the accessible name. */
export function IconButton({
  label,
  className,
  ...props
}: MotionButtonProps & { label: string }) {
  return (
    <m.button
      whileTap={{ scale: 0.94 }}
      transition={tween.tap}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-11 place-items-center rounded-xl text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
