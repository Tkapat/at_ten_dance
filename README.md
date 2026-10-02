# FaceTrack — admin console

Next.js 16 (App Router) front end for the FaceTrack face-recognition attendance
service. Admin only: there is no self sign-up anywhere in this UI.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000 — mock data by default
```

Demo sign-in in mock mode: **admin / facetrack**.

Point at a live backend:

```bash
cp .env.example .env.local
#   NEXT_PUBLIC_USE_MOCK=false
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   JWT_SECRET=<random hex>            # required in production
pnpm dev
```

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
