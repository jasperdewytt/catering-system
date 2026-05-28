"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Store,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  deriveShellWorkflowAction,
  type ShellWorkflowData,
} from "@/lib/operator-workflow";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weeks", label: "Weeks", icon: CalendarDays },
  { href: "/caterers", label: "Caterers", icon: Store },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/audit", label: "Audit", icon: ScrollText },
] as const;

function weekStartFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/weeks\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function ShellNavigation({
  workflow,
  workflowError,
}: {
  workflow: ShellWorkflowData | null;
  workflowError: string | null;
}) {
  const pathname = usePathname();
  const activeWeekStart =
    weekStartFromPathname(pathname) ?? workflow?.currentWeekStart ?? null;
  const activeWeekStatus =
    workflow?.weekStatuses.find(
      (status) => status.week_start === activeWeekStart,
    ) ?? null;
  const workflowAction = deriveShellWorkflowAction({
    activeWeekStart,
    communications: workflow?.communications ?? [],
    error: workflowError,
    weekStatus: activeWeekStatus,
  });

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
      <div className="rounded-md border border-border bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
            <ClipboardCheck
              className="size-4 shrink-0 text-brand"
              aria-hidden="true"
            />
            <span className="truncate">Next step</span>
          </div>
          <StatusBadge status={workflowAction.status} className="shrink-0" />
        </div>
        <div className="mt-3 text-sm font-medium leading-5 text-foreground">
          {workflowAction.title}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {workflowAction.detail}
        </p>
        <Link
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover"
          href={workflowAction.href}
        >
          Open workflow
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
