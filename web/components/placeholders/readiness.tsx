import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  MailCheck,
  Utensils,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tasks = [
  {
    label: "Choose the weekly menu",
    note: "Pick the caterer options that should be offered before orders are generated.",
    icon: Utensils,
  },
  {
    label: "Review items that need a decision",
    note: "Check anything that is missing, unclear, or not ready for restricted students.",
    icon: ClipboardList,
  },
  {
    label: "Approve the order run",
    note: "Confirm the generated quantities once the week is ready.",
    icon: FileCheck2,
  },
  {
    label: "Prepare caterer emails",
    note: "Review the saved message drafts before sending them manually.",
    icon: MailCheck,
  },
];

export function ReadinessPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks To Complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-[var(--padea-crimson-border)] bg-brand-tint p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-brand">
                Next task
              </p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">
                Choose the weekly menu
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start with the menu choices for the current catering week. The
                rest of the workflow stays locked until real week data is
                available.
              </p>
            </div>
            <Button asChild variant="primary">
              <Link href="/weeks/2026-05-01/menu">
                Open
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {tasks.map((task, index) => {
            const Icon = task.icon;

            return (
              <div
                className="grid gap-3 rounded-md border border-border bg-muted p-3 sm:grid-cols-[32px_1fr]"
                key={task.label}
              >
                <div className="flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  {index === 0 ? (
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {task.label}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {task.note}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
