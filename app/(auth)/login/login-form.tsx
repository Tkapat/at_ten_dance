"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { api, USE_MOCK } from "@/lib/api";
import { DEMO_PASSWORD, DEMO_USERNAME, MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { LogoMark } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

/** Only same-site absolute paths are honoured, so `?next=` cannot redirect out. */
function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const controls = useAnimationControls();
  const reduced = useReducedMotion();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error || reduced) return;
    controls.start({
      x: [0, -10, 10, -8, 8, -4, 0],
      transition: { duration: 0.42, ease: "easeInOut" },
    });
  }, [error, controls, reduced]);

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
    // The cookie is already in the jar, so `proxy` sees the session on this
    // navigation. `pending` deliberately stays true: if the redirect somehow
    // does not happen the button keeps spinning instead of lying about success.
    router.replace(next);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <motion.div
        animate={controls}
        className="w-full max-w-[360px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sheet)]"
      >
        <div className="flex flex-col items-center text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10">
            <LogoMark className="size-7" />
          </span>
          <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.015em]">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            FaceTrack attendance console
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Field label="Username" htmlFor="username">
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="pl-9"
                placeholder="admin"
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
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-danger"
              >
                {error}
              </motion.p>
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
        </form>

        {USE_MOCK && (
          <p className="mt-5 rounded-xl bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
            Demo build — sign in with{" "}
            <span className="font-medium text-foreground">
              {DEMO_USERNAME} / {DEMO_PASSWORD}
            </span>
          </p>
        )}
      </motion.div>

      <p className="mt-6 text-xs text-muted-foreground">
        No self sign-up. Accounts are created by an administrator.
      </p>
    </div>
  );
}
