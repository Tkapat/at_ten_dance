import { Suspense } from "react";
import { RegisterScreen } from "@/components/register/register";
import { CardSkeleton } from "@/components/ui/skeleton";

export default function RegisterPage() {
  return (
    <Suspense fallback={<CardSkeleton className="h-[420px]" />}>
      <RegisterScreen />
    </Suspense>
  );
}
