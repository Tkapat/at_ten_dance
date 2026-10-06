"use client";

import { Suspense, useState } from "react";
import { Building2, GraduationCap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { AuthCard, AuthFooter, AuthFrame, AuthLink } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";
import { StudentLogin } from "./student-login";

/**
 * One page, two accounts, one question first.
 *
 * An institute signs in with an email it chose; a student with an id its institute
 * gave them plus a code that says which institute. Keeping them on one screen with
 * a toggle means nobody has to remember which URL they were sent to, and the tab
 * can be linked to — `/login?tab=student` is what the welcome screen and a poster
 * both point at.
 *
 * The tab lives in the URL as well as in state, because these links get shared: a
 * code pasted into a message, a bookmark, the back button after signing in. A tab
 * that only existed in state would lose it on every reload and put a student back
 * on the wrong form.
 *
 * Both forms stay mounted. Switching tabs keeps whatever was typed into the one
 * you left, which is what a tab bar is expected to do — and it means the institute
 * form does not re-request anything on the way back.
 */

type Tab = "institute" | "student";

const TABS = [
  { value: "institute" as const, label: "Institute", icon: <Building2 className="size-3.5" /> },
  { value: "student" as const, label: "Student", icon: <GraduationCap className="size-3.5" /> },
];

function LoginScreen() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() =>
    params.get("tab") === "student" ? "student" : "institute",
  );

  function change(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "student") url.searchParams.set("tab", "student");
    else url.searchParams.delete("tab");
    // `replace` rather than `push`: switching tabs is not a place to go back to,
    // and pushing would fill the history with a form somebody did not mean to be
    // in when they pressed back.
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="mb-5 flex justify-center">
        <Segmented options={TABS} value={tab} onChange={change} ariaLabel="Sign in as" />
      </div>
      <div className={tab === "institute" ? "block" : "hidden"}>
        <LoginForm />
      </div>
      <div className={tab === "student" ? "block" : "hidden"}>
        <StudentLogin />
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame
      footer={
        <AuthFooter>
          <p>
            Run an institute that is not set up yet?{" "}
            <AuthLink href="/institute/signup">Create one</AuthLink>
          </p>
        </AuthFooter>
      }
    >
      <Suspense fallback={<div className="min-h-[320px]" />}>
        <LoginScreenWithCard />
      </Suspense>
    </AuthFrame>
  );
}

function LoginScreenWithCard() {
  return (
    <AuthCard
      title="Sign in"
      subtitle="FaceTrack attendance"
    >
      <LoginScreen />
    </AuthCard>
  );
}