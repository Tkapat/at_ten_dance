/**
 * Turning a service error into one of ours.
 *
 * Every BFF route in `app/api/auth/*` talks to the service and then answers the
 * browser. When the service refuses, the browser needs two things: a sentence it
 * can show, and the machine-readable facts behind it. Most errors are just the
 * sentence, but a 429 carries `retryAfterSeconds` — and that is the difference
 * between "too many attempts, please wait a moment" and a countdown the person
 * can watch down to zero.
 *
 * `retryAfterSeconds` used to be dropped here, along with the `Retry-After`
 * header, because each route read only `detail.message`. The browser reads
 * `detail.message` too, so it was missing the one number it needed. Both are
 * passed through now, in one place, so no route has to remember.
 */

import { NextResponse } from "next/server";

/** The `{message}` shape every failure uses, plus whatever the service added. */
export interface ErrorBody {
  message: string;
  /** Present only on 429: how long to wait before trying again. */
  retryAfterSeconds?: number;
  /** Present when the service named the offending input. */
  field?: string;
  /** Present when the service listed per-row problems. */
  rejected?: string[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * The sentence inside a service error body.
 *
 * The service answers errors in two shapes: `{detail: {message}}` and, for its
 * own validation, `{detail: [issues]}`. Both are read here rather than guessed at
 * by each caller.
 */
export function detailMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const message = asString(detail) ?? asString((detail as { message?: unknown } | null)?.message);
  if (message) return message;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    return asString(first?.msg) ?? fallback;
  }
  return fallback;
}

/** How long a 429 asks the caller to wait, from the body or the header. */
function retryAfter(body: unknown, response: Response): number | undefined {
  const fromBody = (body as { detail?: { retryAfterSeconds?: unknown } } | null)?.detail
    ?.retryAfterSeconds;
  if (typeof fromBody === "number" && fromBody > 0) return Math.ceil(fromBody);
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * Answer the browser with the service's own error.
 *
 * `status` defaults to the service's, because a 403 from the service is a 403
 * here and re-deriving it would be a chance to disagree.
 */
export function serviceError(response: Response, body: unknown, fallback: string): NextResponse {
  const error: ErrorBody = { message: detailMessage(body, fallback) };

  const detail = (body as { detail?: Record<string, unknown> | null } | null)?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const field = asString(detail.field);
    if (field) error.field = field;
    if (Array.isArray(detail.rejected)) {
      error.rejected = detail.rejected.filter((r): r is string => typeof r === "string");
    }
  }

  const wait = retryAfter(body, response);
  if (wait) {
    error.retryAfterSeconds = wait;
    return NextResponse.json(error, {
      status: response.status || 429,
      headers: { "Retry-After": String(wait) },
    });
  }
  return NextResponse.json(error, { status: response.status || 500 });
}

/** An error of our own, for a check that never left the browser. */
export function localError(message: string, status: number, extra: Partial<ErrorBody> = {}): NextResponse {
  return NextResponse.json({ message, ...extra }, { status });
}