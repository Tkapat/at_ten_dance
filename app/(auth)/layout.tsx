import type { Metadata } from "next";

/**
 * The signed-out area: welcome, sign in, join and create-an-institute.
 *
 * These four routes are reached from a poster, a shared link or a bookmark as
 * often as from inside the app, so each names itself in a shared link preview
 * rather than inheriting the root layout's "at_ten_dance".
 *
 * The layout itself exists for the title template, and to keep this group off the
 * app shell: a signed-out person has no institute, no session and no nav, and the
 * shell would have nothing to fill in.
 */
export const metadata: Metadata = {
  title: {
    default: "Sign in · FaceTrack",
    template: "%s · FaceTrack",
  },
  description: "Face-based attendance for institutes and their students.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}