import { z } from "zod";
import { DEGREE_LIST, MIN_PASSWORD_LENGTH, type Degree } from "./constants";

/**
 * Form validation runs client-side for a fast message, but the server is
 * authoritative: its 422/409 payload is always rendered verbatim on top.
 */

const DEGREE_ENUM = z.enum(DEGREE_LIST as [Degree, ...Degree[]]);

export const studentFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the student's full name."),
  enrollmentNo: z
    .string()
    .trim()
    .min(3, "Enter a valid enrollment number.")
    .regex(/^[A-Za-z0-9.\-/]+$/, "Enrollment numbers can only contain letters, numbers, . - /"),
  degree: DEGREE_ENUM,
  department: z.string().optional(),
  section: z.string().min(1, "Pick a section."),
  // Kept as a string so the form's value type and the parsed type match —
  // the select submits a string, and the caller converts before hitting the API.
  year: z.string().regex(/^[1-4]$/, "Year must be between 1 and 4."),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  });

export type PasswordFormValues = z.infer<typeof passwordSchema>;

export const holidaySchema = z.object({
  date: z.string().min(1, "Pick a date."),
  label: z.string().trim().min(2, "Give the holiday a name."),
});

export type HolidayFormValues = z.infer<typeof holidaySchema>;
