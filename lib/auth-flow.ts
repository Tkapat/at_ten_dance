/**
 * What the entry screens share: the institute code's shape, the code we remember,
 * and the one sentence a failed student sign-in is allowed to say.
 *
 * None of this is state. Keeping it here rather than in each screen means the
 * login flow, the join flow and the welcome screen cannot disagree about what a
 * valid code looks like, which is the kind of disagreement a person only finds out
 * about by being refused.
 */

import type { Role, Session } from "./types";

/**
 * The service's rule for an institute code: exactly six characters, and none of
 * `I`, `O`, `0` or `1`. Those are excluded because they are read aloud, written on
 * posters and typed by hand — `1`/`I` and `0`/`O` are the pairs people get wrong,
 * so they are not in the alphabet at all.
 */
export const CODE_LENGTH = 6;
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** What a code may contain, before it is six characters long. */
export const CODE_CHARACTERS = /^[A-HJ-NP-Z2-9]*$/;

export function normaliseCode(value: string): string {
  return value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, CODE_LENGTH);
}

export function isCompleteCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/**
 * Where the last successful code is kept.
 *
 * `localStorage` rather than a cookie because it is a convenience, never a
 * credential: it saves typing six characters on a phone. Losing it costs a
 * re-type and nothing else, which is exactly the right trade for something this
 * small and this public.
 */
const REMEMBERED_KEY = "ft_inst";

export interface RememberedInstitute {
  code: string;
  name: string;
}

export function readRememberedInstitute(): RememberedInstitute | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedInstitute>;
    const code = typeof parsed.code === "string" ? normaliseCode(parsed.code) : "";
    if (!isCompleteCode(code)) return null;
    return { code, name: typeof parsed.name === "string" ? parsed.name : "" };
  } catch {
    // A private-mode browser, a full quota, or something else that is nobody's
    // business. Remembering the code is a nicety; failing to is not an error.
    return null;
  }
}

export function rememberInstitute(code: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    const clean = normaliseCode(code);
    if (!isCompleteCode(clean)) return;
    window.localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ code: clean, name }));
  } catch {
    /* see readRememberedInstitute */
  }
}

export function forgetInstitute(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBERED_KEY);
  } catch {
    /* see readRememberedInstitute */
  }
}

/**
 * The only thing a failed student sign-in ever says.
 *
 * Unknown id, wrong institute, not yet claimed, locked — one sentence for all of
 * them, because any difference is an oracle for "does this id exist at this
 * institute". The forms show it verbatim rather than writing something friendlier
 * of their own, for the same reason.
 */
export const GENERIC_DETAILS_MISMATCH = "Details don't match.";

/** Shown when the code itself is refused, which is not the same question. */
export const INVALID_CODE_MESSAGE = "We don't recognise that institute code.";

/** An institute that has not finished setup yet. */
export const INSTITUTE_NOT_READY = "This institute hasn't finished setting up yet.";

/**
 * Where to send somebody once they are signed in.
 *
 * An institute whose status is still `setup` has an owner who has just created it
 * and nothing else done, so landing them on a dashboard full of zeroes is the wrong
 * first impression; they go to setup instead. Students have one home and no setup
 * to do.
 */
export function landingPath(session: Pick<Session, "role">, instituteStatus?: string): string {
  if (session.role === "student") return "/me";
  return instituteStatus === "setup" ? "/setup" : "/";
}

export function isInstituteRole(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "staff";
}