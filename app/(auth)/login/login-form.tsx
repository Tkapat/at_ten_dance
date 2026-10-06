"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { m } from "framer-motion";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { api, USE_MOCK } from "@/lib/api";
import { DEMO_PASSWORD, DEMO_USERNAME, MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { distance, tween } from "@/lib/motion";
import { landingPath } from "@/lib/auth-flow";
import { Field, Input } from "@/components/ui/input";
import { Shake } from "@/components/motion/Shake";
import { Button } from "@/components/ui/button";

/**
 * Institute sign-in: email and password, and nothing else.
 *
 * This is the form the single-admin app already had and it is unchanged in
 * substance — same fields, same copy for a wrong password. What is new is the
 * redirect: an owner who has just created an institute and set nothing up lands
 * on setup rather than on a dashboard of zeroes, because a brand-new account
 * answering "0 of 0 students" reads as broken rather than as empty.
 */

/** Only same-site absolute paths are honoured, so `?next=` cannot redirect out. */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await api().login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Incorrect username or password.",
      );
      setPending(false);
      return;
    }
    // The cookie is already in the jar, so `proxy.ts` sees the session on this
    // navigation. `pending` deliberately stays true: if the redirect somehow does
    // not happen the button keeps spinning instead of lying about success.
    if (next) {
      router.replace(next);
      return;
    }
    // An institute that has not finished setup goes to setup rather than to an
    // empty dashboard. Read after signing in, because the status is only in the
    // service's answer and not in the session the cookie carries.
    try {
      const status = await api().setupStatus();
      router.replace(landingPath({ role: "owner" }, status.institute.status));
    } catch {
      // The sign-in succeeded, so a failure to read the checklist must not send
      // anybody back to the form. The console is the safe destination.
      router.replace("/");
    }
  }

  return (
    <Shake trigger={Boolean(error)}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="username">
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="username"
              name="username"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="pl-9"
              placeholder="admin@institute.edu"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pl-9 pr-11"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow((v) => !v)}
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div aria-live="polite" className="min-h-[20px]">
          {error && (
            <m.p
              initial={{ opacity: 0, y: distance.page }}
              animate={{ opacity: 1, y: 0 }}
              transition={tween.tick}
              className="text-sm text-danger"
            >
              {error}
            </m.p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={pending}
          disabled={!username.trim() || password.length < MIN_PASSWORD_LENGTH}
        >
          Sign in
        </Button>

        {USE_MOCK && (
          <p className="rounded-xl bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
            Demo build — sign in with{" "}
            <span className="font-medium text-foreground">
              {DEMO_USERNAME} / {DEMO_PASSWORD}
            </span>
          </p>
        )}
      </form>
    </Shake>
  );
}