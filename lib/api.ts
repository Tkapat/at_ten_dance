import type {
  DashboardSummary,
  DayRecord,
  GroupStat,
  HealthStatus,
  Holiday,
  MarkedToday,
  RecognitionSettings,
  RegisterCheck,
  RegisterPayload,
  RegisterResult,
  Status,
  Student,
  StudentDetail,
  StudentRow,
  Track,
} from "./types";
import type { Degree, Pose } from "./constants";
import { API_BASE, USE_MOCK, WS_BASE } from "./env";
import { createMockApi } from "./mock";
import { clearToken, ensureToken, getToken } from "./token";

/**
 * One typed client for the whole app. Components never call `fetch`.
 *
 * `NEXT_PUBLIC_USE_MOCK !== "false"` (the default) serves the mock adapter so
 * every screen can be built and reviewed with no backend running. Setting it to
 * `false` switches every call to the real adapter, which talks to Next.js route
 * handlers / the FastAPI service with a bearer token read from the `ft_token`
 * cookie.
 */

export { API_BASE, USE_MOCK, WS_BASE } from "./env";

export type Segment = "department" | "degree" | "section" | "year";

export interface StudentFilter {
  search?: string;
  degree?: Degree | null;
  section?: string | null;
  year?: number | null;
  status?: string | null;
}

export interface YearPoint {
  month: string;
  presentDays: number;
  workingDays: number;
  pct: number;
}

export class ApiError extends Error {
  status: number;
  field?: string;
  issues?: string[];
  duplicate?: { message: string; studentId?: string; name?: string; similarity?: number };

  constructor(
    status: number,
    message: string,
    extra: { field?: string; issues?: string[]; duplicate?: ApiError["duplicate"] } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = extra.field;
    this.issues = extra.issues;
    this.duplicate = extra.duplicate;
  }
}

export interface FaceTrackApi {
  login(username: string, password: string): Promise<{ username: string }>;
  logout(): Promise<void>;

  summary(): Promise<DashboardSummary>;
  listStudents(filter?: StudentFilter): Promise<StudentRow[]>;
  getStudent(id: string): Promise<StudentDetail>;
  studentDays(id: string, month: string): Promise<DayRecord[]>;
  studentYear(id: string): Promise<YearPoint[]>;
  updateStudent(id: string, patch: Partial<Student>): Promise<Student>;
  deleteStudent(id: string): Promise<void>;

  analytics(segment: Segment, month: string): Promise<GroupStat[]>;

  registerOptions(): Promise<RegisterOptions>;
  registerCheck(
    frame: Blob,
    baseline?: number | null,
    targetPose?: Pose,
  ): Promise<RegisterCheck>;
  registerCommit(payload: RegisterPayload): Promise<RegisterResult>;
  reenroll(
    id: string,
    payload: RegisterPayload,
  ): Promise<RegisterResult>;

  recentlyMarked(): Promise<MarkedToday[]>;
  health(): Promise<HealthStatus>;

  getSettings(): Promise<RecognitionSettings>;
  saveSettings(patch: Partial<RecognitionSettings>): Promise<RecognitionSettings>;
  switchModel(model: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;

  getHolidays(): Promise<Holiday[]>;
  addHoliday(date: string, label: string): Promise<void>;
  removeHoliday(date: string): Promise<void>;

  /** The websocket the Scan page opens. Only available in the browser. */
  streamUrl(token: string): string;
}

export interface RegisterOptions {
  degrees: Degree[];
  departments: string[];
  sections: string[];
  poses: Pose[];
  poseLabels: Record<Pose, string>;
  posePrompts: Record<Pose, string>;
}

/* ------------------------------------------------------------------ real */

async function readToken(): Promise<string | null> {
  if (getToken()) return getToken();
  // A data query can reach here before `useSession` has cached the token.
  // Waiting for it avoids a 401 bounce to /login on the first paint;
  // `ensureToken` shares one in-flight request across every caller.
  return ensureToken();
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  base = API_BASE,
): Promise<T> {
  const token = await readToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Free ngrok tiers serve an HTML interstitial to browser requests, which the
  // browser then reports as a CORS error. This header is their documented opt-out.
  headers.set("ngrok-skip-browser-warning", "1");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Cannot reach the FaceTrack service.");
  }

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.replace(`/login?next=${next}`);
    }
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") throw new ApiError(res.status, detail);
    if (detail && typeof detail === "object") {
      const d = detail as Record<string, unknown>;
      const duplicate =
        res.status === 409 && typeof d.message === "string"
          ? {
              message: d.message,
              studentId: typeof d.student_id === "string" ? d.student_id : undefined,
              name: typeof d.name === "string" ? d.name : undefined,
              similarity: typeof d.similarity === "number" ? d.similarity : undefined,
            }
          : undefined;
      throw new ApiError(
        res.status,
        typeof d.message === "string" ? d.message : "Request failed.",
        {
          field: typeof d.field === "string" ? d.field : undefined,
          issues: Array.isArray(d.rejected) ? (d.rejected as string[]) : undefined,
          duplicate,
        },
      );
    }
    throw new ApiError(res.status, `Request failed (${res.status}).`);
  }

  return body as T;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Backend gate messages → the codes the capture UI renders. */
const ISSUE_PATTERNS: [RegExp, string][] = [
  [/no face detected/i, "no_face"],
  [/faces detected/i, "multiple_faces"],
  [/could not see your face clearly/i, "no_face"],
  [/needs at least \d+px/i, "too_small"],
  [/cut off by the frame edge/i, "off_center"],
  [/move back into frame/i, "off_center"],
  [/blurry/i, "blurry"],
  [/too dark/i, "too_dark"],
  [/too bright/i, "too_bright"],
];

function mapIssues(messages: string[]): { issues: RegisterCheck["issues"]; message?: string } {
  const issues: RegisterCheck["issues"] = [];
  for (const m of messages) {
    const hit = ISSUE_PATTERNS.find(([re]) => re.test(m));
    if (hit) issues.push(hit[1] as RegisterCheck["issues"][number]);
  }
  return { issues, message: issues.length === 0 ? messages[0] : undefined };
}

/* ----------------------------------------------------------- service shapes */

/**
 * The service is institute-scoped and schema-driven, which is why its payloads
 * do not look like this app's types: a student's login id is whichever column
 * the institute chose, the programme is a `course_code` that carries the degree
 * and department, and `year` is derived from the admission year rather than
 * stored. The mappings below fold the wire format into the app's own types, so
 * no component ever sees a field the app does not own.
 */
interface WireStudent {
  id: string;
  loginId: string;
  name: string;
  section: string;
  admissionYear: number | null;
  courseCode: string | null;
  degree: string | null;
  department: string | null;
  isActive: boolean;
  faceStatus: string;
  claimed: boolean;
  createdAt: string;
  extra: Record<string, unknown>;
}

/** A roster row: the same student plus the numbers SQL computes for today. */
interface WireRow extends WireStudent {
  year: number | null;
  todayStatus: string;
  monthPct: number;
  presentDays: number;
  workingDays: number;
}

interface WireDay {
  date: string;
  status: string;
  firstSeenAt: string | null;
  confidence: number | null;
}

interface WireColumn {
  key: string;
  label: string;
  type: string;
  required: boolean;
  system: boolean;
}

/** The service calls a weekly off day `off`; the app labels it by weekday. */
function dayStatus(value: string): Status {
  return (value === "off" ? "sunday" : value) as Status;
}

function mapRow(row: WireRow): StudentRow {
  return {
    id: row.id,
    enrollmentNo: row.loginId,
    name: row.name,
    degree: (row.degree ?? "") as Degree,
    department: row.department ?? null,
    section: row.section,
    year: row.year ?? 1,
    isActive: row.isActive,
    todayStatus: dayStatus(row.todayStatus),
    monthPct: Number(row.monthPct ?? 0),
    presentDays: row.presentDays,
    workingDays: row.workingDays,
  };
}

/**
 * Looks one student up in the roster by login id.
 *
 * `year`, today's status and the month totals come from SQL functions that only
 * the roster endpoint exposes, and the login id is the value being searched for,
 * so this is one extra request behind `getStudent` and `updateStudent` rather
 * than a re-implementation of the academic-year maths here.
 */
async function rosterRow(base: string, id: string, loginId: string): Promise<WireRow | undefined> {
  const r = await request<{ students: WireRow[] }>(
    `${base}/students${qs({ search: loginId, joined: "all", limit: 200 })}`,
  );
  return r.students.find((row) => row.id === id);
}

/**
 * Resolves the programme a degree (and department) names to the course code the
 * service stores.
 *
 * Programmes come from the structure import, so the roster is the only place
 * they can be read without a new endpoint. A degree that matches nothing is
 * refused here rather than sent, because the service would answer with a 422
 * listing the codes it knows.
 */
async function programFor(degree: Degree, department: string | null): Promise<string> {
  const r = await request<{ students: WireRow[] }>(`/students${qs({ joined: "all", limit: 2000 })}`);
  const wanted = String(degree).trim().toLowerCase();
  const wantedDept = department?.trim().toLowerCase();
  const match = r.students.find(
    (row) =>
      Boolean(row.courseCode) &&
      row.degree?.trim().toLowerCase() === wanted &&
      (wantedDept ? row.department?.trim().toLowerCase() === wantedDept : true),
  );
  if (!match?.courseCode) {
    throw new ApiError(
      422,
      "That programme is not in the roster yet. Import the structure first, then set the programme.",
    );
  }
  return match.courseCode;
}

function createRealApi(): FaceTrackApi {
  return {
    async login(username, password) {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new ApiError(res.status, body?.error || "Sign in failed.");
      }
      return { username: username };
    },

    async logout() {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    },

    async summary() {
      const r = await request<{ summary: DashboardSummary }>("/dashboard/summary");
      return r.summary;
    },

    async listStudents(filter = {}) {
      // The roster endpoint filters in SQL, so the search box and the four
      // selects narrow the result set instead of the browser narrowing 2000 rows.
      const r = await request<{ students: WireRow[] }>(
        `/students${qs({
          search: filter.search,
          degree: filter.degree,
          section: filter.section,
          year: filter.year,
          status: filter.status,
          limit: 2000,
        })}`,
      );
      return r.students.map(mapRow);
    },

    async getStudent(id) {
      const [detail, year] = await Promise.all([
        request<{ student: WireStudent }>(`/students/${id}`),
        request<{ months: YearPoint[] }>(`/students/${id}/yearly`),
      ]);
      const s = detail.student;
      const row = await rosterRow(API_BASE, id, s.loginId);

      const yearPresentDays = year.months.reduce((n, m) => n + m.presentDays, 0);
      const yearWorkingDays = year.months.reduce((n, m) => n + m.workingDays, 0);

      return {
        student: {
          id: s.id,
          enrollmentNo: s.loginId,
          name: s.name,
          degree: (row?.degree ?? s.degree ?? "") as Degree,
          department: row?.department ?? s.department ?? null,
          section: s.section,
          year: row?.year ?? 1,
          isActive: s.isActive,
          createdAt: s.createdAt,
        },
        todayStatus: row ? dayStatus(row.todayStatus) : ("absent" as Status),
        monthPct: row?.monthPct ?? 0,
        presentDays: row?.presentDays ?? 0,
        workingDays: row?.workingDays ?? 0,
        yearPct:
          yearWorkingDays > 0
            ? Math.round((yearPresentDays / yearWorkingDays) * 1000) / 10
            : 0,
        yearPresentDays,
        yearWorkingDays,
      } satisfies StudentDetail;
    },

    async studentDays(id, month) {
      const r = await request<{ days: WireDay[] }>(
        `/students/${id}/daily${qs({ month })}`,
      );
      return r.days.map((d) => ({
        date: d.date,
        status: dayStatus(d.status),
        firstSeenAt: d.firstSeenAt ?? undefined,
        confidence: d.confidence ?? undefined,
      })) satisfies DayRecord[];
    },

    async studentYear(id) {
      const r = await request<{ months: YearPoint[] }>(`/students/${id}/yearly`);
      return r.months;
    },

    async updateStudent(id, patch) {
      // A PATCH writes the whole row: the service validates every column of the
      // institute's schema, and rejects any key it does not own. The login id
      // therefore goes under whichever key this institute picked for it.
      const [detail, schemaRes] = await Promise.all([
        request<{ student: WireStudent }>(`/students/${id}`),
        request<{ schema: { columns: WireColumn[]; loginKey: string } }>(
          "/setup/student-schema",
        ),
      ]);
      const current = detail.student;
      const { columns, loginKey } = schemaRes.schema;

      const body: Record<string, unknown> = {};
      for (const column of columns) {
        if (column.key === "name") body.name = current.name;
        else if (column.key === "course_code") body.course_code = current.courseCode ?? "";
        else if (column.key === "section") body.section = current.section;
        else if (column.key === "admission_year") body.admission_year = current.admissionYear ?? "";
        else body[column.key] = current.extra[column.key] ?? "";
      }

      if (patch.name !== undefined) body.name = patch.name;
      if (patch.enrollmentNo !== undefined) body[loginKey] = patch.enrollmentNo;
      if (patch.section !== undefined) body.section = patch.section;

      if (patch.degree !== undefined && patch.degree !== current.degree) {
        body.course_code = await programFor(patch.degree, patch.department ?? null);
      }
      if (patch.year !== undefined) {
        const row = await rosterRow(API_BASE, id, current.loginId);
        const admission = current.admissionYear ?? new Date().getFullYear();
        if (row?.year) body.admission_year = admission - (patch.year - row.year);
        else body.admission_year = admission - (patch.year - 1);
      }

      await request(`/students/${id}`, { method: "PATCH", body: JSON.stringify(body) });

      return {
        id,
        enrollmentNo: (patch.enrollmentNo ?? current.loginId).trim().toUpperCase(),
        name: patch.name ?? current.name,
        degree: (patch.degree ?? current.degree ?? "") as Degree,
        department: patch.department === undefined ? current.department : patch.department,
        section: patch.section ?? current.section,
        year: patch.year ?? 1,
        isActive: current.isActive,
        createdAt: current.createdAt,
      } satisfies Student;
    },

    async deleteStudent(id) {
      // The service deactivates rather than deleting: attendance rows and audit
      // entries stay intact, and an inactive student leaves the roster.
      await request(`/students/${id}/deactivate`, { method: "POST" });
    },

    async analytics(segment, month) {
      const r = await request<{ groups: GroupStat[] }>(
        `/analytics/groups${qs({ group: segment, month })}`,
      );
      return r.groups;
    },

    async registerOptions() {
      return request<RegisterOptions>("/register/options");
    },

    async registerCheck(frame, baseline, targetPose) {
      const fd = new FormData();
      fd.append("frame", frame, "frame.jpg");
      const r = await request<Record<string, unknown>>(
        `/register/check${qs({
          baseline: baseline ?? undefined,
          target_pose: targetPose ?? undefined,
        })}`,
        { method: "POST", body: fd },
      );
      const raw = (r.issues as string[] | undefined) ?? [];
      const mapped = mapIssues(raw);
      return {
        ok: Boolean(r.ok),
        issues: mapped.issues,
        pose: (r.pose as Pose | null) ?? null,
        faceBox: (r.face_box as [number, number, number, number] | null) ?? null,
        message: mapped.message ?? (r.ok ? undefined : raw[0]),
      };
    },

    async registerCommit(payload) {
      const fd = formData(payload);
      return request<RegisterResult>("/register/commit", { method: "POST", body: fd });
    },

    async reenroll(id, payload) {
      const fd = formData(payload);
      return request<RegisterResult>(`/register/reenroll/${id}`, {
        method: "POST",
        body: fd,
      });
    },

    async recentlyMarked() {
      const r = await request<{
        attendance: {
          studentId: string;
          name: string;
          loginId: string;
          firstSeenAt: string;
          status: string;
          confidence: number | null;
          source: string;
        }[];
      }>("/attendance/today");
      const today = new Date().toISOString().slice(0, 10);
      return r.attendance.map((row) => ({
        // The service keys a mark by (student, day) and sends the day's first
        // sighting; together they are unique for one day's list.
        id: `${row.studentId}:${row.firstSeenAt}`,
        studentId: row.studentId,
        name: row.name,
        enrollmentNo: row.loginId,
        date: today,
        status: row.status as MarkedToday["status"],
        firstSeenAt: row.firstSeenAt,
        confidence: row.confidence,
        source: row.source,
      }));
    },

    async health() {
      const h = await request<{
        ok: boolean;
        model: { name: string };
        gallery: { studentsInMemory?: number; students?: number };
        performance: { avg_ms_per_frame: number | null; sessions: number };
        server_time_utc: string;
        database: { reachable: boolean };
        uptime_s: number;
      }>("/api/health");
      return {
        ok: h.ok,
        model: h.model.name,
        galleryStudents: h.gallery.studentsInMemory ?? h.gallery.students ?? 0,
        avgMsPerFrame: h.performance.avg_ms_per_frame,
        sessions: h.performance.sessions,
        today: h.server_time_utc.slice(0, 10),
        dbReachable: h.database.reachable,
        uptimeSeconds: h.uptime_s,
      };
    },

    async getSettings() {
      const r = await request<{ recognition: RecognitionSettings }>("/api/config");
      return r.recognition;
    },

    async saveSettings(patch) {
      const r = await request<{ recognition: RecognitionSettings }>("/api/config", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      return r.recognition;
    },

    async switchModel(model) {
      await request(`/api/config/model${qs({ model })}`, { method: "POST" });
    },

    async changePassword(current, next) {
      // The service bumps the token version, so this session is over: the caller
      // is sent back to the login form rather than left with a dead token.
      await request("/auth/institute/password", {
        method: "POST",
        body: JSON.stringify({ current, next }),
      });
      await this.logout();
    },

    async getHolidays() {
      const r = await request<{ holidays: Holiday[] }>("/holidays");
      return r.holidays;
    },

    async addHoliday(date, label) {
      await request("/holidays", {
        method: "POST",
        body: JSON.stringify({ date, label }),
      });
    },

    async removeHoliday(date) {
      await request(`/holidays/${date}`, { method: "DELETE" });
    },

    streamUrl(token) {
      return `${WS_BASE}/ws/recognize?token=${encodeURIComponent(token)}`;
    },
  };

  function formData(payload: RegisterPayload): FormData {
    const fd = new FormData();
    fd.append("name", payload.name);
    fd.append("enrollment_no", payload.enrollmentNo);
    fd.append("degree", payload.degree);
    fd.append("section", payload.section);
    fd.append("year", String(payload.year));
    if (payload.department) fd.append("department", payload.department);
    payload.frames.forEach((frame, i) => {
      fd.append("frames", frame, `frame-${i}.jpg`);
    });
    return fd;
  }
}

let instance: FaceTrackApi | null = null;

export function api(): FaceTrackApi {
  if (!instance) instance = USE_MOCK ? createMockApi() : createRealApi();
  return instance;
}

export type { Track };
