"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { LazyMotion, MotionConfig, domMax } from "framer-motion";
import { Toaster } from "sonner";
import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * The app's motion context. `MotionConfig` maps the device preference (manual
 * override or OS) onto framer-motion, so springs and transform/layout tweens
 * snap instead of animating when motion is reduced, while opacity fades keep
 * running. `LazyMotion` in strict mode makes every `motion.*` slip-through a
 * loud runtime error — all components use `m.*` so one shared feature set
 * serves them. `domMax` rather than `domAnimation` because layout indicators
 * (segmented pill, nav rail, tab bar) need the layout feature.
 */
function MotionBridge({ children }: { children: React.ReactNode }) {
  const { reduced } = useMotionPref();
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 4_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <MotionBridge>{children}</MotionBridge>
        <Toaster
          position="top-center"
          closeButton
          richColors
          duration={3600}
          toastOptions={{ style: { borderRadius: 14, fontSize: 14 } }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
