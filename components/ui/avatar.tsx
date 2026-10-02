import { cn, hashString, initials } from "@/lib/utils";

/**
 * Initials on a deterministic, low-saturation tint. The palette classes live in
 * `globals.css` and flip with the theme.
 */
export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const hue = hashString(name) % 6;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        `avatar-${hue}`,
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        backgroundColor: "hsl(var(--av-bg))",
        color: "hsl(var(--av-fg))",
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
