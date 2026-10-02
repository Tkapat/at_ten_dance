import {
  DEGREE_LIST,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  DEPARTMENTS,
  DEPT_CODE,
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
  DayRecord,
  GroupStat,
  Holiday,
  MarkedToday,
  RecognitionSettings,
  RegisterCheck,
  Status,
  Student,
  StudentRow,
} from "./types";
import type { FaceTrackApi, Segment, StudentFilter, YearPoint } from "./api";
import { ApiError } from "./api";
import { daysInMonth, monthKey, toKey, todayKey } from "./format";
import { hashString, seededRandom } from "./utils";

/* --------------------------------------------------------------- fixtures */

const NAMES = [
  "Aarav Sharma", "Priya Iyer", "Rohan Verma", "Ananya Nair", "Kabir Singh",
  "Meera Krishnan", "Aditya Rao", "Ishita Bose", "Vikram Chandra", "Sneha Pillai",
  "Arjun Menon", "Kavya Reddy", "Nikhil Joshi", "Tanvi Deshmukh", "Siddharth Malhotra",
  "Riya Kapoor", "Manav Trivedi", "Aisha Khan", "Devansh Gupta", "Nisha Patel",
  "Karan Mehta", "Pooja Balakrishnan", "Yash Agarwal", "Laila Fernandes", "Harsh Vardhan",
  "Divya Srinivasan", "Omar Sheikh", "Ritika Sinha", "Aditya Narayan", "Sanjana Kulkarni",
  "Varun Dixit", "Aparna Bhatt", "Zaid Ansari", "Shreya Ghosh", "Raghav Chopra",
  "Nandini Ramesh", "Farhan Qureshi", "Tara Elizabeth", "Gurpreet Sandhu", "Nikita Jain",
] as const;

/** Mostly BTech, with a realistic tail of postgrads. */
const DEGREE_PLAN: Degree[] = [
  ...Array.from({ length: 24 }, () => "BTech" as Degree),
  ...Array.from({ length: 6 }, () => "MTech" as Degree),
  ...Array.from({ length: 5 }, () => "BCA" as Degree),
  ...Array.from({ length: 5 }, () => "MCA" as Degree),
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

/* ----------------------------------------------------------------- store */

interface MockStudent extends Student {
  propensity: number;
}

interface Db {
  students: MockStudent[];
  attendance: Map<string, Map<string, Status>>;
  holidays: Holiday[];
  password: string;
  settings: RecognitionSettings;
}

let db: Db | null = null;

const delay = (ms = 160) => new Promise((r) => setTimeout(r, ms));
const isSunday = (date: Date) => date.getDay() === 0;

function buildDb(): Db {
  const now = new Date();
  const year = now.getFullYear();
  const today = todayKey();

  const holidays: Holiday[] = STATIC_HOLIDAYS.map(([mmdd, label]) => ({
    date: `${year}-${mmdd}`,
    label,
  }));
  const holidaySet = new Set(holidays.map((h) => h.date));

  const students: MockStudent[] = NAMES.map((name, i) => {
    const degree = DEGREE_PLAN[i];
    const r = seededRandom(hashString(name));
    const department =
      degree === "BTech" || degree === "MTech"
        ? DEPARTMENTS[Math.floor(r() * DEPARTMENTS.length)]
        : null;
    const section = SECTIONS[Math.floor(r() * 6)];
    const maxYear = DEGREE_YEARS[degree];
    const enrollment =
      `${22 + (i % 2)}${DEGREE_PREFIX[degree]}` +
      `${department ? DEPT_CODE[department] ?? "XX" : section}` +
      `${String(1000 + ((i * 137) % 8999))}`;
    return {
      id: `s-${i + 1}`,
      enrollmentNo: enrollment,
      name,
      degree,
      department,
      section,
      year: 1 + Math.floor(r() * maxYear),
      isActive: true,
      createdAt: `${year - 2}-08-01T09:00:00.000Z`,
      propensity: 0.52 + r() * 0.47,
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
    students,
    attendance,
    holidays,
    password: DEMO_PASSWORD,
    settings: {
      model: "buffalo_l",
      sim_threshold: 0.45,
      margin: 0.06,
      votes_needed: 3,
      vote_window: 5,
      min_face_px: 80,
      recheck_seconds: 5,
    },
  };
}

function store(): Db {
  if (!db) db = buildDb();
  return db;
}

function holidayDates(): Set<string> {
  return new Set(store().holidays.map((h) => h.date));
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

function toStudentRow(student: MockStudent): StudentRow {
  const m = studentMonth(student, monthKey());
  return {
    ...publicStudent(student),
    todayStatus: statusOn(student, todayKey()),
    monthPct: Math.round(m.pct * 10) / 10,
    presentDays: m.present,
    workingDays: m.working,
  };
}

function publicStudent(s: MockStudent): Student {
  const { propensity: _propensity, ...rest } = s;
  void _propensity;
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
  if (filter.section) out = out.filter((r) => r.section === filter.section);
  if (filter.year) out = out.filter((r) => r.year === filter.year);
  if (filter.status) out = out.filter((r) => r.todayStatus === filter.status);
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

export function createMockApi(): FaceTrackApi {
  let checks = 0;

  return {
    async login(username, password) {
      const s = store();
      if (username.trim().toLowerCase() !== DEMO_USERNAME || password !== s.password) {
        throw new ApiError(401, "Incorrect username or password.");
      }
      // The session cookie is httpOnly and signed server-side, so the mock has
      // to mint it through the login route too — otherwise `proxy.ts` finds no
      // cookie and bounces the next navigation back to /login. The route's own
      // credential check is satisfied with the demo pair; in mock mode the
      // browser is the authority on what the current password is.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: DEMO_USERNAME, password: DEMO_PASSWORD }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new ApiError(res.status, body?.error || "Could not start a session.");
      }
      return { username: DEMO_USERNAME };
    },

    async logout() {
      // Same reason as login: the session lives in an httpOnly cookie that only
      // the Next route can clear, otherwise `proxy.ts` still sees a session and
      // redirects /login straight back to the dashboard.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
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
      const s = store();
      if (current !== s.password) throw new ApiError(401, "Your current password is incorrect.");
      if (next.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(422, "Password must be at least 8 characters.");
      }
      s.password = next;
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

    streamUrl() {
      return "mock://recognize";
    },
  };
}

export { ISSUE_PRIORITY, isWorkingDay as workingDay };
