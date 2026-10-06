"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { m } from "framer-motion";
import { Check, Copy, Printer, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring, tween } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { Button } from "@/components/ui/button";
import { FlipTiles } from "@/components/motion/FlipTiles";
import { Modal } from "@/components/ui/modal";

/**
 * The code, and the three ways it needs to be taken away from this screen.
 *
 * The code is the whole product handover: it is how a student joins and how an
 * admin proves they belong to the right institute. So it is offered as a tile
 * flip to draw the eye, then as a tap-to-copy for the person who is going to send
 * it in a message, a QR for the person putting it on a poster, and a print
 * stylesheet for the person with a printer in front of them.
 *
 * A code that is hard to copy gets photographed, and a photographed code on a
 * phone screen is unreadable. That is why every one of these is the code *tile*
 * itself and not a button next to it.
 */

const COPY_REVERT_MS = 1600;

export function CodeReveal({
  code,
  instituteName,
  joinLink,
}: {
  code: string;
  instituteName: string;
  joinLink: string;
}) {
  const { reduced } = useMotionPref();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [qr, setQr] = useState(false);

  async function copy(what: "code" | "link") {
    const text = what === "code" ? code : joinLink;
    try {
      await writeClipboard(text);
    } catch {
      return;
    }
    setCopied(what);
    window.setTimeout(() => setCopied(null), COPY_REVERT_MS);
  }

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">
        Students join <span className="font-medium text-foreground">{instituteName}</span>{" "}
        with this code.
      </p>

      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={tween.enter}
        className="mt-5 flex justify-center"
      >
        <FlipTiles code={code} />
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? tween.instant : tween.enter}
        className="mt-6 flex flex-wrap items-center justify-center gap-2"
      >
        <Button onClick={() => copy("code")}>
          <CopyOrCheck copied={copied === "code"} />
          {copied === "code" ? "Code copied" : "Copy code"}
        </Button>
        <Button variant="outline" onClick={() => copy("link")}>
          <CopyOrCheck copied={copied === "link"} />
          {copied === "link" ? "Link copied" : "Copy join link"}
        </Button>
        <Button variant="outline" onClick={() => setQr(true)}>
          <QrCode className="size-4" /> Show QR
        </Button>
        {/* The print button is hidden on screen and shown by the print stylesheet
            only where it belongs — but it still needs to exist in the document for
            that stylesheet to reveal it. */}
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-4" /> Print poster
        </Button>
      </m.div>

      <p className="mt-5 text-xs text-muted-foreground">
        This code does not change. Students can join with it as soon as you have
        finished setup.
      </p>

      {qr && (
        <Modal open={qr} onOpenChange={setQr} title="Scan to join">
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Large enough to scan from across a desk, and rendered inline as SVG
                so it prints and scales without a second asset. */}
            {/* White on purpose, and the only hard-coded colour in these screens.
                A QR code is read by inverting whatever it sits on, so in dark mode
                a themed background makes it unscannable — the quiet padding is the
                price of it working. */}
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={joinLink} size={208} marginSize={0} />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Point a camera at this to open the join page.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
              <Button onClick={() => setQr(false)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** The icon that becomes a check, in place, for as long as it is true. */
function CopyOrCheck({ copied }: { copied: boolean }) {
  const { reduced } = useMotionPref();
  return (
    <span className="relative grid size-4 place-items-center">
      <m.span
        className="absolute grid place-items-center"
        initial={false}
        animate={{ opacity: copied ? 0 : 1, scale: copied ? 0.7 : 1 }}
        transition={reduced ? tween.instant : tween.tick}
      >
        <Copy className="size-4" />
      </m.span>
      <m.span
        className="absolute grid place-items-center text-success"
        initial={false}
        animate={{ opacity: copied ? 1 : 0, scale: copied ? 1 : 0.7 }}
        transition={reduced ? tween.instant : spring.pop}
      >
        <Check className="size-4" strokeWidth={2.6} />
      </m.span>
    </span>
  );
}

/**
 * Clipboard, with a fallback.
 *
 * The async clipboard API only exists on a secure origin. Over plain http on a
 * campus LAN — which is where a first deployment often is — it is missing, and
 * failing to copy because of that is worse than copying the old way.
 */
async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  document.body.removeChild(field);
}

/** The poster. Hidden on screen, laid out for A4 with nothing else on it. */
export function CodePoster({
  code,
  instituteName,
}: {
  code: string;
  instituteName: string;
}) {
  return (
    <div className="print:block hidden">
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <div>
          <p className="text-2xl font-semibold">{instituteName}</p>
          <p className="mt-1 text-lg">Join with this code</p>
        </div>
        <p className="font-mono text-6xl font-semibold uppercase tracking-[0.2em]">{code}</p>
        <p className="max-w-md text-sm">
          Open the FaceTrack join page on your phone and enter this code, then your own
          ID. Ask your institute for your ID if you do not have it.
        </p>
      </div>
    </div>
  );
}

export const posterClass = cn("print:hidden");