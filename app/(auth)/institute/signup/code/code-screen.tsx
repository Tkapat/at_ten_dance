"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { AuthFrame, AuthCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Spinner } from "@/components/ui/spinner";
import { CodePoster, CodeReveal } from "./code-reveal";

/**
 * The code reveal, read from the session rather than from the submit.
 *
 * After signing up, the owner is sent here. The institute and its code are in the
 * session the service just minted — which means this page survives a refresh, and
 * a bookmark, and the email that says "your code is XXXXXX" being opened a week
 * later. Reading them out of component state would have shown an empty screen the
 * moment the page reloaded, which for the one page that exists to show a code is
 * the worst possible failure.
 *
 * There is no fallback and no re-fetch loop: the session is the authority, and if
 * it is missing then this person is not the owner of an institute that was just
 * created, so they are sent to sign in rather than shown a blank card.
 */
export function CodeRevealScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api()
      .session()
      .then((current) => {
        if (!live) return;
        // A student has no code to reveal, and an institute that has one but is
        // mid-import still belongs here.
        if (current.role === "student") {
          router.replace("/me");
          return;
        }
        setSession(current);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [router]);

  if (loading) {
    return (
      <AuthFrame>
        <AuthCard title="One moment">
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        </AuthCard>
      </AuthFrame>
    );
  }

  if (failed || !session?.institute?.code) {
    return (
      <AuthFrame>
        <AuthCard title="Your institute">
          <ErrorState
            message="We couldn't read your institute. Sign in and we'll show your code again."
            onRetry={() => router.replace("/login?tab=institute")}
          />
        </AuthCard>
      </AuthFrame>
    );
  }

  const code = session.institute.code;
  const name = session.institute.name || "your institute";
  const joinLink =
    typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : `/join?code=${code}`;

  return (
    <AuthFrame width="wide">
      <div className="print:hidden">
        <AuthCard title="Your institute code" subtitle="Share it, and students can join.">
          <CodeReveal code={code} instituteName={name} joinLink={joinLink} />

          <div className="mt-7 border-t border-border pt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              Next: import your programmes, then your students, then turn on attendance.
            </p>
            <Button size="lg" className="w-full" onClick={() => router.replace("/setup")}>
              <Building2 className="size-4" /> Continue setup
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You can find this code again in Settings at any time.
            </p>
          </div>
        </AuthCard>
      </div>

      {/* The printed sheet. Hidden on screen by the print stylesheet. */}
      <CodePoster code={code} instituteName={name} />
    </AuthFrame>
  );
}