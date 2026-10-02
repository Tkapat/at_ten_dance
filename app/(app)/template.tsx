"use client";

import { motion } from "framer-motion";
import { page } from "@/lib/motion";

/**
 * Re-mounts on every navigation inside the app group, which is what gives each
 * screen its own entrance animation without tearing down the shell.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div {...page} className="flex w-full flex-1 flex-col">
      {children}
    </motion.div>
  );
}
