import Link from "next/link";
import { Building2, GraduationCap } from "lucide-react";
import { LogoMark } from "@/components/shell/app-shell";
import { RememberedInstitute } from "@/components/auth/remembered-institute";

export const metadata = { title: "FaceTrack" };

/**
 * The front door: which of the two people are you.
 *
 * A single sign-in form cannot ask for both. An institute signs in with an email
 * it chose; a student signs in with an id their institute gave them and a code that
 * identifies it. Asking one person for the other's field is how you get "please
 * enter a valid email" from somebody who was never going to have one, so the
 * question comes first and the form comes after.
 *
 * The remembered institute is offered as a chip on the same screen, because most
 * people coming back are the same person as last time and re-typing six characters
 * on a phone is the friction that makes people give up.
 */

function Choice({
  href,
  icon,
  title,
  description,
  action,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="mt-3 text-[15px] font-medium">{title}</span>
      <span className="mt-1 text-sm text-muted-foreground">{description}</span>
      <span className="mt-3 text-sm font-medium text-primary">{action}</span>
    </Link>
  );
}

export default function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-10 sm:justify-center">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10">
            <LogoMark className="size-8" />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.015em]">FaceTrack</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Face-based attendance for institutes and their students.
          </p>
        </div>

        <div className="mt-8 grid gap-3">
          <Choice
            href="/login?tab=student"
            icon={<GraduationCap className="size-5" />}
            title="I'm a student"
            description="Sign in with your institute code and your own ID."
            action="Continue as a student"
          />
          <Choice
            href="/login?tab=institute"
            icon={<Building2 className="size-5" />}
            title="I run an institute"
            description="Attendance for your students, with your own columns and calendar."
            action="Continue as an institute"
          />
        </div>

        <RememberedInstitute />

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            <Link
              href="/login"
              className="rounded font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-2">
            No institute yet?{" "}
            <Link
              href="/institute/signup"
              className="rounded font-medium text-primary underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}