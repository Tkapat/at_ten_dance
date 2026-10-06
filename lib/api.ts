import type { components } from "./api-types";
import type {
  ClaimCompleteInput,
  ClaimVerifyInput,
  ClaimVerifyResult,
  DashboardSummary,
  DayRecord,
  GroupStat,
  HealthStatus,
  Holiday,
  ImportCommit,
  ImportKind,
  ImportPreview,
  InstituteProfile,
  InstituteProfileInput,
  InstituteSettings,
  JoinState,
  InstituteSignupInput,
  ManualMarkInput,
  MarkedToday,
  Program,
  PublicInstitute,
  RecognitionSettings,
  RegisterCheck,
  RegisterPayload,
  RegisterResult,
  Session,
  SetupStatus,
  Status,
  Student,
  StudentDetail,
  StudentRow,
  StudentSchema,
  StudentSchemaInput,
  StudentSelf,
  Track,
} from "./types";
import type { Degree, Pose } from "./constants";
import { API_BASE, proxied, USE_MOCK, WS_BASE } from "./env";
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

/** @deprecated Use {@link ApiClient}. Kept so older imports keep compiling. */
export type FaceTrackApi = ApiClient;

export interface StudentFilter {
  search?: string;
  degree?: Degree | null;
  department?: string | null;
  section?: string | null;
  /** Current year of the programme, computed by the service. */
  year?: number | null;
  status?: string | null;
  /**
   * `joined` is the service's own filter and is deliberately not the same as
   * `joinState`: it asks "has an account", which includes students who have also
   * enrolled a face. `joinState` on a row is the precise three-way answer.
   */
  joined?: JoinState | "all" | null;
  limit?: number;
  offset?: number;
}

/** One page of the roster, with the count that makes paging possible. */
export interface StudentPage {
  students: StudentRow[];
  /** Rows in this page. */
  count: number;
  /** Rows the filters match, across every page. */
  total: number;
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
  /**
   * Set on a 429: how many seconds the caller asked us to wait.
   *
   * A timer is only worth showing if it says the real number, so this is read
   * from the body first and the header second — the header is the fallback for a
   * response whose body was replaced somewhere along the way.
   */
  retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    extra: {
      field?: string;
      issues?: string[];
      duplicate?: ApiError["duplicate"];
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = extra.field;
    this.issues = extra.issues;
    this.duplicate = extra.duplicate;
    this.retryAfterSeconds = extra.retryAfterSeconds;
  }
}

/**
 * One typed client for the whole app, and the only place that knows the wire
 * format. Components never call `fetch`.
 *
 * `ApiClient` is the seam the two adapters meet at: `createMockApi()` and
 * `createRealApi()` implement every method below, so a screen built against the
 * mock cannot quietly depend on something only one of them has. Every shape on
 * the wire comes from `lib/api-types.ts`, generated from the service's own
 * OpenAPI schema, so this file is where "what does the service actually say?"
 * is answered in one place.
 *
 * A method returns the app's own type where it has one (`StudentRow`), and the
 * service's type where it does not (`SetupStatus`, `StudentSelf`). Nothing is
 * renamed twice.
 */
export interface ApiClient {
  /* ---------------------------------------------------------------- session */
  /**
   * What an institute code says about the institute behind it: its name, whether
   * it is accepting students, and the two labels its student form has to ask for.
   *
   * The only call in the app that needs no session, and the first one a student
   * ever makes. It answers 404 with one message for every wrong code.
   */
  publicInstitute(code: string): Promise<PublicInstitute>;
  /** Institute sign-in by email. Sets the session cookie. */
  login(email: string, password: string): Promise<Session>;
  /** Student sign-in: code, then the institute's login id, then the password. */
  loginStudent(code: string, loginId: string, password: string): Promise<Session>;
  /** Create an institute and its owner. Answers with the code it was given. */
  signupInstitute(input: InstituteSignupInput): Promise<Session>;
  /**
   * Step one of claiming an account: the institute code, the login id and the
   * verification value. Answers with a single-use claim token and the details
   * shown on the confirm screen — and one generic failure for every reason, so
   * it cannot be used to find out whether an id exists.
   */
  claimVerify(input: ClaimVerifyInput): Promise<ClaimVerifyResult>;
  /** Step two: creates the account and signs the student in. */
  claimComplete(input: ClaimCompleteInput): Promise<Session>;
  logout(): Promise<void>;
  /** The signed-in session, read back from the httpOnly cookie. */
  session(): Promise<Session>;

  /* -------------------------------------------------------- institute setup */
  /** Where this institute is in its own setup, and what is still missing. */
  setupStatus(): Promise<SetupStatus>;
  /** The programmes imported from the structure file. Empty before the import. */
  structure(): Promise<Program[]>;
  /** The institute's student columns, and which two of them matter. */
  studentSchema(): Promise<StudentSchema>;
  saveStudentSchema(schema: StudentSchemaInput): Promise<StudentSchema>;
  /** Academic calendar, weekly off, timezone, and whether self-enrolment is on. */
  instituteSettings(): Promise<InstituteSettings>;
  saveInstituteSettings(patch: Partial<InstituteSettings>): Promise<InstituteSettings>;
  /** The institute's own record: name, where it is, and its code. */
  instituteProfile(): Promise<InstituteProfile>;
  /**
   * Rename the institute, or fill in where it is.
   *
   * `code`, `status` and `timezone` are not writable here and the service refuses
   * a body that names them, so an editor cannot appear to have saved one.
   */
  saveInstituteProfile(patch: InstituteProfileInput): Promise<InstituteProfile>;

  /* ---------------------------------------------------------------- imports */
  /** The template spreadsheet for one import kind, as a file. */
  importTemplate(kind: ImportKind): Promise<Blob>;
  /** Validate a spreadsheet without writing anything. */
  importPreview(kind: ImportKind, file: File): Promise<ImportPreview>;
  /** Apply a previewed job. `skipInvalid` writes the valid rows only. */
  importCommit(kind: ImportKind, jobId: string, skipInvalid: boolean): Promise<ImportCommit>;
  /** Where the row-by-row error report can be downloaded from. */
  importErrorsUrl(kind: ImportKind, jobId: string): string;

  /* ---------------------------------------------------------------- students */
  summary(): Promise<DashboardSummary>;
  listStudents(filter?: StudentFilter): Promise<StudentRow[]>;
  /**
   * One page of the roster, plus `total`.
   *
   * `listStudents` cannot answer "are there more?" — one page of rows cannot tell
   * the end of a list from a filter that matched nothing — so a "load more" needs
   * this rather than a guess based on a short page.
   */
  listStudentsPage(filter?: StudentFilter): Promise<StudentPage>;
  getStudent(id: string): Promise<StudentDetail>;
  /** Write one student from the institute's own column keys. */
  createStudent(values: Record<string, string | number | null>): Promise<{ id: string; name: string }>;
  /** Write one student's whole record, again in the institute's column keys. */
  patchStudent(id: string, values: Record<string, string | number | null>): Promise<void>;
  /** The app-shaped edit, kept for the modal that predates the column form. */
  updateStudent(id: string, patch: Partial<Student>): Promise<Student>;
  /** Soft removal: history stays, and the student stops being recognised. */
  deleteStudent(id: string): Promise<void>;
  reactivateStudent(id: string): Promise<void>;
  /** Clear the password and the claim, so the student claims the account again. */
  resetStudentAccess(id: string): Promise<void>;
  /** Remove the stored face so the student (or an admin) can enrol again. */
  unlockStudentFace(id: string): Promise<void>;

  /* ---------------------------------------------------------------- reports */
  analytics(segment: Segment, month: string): Promise<GroupStat[]>;
  /** Everyone with today's status, for the roster card's polling. */
  dashboardStudents(): Promise<StudentRow[]>;
  recentlyMarked(): Promise<MarkedToday[]>;
  studentDays(id: string, month: string): Promise<DayRecord[]>;
  studentYear(id: string): Promise<YearPoint[]>;
  /** One day written by a person. Source becomes `manual`, and shows as such. */
  markAttendance(input: ManualMarkInput): Promise<void>;
  clearAttendance(id: string, date: string): Promise<void>;
  /** Where a date range of attendance can be downloaded from. */
  exportCsvUrl(from: string, to: string): string;

  /* --------------------------------------------------------- student portal */
  /** The signed-in student's own record, including their extra columns. */
  me(): Promise<StudentSelf>;
  meSummary(): Promise<{
    monthPct: number;
    monthPresent: number;
    monthWorking: number;
    yearPct: number;
    yearPresent: number;
    yearWorking: number;
    todayStatus: Status | "working" | "off";
    firstSeenAt?: string;
    confidence?: number;
  }>;
  meAttendance(month: string): Promise<DayRecord[]>;
  meHolidays(): Promise<Holiday[]>;
  changeOwnPassword(current: string, next: string): Promise<void>;
  /** One frame of self-enrolment guidance. */
  faceCheck(frame: Blob, baseline?: number | null): Promise<RegisterCheck>;
  /** Store the student's own face. Allowed once. */
  faceCommit(frames: Blob[]): Promise<{ stored: number; poses: string[] }>;

  /* ---------------------------------------------------- admin-assisted enrol */
  registerOptions(): Promise<RegisterOptions>;
  registerCheck(frame: Blob, baseline?: number | null, targetPose?: Pose): Promise<RegisterCheck>;
  registerCommit(payload: RegisterPayload): Promise<RegisterResult>;
  reenroll(id: string, payload: RegisterPayload): Promise<RegisterResult>;
  /**
   * Live guidance for one frame while enrolling somebody who is already on the
   * roster. Same answer as `registerCheck`, because it is the same capture panel.
   */
  enrollCheck(
    id: string,
    frame: Blob,
    baseline?: number | null,
    targetPose?: Pose,
  ): Promise<RegisterCheck>;
  /** Store a face for a student who already exists. */
  enrollCommit(id: string, payload: RegisterPayload): Promise<RegisterResult>;

  /* --------------------------------------------------------------- settings */
  health(): Promise<HealthStatus>;
  getSettings(): Promise<RecognitionSettings>;
  saveSettings(patch: Partial<RecognitionSettings>): Promise<RecognitionSettings>;
  switchModel(model: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;

  /* ---------------------------------------------------------------- holidays */
  getHolidays(): Promise<Holiday[]>;
  addHoliday(date: string, label: string): Promise<void>;
  removeHoliday(date: string): Promise<void>;

  /* ------------------------------------------------------------------- scan */
  /**
   * The WebSocket the Scan page opens. Only available in the browser, and the
   * only call that does not go through the proxy: a WebSocket handshake cannot
   * carry an Authorization header, so the token travels in the query string.
   */
  streamUrl(token: string, scope?: ScanScope): string;
}

/**
 * Narrows a scan to one group. Every field is optional; "Everyone" is all of
 * them absent. The year is a year of the programme ("third year"), and the
 * service converts it to admission years, because only an institute account may
 * read the academic year it depends on.
 */
export interface ScanScope {
  degree?: string;
  department?: string;
  program?: string;
  section?: string;
  currentYear?: number;
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

/**
 * One call to the service.
 *
 * `raw` hands back the response body untouched, for the endpoints that answer
 * with a file rather than JSON: the import templates and the error reports.
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
  base?: string,
  raw = false,
): Promise<T> {
  // No Authorization header here: the proxy reads the cookie and attaches the
  // bearer token itself, so the browser never holds the service token for a REST
  // call. `base` is only set for the handful of links the browser fetches
  // directly, which is why those pass the header themselves.
  const token = base ? await readToken() : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(base ? `${base}${path}` : proxied(path), {
      ...init,
      headers,
      cache: "no-store",
    });
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

  if (raw) {
    if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status}).`);
    return (await res.blob()) as T;
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
    // Our own route handlers answer `{message}` rather than `{detail:{message}}`,
    // so both shapes are read here and the rest of the app only sees one.
    const flat = body as { message?: unknown; retryAfterSeconds?: unknown } | null;
    if (typeof flat?.message === "string") {
      const headerRetry = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
      throw new ApiError(res.status, flat.message, {
        retryAfterSeconds:
          typeof flat.retryAfterSeconds === "number"
            ? flat.retryAfterSeconds
            : Number.isFinite(headerRetry) && headerRetry > 0
              ? headerRetry
              : undefined,
      });
    }
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
      const headerRetry = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
      throw new ApiError(
        res.status,
        typeof d.message === "string" ? d.message : "Request failed.",
        {
          field: typeof d.field === "string" ? d.field : undefined,
          issues: Array.isArray(d.rejected) ? (d.rejected as string[]) : undefined,
          duplicate,
          retryAfterSeconds:
            typeof d.retryAfterSeconds === "number"
              ? d.retryAfterSeconds
              : Number.isFinite(headerRetry) && headerRetry > 0
                ? headerRetry
                : undefined,
        },
      );
    }
    throw new ApiError(res.status, `Request failed (${res.status}).`);
  }

  return body as T;
}

/**
 * A call to one of this app's own route handlers.
 *
 * Used for the four session calls and nothing else: those are the ones that set
 * a cookie, which only a server can do. Everything else is proxied to the
 * service, so the browser talks to one origin.
 */
async function bff<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  if (!res.ok) {
    throw new ApiError(res.status, parsed?.message || parsed?.error || "Request failed.");
  }
  return parsed as T;
}

/**
 * A file from the service, fetched by the browser itself.
 *
 * Used for the three things that are downloads rather than data: the import
 * template, an import error report and the attendance export. They bypass the
 * proxy because the browser, not this app, decides what to do with the body — and
 * a file the browser saved needs the name the service gave it.
 */
async function directBlob(path: string): Promise<Blob> {
  const token = await readToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers, cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, "That file could not be downloaded.");
  return res.blob();
}

/**
 * An absolute URL, for the few calls the browser makes directly.
 *
 * Three of them, and each for a reason a route handler cannot serve: an import
 * template and an error report are files the browser saves under their own name,
 * and the attendance export is a download. Everything else is proxied.
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
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

/** The service answers both capture endpoints with the same quality dict. */
function qualityResult(r: Record<string, unknown>): RegisterCheck {
  const raw = (r.issues as string[] | undefined) ?? [];
  const mapped = mapIssues(raw);
  return {
    ok: Boolean(r.ok),
    issues: mapped.issues,
    pose: (r.pose as Pose | null) ?? null,
    faceBox: (r.face_box as [number, number, number, number] | null) ?? null,
    message: mapped.message ?? (r.ok ? undefined : raw[0]),
  };
}

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
/**
 * Roster rows, student records, days and columns are read from the generated
 * schema rather than copied out of the service's SQL, so a renamed column is a
 * compile error rather than a blank cell.
 */
type WireStudent = components["schemas"]["AdminStudent"];
type WireRow = components["schemas"]["RosterRow"];
type WireDay = components["schemas"]["DayRow"];
type WireColumn = components["schemas"]["SchemaColumn"];

/** The dashboard's lighter row, mapped onto the app's roster row. */
function mapDashboardRow(row: components["schemas"]["DashboardStudent"]): StudentRow {
  return {
    id: row.id,
    enrollmentNo: row.loginId,
    name: row.name,
    degree: "" as Degree,
    department: null,
    section: row.section,
    year: 1,
    isActive: true,
    todayStatus: dayStatus(row.todayStatus ?? "absent"),
    monthPct: Number(row.monthPct ?? 0),
    presentDays: row.presentDays,
    workingDays: row.workingDays,
    // The dashboard's row is a day's attendance, not a roster line: it carries no
    // claim state at all, so `joinState` is not guessed from it. A screen showing a
    // joining-up badge reads `listStudents`, where the service decides it.
    joinState: "not_joined" as JoinState,
  };
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
    todayStatus: dayStatus(row.todayStatus ?? "absent"),
    monthPct: Number(row.monthPct ?? 0),
    presentDays: row.presentDays,
    workingDays: row.workingDays,
    // The service decides this, and derives it the same way for every client.
    // The fallback keeps an older service readable rather than leaving a badge
    // blank: an enrolled face is the state that matters most.
    joinState: row.joinState ?? (row.faceStatus === "enrolled" ? "enrolled" : "not_joined"),
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
async function rosterRow(id: string, loginId: string): Promise<WireRow | undefined> {
  const r = await request<{ students: WireRow[] }>(
    `/students${qs({ search: loginId, joined: "all", limit: 200 })}`,
  );
  return r.students.find((row) => row.id === id);
}

/**
 * Resolves the programme a degree (and department) names to the course code the
 * service stores.
 *
 * Read from the structure list rather than from the roster: a programme with no
 * students yet is still a real programme, and it is exactly that case an admin
 * hits when adding the first student after importing the structure.
 */
async function programFor(degree: Degree, department: string | null): Promise<string> {
  const r = await request<{ programs: Program[] }>("/setup/structure");
  const wanted = String(degree).trim().toLowerCase();
  const wantedDept = department?.trim().toLowerCase();
  const match = r.programs.find(
    (program) =>
      program.degree.trim().toLowerCase() === wanted &&
      (wantedDept ? (program.department ?? "").trim().toLowerCase() === wantedDept : true),
  );
  if (!match) {
    throw new ApiError(
      422,
      "That programme is not in the structure yet. Import the structure first, then set the programme.",
    );
  }
  return match.courseCode;
}

function createRealApi(): ApiClient {
  return {
    async publicInstitute(code) {
      // No session: this is the call that comes before there is one.
      return request<PublicInstitute>(`/public/institutes/${code.trim().toUpperCase()}`);
    },

    /*
     * The four session calls go through Next route handlers rather than straight
     * to the service, because the httpOnly cookie has to be set server-side: a
     * browser cannot keep a session token where a script cannot read it. Each
     * handler forwards to the service, adopts the token it gets back and answers
     * with the whole session, so the app never has to ask who it is a second time.
     */
    async login(email, password) {
      return bff<Session>("/api/auth/login", { username: email, password });
    },

    async loginStudent(code, loginId, password) {
      return bff<Session>("/api/auth/student", { code, loginId, password });
    },

    async signupInstitute(input) {
      return bff<Session>("/api/auth/signup", input);
    },

    async claimVerify(input) {
      // Public endpoint, no session yet: it goes to the service directly.
      return request<ClaimVerifyResult>("/auth/student/claim/verify", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async claimComplete(input) {
      return bff<Session>("/api/auth/claim", input);
    },

    async logout() {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    },

    async session() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) throw new ApiError(res.status, "Not signed in.");
      return (await res.json()) as Session;
    },

    async summary() {
      const r = await request<{ summary: DashboardSummary }>("/dashboard/summary");
      return r.summary;
    },

    async listStudents(filter = {}) {
      // The roster endpoint filters in SQL, so the search box and the selects
      // narrow the result set instead of the browser narrowing thousands of rows.
      const page = await this.listStudentsPage({ ...filter, limit: 2000, offset: 0 });
      return page.students;
    },

    async listStudentsPage(filter = {}) {
      const r = await request<{ students: WireRow[]; count: number; total: number }>(
        `/students${qs({
          search: filter.search,
          degree: filter.degree,
          department: filter.department,
          section: filter.section,
          year: filter.year,
          status: filter.status,
          joined: filter.joined,
          limit: filter.limit ?? 200,
          offset: filter.offset ?? 0,
        })}`,
      );
      return {
        students: r.students.map(mapRow),
        count: r.count,
        // A service that predates `total` would leave this undefined; falling back
        // to the page size keeps "load more" working rather than reading NaN.
        total: r.total ?? r.students.length,
      };
    },

    async getStudent(id) {
      const [detail, year] = await Promise.all([
        request<{ student: WireStudent }>(`/students/${id}`),
        request<{ months: YearPoint[] }>(`/students/${id}/yearly`),
      ]);
      const s = detail.student;
      const row = await rosterRow(id, s.loginId);

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
          createdAt: s.createdAt ?? undefined,
        },
        todayStatus: row ? dayStatus(row.todayStatus ?? "absent") : ("absent" as Status),
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

      const body: Record<string, string | number | null> = {};
      for (const column of columns) {
        if (column.key === "name") body.name = current.name;
        else if (column.key === "course_code") body.course_code = current.courseCode ?? "";
        else if (column.key === "section") body.section = current.section;
        else if (column.key === "admission_year") body.admission_year = current.admissionYear ?? "";
        else body[column.key] = String(current.extra[column.key] ?? "");
      }

      if (patch.name !== undefined) body.name = patch.name;
      if (patch.enrollmentNo !== undefined) body[loginKey] = patch.enrollmentNo;
      if (patch.section !== undefined) body.section = patch.section;

      if (patch.degree !== undefined && patch.degree !== current.degree) {
        body.course_code = await programFor(patch.degree, patch.department ?? null);
      }
      if (patch.year !== undefined) {
        const row = await rosterRow(id, current.loginId);
        const admission = current.admissionYear ?? new Date().getFullYear();
        if (row?.year) body.admission_year = admission - (patch.year - row.year);
        else body.admission_year = admission - (patch.year - 1);
      }

      await this.patchStudent(id, body);

      return {
        id,
        enrollmentNo: (patch.enrollmentNo ?? current.loginId).trim().toUpperCase(),
        name: patch.name ?? current.name,
        degree: (patch.degree ?? current.degree ?? "") as Degree,
        department: patch.department === undefined ? current.department : patch.department,
        section: patch.section ?? current.section,
        year: patch.year ?? 1,
        isActive: current.isActive,
        createdAt: current.createdAt ?? undefined,
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
      return qualityResult(
        await request<Record<string, unknown>>(
          `/register/check${qs({
            baseline: baseline ?? undefined,
            target_pose: targetPose ?? undefined,
          })}`,
          { method: "POST", body: fd },
        ),
      );
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

    async enrollCheck(id, frame, baseline, targetPose) {
      const fd = new FormData();
      fd.append("frame", frame, "frame.jpg");
      return qualityResult(
        await request<Record<string, unknown>>(
          `/students/${id}/enroll/check${qs({
            baseline: baseline ?? undefined,
            target_pose: targetPose ?? undefined,
          })}`,
          { method: "POST", body: fd },
        ),
      );
    },

    async enrollCommit(id, payload) {
      const fd = formData(payload);
      return request<RegisterResult>(`/students/${id}/enroll/commit`, {
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

    /* ------------------------------------------------------ institute setup */
    async setupStatus() {
      return request<SetupStatus>("/setup/status");
    },

    async structure() {
      const r = await request<{ programs: Program[] }>("/setup/structure");
      return r.programs;
    },

    async studentSchema() {
      const r = await request<{ schema: StudentSchema }>("/setup/student-schema");
      return r.schema;
    },

    async saveStudentSchema(schema) {
      const r = await request<{ schema: StudentSchema }>("/setup/student-schema", {
        method: "PUT",
        body: JSON.stringify(schema),
      });
      return r.schema;
    },

    async instituteSettings() {
      // The calendar lives in the setup status, which is the one place that reads
      // it; `institution/settings` only writes. Composing the read here keeps the
      // two halves in one file rather than in two callers.
      const status = await this.setupStatus();
      return {
        academicYearStart: status.status.calendar.academicYearStart ?? null,
        academicYearEnd: status.status.calendar.academicYearEnd ?? null,
        weeklyOff: status.status.calendar.weeklyOff ?? null,
        timezone: status.institute.timezone,
        faceSelfEnroll: (status.institute.settings.face_self_enroll as boolean | undefined) ?? true,
      } satisfies InstituteSettings;
    },

    async instituteProfile() {
      const r = await request<{ institution: InstituteProfile }>("/institution");
      return r.institution;
    },

    async saveInstituteProfile(patch) {
      const r = await request<{ institution: InstituteProfile }>("/institution/profile", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      return r.institution;
    },

    async saveInstituteSettings(patch) {
      const r = await request<{ settings: InstituteSettings }>("/institution/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      return r.settings;
    },

    /* -------------------------------------------------------------- imports */
    async importTemplate(kind) {
      // Fetched directly, not proxied: the response is a file the browser saves
      // under the name the service gives it, and a proxy that buffers it would
      // have to invent that name.
      return directBlob(`/setup/templates/${kind}`);
    },

    async importPreview(kind, file) {
      const fd = new FormData();
      fd.append("file", file, file.name);
      return request<ImportPreview>(`/setup/${kind}/preview`, { method: "POST", body: fd });
    },

    async importCommit(kind, jobId, skipInvalid) {
      return request<ImportCommit>(`/setup/${kind}/commit`, {
        method: "POST",
        body: JSON.stringify({ jobId, skipInvalid }),
      });
    },

    importErrorsUrl(kind, jobId) {
      return apiUrl(`/setup/${kind}/jobs/${jobId}/errors.csv`);
    },

    /* ------------------------------------------------------- student writes */
    async createStudent(values) {
      const r = await request<{ student: { id: string; name: string } }>("/students", {
        method: "POST",
        body: JSON.stringify(values),
      });
      return r.student;
    },

    async patchStudent(id, values) {
      await request(`/students/${id}`, { method: "PATCH", body: JSON.stringify(values) });
    },

    async reactivateStudent(id) {
      await request(`/students/${id}/reactivate`, { method: "POST" });
    },

    async resetStudentAccess(id) {
      await request(`/students/${id}/reset-access`, { method: "POST" });
    },

    async unlockStudentFace(id) {
      await request(`/students/${id}/unlock-face`, { method: "POST" });
    },

    /* -------------------------------------------------------------- reports */
    async dashboardStudents() {
      const r = await request<{ students: components["schemas"]["DashboardStudent"][] }>(
        "/dashboard/students",
      );
      return r.students.map((row) => mapDashboardRow(row));
    },

    async markAttendance(input) {
      await request("/attendance/manual", { method: "PUT", body: JSON.stringify(input) });
    },

    async clearAttendance(id, date) {
      await request(`/attendance/${id}/${date}`, { method: "DELETE" });
    },

    exportCsvUrl(from, to) {
      return apiUrl(`/export/attendance.csv${qs({ from, to })}`);
    },

    /* ------------------------------------------------------- student portal */
    async me() {
      const r = await request<{ student: StudentSelf }>("/me");
      return r.student;
    },

    async meSummary() {
      const r = await request<{ summary: components["schemas"]["MeSummaryBody"] }>("/me/summary");
      const s = r.summary;
      return {
        monthPct: s.monthPct,
        monthPresent: s.monthPresent,
        monthWorking: s.monthWorking,
        yearPct: s.yearPct,
        yearPresent: s.yearPresent,
        yearWorking: s.yearWorking,
        todayStatus: s.todayStatus as Status | "working" | "off",
        firstSeenAt: s.firstSeenAt ?? undefined,
        confidence: s.confidence ?? undefined,
      };
    },

    async meAttendance(month) {
      const r = await request<{ days: components["schemas"]["MeDayRow"][] }>(
        `/me/attendance${qs({ month })}`,
      );
      return r.days.map((d) => ({
        date: d.date,
        status: dayStatus(d.status),
        firstSeenAt: d.firstSeenAt ?? undefined,
        confidence: d.confidence ?? undefined,
      }));
    },

    async meHolidays() {
      const today = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
      const r = await request<{ holidays: Holiday[] }>(`/me/holidays${qs({ from, to: today })}`);
      return r.holidays;
    },

    async changeOwnPassword(current, next) {
      await request("/me/password", {
        method: "POST",
        body: JSON.stringify({ current, next }),
      });
      await this.logout();
    },

    async faceCheck(frame, baseline) {
      const fd = new FormData();
      fd.append("frame", frame, "frame.jpg");
      return qualityResult(
        await request<Record<string, unknown>>(
          `/me/face/check${qs({ baseline: baseline ?? undefined })}`,
          { method: "POST", body: fd },
        ),
      );
    },

    async faceCommit(frames) {
      const fd = new FormData();
      frames.forEach((frame, i) => fd.append("frames", frame, `frame-${i}.jpg`));
      return request<{ ok: boolean; stored: number; poses: string[] }>("/me/face/commit", {
        method: "POST",
        body: fd,
      });
    },

    streamUrl(token, scope) {
      const params = qs({
        token,
        degree: scope?.degree,
        department: scope?.department,
        program: scope?.program,
        section: scope?.section,
        currentYear: scope?.currentYear,
      });
      return `${WS_BASE}/ws/recognize${params}`;
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

let instance: ApiClient | null = null;

export function api(): ApiClient {
  // The two assignments are the same type; the assertion is only there because
  // the compiler cannot see through the lazy initialisation.
  if (!instance) instance = (USE_MOCK ? createMockApi() : createRealApi()) as ApiClient;
  return instance;
}

export type { Track };
