import type { components, paths } from "./api-types";
import type { Degree, Pose, RegisterIssue } from "./constants";

export type { Degree, Pose, RegisterIssue };

/**
 * Shapes the service owns are not redeclared here: they are read out of
 * `lib/api-types.ts`, which is generated from the backend's OpenAPI schema
 * (`app/contracts.py`). A field renamed on the service is renamed here by
 * running `pnpm api:types`, and the compiler points at every place that still
 * uses the old one.
 *
 * What *is* declared here is what the app owns on top of the wire: statuses the
 * app labels differently, records assembled from two endpoints, and the session
 * the browser keeps.
 */
type Schema = components["schemas"];

/**
 * Request bodies are read out of the generated paths rather than written down
 * again, for the same reason responses are: a field the service renamed shows up
 * as a type error here instead of a 422 at runtime.
 */
type JsonBody<R extends { requestBody?: unknown }> = R extends {
  requestBody: { content: { "application/json": infer B } };
}
  ? B
  : never;

export type Status =
  | "present"
  | "late"
  | "absent"
  | "excused"
  | "holiday"
  | "sunday";

export interface Student {
  id: string;
  enrollmentNo: string;
  name: string;
  degree: Degree;
  department: string | null;
  section: string;
  year: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface StudentRow extends Student {
  todayStatus: Status;
  monthPct: number;
  presentDays: number;
  workingDays: number;
  /**
   * Where this student is in joining up: no account yet, an account, or a face.
   *
   * Decided by the service so that every client reads the same rule instead of
   * each re-deriving it from `claimed` and `faceStatus` — which is how a student
   * who has claimed an account but not enrolled a face ends up labelled
   * "not joined" on one screen and "joined" on another.
   */
  joinState: JoinState;
}

export type JoinState = "not_joined" | "joined" | "enrolled";

export interface DashboardSummary {
  presentToday: number;
  absentToday: number;
  monthPct: number;
  totalStudents: number;
  date: string;
  /** False on Sundays and holidays — the dashboard says so instead of 0/0. */
  isWorkingDay: boolean;
}

export interface GroupStat {
  label: string;
  students: number;
  presentDays: number;
  workingDays: number;
  pct: number;
}

export interface DayRecord {
  date: string;
  status: Status;
  firstSeenAt?: string;
  confidence?: number;
}

export interface StudentDetail {
  student: Student;
  todayStatus: Status;
  monthPct: number;
  presentDays: number;
  workingDays: number;
  yearPct: number;
  yearPresentDays: number;
  yearWorkingDays: number;
}

export interface MonthlyRow {
  studentId: string;
  name: string;
  enrollmentNo: string;
  degree: Degree;
  department: string | null;
  section: string;
  year: number;
  presentDays: number;
  workingDays: number;
  pct: number;
}

export type TrackState = "scanning" | "recognized" | "unknown";

export interface Track {
  id: number;
  box: [number, number, number, number];
  state: TrackState;
  studentId?: string | null;
  name: string | null;
  enrollmentNo?: string | null;
  sim?: number;
}

export interface RecognitionEvent {
  type: "recognized";
  studentId: string;
  name: string | null;
  sim: number;
  trackId: number;
}

export interface FrameReply {
  seq: number;
  ms: number;
  faces: number;
  hints: string[];
  tracks: Track[];
  events?: RecognitionEvent[];
  error?: string;
}

export interface RegisterCheck {
  ok: boolean;
  issues: RegisterIssue[];
  pose: Pose | null;
  faceBox: [number, number, number, number] | null;
  /** Raw server text when an issue could not be mapped to a known code. */
  message?: string;
}

export interface HealthStatus {
  ok: boolean;
  model: string;
  galleryStudents: number;
  avgMsPerFrame: number | null;
  sessions: number;
  today: string;
  dbReachable: boolean;
  uptimeSeconds: number;
}

/** What a student needs from an institute code, and nothing more. */
export type PublicInstitute = Schema["PublicInstitute"];

/** One row of the academic structure an institute imported. */
export type Program = Schema["ProgramRow"];

/** Where a new institute is in its own setup. */
export type SetupStatus = Schema["SetupStatusOut"];

export type SchemaColumn = Schema["SchemaColumn"];

/** The institute's own student columns, and which two of them matter. */
export type StudentSchema = Schema["StudentSchemaBody"];

export type InstituteSettings = Schema["InstituteSettings"];

export type ImportKind = "structure" | "students" | "holidays";
export type ImportPreview = Schema["ImportPreviewOut"];
export type ImportError = Schema["ImportIssue"];
export type ImportCommit = Schema["ImportCommitOut"];

/** A roster row as the service reports it, before the app renames its fields. */
export type RosterRow = Schema["RosterRow"];

/** One student as the admin's detail screen reads them. */
export type AdminStudent = Schema["AdminStudent"];

/** A student reading their own record. */
export type StudentSelf = Schema["StudentSelf"];

export type Role = "owner" | "admin" | "staff" | "student";

/**
 * Who is signed in, and whose data everything on screen belongs to.
 *
 * `role` decides which half of the app exists at all: a student never sees an
 * admin route, and an institute user never sees `/me`. It is read from the
 * session cookie, never asked for.
 */
export interface Session {
  role: Role;
  name: string;
  institute: { id: string; name: string; code: string };
}

/* ------------------------------------------------------------------ inputs */
/* Bodies the service accepts, straight from the generated paths. */

export type InstituteSignupInput = JsonBody<paths["/auth/institute/signup"]["post"]>;
export type InstituteLoginInput = JsonBody<paths["/auth/institute/login"]["post"]>;
export type InstitutePasswordInput = JsonBody<paths["/auth/institute/password"]["post"]>;
export type StudentLoginInput = JsonBody<paths["/auth/student/login"]["post"]>;
export type ClaimVerifyInput = JsonBody<paths["/auth/student/claim/verify"]["post"]>;
export type ClaimCompleteInput = JsonBody<paths["/auth/student/claim/complete"]["post"]>;
export type StudentSchemaInput = JsonBody<paths["/setup/student-schema"]["put"]>;
export type InstituteSettingsInput = JsonBody<paths["/institution/settings"]["put"]>;

/** The institute as the Settings → Institute form reads and writes it. */
export type InstituteProfile = Schema["InstituteProfile"];
export type InstituteProfileInput = JsonBody<paths["/institution/profile"]["put"]>;
export type ManualMarkInput = JsonBody<paths["/attendance/manual"]["put"]>;
export type ImportCommitInput = JsonBody<paths["/setup/{kind}/commit"]["post"]>;

/** What the claim step answers with: who you are about to claim, and nothing more. */
export type ClaimVerifyResult = Schema["ClaimVerifyOut"];

/**
 * The details a claim may echo back. Shown on the confirm screen and nowhere
 * earlier, because before the verification step nothing about the record has
 * been proven.
 */
export type ClaimDetail = Schema["ClaimDetail"];

export type Holiday = Schema["Holiday"];

export type RecognitionSettings = Schema["RecognitionSettings"];

export interface MarkedToday {
  id: string;
  studentId: string;
  /** Optional: the Scan page joins these from the student list when absent. */
  name?: string;
  enrollmentNo?: string;
  date: string;
  status: "present" | "late" | "excused";
  firstSeenAt: string;
  confidence: number | null;
  source: string;
}

export interface RegisterPayload {
  name: string;
  enrollmentNo: string;
  degree: Degree;
  department: string | null;
  section: string;
  year: number;
  frames: Blob[];
  /** Which poses were captured — drives the review step's coverage ticks. */
  poses?: Pose[];
}

export interface RegisterResult {
  studentId: string;
  name: string;
  embeddings: number;
  poses: Pose[];
  gallerySize: number;
}

/** Shape of `detail` on a 409 from /register/commit. */
export interface DuplicateError {
  message: string;
  studentId?: string;
  name?: string;
  similarity?: number;
}

export interface ApiErrorShape {
  status: number;
  message: string;
  field?: string;
  duplicate?: DuplicateError;
  issues?: string[];
}
