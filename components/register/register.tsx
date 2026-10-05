"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { RegisterPayload, RegisterResult } from "@/lib/types";
import {
  DEGREES,
  DEGREE_LIST,
  FRAMES_PER_POSE,
  MIN_GOOD_FRAMES,
  MIN_POSES,
  SECTIONS,
  departmentsFor,
  yearsFor,
} from "@/lib/constants";
import { studentFormSchema, type StudentFormValues } from "@/lib/schemas";
import { useRegisterCapture } from "@/hooks/use-register-capture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Tag } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StepTransition } from "@/components/motion/StepTransition";
import { CheckDraw } from "@/components/motion/CheckDraw";
import { CapturePanel } from "./capture-panel";

const STEPS = ["Details", "Capture", "Review"] as const;

const BLANK: StudentFormValues = {
  name: "",
  enrollmentNo: "",
  degree: "BTech",
  department: "",
  section: "A",
  year: "1",
};

export function RegisterScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const reenrollId = search.get("student");
  const qc = useQueryClient();

  const capture = useRegisterCapture();
  const [step, setStep] = useState(0);
  // The step we came from drives direction, so going Back slides the other way.
  // Derived during render (the "adjust state when props change" pattern).
  const [lastStep, setLastStep] = useState(step);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (step !== lastStep) {
    setDirection(step > lastStep ? 1 : -1);
    setLastStep(step);
  }
  const [details, setDetails] = useState<StudentFormValues | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  const target = useQuery({
    queryKey: ["student", reenrollId],
    queryFn: () => api().getStudent(reenrollId as string),
    enabled: Boolean(reenrollId),
  });

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: BLANK,
    values: target.data?.student
      ? {
          name: target.data.student.name,
          enrollmentNo: target.data.student.enrollmentNo,
          degree: target.data.student.degree,
          department: target.data.student.department ?? "",
          section: target.data.student.section,
          year: String(target.data.student.year),
        }
      : undefined,
  });

  const degree = useWatch({ control: form.control, name: "degree" });
  const hasDepartment = DEGREES[degree ?? "BTech"].hasDepartment;

  function startCapture(values: StudentFormValues) {
    setDetails(values);
    setStep(1);
  }

  function goToReview() {
    setStep(2);
    capture.stop();
  }

  async function submit() {
    if (!details) return;
    const shots = capture.state.shots;
    setSubmitting(true);
    setSubmitError(null);
    const payload: RegisterPayload = {
      name: details.name,
      enrollmentNo: details.enrollmentNo,
      degree: details.degree,
      department: hasDepartment ? details.department || null : null,
      section: details.section,
      year: Number(details.year),
      frames: shots.map((s) => s.blob),
      poses: [...new Set(shots.map((s) => s.pose))],
    };
    try {
      const r = reenrollId
        ? await api().reenroll(reenrollId, payload)
        : await api().registerCommit(payload);
      setResult(r);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["students"] }),
        qc.invalidateQueries({ queryKey: ["summary"] }),
        qc.invalidateQueries({ queryKey: ["student", reenrollId] }),
      ]);
      toast.success(reenrollId ? "Face re-enrolled." : "Student registered.");
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err : new ApiError(0, "Registration failed. Try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    capture.reset();
    setResult(null);
    setDetails(null);
    setStep(0);
    setSubmitError(null);
    form.reset(BLANK);
  }

  if (target.isPending && reenrollId) {
    return <CardSkeleton className="h-[420px]" />;
  }

  if (target.isError && reenrollId) {
    return (
      <ErrorState
        message={target.error.message || "That student could not be loaded."}
        onRetry={() => target.refetch()}
      />
    );
  }

  /* ------------------------------------------------------------ success */
  if (result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <CheckDraw size={56} />
          <div className="space-y-1">
            <h1 className="text-[20px] font-semibold tracking-[-0.015em]">
              {reenrollId ? "Face re-enrolled" : "Student registered"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {result.name} now has {result.embeddings} usable frames in the gallery.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <Tag tone="success">{result.poses.length} poses</Tag>
            <Tag>{result.gallerySize} in gallery</Tag>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={startOver}>
              <UserPlus className="size-4" /> Register another
            </Button>
            <Button onClick={() => router.push("/")}>
              <LayoutDashboard className="size-4" /> Back to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* -------------------------------------------------------------- 409 */
  const duplicate = submitError?.status === 409 ? submitError.duplicate : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <Stepper step={step} />

      <StepTransition stepKey={step} direction={direction} focusHeading>
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Student details</CardTitle>
            {reenrollId && <Tag tone="primary">Re-enroll</Tag>}
          </CardHeader>
          <CardContent className="pt-4">
            <form
              id="register-details"
              onSubmit={form.handleSubmit(startCapture)}
              className="space-y-4"
            >
              <Field label="Full name" htmlFor="reg-name" error={form.formState.errors.name?.message}>
                <Input
                  id="reg-name"
                  autoComplete="name"
                  placeholder="e.g. Aarav Sharma"
                  {...form.register("name")}
                />
              </Field>

              <Field
                label="Enrollment number"
                htmlFor="reg-enrollment"
                hint="Must match the college record — it cannot be changed later without an edit."
                error={form.formState.errors.enrollmentNo?.message}
              >
                <Input
                  id="reg-enrollment"
                  autoCapitalize="characters"
                  placeholder="e.g. 21BCS0045"
                  {...form.register("enrollmentNo")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Degree" htmlFor="reg-degree" error={form.formState.errors.degree?.message}>
                  <Select id="reg-degree" {...form.register("degree")}>
                    {DEGREE_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Section" htmlFor="reg-section" error={form.formState.errors.section?.message}>
                  <Select id="reg-section" {...form.register("section")}>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {hasDepartment ? (
                  <Field
                    label="Department"
                    htmlFor="reg-department"
                    error={form.formState.errors.department?.message}
                  >
                    <Select id="reg-department" {...form.register("department")}>
                      <option value="">Select…</option>
                      {departmentsFor(degree ?? "BTech").map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <div />
                )}
                <Field label="Year" htmlFor="reg-year" error={form.formState.errors.year?.message}>
                  <Select id="reg-year" {...form.register("year")}>
                    {yearsFor(degree ?? "BTech").map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </form>

            <div className="mt-6 flex justify-end">
              <Button type="submit" form="register-details" size="lg">
                Continue to capture <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Capture faces</CardTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {details?.name} · {details?.enrollmentNo}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                capture.stop();
                setStep(0);
              }}
            >
              <ArrowLeft className="size-4" /> Details
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            <CapturePanel capture={capture} onContinue={goToReview} />
          </CardContent>
        </Card>
      )}

      {step === 2 && details && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" /> Recapture
              </Button>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
                <Row label="Name" value={details.name} />
                <Row label="Enrollment" value={details.enrollmentNo} />
                <Row label="Degree" value={details.degree} />
                <Row label="Department" value={hasDepartment ? details.department || "—" : "—"} />
                <Row label="Section" value={`Section ${details.section}`} />
                <Row label="Year" value={`Year ${details.year}`} />
              </dl>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Captured frames</span>
                  <span>
                    {capture.state.shots.length} / {MIN_GOOD_FRAMES}+ needed ·{" "}
                    {new Set(capture.state.shots.map((s) => s.pose)).size} / {MIN_POSES}+ poses
                  </span>
                </div>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {capture.state.shots.map((shot, i) => (
                    <li
                      key={shot.url}
                      className="overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shot.url}
                        alt={`Frame ${i + 1}, ${shot.pose} pose`}
                        className="aspect-square w-full object-cover"
                      />
                      <span className="block truncate px-1.5 py-1 text-center text-[10px] text-muted-foreground">
                        {shot.pose}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Tag tone={capture.state.shots.length >= MIN_GOOD_FRAMES ? "success" : "danger"}>
                  {capture.state.shots.length} frames
                </Tag>
                <Tag
                  tone={
                    new Set(capture.state.shots.map((s) => s.pose)).size >= MIN_POSES
                      ? "success"
                      : "danger"
                  }
                >
                  {new Set(capture.state.shots.map((s) => s.pose)).size} poses
                </Tag>
                <Tag>
                  {FRAMES_PER_POSE} per angle
                </Tag>
              </div>

              {duplicate && (
                <div className="rounded-xl border border-danger/40 bg-danger/8 p-4">
                  <p className="text-sm font-medium text-danger">Already registered</p>
                  <p className="mt-1 text-sm text-muted-foreground">{duplicate.message}</p>
                  {(duplicate.name || duplicate.similarity) && (
                    <p className="text-sm text-muted-foreground">
                      {duplicate.name ? `${duplicate.name} · ` : ""}
                      {duplicate.similarity
                        ? `${Math.round(duplicate.similarity * 100)}% match`
                        : "already in the gallery"}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {duplicate.studentId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/students/${duplicate.studentId}`)}
                      >
                        Open existing profile
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSubmitError(null);
                        setStep(0);
                      }}
                    >
                      Use a different enrollment number
                    </Button>
                  </div>
                </div>
              )}

              {submitError && !duplicate && (
                <div className="rounded-xl border border-danger/40 bg-danger/8 p-4 text-sm text-danger">
                  {submitError.message}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="lg" onClick={() => setStep(1)} disabled={submitting}>
              Back to capture
            </Button>
            <Button size="lg" loading={submitting} onClick={() => void submit()}>
              <Check className="size-4" />
              {reenrollId ? "Save new face" : "Register student"}
            </Button>
          </div>
        </div>
      )}
      </StepTransition>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Registration progress">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center">
              <span className="flex items-center gap-2">
                <span
                  className={
                    done
                      ? "grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"
                      : active
                        ? "grid size-7 place-items-center rounded-full border border-primary text-sm font-semibold text-primary"
                        : "grid size-7 place-items-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
                  }
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={
                    active ? "text-sm font-medium" : "text-sm text-muted-foreground"
                  }
                >
                  {label}
                </span>
              </span>
              {i < STEPS.length - 1 && <span className="mx-3 h-px w-6 bg-border sm:w-14" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
