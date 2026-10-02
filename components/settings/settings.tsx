"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Moon, RefreshCw, Sun, SunMoon } from "lucide-react";
import { api, API_BASE, USE_MOCK, WS_BASE } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AccountSection } from "./account-section";
import { RecognitionSection } from "./recognition-section";
import { CameraSection } from "./camera-section";
import { HolidaysSection } from "./holidays-section";

function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Segmented
          options={[
            { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
            { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
            { value: "system", label: "System", icon: <SunMoon className="size-3.5" /> },
          ]}
          value={theme === "dark" || theme === "light" ? theme : "system"}
          onChange={(v) => setTheme(v)}
          ariaLabel="Color theme"
        />
      </CardContent>
    </Card>
  );
}

function ServiceCard() {
  const qc = useQueryClient();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api().health(),
    refetchInterval: 30_000,
    retry: 1,
  });

  const rows = [
    { label: "Mode", value: USE_MOCK ? "Mock data" : "Live service" },
    { label: "REST base", value: API_BASE },
    { label: "Recognition socket", value: `${WS_BASE}/ws/recognize` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void qc.invalidateQueries({ queryKey: ["health"] })}
          disabled={health.isFetching}
        >
          <RefreshCw className={health.isFetching ? "size-4 animate-spin" : "size-4"} /> Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={USE_MOCK ? "warning" : "success"}>
            {USE_MOCK ? "Mock" : "Live"}
          </Tag>
          {health.data && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  health.data.ok && health.data.dbReachable ? "bg-success" : "bg-warning",
                )}
              />
              {health.data.ok
                ? health.data.dbReachable
                  ? "Service reachable"
                  : "Service up, database unreachable"
                : "Service degraded"}
            </span>
          )}
        </div>

        <dl className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
              <dd className="truncate font-mono text-xs">{r.value}</dd>
            </div>
          ))}
          {health.data && (
            <>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="shrink-0 text-muted-foreground">Model</dt>
                <dd className="truncate font-mono text-xs">{health.data.model}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="shrink-0 text-muted-foreground">Gallery</dt>
                <dd className="tabular-nums text-xs">
                  {health.data.galleryStudents} students enrolled
                </dd>
              </div>
            </>
          )}
        </dl>

        {health.isError && (
          <p className="text-xs text-danger">
            Could not reach the service at {API_BASE}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Settings() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="mx-auto w-full max-w-3xl space-y-4 pb-6"
    >
      <p className="text-sm text-muted-foreground">
        Attendance policy, device preferences, and account credentials for this kiosk.
      </p>

      <AccountSection />
      <RecognitionSection />
      <CameraSection />
      <HolidaysSection />
      <AppearanceCard />
      <ServiceCard />
    </motion.div>
  );
}
