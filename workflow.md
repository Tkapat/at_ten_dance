# FaceTrack (`at_ten_dance`) — workflow, stack and reference

**Read this first.** It is the map of the project: what the system is, what it is
built with, how a request or a video frame travels through it, how to run and
ship it, and where every number you might need for a write-up or a demo lives.

Deep detail lives in the two component READMEs — this file points at them rather
than repeating them:

| Question | Look in |
| --- | --- |
| Recognition rules, gates, frame protocol, tuning, limitations | `backend/README.md` |
| Routes, conventions, overlay, PWA, design tokens | `frontend/README.md` |
| Every environment variable, with comments | `backend/.env.example`, `frontend/README.md` |
| SQL arithmetic, checked by hand | `backend/sql/verify.sql` |

---

## 1. What the project is

An **admin-only, camera-based attendance system**. An administrator signs in,
enrols students once from a webcam, and then points a camera at the room: the
live view names each person it recognises and writes an attendance row for them,
exactly once per day. Dashboards, per-student heatmaps and monthly analytics are
read straight out of SQL.

Deliverable for **SIH 2026**. There is **no student-facing app and no self
sign-up** — the only account is the seeded admin.

**Design brief it was built against** (the three priorities everything is judged on):

1. Minimalist, professional visual design with **purposeful motion only**.
2. The live overlay runs at **60 fps with zero React re-renders per frame**.
3. Numbers are **correct** — no stale or misleadingly rounded values, and every
   screen has explicit loading, empty and error states.
4. Mobile-first **PWA** (installable, offline shell).

---

## 2. Features the admin can use

Everything below ships **today**: one admin account, seven screens, no
student-facing side. Navigation order (mobile tab bar: Home, Scan, Register,
Analytics, Settings — Register is a floating action button).

### Sign in — `/login`

- Username + password with a show/hide toggle; the button unlocks only from 8
  characters.
- Sends you back to the page you originally asked for (`?next=`).
- No self sign-up — stated in the login footer and again in Settings.

### Dashboard — `/`

- **Four stat cards**: present today (with % of enrolled, or "Not recorded
  today" on an off day), absent today (turns red on a working day), this month's
  %, and total enrolled.
- **Today's attendance** ring with a present/absent legend; Sundays and holidays
  show an "Off day" pill instead of a rate.
- **By department · current month**: rate plus present/working days per
  department with a colour-coded bar.
- **Health strip**: live/unreachable dot, active model, measured ms/frame,
  gallery size, database connection, and a Retry button when it fails.
- **Register** and **Start scanning** shortcuts in the header.
- Refreshes every 5 s (summary, students) and 30 s (groups, health).

### Students (card on the Dashboard)

- **Search** by name or enrollment number (250 ms debounce).
- **Filters**: degree, section, year, and today's status (present / late /
  excused / absent). *Clear filters* appears only when something is active.
- Each row: initials, name, enrollment, `degree · department · section · year`,
  today's status dot, this month's % — and it **flashes when that student is
  newly marked**.
- **Quick view** (click a row): profile summary, month ring, present/working
  days, with **Re-enroll face** and **Open profile** actions.
- *Show more* pagination (6 rows, then +12), always alphabetical; empty states
  offer *Clear filters* or *Register student*.

### Student profile — `/students/[id]`

- Header with today's status and the three actions: **Edit**, **Re-enroll**,
  **Delete**.
- **This month** and **this year** rings with present/working days.
- **Attendance calendar**: month picker (prev/next plus *This month*), six
  states — present, late, excused, absent, Sunday, holiday — with a legend and a
  label per day.
- **Daily records** for the chosen month: date, weekday, status, **first-seen
  time** and **confidence %**.
- **Month by month**: 12 bars for the year, hover for the exact percentage.
- **Edit** name, enrollment number, degree, section, department and year with
  inline validation and a success toast.
- **Delete** behind a confirm modal that spells out that face embeddings *and*
  attendance history are removed, with no way back.

### Analytics — `/analytics`

- Compare by **Department / Degree / Section / Year** and step through months
  (bounded Jan 2024 → current month).
- Tiles: overall %, number of groups, highest and lowest.
- Bar chart coloured by rate (lowest group in red), 0–100 axis, tooltip with the
  exact %, plus a ranked list tagged *Highest* and *Lowest*.

### Live scan — `/scan`

- Start/stop the camera; status chip (off / starting / connecting / live /
  offline), an `ms · fps · faces` readout, and actionable hints — "Move closer",
  "Improve lighting", "Face the camera".
- **Canvas overlay** draws corner brackets, name and confidence, or
  "Scanning…" / "Unknown" per face at 60 fps without re-rendering React.
- **Marked today** list: name, enrollment, first-seen time, status tag and
  confidence — the newest mark flashes; 5 s refresh while live, 15 s when idle.
- Failures are specific (session expired, service unreachable, HTTPS required,
  camera permission blocked, no camera) and the socket reconnects with backoff.

### Enrolment — `/register`

- Three-step wizard: **Details → Capture → Review**.
- **Details**: name, enrollment number, degree, section, department, year, all
  validated inline.
- **Capture**: oval framing guide, live face box, pose prompt, one
  high-priority guidance message, a 4 × 3 pose plan (front / left / right / up),
  **Skip this angle** and **Pause**; *Continue* stays locked until **≥ 8 good
  frames across ≥ 3 poses**.
- **Review**: details, thumbnails with pose captions, coverage chips, then
  **Register student**.
- **Duplicate detection**: a 409 shows *Already registered* with the matched
  student and similarity, offering *Open existing profile* or *Use a different
  enrollment number*.
- **Re-enroll mode** (`/register?student=<id>`) prefills everything and replaces
  only the face.
- The success card reports usable frames, pose count and gallery size.

### Settings — `/settings`

| Section | What the admin can do |
| --- | --- |
| Account | change the password with a live strength meter (current password required) |
| Recognition | hot-swap `buffalo_s` ↔ `buffalo_l`; tune **six sliders** — similarity, margin, votes needed, vote window, minimum face size, recheck interval — with draft, Reset and Save |
| Camera | choose the preferred camera device and mirror the preview (frames sent for recognition are never flipped) |
| Holidays | add a holiday (date + name) and remove one from the list |
| Appearance | Light / Dark / System |
| Service | Live/Mock tag, reachability, REST base, socket URL, active model, gallery size, manual Refresh |

### Cross-cutting

- Theme from the top bar or Settings; account menu with **Sign out**.
- Every card and list has **loading skeletons, empty states, and error +
  Retry**; failures surface the server's own message in a toast.
- Session expiry anywhere redirects to `/login?next=…`.
- Mobile-first: tab bar plus a floating Register button, dialogs become bottom
  sheets under 768 px, touch targets ≥ 44 px, `aria-label`s on every icon-only
  control.

### Destructive actions and their guards

| Action | Guard |
| --- | --- |
| Delete a student | confirm modal, states that history is removed, not undoable |
| Remove a holiday | one click, toast only |
| Save new face / re-enroll | replaces the student's face, no confirmation |
| Switch recognition model | applies to the live service immediately |
| Change password | requires the current password and a matching confirmation |
| Sign out | no confirmation, clears cached data |

### Not in the UI yet

- **No export** anywhere (CSV, print, share).
- **No manual attendance correction or undo** — attendance is written only by
  the camera.
- **No bulk actions** and no archive/reactivate; delete is permanent.
- **No keyboard shortcuts** beyond arrow keys inside segmented controls.
- Two backend capabilities are wired but unused: `GET /api/register/options`
  (the UI keeps its own degree/department/pose constants) and the health
  `sessions` / `uptime` fields.

---

## 3. Repository layout

```
at_ten_dance/
├── workflow.md          ← this file (project root)
├── backend/             Python / FastAPI face service          (not a git repo yet)
│   ├── app/             the service: engine, tracker, routers, auth, SQL client
│   ├── scripts/         selftest, api_test, eval, seed_admin, webcam_test
│   ├── supabase/        migrations → the single source of schema truth
│   ├── sql/verify.sql   seeds a cohort and checks the arithmetic by hand
│   ├── .env             real secrets — gitignored, never committed
│   └── .env.example     every variable, documented
└── frontend/            Next.js 16 admin console               (the only git repo)
    ├── app/             routes (App Router), API route handlers
    ├── components/      dashboard, scan, register, analytics, settings, ui
    ├── hooks/           camera, WebSocket, session, capture
    ├── lib/             api client, mock adapter, overlay, schemas, formats
    ├── proxy.ts         Next 16 middleware: guards every app route
    └── .env             JWT_SECRET + API URL — gitignored
```

> **Version control:** only `frontend/` contains `.git` (remote
> `https://github.com/Tkapat/at_ten_dance.git`). **`backend/` and `workflow.md`
> are not tracked anywhere** — they live only on this machine. Create a
> repository at the project root if you want the whole system under source
> control. `backend/.env` and `frontend/.env` are ignored by their `.gitignore`
> files, so committing the rest is safe.

---

## 4. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend framework | **Next.js 16.3.8** (App Router, Turbopack) | `proxy.ts` replaces `middleware.ts` in Next 16 |
| UI | **React 19.2.8**, TypeScript 5 | React Compiler rules enforced by lint |
| Styling | **Tailwind CSS 4** (CSS-first), design tokens in `app/globals.css` | Indigo accent, `rounded-2xl` cards, ≥44 px touch targets |
| Motion | **framer-motion 14** | Page/sheet transitions only, never per-frame |
| Data fetching | **@tanstack/react-query 5** | loading / empty / error state on every screen |
| Charts | **recharts 3** | analytics + student year view |
| Forms | **react-hook-form 7 + zod 4** (`@hookform/resolvers`) | schemas in `lib/schemas.ts` |
| Icons / toast / theme | **lucide-react**, **sonner**, **next-themes** | |
| Primitives | **Radix UI** + **vaul** (sheets) | |
| JWT in the browser | **jose 6** | signing and verification both happen in Next |
| Package manager | **pnpm 10.33** | `frontend/pnpm-workspace.yaml` |
| Backend framework | **FastAPI 0.115.6** + **uvicorn 0.34** | Python 3.10/3.11 |
| Face models | **InsightFace 0.7.3** — `buffalo_l` (SCRFD detect + ArcFace 512-d) | runs on **CPU** via **onnxruntime 1.20** |
| Vision / maths | **opencv-headless**, **numpy 1.26**, **scipy 1.14** | Hungarian association, Laplacian sharpness |
| Auth (backend) | **PyJWT** (HS256) + **bcrypt** for the stored password | 7-day token |
| HTTP client | **httpx** → Supabase **PostgREST** | the service never speaks SQL directly |
| Database | **Supabase Postgres** (project `at_ten_dance`, ref `uglqliwaftxnmksqyhqr`) | schema from `supabase/migrations/` |
| Deploy (frontend) | **Vercel** → <https://at-ten-dance.vercel.app> | |
| Tunnel (backend) | **ngrok 3.39** static domain → <https://leisa-nondisrupting-uncruelly.ngrok-free.dev> | HTTPS is required for camera access |
| Migrations / CLI | **Supabase CLI** (`supabase link`, `supabase db push`) | |

**Why the backend owns the model.** Everything that touches a camera or a neural
network lives in Python; the browser only ever encodes JPEGs and draws boxes.
The frontend never connects to Postgres and never computes a percentage.

---

## 5. Architecture — who talks to whom

```
                       ┌──────────────────────────────────────────┐
   admin browser       │  Next.js (Vercel or localhost:3000)      │
  ┌──────────────┐     │                                          │
  │ dashboard    │────▶│  /api/auth/{login,logout,token}           │  sets/reads the httpOnly
  │ students     │     │  proxy.ts  → guards every app route      │  `ft_token` cookie
  │ analytics    │     └───────────────┬──────────────────────────┘
  │ settings     │                    │  fetch with `Authorization: Bearer <jwt>`
  └──────┬───────┘                    ▼
         │                       ┌──────────────────────────────┐
         │  GET /api/auth/token  │  FastAPI  :8000              │
         │  (raw jwt, once)      │                              │
         │                       │  routers: auth, reports,     │
         │  WebSocket            │    admin, register, health   │
         └──────────────────────▶│  app/session.py   ← frame loop│
                                 │  app/face_engine.py (InsightFace)
                                 │  app/tracker.py    (Hungarian ids)
                                 │  app/attendance.py (write-once)
                                 └───────────────┬──────────────┘
                                                 │ httpx, service-role key
                                                 ▼  (PostgREST)
                                       ┌──────────────────────┐
                                       │  Supabase Postgres   │
                                       │  7 tables, 1 view,   │
                                       │  4 RPC functions     │
                                       └──────────────────────┘
```

**Two different call paths, deliberately:**

- **REST** — the browser always calls the Next API route for sign-in (so the JWT
  stays in an httpOnly cookie it cannot read), then fetches the raw token from
  `GET /api/auth/token` once and sends it as `Authorization: Bearer` to FastAPI.
- **WebSocket** — `WS {API_BASE}/ws/recognize?token=…`, because browsers cannot
  set headers on a WebSocket handshake.

**Everything is signed with one secret.** `JWT_SECRET` must be **byte-identical**
in `backend/.env` and `frontend/.env`, or the cookie the frontend mints is
rejected by the backend.

---

## 6. Runtime workflows

### 6.1 Sign-in

1. `POST /login` → the Next route handler validates the form, then (real build)
   **forwards to the backend's `POST {API_BASE}/api/auth/login`**, which checks
   the bcrypt hash on `admin_account` and mints a 7-day HS256 token. Next stores
   that exact token in an httpOnly cookie, so the cookie always holds something
   the backend itself will accept. In mock build the check happens locally
   against the demo credentials instead.
2. `proxy.ts` verifies the cookie locally (no network) on every app navigation
   and redirects to `/login` — with `?next=…` for the page you asked for — when
   it is missing or expired. It is a redirect helper, not a security boundary:
   every API call is authorised again server-side.
3. Data calls resolve the token through `lib/token.ts` (`getToken()` →
   `ensureToken()`), so the first paint never races ahead of the session and
   gets bounced to login.

### 6.2 Live recognition (`/scan`)

1. `hooks/use-face-stream.ts` opens the WebSocket, captures from
   `getUserMedia`, and encodes a 640 px JPEG per frame.
2. **Ack pacing:** one frame is in flight at a time; the next is sent only after
   the server replies (~110 ms cadence), so latency can never accumulate.
   Reconnects use exponential backoff.
3. Server side per frame: decode → downscale → **SCRFD** → Hungarian IoU
   association (velocity coasting keeps track ids stable) → gate (size, score,
   yaw) → **ArcFace** embedding only for tracks that need one → 512×N matmul
   against the whole gallery as one NumPy multiply.
4. A track is only named when **all** of: gate passes, cosine ≥
   `SIM_THRESHOLD`, winner leads the best *different* student by ≥ `MARGIN`,
   and the same id appears in ≥ `VOTES_NEEDED` of the last `VOTE_WINDOW`
   embeddings. One identity per frame; the loser is demoted to `unknown`.
5. On first confirmation an `event` comes back → `AttendanceWriter.claim()`
   reserves `(student_id, IST date)` in memory → a background queue drains it →
   `upsert … on conflict do nothing`. Three independent mechanisms guarantee
   **one row per student per day**.
6. Browser: `lib/overlay.ts` draws boxes and name pills on a canvas in a
   `requestAnimationFrame` loop (lerp 0.35). **React never renders per frame**;
   the panel numbers update at ≈4 Hz from throttled aggregates.

### 6.3 Enrolment (`/register`)

Details form → guided capture → review/commit.

- `POST /api/register/check` runs at ~4 fps and returns gate results as
  student-facing copy: exactly one face, ≥110 px, detector ≥0.7,
  Laplacian ≥60, mean brightness 70–200, ≥6 px margin on every side.
- `POST /api/register/commit` re-checks every frame, buckets frames into poses
  (front/left/right/up/down — up/down relative to the submitter's own median),
  keeps ≤4 per pose, requires **≥8 good frames across ≥3 poses**, drops
  outliers (<0.5 to the centroid), and **refuses duplicates at >0.6 similarity
  with `409` naming the existing student**.
- Only **512-float embeddings** are stored. No image, no video, ever.

### 6.4 Reading reports (`/`, `/analytics`, `/students/[id]`)

React Query → `GET /api/reports/*` → FastAPI → PostgREST → SQL.
**Every percentage is computed in the database** (`v_student_month`,
`attendance_by_group`, `student_yearly`, `student_daily`); the frontend only
formats. Absent is never stored — it means a working day with no row.
Holidays and weekends are excluded by `f_working_days()`; the day boundary is
**IST (`Asia/Kolkata`)**.

### 6.5 Day-to-day operations

| Task | Route | Backend |
| --- | --- | --- |
| Today's counts, group rates, service health | `/` | `/api/reports/summary`, `/api/attendance/today`, `/api/health` |
| Find / edit / delete a student | `/students/[id]` | `/api/reports/student/{id}`, `/api/students/{id}` |
| Monthly rates by department/degree/section/year | `/analytics` | `/api/reports/groups` |
| Live attendance | `/scan` | `WS /ws/recognize` |
| Enrol or re-enrol | `/register` | `/api/register/*` |
| Thresholds, model swap, holidays, password | `/settings` | `/api/config`, `/api/holidays`, `/api/auth/password` |

---

## 7. Running it locally (first time)

```bash
# ── database (once) ─────────────────────────────────────────────
cd backend
supabase link --project-ref uglqliwaftxnmksqyhqr
supabase db push                       # applies supabase/migrations/ in filename order
cp .env.example .env                   # fill SUPABASE_URL, SUPABASE_SERVICE_KEY
python -m scripts.seed_admin           # reads ADMIN_USERNAME / ADMIN_PASSWORD

# ── backend ─────────────────────────────────────────────────────
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# --env-file is REQUIRED: the service never calls load_dotenv()
uvicorn app.main:app --host 0.0.0.0 --port 8000 --env-file .env

# ── frontend (second terminal) ─────────────────────────────────
cd frontend
pnpm install
# .env must contain: NEXT_PUBLIC_USE_MOCK=false
#                    NEXT_PUBLIC_API_URL=http://localhost:8000
#                    JWT_SECRET=<identical to backend/.env>
pnpm dev                                # http://localhost:3000
```

Check both: `curl -s localhost:8000/api/health` and open
<http://localhost:3000>. Backend OpenAPI at `http://localhost:8000/docs`.

**Editing `.env` later?** `NEXT_PUBLIC_*` values are inlined at build time, so
restart `pnpm dev` (and redeploy Vercel) after changing them. The backend only
reads its environment at start-up, so restart uvicorn too.

---

## 8. Deployment, and the four gotchas that cost time

Current live setup: **frontend on Vercel**, **backend on the laptop behind a
free ngrok static domain**.

| Where | Value |
| --- | --- |
| Production URL | <https://at-ten-dance.vercel.app> |
| API tunnel | <https://leisa-nondisrupting-uncruelly.ngrok-free.dev> |
| Vercel env (Production + Preview) | `NEXT_PUBLIC_USE_MOCK=false`, `NEXT_PUBLIC_API_URL=https://leisa-nondisrupting-uncruelly.ngrok-free.dev`, `JWT_SECRET` (Secret) |
| `backend/.env` | `FRONTEND_ORIGIN=https://at-ten-dance.vercel.app` (no trailing slash), `EXTRA_ORIGINS=http://localhost:3000,http://127.0.0.1:3000` |

1. **Trailing slash on `FRONTEND_ORIGIN`** → Starlette answers
   `400 Disallowed CORS origin` with no `access-control-allow-origin` header,
   which the browser reports as a CORS block. `config.py::allowed_origins()`
   now strips slashes, but keep the value clean anyway.
2. **ngrok free-tier interstitial.** ngrok serves an HTML warning page to
   browser requests on the free plan, which also surfaces *as* a CORS error.
   Fix: send the documented `ngrok-skip-browser-warning: 1` header — it is set
   in `lib/api.ts` and allowed in `main.py` `allow_headers`.
   **WebSockets are unaffected**: the handshake passes through (`101`) over
   HTTP/1.1, and a browser cannot send custom headers there anyway.
3. **`NEXT_PUBLIC_*` is compiled in.** Changing an env var on Vercel does
   nothing until you **redeploy**.
4. **`--env-file .env`** for uvicorn, always. Without it the backend starts with
   an empty configuration and every request fails.

Deploy after code changes:

```bash
cd frontend
git add <files> && git commit -m "…" && git push   # Vercel auto-deploys on push
# or, without git integration:  npx vercel --prod
```

---

## 9. Day-to-day development workflow

1. **Read the rules before editing.** `frontend/AGENTS.md` is re-generated by
   `next dev` — Next 16 has breaking changes; the guides it points at live in
   `node_modules/next/dist/docs/`.
2. **Change code** following the existing conventions (React Compiler lint:
   no `setState` in an effect body, no ref reads/writes during render, destructure
   hook returns before passing `ref=`).
3. **Verify, in this order:**

   ```bash
   # frontend
   npx tsc --noEmit        # types
   pnpm lint               # ESLint + React Compiler rules
   pnpm build              # production build (does NOT run lint)

   # backend
   python scripts/selftest.py    # 51 checks — no camera, no database
   python scripts/api_test.py    # 55 checks — real app, Postgres stubbed
   ```

4. **Commit** only what you intended (`git status` / `git diff` first). Never
   commit `.env`. The `AGENTS.md` block is meant to be committed.
5. **Deploy** (`git push` or `npx vercel --prod`), restart uvicorn if backend
   files changed, then re-check the live URL.
6. **Docs and this file** are updated in the same change as the behaviour they
   describe.

---

## 10. Testing

| Command | What it proves | Cost |
| --- | --- | --- |
| `python scripts/selftest.py` | tracker ids, voting, guards, registration gates, throughput | 51 checks, no camera/DB |
| `python scripts/api_test.py` | the whole HTTP surface: bearer auth, sign-in, password rotation, reports, WS handshake + frame protocol, registration, duplicate 409, re-enrol, one attendance row across 25 frames, cascade delete, settings persistence | 55 checks, Postgres stubbed in memory |
| `python scripts/multiface_check.py --synthetic` | multi-face headline requirement with look-alikes | real models, a few seconds |
| `python scripts/webcam_test.py --headless` | live yaw / vertical probe against your own cohort | camera |
| `python scripts/eval.py --sweep` | threshold evidence (FAR/FRR + margin) from real decisions | uses `recognition_log` |
| `backend/sql/verify.sql` | the SQL percentages, checked by hand | PostgreSQL |
| `npx tsc --noEmit` / `pnpm lint` / `pnpm build` | frontend correctness | CI-equivalent |

`multiface_check.py --faces a.jpg b.jpg c.jpg` is the one to run with **three
real people** before quoting multi-person numbers — the synthetic version has
been run, the genuine three-person version has **not** (only one face image was
available here).

---

## 11. Data model

**Tables** — `admin_account`, `students`, `face_embeddings`, `attendance`,
`holidays`, `app_settings`, `recognition_log`.
Indexing: `attendance(date)`, `attendance(student_id)`,
`face_embeddings(student_id)`, `recognition_log(ts)` / `(student_id)`.

**Schema is SQL-only.** `supabase/migrations/` is the single source of truth
(two files, applied in filename order):

| Migration | Purpose |
| --- | --- |
| `20261003042200_init.sql` | 7 tables, `f_working_days()`, `v_student_month`, `attendance_by_group`, `student_yearly`, `student_daily`, indexes |
| `20261003050000_fix_yearly_and_grants.sql` | fixes `student_yearly` (was joining on `a.date = month_start`, so only the 1st of each month counted) and `v_student_month` (cross-joined an empty working-days row when the 1st was a non-working day); adds `GRANT`s to the view and the four RPCs |

**Privacy.** Service-role key is server-only; no face images or video are
stored; embeddings and JWTs are never logged; `recognition_log` keeps
similarity values only so thresholds can be re-tuned later.

---

## 12. API surface (condensed)

Public: `GET /api/health`, `GET /api/version`, `GET /api/register/options`,
`POST /api/auth/login`. Everything else needs
`Authorization: Bearer <jwt>` (WebSocket: `?token=`).

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/password` |
| Reports | `GET /api/reports/summary`, `/students`, `/groups`, `/student/{id}`, `/student/{id}/days`, `/student/{id}/year` |
| Registration | `POST /api/register/check`, `/commit`, `/reenroll/{id}` |
| Students | `GET/POST/PUT/DELETE /api/students[/{id}]` |
| Config | `GET/PUT /api/config`, `POST /api/config/model?model=` |
| Holidays | `GET/POST/DELETE /api/holidays[/{date}]` |
| Today | `GET /api/attendance/today` |
| Live | `WS /ws/recognize?token=` |

Responses the browser reads are **camelCase**; anything going back to Postgres
stays **snake_case**. `backend/app/serialize.py` is the conversion point.
The full table, plus the exact WebSocket message shape, is in
`backend/README.md` → *API*.

---

## 13. Key configuration values

| Variable | Default | Meaning |
| --- | --- | --- |
| `MODEL` | `buffalo_l` | `buffalo_s` is roughly 8× faster on CPU, less accurate |
| `DET_SIZE` | `640` | detector never sees more than 640 px |
| `SIM_THRESHOLD` | `0.45` | minimum cosine similarity to accept a face |
| `MARGIN` | `0.06` | how far ahead the winner must be over the best *other* student — this is the lookalike guard |
| `VOTES_NEEDED` / `VOTE_WINDOW` | `3` / `5` | confirmations needed out of the last five embeddings |
| `MIN_FACE_PX` | `80` | smallest face worth embedding (registration requires 110 px) |
| `RECHECK_SECONDS` | `5` | re-check interval for an already confirmed track |
| `ORT_THREADS` / `INFERENCE_CONCURRENCY` | `4` / `2` | deliberately capped — using every core measured ~2× slower |
| `MARK_LATE_AFTER_MINUTES` | `0` | minutes past midnight before a mark becomes `late` (`0` disables) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `facetrack` | read **once** by `scripts/seed_admin.py`, never by the server |

Do not guess `SIM_THRESHOLD` — sweep it with `scripts/eval.py --sweep`.

---

## 14. Numbers worth quoting

**Performance** (measured, `buffalo_l`, `DET_SIZE=640`, `ORT_THREADS=4`, 8 CPU
cores with background load):

| Situation | Cost |
| --- | --- |
| Steady state, nothing to embed | **~150 ms/frame (6.6 fps)** |
| One face being identified | ~200 ms/frame (5 fps) |
| Three faces identified in one frame | ~330 ms/frame, dropping to ~150 ms once settled |
| Six faces identified in one frame | ~550 ms/frame (1.8 fps) |
| Same six with `buffalo_s` | ~70 ms/frame |
| First identification of a clear frontal face ≥110 px | **≈0.5 s** (target: 1 s) |
| Frame composition | SCRFD 150 ms · ArcFace 67 ms/face · association, gate, gallery matmul all <1 ms |
| UI overlay | 60 fps canvas, **0 React renders per frame**, panel numbers at ≈4 Hz |

**Correctness and coverage:**

- Attendance written **exactly once per student per day** (in-memory claim +
  background queue + `on conflict do nothing`), asserted across 25 frames in
  `api_test.py`.
- **51** self-test checks + **55** API checks, all passing.
- Every screen has explicit loading / empty / error states; `pnpm build`
  produces 13 routes.
- Multi-face: stable track ids, one identity per frame, no double marking,
  unknowns settle without writing attendance.

**Evaluation output** (two-person set where the "second person" is a mirror of
the first — genuine 1.000 vs impostor 0.960): the margin rule alone refuses the
impostor, which is why `MARGIN` is reported separately from the threshold.

---

## 15. Invariants — do not regress these

- **No React re-render per frame** on `/scan`; the overlay is a canvas.
- **No percentage computed in the frontend.** SQL is the source of truth.
- **Exactly one attendance row per student per day**, IST day boundary.
- **No face images stored** — 512-float embeddings only.
- **One `JWT_SECRET`** shared byte-for-byte by both halves.
- **`frontend/` never talks to Postgres** and never holds the service-role key.
- Every screen: loading, empty and error states.
- Colour is never the only signal (6 px status dots always have a label);
  touch targets ≥44 px; numbers use `tabular-nums`.

---

## 16. Demo sheet

| Item | Value |
| --- | --- |
| Admin login | **admin / facetrack** (mock mode uses the same credentials) |
| App | <https://at-ten-dance.vercel.app> |
| API | <https://leisa-nondisrupting-uncruelly.ngrok-free.dev> (`/api/health` → 200) |
| Local frontend | <http://localhost:3000> (`pnpm dev`) |
| Local API | <http://localhost:8000> (`/docs` for OpenAPI) |
| Supabase project | `at_ten_dance`, ref `uglqliwaftxnmksqyhqr` — service-role key **only** in `backend/.env` |
| Screens to show | `/` dashboard → `/analytics` → `/students/{id}` → `/register` (capture) → `/scan` (live names) → `/settings` |
| Talking points | CPU-only models; write-once attendance; margin rule vs lookalikes; all analytics in SQL; privacy (no images) |
| Known caveat to disclose | three-real-people multi-face run and anti-spoofing/liveness are not yet done |

---

## 17. Known limitations and next steps

- A printed photo can fool 2D recognition — liveness/anti-spoofing is a planned
  upgrade, not a bug in the current code.
- Accuracy is bounded by enrolment quality; re-enrol anyone registered in poor
  light or at one angle.
- `vertical_ratio` thresholds are measured defaults — re-probe them for the
  actual cohort.
- Three-real-person multi-face verification and `python scripts/eval.py`
  against a genuine cohort are still outstanding.
- `backend/` is not under version control; a root repository would fix that.

---

*Last updated: 2026-10-03. When this file disagrees with the code, the code is
right — update this file.*
