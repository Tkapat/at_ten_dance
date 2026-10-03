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

const snake = <T,>(v: T) => JSON.parse(JSON.stringify(v)) as T;

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
      const r = await request<{ summary: DashboardSummary }>("/api/reports/summary");
      return r.summary;
    },

    async listStudents(filter = {}) {
      const r = await request<{ students: StudentRow[] }>("/api/reports/students");
      let rows = r.students;
      const q = filter.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter(
          (s) =>
            s.name.toLowerCase().includes(q) || s.enrollmentNo.toLowerCase().includes(q),
        );
      }
      if (filter.degree) rows = rows.filter((s) => s.degree === filter.degree);
      if (filter.section) rows = rows.filter((s) => s.section === filter.section);
      if (filter.year) rows = rows.filter((s) => s.year === filter.year);
      if (filter.status) rows = rows.filter((s) => s.todayStatus === filter.status);
      return rows;
    },

    async getStudent(id) {
      return request<StudentDetail>(`/api/reports/student/${id}`);
    },

    async studentDays(id, month) {
      const r = await request<{ days: DayRecord[] }>(
        `/api/reports/student/${id}/days${qs({ month })}`,
      );
      return r.days;
    },

    async studentYear(id) {
      const r = await request<{ months: YearPoint[] }>(`/api/reports/student/${id}/year`);
      return r.months;
    },

    async updateStudent(id, patch) {
      const r = await request<{ student: Student }>(`/api/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify(snake(patch)),
      });
      return r.student;
    },

    async deleteStudent(id) {
      await request(`/api/students/${id}`, { method: "DELETE" });
    },

    async analytics(segment, month) {
      const r = await request<{ groups: GroupStat[] }>(
        `/api/reports/groups${qs({ group: segment, month })}`,
      );
      return r.groups;
    },

    async registerOptions() {
      return request<RegisterOptions>("/api/register/options");
    },

    async registerCheck(frame, baseline, targetPose) {
      const fd = new FormData();
      fd.append("frame", frame, "frame.jpg");
      const r = await request<Record<string, unknown>>(
        `/api/register/check${qs({
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
      return request<RegisterResult>("/api/register/commit", { method: "POST", body: fd });
    },

    async reenroll(id, payload) {
      const fd = formData(payload);
      return request<RegisterResult>(`/api/register/reenroll/${id}`, {
        method: "POST",
        body: fd,
      });
    },

    async recentlyMarked() {
      const r = await request<{ attendance: MarkedToday[] }>("/api/attendance/today");
      return r.attendance;
    },

    async health() {
      const h = await request<{
        ok: boolean;
        model: { name: string };
        gallery: { students: number };
        performance: { avg_ms_per_frame: number | null; sessions: number };
        today: string;
        database: { reachable: boolean };
        uptime_s: number;
      }>("/api/health");
      return {
        ok: h.ok,
        model: h.model.name,
        galleryStudents: h.gallery.students,
        avgMsPerFrame: h.performance.avg_ms_per_frame,
        sessions: h.performance.sessions,
        today: h.today,
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
      await request("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ current, next }),
      });
    },

    async getHolidays() {
      const r = await request<{ holidays: Holiday[] }>("/api/holidays");
      return r.holidays;
    },

    async addHoliday(date, label) {
      await request("/api/holidays", {
        method: "POST",
        body: JSON.stringify({ date, label }),
      });
    },

    async removeHoliday(date) {
      await request(`/api/holidays/${date}`, { method: "DELETE" });
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
