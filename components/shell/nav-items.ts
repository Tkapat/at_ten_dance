import {
  BarChart3,
  LayoutDashboard,
  Plus,
  ScanFace,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Where it sits in the mobile tab bar (Register is the floating button). */
  order: number;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, order: 0 },
  { href: "/scan", label: "Scan", icon: ScanFace, order: 1 },
  { href: "/register", label: "Register", icon: Plus, order: 2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3, order: 3 },
  { href: "/settings", label: "Settings", icon: Settings, order: 4 },
];

/** Tab bar shows everything except Register, which becomes the FAB. */
export const TAB_ITEMS = NAV_ITEMS.filter((i) => i.href !== "/register");

export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/students")) return "Student";
  const match = NAV_ITEMS.find(
    (i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)),
  );
  return match?.label ?? "FaceTrack";
}
