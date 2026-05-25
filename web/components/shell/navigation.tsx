"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Settings,
  Store,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weeks", label: "Weeks", icon: CalendarDays },
  { href: "/caterers", label: "Caterers", icon: Store },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function ShellNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-2" aria-label="Main navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active &&
                "bg-brand-tint text-brand ring-1 ring-[var(--padea-crimson-border)]",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <div className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Week Workflow
      </div>
      <div className="rounded-md border border-border bg-muted p-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ClipboardCheck className="size-4 text-brand" aria-hidden="true" />
          Current workflow
        </div>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
          <li>Choose a week from Weeks or Dashboard.</li>
          <li>Menu setup and order review are available from the week view.</li>
          <li>Caterer emails are available from the week view.</li>
        </ul>
      </div>
    </nav>
  );
}
