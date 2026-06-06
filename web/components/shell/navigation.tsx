"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Bot,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Store,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/autopilot", label: "Autopilot", icon: Bot },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/weeks", label: "Weeks", icon: CalendarDays },
  { href: "/caterers", label: "Caterers", icon: Store },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/audit", label: "Audit", icon: ScrollText },
] as const;


export function ShellNavigation({
  openExceptionCount,
}: {
  openExceptionCount: number;
}) {
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
        Autopilot
      </div>
      <div className="rounded-md border border-border bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
            <Bot className="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="truncate">Status</span>
          </div>
          <StatusBadge
            status={openExceptionCount > 0 ? "Failed" : "Ready"}
            className="shrink-0"
          />
        </div>
        <div className="mt-3 text-sm font-medium leading-5 text-foreground">
          {openExceptionCount > 0
            ? `${openExceptionCount} exception${openExceptionCount === 1 ? "" : "s"} raised`
            : "All clear"}
        </div>
        <Link
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover"
          href="/autopilot"
        >
          Open autopilot
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
