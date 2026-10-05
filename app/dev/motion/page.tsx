"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useMotionPref } from "@/hooks/useMotionPref";
import { setReducedMotionOverride } from "@/lib/motion-pref";
import { Collapse } from "@/components/motion/Collapse";
import { StepTransition } from "@/components/motion/StepTransition";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { CheckDraw } from "@/components/motion/CheckDraw";
import { Shake } from "@/components/motion/Shake";
import { Highlight } from "@/components/motion/HighlightFlash";
import { FlipTiles } from "@/components/motion/FlipTiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * `/dev/motion` — every motion primitive in one place, with a replay button and
 * a reduced-motion toggle that writes the same `facetrack.reduceMotion`
 * preference Settings → Appearance uses. Development only.
 */
export default function DevMotionPage() {
  const router = useRouter();
  const [tick, bump] = useReducer((t: number) => t + 1, 0);
  const m = useMotionPref();
  const isProduction = process.env.NODE_ENV === "production";

  // Hooks must run unconditionally, so the redirect lives in an effect and the
  // production branch just renders nothing.
  useEffect(() => {
    if (isProduction) router.replace("/");
  }, [isProduction, router]);

  if (isProduction) return null;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Motion primitives</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each has a replay button, and the toggle below writes the same
            production preference Settings → Appearance uses:{" "}
            <code>facetrack.reduceMotion</code>.
          </p>
        </div>
        <Button onClick={bump}>Replay everything</Button>
      </header>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Reduced motion</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReducedMotionOverride(m.reduced ? null : true)}
        >
          {m.reduced ? "Forced on — clear to follow OS" : "Force on"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {m.reduced ? "Reduced. All movement collapsed." : "Following your OS unless you force it above."}
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>FlipTiles</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4 pt-4">
          <FlipTiles code="XPX8R2" />
          <Button variant="ghost" size="sm" onClick={bump}>replay</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>StaggerList</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <StaggerList>
            {["One", "Two", "Three", "Four"].map((label, i) => (
              <StaggerItem key={`${label}${tick}`} index={i}>
                <div className="rounded-lg border border-border p-3">{label}</div>
              </StaggerItem>
            ))}
          </StaggerList>
          <Button variant="ghost" size="sm" onClick={bump} className="mt-3">replay</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Collapse</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <Collapse open={tick % 2 === 1}>
            <p className="rounded-xl bg-muted p-3 text-sm">Appears and folds away.</p>
          </Collapse>
          <Button variant="ghost" size="sm" onClick={bump} className="mt-3">toggle</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>StepTransition</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <StepTransition stepKey={tick % 2} direction={tick % 2 === 0 ? 1 : -1}>
            <p className="rounded-xl bg-muted p-3 text-sm">Step {tick % 2}</p>
          </StepTransition>
          <Button variant="ghost" size="sm" onClick={bump} className="mt-3">next</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>AnimatedNumber</CardTitle></CardHeader>
        <CardContent className="pt-4 text-3xl font-semibold">
          <AnimatedNumber value={84} suffix="%" />
          <Button variant="ghost" size="sm" onClick={bump}>nudge</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>CheckDraw</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <CheckDraw size={52} key={tick} />
          <Button variant="ghost" size="sm" onClick={bump} className="ml-3">replay</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shake</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <Shake trigger={tick % 2 === 1}>
            <p className="rounded-xl border border-danger/40 p-3 text-sm">Failing field</p>
          </Shake>
          <Button variant="ghost" size="sm" onClick={bump} className="mt-3">trigger</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>HighlightFlash</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <Highlight id={tick}>
            <span className="rounded-lg border border-border p-2">84% attendance</span>
          </Highlight>
          <Button variant="ghost" size="sm" onClick={bump} className="ml-3">replay</Button>
        </CardContent>
      </Card>
    </div>
  );
}
