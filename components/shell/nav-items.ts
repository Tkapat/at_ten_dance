import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  LayoutDashboard,
  ScanFace,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short label for the mobile tab bar, where width is the constraint. */
  tabLabel?: string;
}

export type NavGroup = NavItem[];

/**
 * The nav a signed-in person sees, and only that.
 *
 * Built from the session's role rather than filtered from one list, because the
 * two halves of the app have nothing in common: an admin has no attendance view
 * of their own, and a student has no console. Rendering a hidden item and
 * letting `proxy.ts` redirect is a worse answer than not rendering it — a tab
 * that bounces is a bug the person can see.
 *
 * `staff` is an institute account with no Settings and no Setup: those two write
 * to the institute rather than to the day's attendance.
 */
export function navFor(role: Role): NavGroup {
  if (role === "student") {
    return [
      { href: "/me", label: "Home", tabLabel: "Home", icon: LayoutDashboard },
      { href: "/me/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/me/holidays", label: "Holidays", icon: CalendarDays },
      { href: "/me/profile", label: "Profile", icon: UserRound },
    ];
  }
  const items: NavGroup = [
    { href: "/", label: "Home", tabLabel: "Home", icon: LayoutDashboard },
    { href: "/scan", label: "Scan", icon: ScanFace },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/students", label: "Students", tabLabel: "Students", icon: Users },
  ];
  if (role === "owner" || role === "admin") {
    items.push({ href: "/settings", label: "Settings", icon: Settings });
  }
  return items;
}

/**
 * The page title, from the same source as the nav.
 *
 * A title the nav does not describe is a title the person cannot navigate back
 * from, so anything unrecognised falls back to the app's name rather than
 * inventing a heading.
 */
export function titleForPath(pathname: string, role: Role): string {
  const items = navFor(role);
  if (role === "student") {
    if (pathname === "/me") return "Home";
  }
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/students/")) return "Student";
  if (pathname.startsWith("/setup")) return "Setup";
  const match = items.find(
    (item) => item.href !== "/" && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return match?.label ?? "FaceTrack";
}