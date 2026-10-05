# FaceTrack — admin console

Next.js 16 (App Router) front end for the FaceTrack face-recognition attendance
service. Admin only: there is no self sign-up anywhere in this UI.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000 — mock data unless .env sets otherwise
```

Demo sign-in in mock mode: **admin / facetrack**.

Point at a live backend (`.env`, not `.env.local`, so a clone behaves the same
way; `NEXT_PUBLIC_*` is inlined at compile time, so restart `pnpm dev` after
editing it):

```bash
#   NEXT_PUBLIC_USE_MOCK=false
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   JWT_SECRET=<the same value as backend/.env>
pnpm dev
```

Sign-in then goes through `POST {API_BASE}/api/auth/login`; the backend must be
running with the same `JWT_SECRET`, or the cookie it returns will be rejected.

| Script            | What it does                                  |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | dev server                                    |
| `pnpm build`      | production build (does **not** run ESLint)    |
| `pnpm start`      | serve the production build                    |
| `pnpm lint`       | ESLint, including the React Compiler rules    |

Type-checking is `npx tsc --noEmit`.

## Routes

| Path              | Screen                                                             |
| ----------------- | ------------------------------------------------------------------ |
| `/login`          | Sign in (redirects to `?next=` when it was forced)                 |
| `/`               | Dashboard: today's counts, group rates, health, quick student list |
| `/scan`           | Live recognition overlay                                            |
| `/register`       | Guided enrolment: details → capture → review                       |
| `/analytics`      | Monthly attendance by department / degree / section / year         |
| `/students/[id]`  | Student detail, heatmap, month-by-month, edit / delete             |
| `/settings`       | Account, recognition, camera, holidays, appearance, service        |

All app routes sit behind `proxy.ts` (Next 16's middleware), which validates the
session cookie and redirects to `/login`.

## Features

What the admin can actually do today — seven screens, one account, no
student-facing side.

**Dashboard `/`** — present/absent/this-month/enrolled stat cards (with an
"Off day" state on Sundays and holidays), a today's-attendance ring, per-department
rates for the current month, a health strip (model, ms/frame, gallery, database,
Retry), and Register / Start scanning shortcuts. Polls at 5 s and 30 s.

**Students (card on the dashboard)** — search by name or enrollment, filter by
degree / section / year / today's status, clear filters when active. Rows show
today's status and this month's %, and flash when a student is newly marked. A
click opens a quick view with *Re-enroll face* and *Open profile*. Six rows at a
time, *Show more* by 12.

**Student profile `/students/[id]`** — month and year rings, a month-by-month
calendar with all six states (present, late, excused, absent, Sunday, holiday),
daily records with first-seen time and confidence %, a 12-bar year chart, plus
**Edit** (name, enrollment, degree, section, department, year), **Re-enroll** and
**Delete** behind a confirm modal that warns embeddings and attendance history
are removed permanently.

**Analytics `/analytics`** — group attendance by department / degree / section /
year, month stepping back to Jan 2024, overall/highest/lowest tiles, a colour-coded
bar chart and a ranked list.

**Scan `/scan`** — start and stop the camera, live canvas overlay naming each
face with confidence at 60 fps (no React re-render), a `ms · fps · faces`
readout, coaching hints, and a *Marked today* list showing first-seen time,
status and confidence that updates as people are recognised. Specific error
messages for expired sessions, an unreachable service, missing HTTPS, blocked
permissions and absent hardware.

**Register `/register`** — a three-step wizard (details → capture → review) with
an oval framing guide, a live face box, a 4 × 3 pose plan, one high-priority
guidance message, Skip this angle and Pause. *Continue* is locked until **≥ 8
good frames across ≥ 3 poses**. Duplicate enrolments come back as *Already
registered* with the matched student and similarity. `/register?student=<id>`
re-enrols an existing student with every field prefilled.

**Settings `/settings`** — change password (live strength meter, current
password required), hot-swap `buffalo_s` ↔ `buffalo_l`, six recognition sliders
with draft/Reset/Save, preferred camera and mirror toggle, holiday add/remove,
Light/Dark/System theme, and a service card showing Live or Mock mode, endpoint
URLs, active model and gallery size with a manual Refresh.

Every card and list has loading, empty and error-plus-Retry states; failures
toast the server's message. Session expiry anywhere redirects to `/login?next=`.

**Not built yet:** no export (CSV/print/share), no manual attendance correction
or undo, no bulk actions or archive (delete is permanent), no keyboard shortcuts
beyond segmented controls.

## Data layer

- `lib/api.ts` exports `api(): FaceTrackApi`. `USE_MOCK` selects the built-in
  mock adapter (`lib/mock.ts`) or the real adapter (`fetch` against
  `NEXT_PUBLIC_API_URL`).
- `lib/token.ts` / `lib/session.ts`: the cookie is httpOnly. The client fetches
  the raw token from `GET /api/auth/token` and sends it as `Authorization:
  Bearer` (REST) or `?token=` (WebSocket) — browsers cannot set headers on a WS
  handshake.
- Lists and summaries are read through `@tanstack/react-query`; every screen has
  explicit loading, empty and error states.

## Live overlay

- `hooks/use-face-stream.ts` opens `WS {WS_BASE}/ws/recognize?token=`, encodes
  the camera frame to JPEG and paces sends on server acks (~110 ms), with
  exponential reconnect backoff.
- `lib/overlay.ts` is a standalone `FaceOverlay` class: it maps normalized
  `[x, y, w, h]` boxes to device pixels, lerps every frame at ~0.35 and draws
  corner brackets + name pills in a `requestAnimationFrame` loop.
- **No React render happens per frame.** The overlay is a canvas; React only
  re-renders on throttled aggregates (≈4 Hz) for the panel numbers.

## Conventions

- Tailwind 4 (CSS-first) + design tokens in `app/globals.css`. Indigo accent,
  6px status dots with labels (colour is never the only signal), `tabular-nums`
  everywhere a number changes.
- Cards `rounded-2xl`, inputs/buttons `rounded-xl`, sheets/camera `rounded-3xl`;
  touch targets ≥ 44px; content max-width 1100px.
- React Compiler lint rules apply: no `setState` in an effect body, no ref
  reads/writes during render. Prefer event handlers, rAF/IO callbacks or
  `useSyncExternalStore`.
- Forms use `react-hook-form` + `zod` (`lib/schemas.ts`). Year fields are
  strings (`"1"`…`"4"`) in forms and converted on submit.
- `pnpm build` after route changes, then `npx next typegen` if `tsc` complains
  about a missing route type.

## PWA

`app/manifest.ts`, generated icons in `public/` and `public/sw.js` (registered
in production only). The service worker caches hashed build assets, images and
recent navigations — API and WebSocket traffic is never cached.
