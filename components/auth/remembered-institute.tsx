"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { readRememberedInstitute } from "@/lib/auth-flow";

/**
 * "Continue to Sunrise Institute", when we know which one.
 *
 * Read through `useSyncExternalStore` rather than a `useEffect` + `setState`,
 * because the server has no access to `localStorage`: rendering the chip on the
 * server would produce markup the client then takes back, which is a chip that
 * appears and then disappears — worse than never showing it on the first frame.
 * The store hook gets hydration right on the first paint.
 *
 * The snapshot is a *string*, not the object. `localStorage` returns a fresh
 * object every read, and a store snapshot that changes identity on every call is an
 * infinite render loop; joining the two fields gives a primitive that compares by
 * value, which is what the store needs.
 *
 * Nothing here is a credential. It saves six characters of typing for somebody
 * already on their way to typing them.
 */

const subscribe = () => () => {};

function snapshot(): string {
  const remembered = readRememberedInstitute();
  return remembered ? `${remembered.code}|${remembered.name}` : "";
}

const serverSnapshot = () => "";

export function RememberedInstitute() {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!value) return null;

  const [code, name] = value.split("|");
  return (
    <Link
      href={`/login?tab=student&code=${code}`}
      className="group mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Building2 className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          Continue to {name || "your institute"}
        </span>
        <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {code}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}