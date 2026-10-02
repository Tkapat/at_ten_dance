import { format, parseISO, isValid } from "date-fns";

/** Local `yyyy-MM-dd`, the shape the backend stores for IST calendar dates. */
export function toKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function monthKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function parseKey(key: string): Date {
  return parseISO(key.length === 7 ? `${key}-01` : key);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function safeParse(value: string | undefined | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/** `2026-10-03` → `Sat, 3 Oct` */
export function formatDay(key: string): string {
  const d = safeParse(key);
  return d ? format(d, "EEE, d MMM") : "—";
}

export function formatLongDay(key: string): string {
  const d = safeParse(key);
  return d ? format(d, "EEEE, d MMMM yyyy") : "—";
}

export function formatMonth(key: string): string {
  const d = parseKey(key);
  return format(d, "MMMM yyyy");
}

export function formatShortDate(key: string): string {
  const d = safeParse(key);
  return d ? format(d, "d MMM") : "—";
}

export function formatWeekday(key: string): string {
  const d = safeParse(key);
  return d ? format(d, "EEE") : "—";
}

/** ISO timestamp → `09:14` (device-local, matching how the admin reads a day). */
export function formatTime(iso: string | undefined | null): string {
  const d = safeParse(iso);
  return d ? format(d, "HH:mm") : "—";
}

/** Greeting bucket for the dashboard headline. */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function addMonthsKey(key: string, delta: number): string {
  const d = parseKey(key);
  d.setMonth(d.getMonth() + delta);
  return format(d, "yyyy-MM");
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function isSameMonth(a: string, b: string): boolean {
  return a === b;
}
