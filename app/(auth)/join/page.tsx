import { Suspense } from "react";
import { JoinFlow } from "./join-flow";

export const metadata = { title: "Join your institute" };

/** `?code=` is read with `useSearchParams`, so this page needs a Suspense boundary. */
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <JoinFlow />
    </Suspense>
  );
}