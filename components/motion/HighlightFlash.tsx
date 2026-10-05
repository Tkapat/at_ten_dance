"use client";

/**
 * A one-shot background flash for live updates (a student flips to present, a
 * stat changes, an entry arrives). Apply by giving the element
 * `key={updateId}` and the `highlight` class; the animation runs once.
 *
 * Use the `Highlight` component, or drop the `.highlight` class onto any node
 * with a key tied to the update identifier. The key is what retriggers it.
 */
export function Highlight({ id, children, className }: { id: string | number; children: React.ReactNode; className?: string }) {
  return (
    <span key={id} className={`highlight-flash ${className ?? ""}`}>
      {children}
    </span>
  );
}
