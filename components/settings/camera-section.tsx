"use client";

import { useEffect, useState } from "react";
import { Camera, FlipHorizontal2 } from "lucide-react";
import { setCameraPrefs } from "@/lib/prefs";
import { useCameraPrefs } from "@/hooks/use-camera-prefs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";

export function CameraSection() {
  const prefs = useCameraPrefs();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const media = navigator.mediaDevices;
    // Without enumerateDevices the list simply stays empty and the default
    // option below is used — no state transition is needed.
    if (!media?.enumerateDevices) return;
    media
      .enumerateDevices()
      .then((list) => {
        if (alive) setDevices(list.filter((d) => d.kind === "videoinput"));
      })
      .catch(() => {
        if (alive)
          setError("Camera access has not been granted yet — start a scan once to unlock the list.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const options =
    devices.length > 0
      ? devices.map((d, i) => ({
          value: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }))
      : [{ value: "", label: "Default (front camera)" }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera</CardTitle>
        <Camera className="size-4 text-muted-foreground" />
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        <Field
          label="Preferred camera"
          htmlFor="camera-device"
          hint={
            error ??
            "Applied to the scan overlay and to registration capture. Choosing a device requests it by id, so it stays stable across refreshes."
          }
        >
          <Select
            id="camera-device"
            value={prefs.deviceId}
            onChange={(e) => setCameraPrefs({ deviceId: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value || "default"} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Mirror preview</p>
            <p className="text-xs text-muted-foreground">
              Flips the preview the way a mirror would. Frames sent for recognition are never
              flipped.
            </p>
          </div>
          <Switch
            checked={prefs.mirror}
            onCheckedChange={(v) => setCameraPrefs({ mirror: v })}
            ariaLabel="Mirror preview"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FlipHorizontal2 className="size-3.5" />
          {prefs.mirror ? "Preview is mirrored." : "Preview matches reality."}
        </div>
      </CardContent>
    </Card>
  );
}
