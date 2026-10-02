import type { Degree, Pose, RegisterIssue } from "./constants";

export type { Degree, Pose, RegisterIssue };

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
}

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

export interface RecognitionSettings {
  model: string;
  sim_threshold: number;
  margin: number;
  votes_needed: number;
  vote_window: number;
  min_face_px: number;
  recheck_seconds: number;
}

export interface Holiday {
  date: string;
  label: string;
}

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
