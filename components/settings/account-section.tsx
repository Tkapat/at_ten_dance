"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { passwordSchema, type PasswordFormValues } from "@/lib/schemas";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/controls";

const LEVELS = ["Too weak", "Weak", "Fair", "Strong", "Very strong"] as const;

function strength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(4, score);
}

export function AccountSection() {
  const { data: session } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  const next = useWatch({ control, name: "next" });
  const score = strength(next ?? "");
  const tone = score <= 1 ? "danger" : score === 2 ? "warning" : "success";

  async function onSubmit(values: PasswordFormValues) {
    setSaving(true);
    try {
      await api().changePassword(values.current, values.next);
      toast.success("Password updated. Sign in again with the new one.");
      reset({ current: "", next: "", confirm: "" });
      router.push("/login");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The password could not be changed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <span className="text-xs text-muted-foreground">{session?.username ?? "—"}</span>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-sm text-muted-foreground">
            FaceTrack has no self sign-up. New accounts are created by an administrator with
            the same credentials you use here.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field
            label="Current password"
            htmlFor="cur-password"
            error={errors.current?.message}
          >
            <Input
              id="cur-password"
              type="password"
              autoComplete="current-password"
              {...register("current")}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            error={errors.next?.message}
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...register("next")}
            />
          </Field>

          <div className="space-y-2">
            <ProgressBar value={(score / 4) * 100} tone={tone} />
            <p className="text-xs text-muted-foreground">
              {next ? LEVELS[score] : "Strength appears as you type."}
            </p>
          </div>

          <Field label="Confirm new password" htmlFor="confirm-password" error={errors.confirm?.message}>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirm")}
            />
          </Field>

          <Button type="submit" loading={saving} disabled={saving}>
            <KeyRound className="size-4" /> Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
