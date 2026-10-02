/**
 * Business rules shared with the backend.
 *
 * Mirrors `backend/app/constants.py` — keep the two in sync. The UI is allowed
 * to validate early for a better message, but the server is authoritative and
 * its 422/409 responses are always rendered verbatim.
 */

export const DEGREES = {
  BTech: { years: 4, hasDepartment: true },
  MTech: { years: 2, hasDepartment: true },
  BCA: { years: 3, hasDepartment: false },
  MCA: { years: 2, hasDepartment: false },
} as const;

export type Degree = keyof typeof DEGREES;

export const DEGREE_LIST = Object.keys(DEGREES) as Degree[];

export const DEPARTMENTS = [
  "CSE",
  "IT",
  "ECE",
  "EEE",
  "ME",
  "CE",
  "AI&ML",
  "Data Science",
] as const;

export const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export const ORDINALS = ["1st", "2nd", "3rd", "4th"] as const;

export const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`;

/** Coerce any casing the API might return into the canonical degree name. */
export function normalizeDegree(value: string): Degree | null {
  const found = DEGREE_LIST.find((d) => d.toLowerCase() === value.trim().toLowerCase());
  return found ?? null;
}

export function yearsFor(degree: Degree): number[] {
  return Array.from({ length: DEGREES[degree].years }, (_, i) => i + 1);
}

export function departmentsFor(degree: Degree): readonly string[] {
  return DEGREES[degree].hasDepartment ? DEPARTMENTS : [];
}

export const POSES = ["front", "left", "right", "up", "down"] as const;
export type Pose = (typeof POSES)[number];

export const POSE_LABELS: Record<Pose, string> = {
  front: "Face the camera",
  left: "Turn your head to the left",
  right: "Turn your head to the right",
  up: "Look up slightly",
  down: "Look down slightly",
};

export const POSE_PROMPTS: Record<Pose, string> = {
  front: "Look straight at the camera and keep still.",
  left: "Slowly turn your head to your left, keep your shoulders still.",
  right: "Slowly turn your head to your right, keep your shoulders still.",
  up: "Tilt your chin up a little and hold.",
  down: "Tilt your chin down a little and hold.",
};

export const FRAMES_PER_POSE = 3;
export const TOTAL_FRAMES = 12;
export const MIN_GOOD_FRAMES = 8;
export const MIN_POSES = 3;

/** Friendly copy for every quality issue the capture step can report. */
export const ISSUE_TEXT: Record<RegisterIssue, string> = {
  no_face: "Move into the oval and face the camera",
  multiple_faces: "Only one person please",
  too_small: "Move closer",
  too_dark: "Find better light",
  too_bright: "Reduce the light",
  blurry: "Hold still",
  off_center: "Stay inside the frame",
  bad_pose: "Try that angle again",
};

export const ISSUE_PRIORITY: RegisterIssue[] = [
  "no_face",
  "multiple_faces",
  "too_small",
  "off_center",
  "too_dark",
  "too_bright",
  "blurry",
  "bad_pose",
];

export type RegisterIssue =
  | "no_face"
  | "multiple_faces"
  | "too_small"
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "off_center"
  | "bad_pose";

export const LIVE_HINT_TEXT: Record<string, string> = {
  "Move closer": "Move closer",
  "Low light": "Improve lighting",
  "Turn towards the camera": "Face the camera",
};

/** `21BCS0045`-style enrollment prefixes, used by the mock data only. */
export const DEGREE_CODE: Record<Degree, string> = {
  BTech: "B",
  MTech: "M",
  BCA: "BC",
  MCA: "MC",
};

export const DEPT_CODE: Record<string, string> = {
  CSE: "CS",
  IT: "IT",
  ECE: "EC",
  EEE: "EE",
  ME: "ME",
  CE: "CE",
  "AI&ML": "AI",
  "Data Science": "DS",
};

/** Minimum length the server accepts for a password. */
export const MIN_PASSWORD_LENGTH = 8;

/** Demo credentials, used only by the mock adapter's sign-in. */
export const DEMO_USERNAME = "admin";
export const DEMO_PASSWORD = "facetrack";

export const STATUS_ORDER = [
  "present",
  "late",
  "excused",
  "absent",
  "holiday",
  "sunday",
] as const;
