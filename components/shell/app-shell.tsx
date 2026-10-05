"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { navFor, titleForPath } from "./nav-items";
import { DropdownMenu, MenuItem, MenuSeparator } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/button";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/token";
import { CodeChip } from "@/components/ui/code-chip";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useSession } from "@/hooks/use-session";
import type { Role } from "@/lib/types";
import { useMounted } from "@/hooks/use-mounted";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  // Until the cookie is read there is no role, and therefore no nav. `owner` is
  // the shape the console has; a person mid-redirect sees it for a frame rather
  // than an empty screen.
  const role = session?.role ?? "owner";
  const title = titleForPath(pathname, role);
  const items = navFor(role);

  return (
    <div className="relative flex min-h-dvh w-full">
      <DesktopRail pathname={pathname} items={items} />

      <div className="flex min-h-dvh w-full flex-1 flex-col lg:pl-16">
        <TopBar title={title} session={session} />
        <main
          className={cn(
            "mx-auto w-full max-w-[1100px] flex-1 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pt-7 lg:pb-12",
          )}
        >
          {children}
        </main>
      </div>

      <TabBar pathname={pathname} items={items} />
    </div>
  );
}

/* --------------------------------------------------------------- desktop */

function DesktopRail({
  pathname,
  items,
}: {
  pathname: string;
  items: ReturnType<typeof navFor>;
}) {
  return (
    <aside
      className={cn(
        "group fixed inset-y-0 left-0 z-40 hidden w-16 flex-col overflow-hidden border-r border-border bg-background",
        "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:w-[220px] focus-within:w-[220px] lg:flex",
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <LogoMark className="size-7 shrink-0" />
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          FaceTrack
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/" || item.href === "/me"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <m.span
                  layoutId="rail-active"
                  className="absolute inset-0 rounded-xl bg-muted"
                  transition={spring.snappy}
                />
              )}
              <item.icon className="relative size-5 shrink-0" />
              <span className="relative whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className="h-px w-full bg-border opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
        <p className="mt-3 whitespace-nowrap px-3 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          Institute console
        </p>
      </div>
    </aside>
  );
}

/* ----------------------------------------------------------------- mobile */

function TabBar({
  pathname,
  items,
}: {
  pathname: string;
  items: ReturnType<typeof navFor>;
}) {
  // Five columns for the console (which has a floating action button), four for
  // the student portal. One grid, sized by what is actually in it.
  const columns = items.length >= 5 ? "grid-cols-5" : "grid-cols-4";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div className="glass-strong border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className={cn("relative mx-auto grid h-16 max-w-md items-center px-1", columns)}>
          {items.map((item) => {
            const active =
              item.href === "/" || item.href === "/me"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && (
                  <m.span
                    layoutId="tab-active"
                    className="absolute inset-x-2 top-1 h-8 rounded-lg bg-muted"
                    transition={spring.snappy}
                  />
                )}
                <item.icon className="relative size-5" />
                <span className="relative">{item.tabLabel ?? item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ----------------------------------------------------------------- topbar */

function TopBar({
  title,
  session,
}: {
  title: string;
  session: { role: Role; name: string; institute: { id: string; name: string; code: string } } | undefined;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const institute = session?.institute;
  const isStudent = session?.role === "student";

  async function logout() {
    clearToken();
    await api().logout().catch(() => undefined);
    qc.clear();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border glass-strong">
      <div className="mx-auto w-full max-w-[1100px] px-4 md:px-6">
        {/* Title row. On a phone the institute name moves under the title rather
            than beside it, because a truncated institute name is worse than a
            truncated page title: the title repeats in the tab below. */}
        <div className="flex h-14 items-center gap-3 md:h-16">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary lg:hidden">
            <LogoMark className="size-5" />
          </span>

          <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-none tracking-[-0.02em] md:text-[28px]">
            {title}
          </h1>

          {/* Desktop: the institute sits beside the title, where there is room. */}
          <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
            {institute?.name && (
              <span className="max-w-[220px] truncate text-sm text-muted-foreground">
                {institute.name}
              </span>
            )}
            {institute?.code && <CodeChip code={institute.code} />}
          </div>

          <IconButton
            label={mounted && resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="size-5" />
            ) : (
              <Moon className="size-5" />
            )}
          </IconButton>

          <DropdownMenu
            trigger={
              <button
                type="button"
                aria-label="Account menu"
                className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <UserRound className="size-5" />
              </button>
            }
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{session?.name ?? "Signed in"}</p>
              <p className="text-xs text-muted-foreground">
                {isStudent ? "Student" : "Institute account"}
              </p>
            </div>
            <MenuSeparator />
            <MenuItem onSelect={logout} destructive icon={<LogOut className="size-4" />}>
              Sign out
            </MenuItem>
          </DropdownMenu>
        </div>

        {/* Mobile: one compact row, so the institute is on screen without the
            title having to share a line with it. */}
        <div className="-mt-0.5 flex items-center gap-2 pb-2 lg:hidden">
          {institute?.name && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {institute.name}
            </span>
          )}
          {institute?.code && <CodeChip code={institute.code} size="sm" />}
        </div>
      </div>
    </header>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" className="fill-primary" />
      <path
        d="M7 8.5V7.6a.6.6 0 0 1 .6-.6H8.5M15.5 7h.9a.6.6 0 0 1 .6.6v.9M7 15.5v.9a.6.6 0 0 0 .6.6h.9M15.5 16.4h.9a.6.6 0 0 0 .6-.6v-.9"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <ellipse cx="12" cy="12" rx="3.1" ry="3.9" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="10.6" r="1.05" fill="#fff" />
    </svg>
  );
}
