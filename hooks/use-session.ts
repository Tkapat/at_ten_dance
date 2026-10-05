"use client";

import { useQuery } from "@tanstack/react-query";
import { setToken } from "@/lib/token";
import type { Role } from "@/lib/types";

/**
 * Who is signed in, and whose institute everything on screen belongs to.
 *
 * Three sources, in order of authority:
 *
 *   1. the httpOnly cookie, read by `/api/auth/session` — the role, which is the
 *      only thing that decides which half of the app exists;
 *   2. the institute's own record — `/setup/status` for an account, `/me` for a
 *      student — for the name and the code the header shows.
 *
 * The second one is per role because the two roles can read different things, and
 * neither may read the other's. A student gets their institute name from their own
 * record; the code comes from the cookie round trip at sign-in.
 *
 * This is allowed to be briefly null on first paint. The shell renders its
 * skeleton until it answers, which is the one moment a header should not claim to
 * know who you are.
 */

export interface SessionInfo {
  role: Role;
  name: string;
  institute: { id: string; name: string; code: string };
}

export function useSession() {
  return useQuery<SessionInfo>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) throw new Error("Not signed in.");
      const claims = (await res.json()) as {
        role: Role;
        name: string;
        inst: string;
        token?: string;
      };

      // Keep the in-memory token in step with the cookie: it is what the two file
      // downloads and the WebSocket use, and they must not be the only thing that
      // knows whether this tab is signed in.
      if (claims.token) setToken(claims.token);

      const institute = await instituteFor(claims.role, claims.inst);
      return { role: claims.role, name: claims.name, institute };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    retry: false,
  });
}

/**
 * The institute's name and code.
 *
 * Both roles know their own institute and nothing about anyone else's: an
 * account reads the setup status it is already entitled to, a student reads
 * their own record. A failure here is not worth a retry — the header simply shows
 * the name without a code chip.
 */
async function instituteFor(
  role: Role,
  id: string,
): Promise<SessionInfo["institute"]> {
  const blank = { id, name: "", code: "" };
  try {
    if (role === "student") {
      const { api } = await import("@/lib/api");
      const me = await api().me();
      return {
        id,
        name: me.instituteName,
        // `/me` answers with the code too, which is why this is not read from a
        // remembered value in localStorage.
        code: me.instituteCode,
      };
    }
    const { api } = await import("@/lib/api");
    const status = await api().setupStatus();
    return {
      id,
      name: status.institute.name,
      code: status.institute.code,
    };
  } catch {
    return blank;
  }
}