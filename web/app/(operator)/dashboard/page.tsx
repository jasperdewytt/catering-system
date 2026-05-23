import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardCheck, Clock3 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ReadinessPlaceholder } from "@/components/placeholders/readiness";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const needsDecision = [
  "Menu choices for the week have not been reviewed in the website yet.",
  "Student and caterer details will appear after the secure read views are added.",
  "Caterer email drafts are waiting for the approved order workflow.",
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="This week"
        title="Catering Dashboard"
        description="A simple work queue for preparing the weekly school meals. The first live version will replace these placeholders with the current week."
        actions={
          <Button asChild variant="primary">
            <Link href="/weeks/2026-05-01">
              View week
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <ReadinessPlaceholder />

        <Card>
          <CardHeader>
            <CardTitle>Needs A Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {needsDecision.map((item) => (
              <div
                className="flex gap-3 rounded-md border border-[var(--warn-border)] bg-[var(--warn-bg)] p-3 text-sm text-[var(--warn-fg)]"
                key={item}
              >
                <ClipboardCheck
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <p>{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-center">
              <CalendarDays
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                Delivery schedule will show here
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Once the secure week view is available, this space will list
                each school, caterer, delivery day, and contact in the order
                they need attention.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-center">
              <Clock3
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                No website activity yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Approvals, exports, and manual notes will appear here after the
                audited website workflows are connected.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
