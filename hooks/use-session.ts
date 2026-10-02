"use client";

import { useQuery } from "@tanstack/react-query";
import { setToken } from "@/lib/token";

export interface SessionInfo {
  username: string;
  expiresAt: number;
}

/**
 * Loads the bearer token once per page load and exposes the username for the
 * shell. A failure means the cookie is gone; `proxy` bounces the next
 * navigation to /login, so there is nothing to retry.
 */
export function useSession() {
  return useQuery<SessionInfo>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/token", { cache: "no-store" });
      if (!res.ok) throw new Error("Not signed in.");
      const body = (await res.json()) as {
        token: string;
        username: string;
        expiresAt: number;
      };
      setToken(body.token);
      return { username: body.username, expiresAt: body.expiresAt };
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
