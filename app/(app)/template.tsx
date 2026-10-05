"use client";

import { PageTransition } from "@/components/motion/PageTransition";

/**
 * Re-mounts the app group on every navigation, giving each screen its own
 * depth-aware transition without tearing down the shell.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
