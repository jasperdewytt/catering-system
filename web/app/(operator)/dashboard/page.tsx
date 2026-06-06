import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  DatabaseZap,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatAuditAction,
  formatAutopilotStatus,
  formatDate,
  formatDateTime,
  formatEmailState,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import { getDashboardReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const result = await getDashboardReadModel(supabase);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="This week"
          title="Catering Dashboard"
          description="Current service-week status from secure operator data."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Dashboard data is unavailable"
          description={result.error}
        />
      </>
    );
  }

  if (!result.data) {
    return (
      <>
        <PageHeader
          eyebrow="This week"
          title="Catering Dashboard"
          description="Current service-week status from secure operator data."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Dashboard data is unavailable"
          description="No dashboard data was returned for this operator."
        />
      </>
    );
  }

  const {
    currentWeek,
    weekStatus,
    sessions,
    latestOrderRun,
    autopilotStatus,
    auditEvents,
  } = result.data;

  if (!currentWeek?.week_start) {
    return (
      <>
        <PageHeader
          eyebrow="This week"
          title="Catering Dashboard"
          description="No service week was found in the operational dataset."
        />
        <EmptyState
          icon={CalendarDays}
          title="No active week"
          description="Ingest sessions before the website can show weekly readiness, deliveries, and order activity."
        />
      </>
    );
  }

  const activeWeekLabel = `${formatDate(currentWeek.week_start)} to ${formatDate(
    currentWeek.week_end,
  )}`;

  const decisionItems = [
    {
      label: "Menu offers",
      value: weekStatus?.menu_offers_ready ?? false,
      href: `/weeks/${currentWeek.week_start}/menu`,
      detail:
        (weekStatus?.missing_offer_caterer_count ?? 0) > 0
          ? `${weekStatus?.missing_offer_caterer_count} caterer offer set missing`
          : "Offer sets are present for active caterers",
    },
    {
      label: "Variant review",
      value: weekStatus?.variant_review_ready ?? false,
      href: `/weeks/${currentWeek.week_start}/menu`,
      detail:
        (weekStatus?.unreviewed_variant_count ?? 0) > 0
          ? `${weekStatus?.unreviewed_variant_count} offered variant(s) need review`
          : "Offered variants are reviewed",
    },
    {
      label: "Validation",
      value: weekStatus?.validation_state ?? null,
      href: `/weeks/${currentWeek.week_start}/validation`,
      detail: `${weekStatus?.blocking_issue_count ?? 0} blocking, ${
        weekStatus?.warning_count ?? 0
      } warning`,
    },
    {
      label: "Caterer emails",
      value: weekStatus?.export_state ?? null,
      detail: `${formatEmailState(weekStatus?.export_state ?? null)} · ${
        latestOrderRun?.exported_caterer_count ?? 0
      } caterer email snapshot(s) ready`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="This week"
        title="Catering Dashboard"
        description={activeWeekLabel}
        actions={
          <Button asChild variant="primary">
            <Link href={`/weeks/${currentWeek.week_start}`}>
              View week
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted p-3">
              <div className="text-sm text-muted-foreground">Latest order</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="font-medium">
                  {latestOrderRun
                    ? formatStatus(latestOrderRun.status)
                    : "No run generated"}
                </div>
                <StatusBadge
                  status={statusToken(latestOrderRun?.status ?? null)}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {latestOrderRun
                  ? `${latestOrderRun.line_count ?? 0} lines, ${
                      latestOrderRun.issue_count ?? 0
                    } issues`
                  : "Generate a run from the week orders page."}
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted p-3">
              <div className="text-sm text-muted-foreground">Sessions</div>
              <div className="mt-2 text-2xl font-semibold">
                {currentWeek.session_count ?? 0}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Active sessions in the current service week.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs A Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisionItems.map((item) => {
              const row = (
                <>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardCheck
                        className="size-4 text-brand"
                        aria-hidden="true"
                      />
                      {item.label}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={statusToken(item.value)} />
                    {item.href ? (
                      <ArrowRight
                        className="size-4 text-brand"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                </>
              );

              return item.href ? (
                <Link
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted p-3 transition-colors hover:border-brand hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  href={item.href}
                  key={item.label}
                >
                  {row}
                </Link>
              ) : (
                <div
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted p-3"
                  key={item.label}
                >
                  {row}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Autopilot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={statusToken(autopilotStatus?.status ?? null)}
              />
              <span className="text-lg font-semibold text-foreground">
                {formatAutopilotStatus(autopilotStatus?.status ?? null)}
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {autopilotStatus?.summary ??
                "No current-week autopilot run has been recorded yet."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Open exceptions
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {autopilotStatus?.open_exception_count ?? 0}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Blocking
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {autopilotStatus?.blocking_exception_count ?? 0}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Prepared
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {autopilotStatus?.emails_prepared_count ?? 0}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Sent / failed
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {autopilotStatus?.sent_communication_count ?? 0}/
                  {autopilotStatus?.failed_communication_count ?? 0}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  AI rows
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {autopilotStatus?.ai_interpretation_count ?? 0}
                </div>
              </div>
            </div>
          </div>
          <Button asChild variant="primary">
            <Link href="/autopilot">
              <Bot className="size-4" aria-hidden="true" />
              Open autopilot
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>School</Th>
                    <Th>Caterer</Th>
                    <Th className="text-right">Students</Th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.session_id}>
                      <Td>{formatDate(session.session_date)}</Td>
                      <Td>
                        <div className="font-medium">
                          {session.school_name ?? "Unknown school"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {session.building ?? "Building not recorded"}
                        </div>
                      </Td>
                      <Td>{session.caterer_name ?? "Unassigned"}</Td>
                      <Td className="text-right">
                        {session.orderable_student_count ?? 0}/
                        {session.enrolled_count ?? 0}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No sessions in this week"
                description="The current week exists, but no session rows are visible to this operator."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {auditEvents.length ? (
              <div className="space-y-3">
                {auditEvents.map((event) => (
                  <div
                    className="rounded-md border border-border bg-muted p-3"
                    key={event.audit_id}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {formatAuditAction(event.display_action, event.action)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {event.actor_name ?? "Unknown operator"}:{" "}
                      {event.reason ?? "No reason recorded"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clock3}
                title="No audited activity yet"
                description="Approvals, email preparation, and manual notes will appear here after audited workflows run."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
