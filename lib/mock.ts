import {
  DEGREE_LIST,
  DEMO_PASSWORD,
  DEPARTMENTS,
  ISSUE_PRIORITY,
  MIN_GOOD_FRAMES,
  MIN_PASSWORD_LENGTH,
  POSE_LABELS,
  POSE_PROMPTS,
  POSES,
  SECTIONS,
  type Degree,
} from "./constants";
import type {
  ClaimVerifyResult,
  DayRecord,
  GroupStat,
  Holiday,
  ImportCommit,
  ImportError,
  ImportKind,
  ImportPreview,
  InstituteProfile,
  InstituteSettings,
  JoinState,
  MarkedToday,
  Program,
  RecognitionSettings,
  RegisterCheck,
  Role,
  SchemaColumn,
  Session,
  SetupStatus,
  Status,
  Student,
  StudentRow,
  StudentSchema,
  StudentSelf,
} from "./types";
import type { ApiClient, Segment, StudentFilter, YearPoint } from "./api";
import { ApiError } from "./api";
import { daysInMonth, monthKey, toKey, todayKey } from "./format";
import { hashString, seededRandom } from "./utils";

/* --------------------------------------------------------------- fixtures */

/**
 * Two institutes, so every screen can be built and reviewed with no service
 * running, and so the parts that are per-institute are visibly per-institute:
 * Sunrise has BTech/MTech and a full roster, Lotus is a BCA/MCA college with a
 * half-finished setup, which is the state the checklist screens exist for.
 *
 * The names and the deterministic rolls are seeded from the student's own name,
 * so a reload shows the same numbers: a demo that reshuffles on every render
 * cannot be reviewed.
 */

const INSTITUTE_NAMES = [
  "Aarav Sharma", "Priya Iyer", "Rohan Verma", "Ananya Nair", "Kabir Singh",
  "Meera Krishnan", "Aditya Rao", "Ishita Bose", "Vikram Chandra", "Sneha Pillai",
  "Arjun Menon", "Kavya Reddy", "Nikhil Joshi", "Tanvi Deshmukh", "Siddharth Malhotra",
  "Riya Kapoor", "Manav Trivedi", "Aisha Khan", "Devansh Gupta", "Nisha Patel",
  "Karan Mehta", "Pooja Balakrishnan", "Yash Agarwal", "Laila Fernandes", "Harsh Vardhan",
  "Divya Srinivasan", "Omar Sheikh", "Ritika Sinha", "Aditya Narayan", "Sanjana Kulkarni",
  "Varun Dixit", "Aparna Bhatt", "Zaid Ansari", "Shreya Ghosh", "Raghav Chopra",
  "Nandini Ramesh", "Farhan Qureshi", "Tara Elizabeth", "Gurpreet Sandhu", "Nikita Jain",
] as const;

const SUNRISE_DEGREES: Degree[] = [
  ...Array.from({ length: 26 }, () => "BTech" as Degree),
  ...Array.from({ length: 8 }, () => "MTech" as Degree),
  ...Array.from({ length: 3 }, () => "BCA" as Degree),
  ...Array.from({ length: 3 }, () => "MCA" as Degree),
];

const LOTUS_DEGREES: Degree[] = [
  ...Array.from({ length: 8 }, () => "BCA" as Degree),
  ...Array.from({ length: 8 }, () => "MCA" as Degree),
  ...Array.from({ length: 24 }, () => "BCA" as Degree),
];

const STATIC_HOLIDAYS: [string, string][] = [
  ["01-26", "Republic Day"],
  ["08-15", "Independence Day"],
  ["10-02", "Gandhi Jayanti"],
  ["12-25", "Christmas"],
];

const DEGREE_YEARS: Record<Degree, number> = { BTech: 4, MTech: 2, BCA: 3, MCA: 2 };
const DEGREE_PREFIX: Record<Degree, string> = {
  BTech: "B",
  MTech: "M",
  BCA: "BC",
  MCA: "MC",
};

/** What an institute is made of, as far as the mock is concerned. */
interface MockInstitute {
  id: string;
  name: string;
  /** Six characters, no I/O/0/1, because that is the service's rule. */
  code: string;
  city: string;
  state: string;
  status: "setup" | "active";
  timezone: string;
  academicYearStart: string | null;
  academicYearEnd: string | null;
  weeklyOff: number[];
  faceSelfEnroll: boolean;
  adminEmail: string;
  adminPassword: string;
  programs: Program[];
  schema: StudentSchema;
}

const SYSTEM_COLUMNS: SchemaColumn[] = [
  { key: "name", label: "Name", type: "text", required: true, system: true },
  { key: "course_code", label: "Course Code", type: "text", required: true, system: true },
  { key: "section", label: "Section", type: "text", required: true, system: true },
  { key: "admission_year", label: "Admission Year", type: "number", required: true, system: true },
];

const SUNRISE: MockInstitute = {
  id: "inst-sunrise",
  name: "Sunrise Institute of Technology",
  code: "SUNR44",
  city: "Pune",
  state: "Maharashtra",
  status: "active",
  timezone: "Asia/Kolkata",
  academicYearStart: "2025-07-01",
  academicYearEnd: "2026-06-30",
  weeklyOff: [7],
  faceSelfEnroll: true,
  adminEmail: "admin@sunrise.test",
  adminPassword: DEMO_PASSWORD,
  programs: [
    { id: "p-sun-btech-cse", degree: "BTech", department: "CSE", durationYears: 4, courseCode: "BTECH-CSE" },
    { id: "p-sun-btech-ece", degree: "BTech", department: "ECE", durationYears: 4, courseCode: "BTECH-ECE" },
    { id: "p-sun-btech-mech", degree: "BTech", department: "Mechanical", durationYears: 4, courseCode: "BTECH-MEC" },
    { id: "p-sun-mtech-cse", degree: "MTech", department: "CSE", durationYears: 2, courseCode: "MTECH-CSE" },
  ],
  schema: {
    columns: [
      ...SYSTEM_COLUMNS,
      { key: "roll_no", label: "Roll Number", type: "text", required: true, system: false },
      { key: "email", label: "Email", type: "email", required: false, system: false },
      { key: "dob", label: "Date of Birth", type: "date", required: false, system: false },
    ],
    loginKey: "roll_no",
    verifyKey: "dob",
    version: 2,
  },
};

const LOTUS: MockInstitute = {
  id: "inst-lotus",
  name: "Lotus College",
  code: "LOTU66",
  city: "Kochi",
  state: "Kerala",
  status: "active",
  timezone: "Asia/Kolkata",
  academicYearStart: "2025-06-01",
  academicYearEnd: "2026-05-31",
  weeklyOff: [7],
  faceSelfEnroll: true,
  adminEmail: "admin@lotus.test",
  adminPassword: DEMO_PASSWORD,
  programs: [
    { id: "p-lot-bca", degree: "BCA", department: "Computer Applications", durationYears: 3, courseCode: "BCA" },
    { id: "p-lot-mca", degree: "MCA", department: "Computer Applications", durationYears: 2, courseCode: "MCA" },
  ],
  schema: {
    columns: [
      ...SYSTEM_COLUMNS,
      { key: "enrollment_no", label: "Enrollment Number", type: "text", required: true, system: false },
    ],
    loginKey: "enrollment_no",
    verifyKey: null,
    version: 1,
  },
};

/* ----------------------------------------------------------------- store */

interface MockStudent extends Student {
  propensity: number;
  /** Has the student claimed their own account yet. */
  claimed: boolean;
  faceStatus: "none" | "enrolled";
  courseCode: string;
  admissionYear: number;
  extra: Record<string, string>;
}

interface Db {
  institute: MockInstitute;
  students: MockStudent[];
  attendance: Map<string, Map<string, Status>>;
  holidays: Holiday[];
  settings: RecognitionSettings;
  /** Who is signed in, and as what. */
  session: Session | null;
  /** Student passwords, keyed by the mock's student id. */
  studentPasswords: Map<string, string>;
  /** Claim tokens handed out by the mock claim step, single use. */
  claimTokens: Map<string, { studentId: string; instituteId: string }>;
  /** Previewed import jobs, keyed by job id. */
  jobs: Map<string, { kind: ImportKind; rows: Record<string, string>[]; valid: number; errors: ImportError[]; committed: boolean }>;
  jobSeq: number;
}

let dbs: Map<string, Db> | null = null;

const delay = (ms = 160) => new Promise((r) => setTimeout(r, ms));
const isSunday = (date: Date) => date.getDay() === 0;

function buildDb(institute: MockInstitute, degrees: Degree[]): Db {
  const now = new Date();
  const year = now.getFullYear();
  const today = todayKey();

  const holidays: Holiday[] = STATIC_HOLIDAYS.map(([mmdd, label]) => ({
    date: `${year}-${mmdd}`,
    label,
  }));
  const holidaySet = new Set(holidays.map((h) => h.date));

  const byDegree = new Map<string, Program[]>();
  for (const program of institute.programs) {
    byDegree.set(program.degree, [...(byDegree.get(program.degree) ?? []), program]);
  }

  const students: MockStudent[] = INSTITUTE_NAMES.map((name, i) => {
    const degree = degrees[i % degrees.length];
    const r = seededRandom(hashString(institute.code + name));
    const options = byDegree.get(degree) ?? institute.programs;
    const program = options[Math.floor(r() * options.length)];
    const section = SECTIONS[Math.floor(r() * 6)];
    const maxYear = DEGREE_YEARS[degree];
    const admissionYear = year - Math.min(maxYear - 1, Math.floor(r() * maxYear));
    const loginPrefix = institute.schema.loginKey === "enrollment_no" ? "BCA" : DEGREE_PREFIX[degree];
    const enrollment =
      `${String(admissionYear).slice(2)}${loginPrefix}` +
      `${String(1000 + ((i * 137) % 8999))}`;
    return {
      id: `${institute.id}-s-${i + 1}`,
      enrollmentNo: enrollment,
      name,
      degree,
      department: program.department,
      section,
      year: Math.max(1, Math.min(maxYear, year - admissionYear + 1)),
      isActive: true,
      createdAt: `${year - 2}-08-01T09:00:00.000Z`,
      propensity: 0.52 + r() * 0.47,
      claimed: r() > 0.28,
      faceStatus: r() > 0.35 ? "enrolled" : "none",
      courseCode: program.courseCode,
      admissionYear,
      extra: (
        institute.schema.loginKey === "enrollment_no"
          ? { enrollment_no: enrollment }
          : {
              roll_no: enrollment,
              email: `${name.split(" ")[0].toLowerCase()}${i}@sunrise.test`,
              dob: `200${2 + (i % 4)}-0${1 + (i % 9)}-1${i % 9}`,
            }
      ) as Record<string, string>,
    };
  });

  // One deterministic roll per student per working day, for every day of this
  // year up to today. Regenerating the whole year keeps every derived number
  // (month %, yearly %, analytics) in agreement after a reload.
  const attendance = new Map<string, Map<string, Status>>();
  const jan1 = `${year}-01-01`;
  for (const student of students) {
    const perDay = new Map<string, Status>();
    const sr = seededRandom(hashString(student.id) ^ 0x9e37);
    let cursor = new Date(`${jan1}T00:00:00`);
    while (toKey(cursor) <= today) {
      const key = toKey(cursor);
      if (!isSunday(cursor) && !holidaySet.has(key)) {
        const roll = sr();
        let status: Status;
        if (roll < student.propensity) status = "present";
        else if (roll < student.propensity + 0.06) status = "late";
        else if (roll > 0.995) status = "excused";
        else status = "absent";
        perDay.set(key, status);
      }
      cursor = new Date(cursor.getTime() + 86400000);
    }
    attendance.set(student.id, perDay);
  }

  return {
    institute,
    students,
    attendance,
    holidays,
    settings: {
      model: "buffalo_l",
      sim_threshold: 0.45,
      margin: 0.06,
      votes_needed: 3,
      vote_window: 5,
      min_face_px: 80,
      recheck_seconds: 5,
    },
    session: null,
    studentPasswords: new Map(),
    claimTokens: new Map(),
    jobs: new Map(),
    jobSeq: 1,
  };
}

function allDbs(): Map<string, Db> {
  if (!dbs) {
    dbs = new Map([
      [SUNRISE.id, buildDb(SUNRISE, SUNRISE_DEGREES)],
      [LOTUS.id, buildDb(LOTUS, LOTUS_DEGREES)],
    ]);
  }
  return dbs;
}

/** The institute a student reaches by typing its code. */
export function findInstitute(code: string): Db | undefined {
  const wanted = code.trim().toUpperCase();
  return [...allDbs().values()].find((db) => db.institute.code === wanted);
}

/** The signed-in institute. Sunrise is the default so the console works before sign-in. */
function store(): Db {
  const all = allDbs();
  const signedIn = [...all.values()].find((db) => db.session);
  return signedIn ?? all.get(SUNRISE.id)!;
}

function requireInstituteDb(): Db {
  const db = store();
  if (!db.session) throw new ApiError(401, "Your session has expired. Please sign in again.");
  return db;
}

function requireStudentDb(): Db {
  const db = store();
  if (!db.session) throw new ApiError(401, "Your session has expired. Please sign in again.");
  if (db.session.role !== "student") {
    throw new ApiError(403, "You do not have access to this.");
  }
  return db;
}

/** The signed-in student, resolved from the session. */
function requireSelf(db: Db): MockStudent {
  const student = db.students.find((s) => s.name === db.session?.name);
  if (!student) throw new ApiError(404, "Account not found.");
  return student;
}

/**
 * Asks the login route handler for the httpOnly cookie.
 *
 * Mock mode has no service to sign anybody in, so this is the only way a session
 * cookie appears — and it is the same code path the real service uses, which is
 * the point: the cookie, and therefore `proxy.ts`, behaves identically either way.
 */
async function mintCookie(session: Session, path = "/api/auth/login"): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      path.endsWith("/student")
        ? { code: session.institute.code, loginId: session.name, password: DEMO_PASSWORD }
        : { username: session.name, password: DEMO_PASSWORD },
    ),
  });
  if (!res.ok) {
    throw new ApiError(res.status, "Could not start a session.");
  }
}

/** The session a sign-in produces. The institute travels with it. */
function sessionFor(db: Db, role: Role, name: string): Session {
  return {
    role,
    name,
    institute: {
      id: db.institute.id,
      name: db.institute.name,
      code: db.institute.code,
    },
  };
}

function selfRecord(student: MockStudent): StudentSelf {
  const db = store();
  const duration = db.institute.programs.find((p) => p.courseCode === student.courseCode)
    ?.durationYears ?? 4;
  return {
    id: student.id,
    name: student.name,
    loginId: student.enrollmentNo,
    section: student.section,
    admissionYear: student.admissionYear,
    courseCode: student.courseCode,
    degree: student.degree,
    department: student.department ?? null,
    faceStatus: student.faceStatus,
    instituteName: db.institute.name,
    extra: student.extra,
    currentYear: student.year <= duration ? student.year : null,
    durationYears: duration,
    instituteCode: db.institute.code,
  };
}

function holidayDates(): Set<string> {
  return new Set(store().holidays.map((h) => h.date));
}

/**
 * Reads an uploaded spreadsheet into rows keyed by header label.
 *
 * A CSV, parsed here. An .xlsx would need a parser the bundle does not carry,
 * and the mock is not the place to add one: what the preview screens need from
 * it is the *shape* of the answer — rows in, row errors keyed by this institute's
 * own column labels, counts that add up.
 */
async function readMockSpreadsheet(
  file: File,
  columns: SchemaColumn[],
): Promise<Record<string, string>[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const known = new Set(columns.map((column) => column.label));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((label, i) => {
      row[label] = (cells[i] ?? "").trim();
    });
    void known;
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells;
}

export function isWorkingDay(date: Date, holidays = holidayDates()): boolean {
  if (isSunday(date)) return false;
  return !holidays.has(toKey(date));
}

function statusOn(student: MockStudent, key: string): Status {
  const date = new Date(`${key}T00:00:00`);
  if (isSunday(date)) return "sunday";
  if (holidayDates().has(key)) return "holiday";
  return store().attendance.get(student.id)?.get(key) ?? "absent";
}

function monthDays(key: string): string[] {
  const n = daysInMonth(key);
  return Array.from({ length: n }, (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`);
}

function studentMonth(student: MockStudent, key: string) {
  const holidays = holidayDates();
  const today = todayKey();
  let present = 0;
  let working = 0;
  for (const day of monthDays(key)) {
    if (day > today) break;
    if (!isWorkingDay(new Date(`${day}T00:00:00`), holidays)) continue;
    working++;
    const s = store().attendance.get(student.id)?.get(day);
    if (s === "present" || s === "late" || s === "excused") present++;
  }
  return { present, working, pct: working ? (100 * present) / working : 0 };
}

function markTimes(key: string): string[] {
  const rng = seededRandom(hashString(key));
  return Array.from({ length: 48 }, () => {
    const h = 8 + Math.floor(rng() * 4);
    const m = Math.floor(rng() * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
}

/** The service's rule, in one place: an enrolled face wins over a claimed account. */
function joinStateOf(student: MockStudent): JoinState {
  if (student.faceStatus === "enrolled") return "enrolled";
  return student.claimed ? "joined" : "not_joined";
}

function toStudentRow(student: MockStudent): StudentRow {
  const m = studentMonth(student, monthKey());
  return {
    ...publicStudent(student),
    todayStatus: statusOn(student, todayKey()),
    monthPct: Math.round(m.pct * 10) / 10,
    presentDays: m.present,
    workingDays: m.working,
    joinState: joinStateOf(student),
  };
}

function publicStudent(s: MockStudent): Student {
  const {
    propensity: _propensity,
    claimed: _claimed,
    faceStatus: _faceStatus,
    courseCode: _courseCode,
    admissionYear: _admissionYear,
    extra: _extra,
    ...rest
  } = s;
  void _propensity;
  void _claimed;
  void _faceStatus;
  void _courseCode;
  void _admissionYear;
  void _extra;
  return rest;
}

function groupLabel(s: Student, segment: Segment): string {
  switch (segment) {
    case "department":
      return s.department || "No department";
    case "degree":
      return s.degree;
    case "section":
      return s.section;
    case "year":
      return `Year ${s.year}`;
  }
}

function applyFilter(rows: StudentRow[], filter: StudentFilter): StudentRow[] {
  let out = rows;
  const q = filter.search?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (r) => r.name.toLowerCase().includes(q) || r.enrollmentNo.toLowerCase().includes(q),
    );
  }
  if (filter.degree) out = out.filter((r) => r.degree === filter.degree);
  if (filter.department) out = out.filter((r) => r.department === filter.department);
  if (filter.section) out = out.filter((r) => r.section === filter.section);
  if (filter.year) out = out.filter((r) => r.year === filter.year);
  if (filter.status) out = out.filter((r) => r.todayStatus === filter.status);
  // `joined` asks "has an account", so it includes students who also have a face.
  // That is the service's behaviour and the mock has to agree, or a screen would
  // behave differently depending on which adapter it was talking to.
  if (filter.joined && filter.joined !== "all") {
    out = out.filter((r) =>
      filter.joined === "enrolled" ? r.joinState === "enrolled" : r.joinState !== "not_joined",
    );
  }
  return [...out].sort((a, b) => a.name.localeCompare(b.name));
}

function yearStats(student: MockStudent) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  let present = 0;
  let working = 0;
  const points: YearPoint[] = [];
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const stat = m <= currentMonth ? studentMonth(student, key) : { present: 0, working: 0, pct: 0 };
    present += stat.present;
    working += stat.working;
    points.push({
      month: key,
      presentDays: stat.present,
      workingDays: stat.working,
      pct: Math.round(stat.pct * 10) / 10,
    });
  }
  return { present, working, pct: working ? (100 * present) / working : 0, points };
}

/* ------------------------------------------------------------------- api */

export function createMockApi(): ApiClient {
  let checks = 0;

  return {
    /* --------------------------------------------------------------- session */
    async publicInstitute(code) {
      await delay(200);
      const db = findInstitute(code);
      if (!db) {
        throw new ApiError(404, "We could not find that institute code.");
      }
      const loginKey = db.institute.schema.loginKey;
      const verifyKey = db.institute.schema.verifyKey;
      const labelFor = (key: string) =>
        db.institute.schema.columns.find((column) => column.key === key)?.label ?? null;
      return {
        name: db.institute.name,
        // Ready means the same thing the service means: programmes, a saved
        // schema and at least one student.
        ready: db.institute.programs.length > 0 && db.institute.schema.version > 0
          && db.students.length > 0,
        loginLabel: labelFor(loginKey),
        verifyLabel: verifyKey ? labelFor(verifyKey) : null,
      };
    },

    async login(email, password) {
      const db = [...allDbs().values()].find(
        (d) => d.institute.adminEmail === email.trim().toLowerCase(),
      );
      if (!db || db.institute.adminPassword !== password) {
        throw new ApiError(401, "Email or password is incorrect.");
      }
      db.session = sessionFor(db, "owner", db.institute.adminEmail);
      // The cookie is httpOnly, so the mock cannot set it: the route handler
      // mints it, exactly as it does for the real service. Without this,
      // `proxy.ts` finds no session and bounces the next navigation to /login.
      await mintCookie(db.session);
      return db.session;
    },

    async loginStudent(code, loginId, password) {
      const db = findInstitute(code);
      // One message for every reason, including "no such institute", because the
      // mock is where that rule gets designed before it reaches the service.
      const refused = () => new ApiError(401, "Details don't match");
      if (!db) throw refused();
      const student = db.students.find(
        (s) => s.enrollmentNo === loginId.trim().toUpperCase(),
      );
      if (!student || !student.claimed) throw refused();
      if (db.studentPasswords.get(student.id) !== password) throw refused();
      db.session = sessionFor(db, "student", student.name);
      await mintCookie(db.session, "/api/auth/student");
      return db.session;
    },

    async signupInstitute(input) {
      await delay(400);
      const existing = [...allDbs().values()].find(
        (d) => d.institute.adminEmail === input.admin.email.trim().toLowerCase(),
      );
      if (existing) {
        throw new ApiError(422, "An account already exists for that email.", {
          field: "admin.email",
        });
      }
      const code = `NEW${String(Math.floor(Math.random() * 900) + 100)}`;
      const institute: MockInstitute = {
        id: `inst-${code}`,
        name: input.institute.name,
        code,
        city: input.institute.city ?? "",
        state: input.institute.state ?? "",
        status: "setup",
        timezone: "Asia/Kolkata",
        academicYearStart: null,
        academicYearEnd: null,
        weeklyOff: [7],
        faceSelfEnroll: true,
        adminEmail: input.admin.email.toLowerCase(),
        adminPassword: input.admin.password,
        programs: [],
        schema: { columns: SYSTEM_COLUMNS, loginKey: "course_code", verifyKey: null, version: 0 },
      };
      const db = buildDb(institute, []);
      db.session = sessionFor(db, "owner", institute.adminEmail);
      allDbs().set(institute.id, db);
      await mintCookie(db.session);
      return db.session;
    },

    async claimVerify(input) {
      await delay(300);
      const db = findInstitute(input.code);
      const refused = () => new ApiError(401, "Details don't match");
      if (!db) throw refused();
      const student = db.students.find(
        (s) => s.enrollmentNo === input.loginId.trim().toUpperCase(),
      );
      if (!student || student.claimed || !student.isActive) throw refused();
      if (db.institute.status !== "active") {
        throw new ApiError(403, "This institute is not accepting registrations yet.");
      }
      const verifyKey = db.institute.schema.verifyKey;
      if (verifyKey) {
        const expected = (student.extra[verifyKey] ?? "").trim().toLowerCase();
        if ((input.verifyValue ?? "").trim().toLowerCase() !== expected) throw refused();
      }
      const claimToken = `claim-${db.jobSeq++}-${Math.random().toString(36).slice(2, 10)}`;
      db.claimTokens.set(claimToken, { studentId: student.id, instituteId: db.institute.id });
      const result: ClaimVerifyResult = {
        claimToken,
        expiresIn: 600,
        details: [
          { label: "Name", value: student.name },
          { label: "Course", value: student.courseCode },
          { label: "Section", value: student.section },
        ],
      };
      return result;
    },

    async claimComplete(input) {
      await delay(400);
      if (!input.acceptConsent) {
        throw new ApiError(422, "You have to accept the terms to continue.", {
          field: "acceptConsent",
        });
      }
      const entry = [...allDbs().values()]
        .map((db) => [db, db.claimTokens.get(input.claimToken)] as const)
        .find(([, held]) => held);
      if (!entry) throw new ApiError(401, "Details don't match");
      const [db, held] = entry;
      const student = db.students.find((s) => s.id === held!.studentId);
      // Single use: the token is spent the moment it is read.
      db.claimTokens.delete(input.claimToken);
      if (!student || student.claimed) throw new ApiError(401, "Details don't match");
      student.claimed = true;
      db.studentPasswords.set(student.id, input.password);
      db.session = sessionFor(db, "student", student.name);
      await mintCookie(db.session, "/api/auth/student");
      return db.session;
    },

    async logout() {
      const db = store();
      db.session = null;
      // Same reason as login: the session lives in an httpOnly cookie that only
      // the Next route can clear, otherwise `proxy.ts` still sees a session and
      // redirects /login straight back to the dashboard.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    },

    async session() {
      const db = store();
      if (!db.session) throw new ApiError(401, "Not signed in.");
      return db.session;
    },

    async summary() {
      await delay();
      const s = store();
      const key = todayKey();
      const isWorking = isWorkingDay(new Date(`${key}T00:00:00`));
      let present = 0;
      let totalPresent = 0;
      let totalWorking = 0;
      for (const student of s.students) {
        const status = statusOn(student, key);
        if (status === "present" || status === "late" || status === "excused") present++;
        const m = studentMonth(student, monthKey());
        totalPresent += m.present;
        totalWorking += m.working;
      }
      return {
        presentToday: present,
        absentToday: isWorking ? s.students.length - present : 0,
        monthPct: totalWorking ? Math.round((1000 * totalPresent) / totalWorking) / 10 : 0,
        totalStudents: s.students.length,
        date: key,
        isWorkingDay: isWorking,
      };
    },

    async listStudents(filter = {}) {
      await delay(190);
      return applyFilter(store().students.map(toStudentRow), filter);
    },

    async listStudentsPage(filter = {}) {
      await delay(190);
      const matched = applyFilter(store().students.map(toStudentRow), filter);
      const offset = filter.offset ?? 0;
      // `total` is the whole match, `count` the page: the difference is what tells
      // "load more" apart from the end of the list.
      return {
        students: matched.slice(offset, offset + (filter.limit ?? 200)),
        count: Math.min(filter.limit ?? 200, Math.max(0, matched.length - offset)),
        total: matched.length,
      };
    },

    async getStudent(id) {
      await delay(150);
      const student = store().students.find((x) => x.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      const m = studentMonth(student, monthKey());
      const y = yearStats(student);
      return {
        student: publicStudent(student),
        todayStatus: statusOn(student, todayKey()),
        monthPct: Math.round(m.pct * 10) / 10,
        presentDays: m.present,
        workingDays: m.working,
        yearPct: Math.round(y.pct * 10) / 10,
        yearPresentDays: y.present,
        yearWorkingDays: y.working,
      };
    },

    async studentDays(id, month) {
      await delay(120);
      const student = store().students.find((x) => x.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      const holidays = holidayDates();
      const today = todayKey();
      const times = markTimes(month);
      const rows: DayRecord[] = [];
      for (const day of monthDays(month)) {
        const date = new Date(`${day}T00:00:00`);
        if (isSunday(date)) {
          rows.push({ date: day, status: "sunday" });
          continue;
        }
        if (holidays.has(day)) {
          rows.push({ date: day, status: "holiday" });
          continue;
        }
        if (day > today) {
          rows.push({ date: day, status: "absent" });
          continue;
        }
        const status = store().attendance.get(student.id)?.get(day) ?? "absent";
        const seen = status === "present" || status === "late" || status === "excused";
        rows.push({
          date: day,
          status,
          firstSeenAt: seen ? `${day}T${times[hashString(day + id) % times.length]}:00.000+05:30` : undefined,
          confidence: seen ? Math.round((0.62 + (hashString(id + day) % 30) / 100) * 100) / 100 : undefined,
        });
      }
      return rows;
    },

    async studentYear(id) {
      await delay(110);
      const student = store().students.find((x) => x.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      return yearStats(student).points;
    },

    async updateStudent(id, patch) {
      await delay(140);
      const s = store();
      const idx = s.students.findIndex((x) => x.id === id);
      if (idx < 0) throw new ApiError(404, "Student not found.");
      const current = s.students[idx];
      if (
        patch.enrollmentNo &&
        patch.enrollmentNo !== current.enrollmentNo &&
        s.students.some((x) => x.enrollmentNo === patch.enrollmentNo)
      ) {
        throw new ApiError(409, "That enrollment number is already registered.", {
          field: "enrollment_no",
        });
      }
      s.students[idx] = { ...current, ...patch, id: current.id };
      return publicStudent(s.students[idx]);
    },

    async deleteStudent(id) {
      await delay(140);
      const s = store();
      s.students = s.students.filter((x) => x.id !== id);
      s.attendance.delete(id);
    },

    async analytics(segment, month) {
      await delay(200);
      const s = store();
      if (month > monthKey()) return [];
      const holidays = holidayDates();
      const today = todayKey();

      let working = 0;
      for (const day of monthDays(month)) {
        if (day > today) break;
        if (isWorkingDay(new Date(`${day}T00:00:00`), holidays)) working++;
      }
      if (working === 0) return [];

      const buckets = new Map<string, { students: number; present: number }>();
      for (const student of s.students) {
        if (!student.isActive) continue;
        const label = groupLabel(student, segment);
        const bucket = buckets.get(label) ?? { students: 0, present: 0 };
        bucket.students++;
        const map = s.attendance.get(student.id) ?? new Map();
        for (const day of monthDays(month)) {
          if (day > today) break;
          const st = map.get(day);
          if (st === "present" || st === "late" || st === "excused") bucket.present++;
        }
        buckets.set(label, bucket);
      }

      const groups: GroupStat[] = [...buckets.entries()].map(([label, b]) => ({
        label,
        students: b.students,
        presentDays: b.present,
        workingDays: working,
        pct: Math.round((1000 * b.present) / Math.max(b.students * working, 1)) / 10,
      }));
      groups.sort((a, b) => a.pct - b.pct || a.label.localeCompare(b.label));
      return groups;
    },

    async registerOptions() {
      await delay(60);
      return {
        degrees: [...DEGREE_LIST],
        departments: [...DEPARTMENTS],
        sections: [...SECTIONS],
        poses: [...POSES],
        poseLabels: POSE_LABELS,
        posePrompts: POSE_PROMPTS,
      };
    },

    async enrollCheck(_id, _frame, _baseline, targetPose) {
      // The same capture panel drives this as `registerCheck`, so it has to answer
      // the same way — otherwise a mock build would review a different experience
      // from the real one.
      return this.registerCheck(_frame, _baseline, targetPose);
    },

    async enrollCommit(id, payload) {
      await delay(700);
      const s = store();
      const idx = s.students.findIndex((x) => x.id === id);
      if (idx < 0) throw new ApiError(404, "Student not found.");
      if (payload.frames.length < MIN_GOOD_FRAMES) {
        throw new ApiError(422, "Not enough usable frames were captured.", { field: "frames" });
      }
      const current = s.students[idx];
      // The service refuses to overwrite a working template until it is unlocked,
      // so the mock has to refuse too or "load more" looks different per adapter.
      if (current.faceStatus === "enrolled") {
        throw new ApiError(422, "This student's face is already enrolled. Unlock it first to re-capture.", {
          field: "face_status",
        });
      }
      s.students[idx] = { ...current, faceStatus: "enrolled" };
      return {
        studentId: id,
        name: current.name,
        embeddings: Math.min(MIN_GOOD_FRAMES, payload.frames.length),
        poses: ["front", "left", "right"],
        gallerySize: s.students.filter((x) => x.faceStatus === "enrolled" && x.isActive !== false).length,
      };
    },

    async registerCheck(_frame, _baseline, targetPose) {
      await delay(45);
      checks++;
      const simulated: RegisterCheck["issues"] =
        checks % 9 === 3 ? ["blurry"] : checks % 17 === 8 ? ["too_small"] : [];
      return {
        ok: simulated.length === 0,
        issues: simulated,
        pose: targetPose ?? "front",
        faceBox: [0.34, 0.2, 0.66, 0.74],
      };
    },

    async registerCommit(payload) {
      await delay(700);
      const s = store();
      if (payload.frames.length < MIN_GOOD_FRAMES) {
        throw new ApiError(422, "Not enough usable frames were captured.", { field: "frames" });
      }
      if (s.students.some((x) => x.enrollmentNo === payload.enrollmentNo)) {
        throw new ApiError(409, "That enrollment number is already registered.", {
          field: "enrollment_no",
        });
      }
      const id = `s-${Date.now().toString(36)}`;
      s.students.push({
        id,
        enrollmentNo: payload.enrollmentNo,
        name: payload.name,
        degree: payload.degree,
        department: payload.department,
        section: payload.section,
        year: payload.year,
        isActive: true,
        createdAt: new Date().toISOString(),
        propensity: 0.82,
        claimed: false,
        faceStatus: "enrolled",
        courseCode: `${payload.degree.toUpperCase()}-${(payload.department ?? "GEN").slice(0, 3).toUpperCase()}`,
        admissionYear: new Date().getFullYear() - (payload.year - 1),
        extra: {},
      });
      s.attendance.set(id, new Map());
      return {
        studentId: id,
        name: payload.name,
        embeddings: payload.frames.length,
        poses: payload.poses?.length ? payload.poses : ["front"],
        gallerySize: s.students.length,
      };
    },

    async reenroll(id, payload) {
      await delay(700);
      const s = store();
      const idx = s.students.findIndex((x) => x.id === id);
      if (idx < 0) throw new ApiError(404, "Student not found.");
      if (
        s.students.some((x) => x.enrollmentNo === payload.enrollmentNo && x.id !== id)
      ) {
        throw new ApiError(409, "That enrollment number is already registered.", {
          field: "enrollment_no",
        });
      }
      const current = s.students[idx];
      s.students[idx] = {
        ...current,
        name: payload.name,
        enrollmentNo: payload.enrollmentNo,
        degree: payload.degree,
        department: payload.department,
        section: payload.section,
        year: payload.year,
      };
      return {
        studentId: id,
        name: payload.name,
        embeddings: payload.frames.length,
        poses: payload.poses?.length ? payload.poses : ["front"],
        gallerySize: s.students.length,
      };
    },

    async recentlyMarked() {
      await delay(130);
      const s = store();
      const key = todayKey();
      const times = markTimes(key);
      const rows: MarkedToday[] = [];
      for (const student of s.students) {
        const status = s.attendance.get(student.id)?.get(key);
        if (!status || status === "absent") continue;
        rows.push({
          id: `${student.id}-${key}`,
          studentId: student.id,
          name: student.name,
          enrollmentNo: student.enrollmentNo,
          date: key,
          status: status as MarkedToday["status"],
          firstSeenAt: `${key}T${times[hashString(student.id) % times.length]}:00.000+05:30`,
          confidence: Math.round((0.62 + (hashString(student.id) % 30) / 100) * 100) / 100,
          source: "face",
        });
      }
      rows.sort((a, b) => (b.firstSeenAt ?? "").localeCompare(a.firstSeenAt ?? ""));
      return rows;
    },

    async health() {
      await delay(70);
      const s = store();
      return {
        ok: true,
        model: s.settings.model,
        galleryStudents: s.students.length,
        avgMsPerFrame: Math.round(170 + Math.sin(Date.now() / 4000) * 38),
        sessions: 1,
        today: todayKey(),
        dbReachable: true,
        uptimeSeconds: Math.round(performance.now() / 1000),
      };
    },

    async getSettings() {
      await delay(80);
      return { ...store().settings };
    },

    async saveSettings(patch) {
      await delay(140);
      const s = store();
      s.settings = { ...s.settings, ...patch };
      return { ...s.settings };
    },

    async switchModel(model) {
      await delay(420);
      store().settings.model = model;
    },

    async changePassword(current, next) {
      await delay(260);
      const db = requireInstituteDb();
      if (current !== db.institute.adminPassword) {
        throw new ApiError(401, "Your current password is incorrect.");
      }
      if (next.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(422, "Password must be at least 8 characters.");
      }
      db.institute.adminPassword = next;
    },

    async getHolidays() {
      await delay(90);
      return [...store().holidays].sort((a, b) => a.date.localeCompare(b.date));
    },

    async addHoliday(date, label) {
      await delay(120);
      const s = store();
      const existing = s.holidays.find((h) => h.date === date);
      if (existing) existing.label = label;
      else s.holidays.push({ date, label });
      s.holidays.sort((a, b) => a.date.localeCompare(b.date));
    },

    async removeHoliday(date) {
      await delay(110);
      const s = store();
      s.holidays = s.holidays.filter((h) => h.date !== date);
    },

    /* ------------------------------------------------------ institute setup */
    async setupStatus() {
      await delay(120);
      const db = store();
      const students = db.students.filter((s) => s.isActive);
      const status: SetupStatus = {
        status: {
          account: true,
          structure: { done: db.institute.programs.length > 0, count: db.institute.programs.length },
          studentSchema: {
            done: db.institute.schema.version > 0,
            count: db.institute.schema.columns.length,
          },
          students: {
            done: students.length > 0,
            total: students.length,
            joined: students.filter((s) => s.claimed).length,
            enrolled: students.filter((s) => s.faceStatus === "enrolled").length,
          },
          holidays: { done: db.holidays.length > 0, count: db.holidays.length },
          calendar: {
            done: Boolean(db.institute.academicYearStart && db.institute.academicYearEnd),
            weeklyOff: db.institute.weeklyOff,
            academicYearStart: db.institute.academicYearStart,
            academicYearEnd: db.institute.academicYearEnd,
          },
          // The same predicate the service uses: programmes, a saved schema and
          // at least one student. Holidays are never part of it.
          ready:
            db.institute.programs.length > 0 &&
            db.institute.schema.version > 0 &&
            students.length > 0,
        },
        institute: {
          id: db.institute.id,
          name: db.institute.name,
          code: db.institute.code,
          status: db.institute.status,
          timezone: db.institute.timezone,
          settings: { face_self_enroll: db.institute.faceSelfEnroll },
        },
      };
      return status;
    },

    async structure() {
      await delay(90);
      return store().institute.programs.map((program) => ({ ...program }));
    },

    async studentSchema() {
      await delay(90);
      const schema = store().institute.schema;
      return { ...schema, columns: schema.columns.map((column) => ({ ...column })) };
    },

    async saveStudentSchema(input) {
      await delay(200);
      const db = store();
      // The service's own request model leaves `columns` optional and types it as
      // a plain string, so the payload is narrowed here rather than trusted.
      const schema: StudentSchema = {
        columns: (input.columns ?? []).map(
          (column) =>
            ({
              ...column,
              type: (column.type ?? "text") as SchemaColumn["type"],
            }) satisfies SchemaColumn,
        ),
        loginKey: input.loginKey ?? "",
        verifyKey: input.verifyKey ?? null,
        version: db.institute.schema.version + 1,
      };
      const labels = new Set<string>();
      for (const column of schema.columns) {
        const label = column.label.trim().toLowerCase();
        if (labels.has(label)) {
          throw new ApiError(422, `Two columns are both called '${column.label}'.`, {
            field: "columns",
          });
        }
        labels.add(label);
      }
      if (!schema.loginKey) {
        throw new ApiError(422, "Choose which column students sign in with.", { field: "loginKey" });
      }
      if (schema.loginKey === "name") {
        throw new ApiError(422, "Name cannot be the login ID: two students can share one.", {
          field: "loginKey",
        });
      }
      if (schema.verifyKey && schema.verifyKey === schema.loginKey) {
        throw new ApiError(422, "The verification field must be a different column.", {
          field: "verifyKey",
        });
      }
      db.institute.schema = {
        columns: schema.columns.map((column) => ({ ...column })),
        loginKey: schema.loginKey,
        verifyKey: schema.verifyKey ?? null,
        version: db.institute.schema.version + 1,
      };
      return this.studentSchema();
    },

    async instituteProfile() {
      await delay(80);
      const institute = store().institute;
      return {
        id: institute.id,
        code: institute.code,
        name: institute.name,
        city: institute.city || null,
        state: institute.state || null,
        country: "India",
        timezone: institute.timezone,
        status: institute.status,
        academicYearStart: institute.academicYearStart,
        academicYearEnd: institute.academicYearEnd,
        weeklyOff: institute.weeklyOff,
        faceSelfEnroll: institute.faceSelfEnroll,
      } satisfies InstituteProfile;
    },

    async saveInstituteProfile(patch) {
      await delay(120);
      const institute = store().institute;
      // Only the four fields the service writes. `code` and `status` are not
      // accepted there either, and the mock refusing keeps a form honest about
      // what it can save.
      institute.name = patch.name.split(/\s+/).join(" ") || institute.name;
      // `null` clears the field, an empty string clears it, `undefined` leaves it.
      if (patch.city !== undefined) institute.city = patch.city?.trim() ?? "";
      if (patch.state !== undefined) institute.state = patch.state?.trim() ?? "";
      const s = store();
      s.session = s.session
        ? { ...s.session, institute: { ...s.session.institute, name: institute.name } }
        : s.session;
      return this.instituteProfile();
    },

    async instituteSettings() {
      await delay(80);
      const institute = store().institute;
      return {
        academicYearStart: institute.academicYearStart,
        academicYearEnd: institute.academicYearEnd,
        weeklyOff: institute.weeklyOff,
        timezone: institute.timezone,
        faceSelfEnroll: institute.faceSelfEnroll,
      } satisfies InstituteSettings;
    },

    async saveInstituteSettings(patch) {
      await delay(180);
      const institute = store().institute;
      Object.assign(institute, {
        academicYearStart: patch.academicYearStart ?? institute.academicYearStart,
        academicYearEnd: patch.academicYearEnd ?? institute.academicYearEnd,
        weeklyOff: patch.weeklyOff ?? institute.weeklyOff,
        timezone: patch.timezone ?? institute.timezone,
        faceSelfEnroll: patch.faceSelfEnroll ?? institute.faceSelfEnroll,
      });
      return this.instituteSettings();
    },

    /* -------------------------------------------------------------- imports */
    async importTemplate(kind) {
      await delay(150);
      // A real workbook would be built here; the shape is what a screen needs.
      return new Blob([`FaceTrack ${kind} template\n`], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    },

    async importPreview(kind, file) {
      await delay(420);
      const db = store();
      const jobId = `job-${db.jobSeq++}`;
      const rows = await readMockSpreadsheet(file, db.institute.schema.columns);
      const errors: ImportError[] = [];
      rows.forEach((row, index) => {
        for (const column of db.institute.schema.columns) {
          const value = (row[column.label] ?? "").trim();
          if (column.required && !value) {
            errors.push({ row: index + 2, column: column.label, message: `${column.label} is required.` });
          }
          if (column.type === "email" && value && !/^[^@\s]+@[^@\s.]+$/.test(value)) {
            errors.push({
              row: index + 2,
              column: column.label,
              message: `${column.label} is not a valid email address.`,
            });
          }
        }
      });
      if (kind === "structure") {
        const seen = new Set<string>();
        rows.forEach((row, index) => {
          const code = (row["Course Code"] ?? "").trim().toUpperCase();
          if (!code) return;
          if (seen.has(code)) {
            errors.push({
              row: index + 2,
              column: "Course Code",
              message: "That course code is already used in this file.",
            });
          }
          seen.add(code);
        });
      }
      const job = {
        kind,
        rows,
        valid: rows.length - new Set(errors.map((e) => e.row)).size,
        errors,
        committed: false,
      };
      db.jobs.set(jobId, job);
      const preview: ImportPreview = {
        jobId,
        kind,
        summary: {
          total: rows.length,
          valid: job.valid,
          errors: errors.length,
          warnings: 0,
          newRows: job.valid,
          updatedRows: 0,
        },
        sample: rows.slice(0, 20),
        errors,
        warnings: [],
        errorCount: errors.length,
        warningCount: 0,
      };
      return preview;
    },

    async importCommit(kind, jobId, skipInvalid) {
      await delay(500);
      const db = store();
      const job = db.jobs.get(jobId);
      if (!job) throw new ApiError(404, "That upload has expired. Upload the file again.");
      if (job.committed) {
        return { kind, inserted: job.valid, updated: 0, alreadyCommitted: true };
      }
      if (job.errors.length > 0 && !skipInvalid) {
        throw new ApiError(422, "Fix the errors, or skip the invalid rows.", {
          field: "skipInvalid",
        });
      }
      const badRows = new Set(job.errors.map((e) => e.row));
      const good = skipInvalid ? job.rows.filter((_, i) => !badRows.has(i + 2)) : job.rows;
      if (kind === "structure") {
        for (const row of good) {
          const code = (row["Course Code"] ?? "").trim().toUpperCase();
          if (!code || db.institute.programs.some((p) => p.courseCode === code)) continue;
          db.institute.programs.push({
            id: `p-${code.toLowerCase()}`,
            degree: (row["Degree"] ?? "").trim(),
            department: (row["Department"] ?? "").trim() || null,
            durationYears: Number(row["Duration (Years)"] ?? row["Duration"] ?? 4) || 4,
            courseCode: code,
          });
        }
      } else if (kind === "students") {
        const schema = db.institute.schema;
        for (const row of good) {
          const loginId = (row[schema.loginKey] ?? "").trim().toUpperCase();
          if (!loginId || db.students.some((s) => s.enrollmentNo === loginId)) continue;
          const extra: Record<string, string> = {};
          for (const column of schema.columns) {
            if (!column.system) extra[column.key] = (row[column.label] ?? "").trim();
          }
          const program = db.institute.programs[0];
          db.students.push({
            id: `${db.institute.id}-s-${db.students.length + 1}`,
            enrollmentNo: loginId,
            name: (row["Name"] ?? "").trim(),
            degree: (program?.degree ?? "BTech") as Degree,
            department: program?.department ?? null,
            section: (row["Section"] ?? "A").trim().toUpperCase(),
            year: 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            propensity: 0.7,
            claimed: false,
            faceStatus: "none",
            courseCode: program?.courseCode ?? "BTECH-CSE",
            admissionYear: Number(row["Admission Year"] ?? new Date().getFullYear()) || 2025,
            extra,
          });
        }
      } else if (kind === "holidays") {
        for (const row of good) {
          const date = (row["Date"] ?? "").trim();
          const label = (row["Label"] ?? row["Holiday"] ?? "").trim();
          if (!date || !label) continue;
          const existing = db.holidays.find((h) => h.date === date);
          if (existing) existing.label = label;
          else db.holidays.push({ date, label });
        }
        db.holidays.sort((a, b) => a.date.localeCompare(b.date));
      }
      job.committed = true;
      const result: ImportCommit = {
        kind,
        inserted: good.length,
        updated: 0,
        alreadyCommitted: false,
      };
      // Importing students into a ready institute makes it live, which is what
      // the checklist's completion banner celebrates.
      if (kind === "students" && db.students.length > 0) db.institute.status = "active";
      return result;
    },

    importErrorsUrl(kind, jobId) {
      return `/api/mock/${kind}/${jobId}/errors.csv`;
    },

    /* ------------------------------------------------------- student writes */
    async createStudent(values) {
      await delay(220);
      const db = store();
      const schema = db.institute.schema;
      const label = (key: string) =>
        schema.columns.find((column: SchemaColumn) => column.key === key)?.label ?? key;
      const name = String(values.name ?? "").trim();
      const loginId = String(values[schema.loginKey] ?? "").trim().toUpperCase();
      if (!name) throw new ApiError(422, `${label("name")} is required.`, { field: "name" });
      if (db.students.some((s) => s.enrollmentNo === loginId)) {
        throw new ApiError(422, `That ${label(schema.loginKey)} is already in use.`, {
          field: schema.loginKey,
        });
      }
      const courseCode = String(values.course_code ?? "").trim().toUpperCase();
      const program = db.institute.programs.find((p) => p.courseCode === courseCode);
      if (!program) {
        throw new ApiError(422, `That course code is not in the structure yet.`, {
          field: "course_code",
        });
      }
      const extra: Record<string, string> = {};
      for (const column of schema.columns) {
        if (!column.system) extra[column.key] = String(values[column.key] ?? "").trim();
      }
      const id = `${db.institute.id}-s-${db.students.length + 1}`;
      const admissionYear = Number(values.admission_year ?? new Date().getFullYear());
      db.students.push({
        id,
        enrollmentNo: loginId,
        name,
        degree: program.degree as Degree,
        department: program.department,
        section: String(values.section ?? "A").trim().toUpperCase(),
        year: Math.max(1, new Date().getFullYear() - admissionYear + 1),
        isActive: true,
        createdAt: new Date().toISOString(),
        propensity: 0.7,
        claimed: false,
        faceStatus: "none",
        courseCode: program.courseCode,
        admissionYear,
        extra,
      });
      db.attendance.set(id, new Map());
      return { id, name };
    },

    async patchStudent(id, values) {
      await delay(200);
      const db = store();
      const student = db.students.find((s) => s.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      if (values.name !== undefined) student.name = String(values.name).trim();
      if (values.section !== undefined) student.section = String(values.section).trim().toUpperCase();
      if (values.admission_year !== undefined) {
        student.admissionYear = Number(values.admission_year);
        student.year = Math.max(1, new Date().getFullYear() - student.admissionYear + 1);
      }
      const loginKey = db.institute.schema.loginKey;
      if (values[loginKey] !== undefined) {
        student.enrollmentNo = String(values[loginKey]).trim().toUpperCase();
      }
      if (values.course_code !== undefined) {
        const program = db.institute.programs.find(
          (p) => p.courseCode === String(values.course_code).toUpperCase(),
        );
        if (!program) {
          throw new ApiError(422, "That course code is not in the structure yet.", {
            field: "course_code",
          });
        }
        student.courseCode = program.courseCode;
        student.degree = program.degree as Degree;
        student.department = program.department;
      }
      for (const column of db.institute.schema.columns) {
        if (!column.system && values[column.key] !== undefined) {
          student.extra[column.key] = String(values[column.key]).trim();
        }
      }
    },

    async reactivateStudent(id) {
      await delay(150);
      const student = store().students.find((s) => s.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      student.isActive = true;
    },

    async resetStudentAccess(id) {
      await delay(180);
      const db = store();
      const student = db.students.find((s) => s.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      student.claimed = false;
      db.studentPasswords.delete(student.id);
    },

    async unlockStudentFace(id) {
      await delay(180);
      const student = store().students.find((s) => s.id === id);
      if (!student) throw new ApiError(404, "Student not found.");
      student.faceStatus = "none";
    },

    /* -------------------------------------------------------------- reports */
    async dashboardStudents() {
      await delay(110);
      return store().students.filter((s) => s.isActive).map(toStudentRow);
    },

    async markAttendance(input) {
      await delay(180);
      const db = store();
      const student = db.students.find((s) => s.id === input.studentId);
      if (!student) throw new ApiError(404, "Student not found.");
      const perDay = db.attendance.get(student.id) ?? new Map<string, Status>();
      perDay.set(input.date, (input.status ?? "present") as Status);
      db.attendance.set(student.id, perDay);
    },

    async clearAttendance(id, date) {
      await delay(150);
      const perDay = store().attendance.get(id);
      if (!perDay?.delete(date)) throw new ApiError(404, "No attendance row for that day.");
    },

    exportCsvUrl(from, to) {
      return `/api/mock/export/attendance.csv?from=${from}&to=${to}`;
    },

    /* ------------------------------------------------------- student portal */
    async me() {
      await delay(110);
      const db = requireStudentDb();
      return selfRecord(requireSelf(db));
    },

    async meSummary() {
      await delay(120);
      const db = requireStudentDb();
      const student = requireSelf(db);
      const month = studentMonth(student, monthKey());
      const year = yearStats(student);
      const key = todayKey();
      const status = statusOn(student, key);
      const seen = status === "present" || status === "late" || status === "excused";
      const times = markTimes(key);
      return {
        monthPct: Math.round(month.pct * 10) / 10,
        monthPresent: month.present,
        monthWorking: month.working,
        yearPct: Math.round(year.pct * 10) / 10,
        yearPresent: year.present,
        yearWorking: year.working,
        todayStatus: seen ? status : isWorkingDay(new Date(`${key}T00:00:00`)) ? "working" : "off",
        firstSeenAt: seen ? `${key}T${times[hashString(student.id) % times.length]}:00.000+05:30` : undefined,
        confidence: seen
          ? Math.round((0.62 + (hashString(student.id) % 30) / 100) * 100) / 100
          : undefined,
      };
    },

    async meAttendance(month) {
      await delay(120);
      const db = requireStudentDb();
      const student = requireSelf(db);
      const times = markTimes(month);
      const today = todayKey();
      return monthDays(month).map((day): DayRecord => {
        const status = statusOn(student, day);
        const seen = status === "present" || status === "late" || status === "excused";
        const index = hashString(day + student.id) % times.length;
        return {
          date: day,
          status: day > today ? "sunday" : status,
          firstSeenAt:
            seen && day <= today ? `${day}T${times[index]}:00.000+05:30` : undefined,
          confidence: seen ? Math.round((0.62 + (hashString(student.id + day) % 30) / 100) * 100) / 100 : undefined,
        };
      });
    },

    async meHolidays() {
      await delay(90);
      const db = requireStudentDb();
      return [...db.holidays].sort((a, b) => a.date.localeCompare(b.date));
    },

    async changeOwnPassword(current, next) {
      await delay(240);
      const db = requireStudentDb();
      const student = requireSelf(db);
      if (db.studentPasswords.get(student.id) !== current) {
        throw new ApiError(401, "Your current password is incorrect.");
      }
      db.studentPasswords.set(student.id, next);
    },

    async faceCheck(frame, baseline) {
      return this.registerCheck(frame, baseline);
    },

    async faceCommit(frames) {
      await delay(600);
      const db = requireStudentDb();
      const student = requireSelf(db);
      if (student.faceStatus === "enrolled") {
        throw new ApiError(409, "Already enrolled. Ask your institute admin to unlock.");
      }
      if (frames.length < MIN_GOOD_FRAMES) {
        throw new ApiError(422, "Not enough usable frames were captured.", {
          field: "frames",
          issues: ["Turn your head left, right, up and down while capturing."],
        });
      }
      student.faceStatus = "enrolled";
      return { stored: frames.length, poses: ["front", "left", "right"] };
    },

    streamUrl() {
      return "mock://recognize";
    },
  };
}

export { ISSUE_PRIORITY, isWorkingDay as workingDay };
