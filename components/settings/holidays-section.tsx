"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarPlus, CalendarX, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { holidaySchema, type HolidayFormValues } from "@/lib/schemas";
import { formatLongDay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Tag } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

export function HolidaysSection() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["holidays"],
    queryFn: () => api().getHolidays(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { date: "", label: "" },
  });

  async function onAdd(values: HolidayFormValues) {
    setBusy(true);
    try {
      await api().addHoliday(values.date, values.label);
      await qc.invalidateQueries({ queryKey: ["holidays"] });
      await qc.invalidateQueries({ queryKey: ["summary"] });
      reset({ date: "", label: "" });
      toast.success("Holiday added.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The holiday could not be added.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(date: string) {
    try {
      await api().removeHoliday(date);
      await qc.invalidateQueries({ queryKey: ["holidays"] });
      await qc.invalidateQueries({ queryKey: ["summary"] });
      toast.success("Holiday removed.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The holiday could not be removed.",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holidays</CardTitle>
        <span className="text-xs text-muted-foreground">No attendance expected</span>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="holiday-date" error={errors.date?.message}>
            <Input id="holiday-date" type="date" {...register("date")} />
          </Field>
          <Field label="Name" htmlFor="holiday-label" error={errors.label?.message}>
            <Input id="holiday-label" placeholder="Institute holiday" {...register("label")} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" size="sm" loading={busy} disabled={busy}>
              <CalendarPlus className="size-4" /> Add holiday
            </Button>
          </div>
        </form>

        <div className="h-px bg-border" />

        {query.isPending && !query.data ? (
          <CardSkeleton className="h-24" />
        ) : query.isError ? (
          <ErrorState
            message={query.error.message || "Holidays could not be loaded."}
            onRetry={() => query.refetch()}
          />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState
            icon={<CalendarX className="size-5" />}
            title="No holidays yet"
            message="Every day is currently counted toward attendance."
            className="py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {query.data.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLongDay(h.date)} · {h.date}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tag tone="warning">Holiday</Tag>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onRemove(h.date)}
                    aria-label={`Remove ${h.label}`}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
