"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cpu, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import type { RecognitionSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/controls";
import { Segmented } from "@/components/ui/segmented";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

type NumericKey =
  | "sim_threshold"
  | "margin"
  | "votes_needed"
  | "vote_window"
  | "min_face_px"
  | "recheck_seconds";

interface FieldSpec {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint: string;
}

const FIELDS: FieldSpec[] = [
  {
    key: "sim_threshold",
    label: "Similarity threshold",
    min: 0.3,
    max: 0.9,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "How close a face must match before it is accepted.",
  },
  {
    key: "margin",
    label: "Refusal margin",
    min: 0,
    max: 0.3,
    step: 0.01,
    format: (v) => v.toFixed(2),
    hint: "Extra gap required between the best and second-best identity.",
  },
  {
    key: "votes_needed",
    label: "Votes needed",
    min: 1,
    max: 6,
    step: 1,
    format: (v) => String(v),
    hint: "Frames that must agree before attendance is written.",
  },
  {
    key: "vote_window",
    label: "Vote window",
    min: 1,
    max: 30,
    step: 1,
    format: (v) => String(v),
    hint: "How many frames those votes are collected over.",
  },
  {
    key: "min_face_px",
    label: "Minimum face size",
    min: 48,
    max: 320,
    step: 8,
    format: (v) => `${v} px`,
    hint: "Smaller faces are ignored rather than guessed at.",
  },
  {
    key: "recheck_seconds",
    label: "Recheck interval",
    min: 1,
    max: 30,
    step: 1,
    format: (v) => `${v} s`,
    hint: "How often a confirmed face is verified again.",
  },
];

const MODELS = [
  { value: "buffalo_s", label: "buffalo_s · fast" },
  { value: "buffalo_l", label: "buffalo_l · accurate" },
];

export function RecognitionSection() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api().getSettings(),
  });

  // Null draft = "show what the server has". Editing switches to the draft so
  // no effect has to copy query data into state.
  const [draft, setDraft] = useState<RecognitionSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (query.isPending && !query.data) return <CardSkeleton className="h-[380px]" />;
  if (query.isError) {
    return (
      <ErrorState
        message={query.error.message || "Recognition settings could not be loaded."}
        onRetry={() => query.refetch()}
      />
    );
  }

  const value = draft ?? query.data!;
  const dirty = draft !== null;

  function update(key: NumericKey, next: number) {
    setDraft({ ...value, [key]: next });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api().saveSettings(draft);
      await qc.invalidateQueries({ queryKey: ["settings"] });
      setDraft(null);
      toast.success("Recognition settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function switchModel(model: string) {
    if (model === value.model) return;
    setSwitching(true);
    try {
      await api().switchModel(model);
      await qc.invalidateQueries({ queryKey: ["settings"] });
      setDraft(null);
      // The ONNX weights are loaded once per process, so a switch is recorded
      // now and takes effect on the next restart. Saying so beats a toast that
      // implies the running engine already changed.
      toast.success(`${model} will be used after the service restarts.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The model could not be switched.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recognition</CardTitle>
        {dirty && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={saving}>
              Save
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Model
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              options={MODELS}
              value={value.model}
              onChange={(m) => void switchModel(m)}
              ariaLabel="Recognition model"
              size="sm"
            />
            {switching && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="size-3.5 animate-pulse" /> Swapping…
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            buffalo_l is more accurate and roughly twice as slow; buffalo_s keeps the live
            overlay responsive on smaller machines.
          </p>
        </div>

        <div className="space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {f.format(value[f.key])}
                </span>
              </div>
              <Slider
                value={value[f.key]}
                onValueChange={(v) => update(f.key, v)}
                min={f.min}
                max={f.max}
                step={f.step}
                ariaLabel={f.label}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
