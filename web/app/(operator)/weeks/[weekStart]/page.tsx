import Link from "next/link";
import { ArrowRight, CalendarDays, DatabaseZap, History } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatAuditAction,
  formatDate,
  formatDateTime,
  formatEmailState,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import { getWeekOverviewReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

export default async function WeekOverviewPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const supabase = await createClient();
  const result = await getWeekOverviewReadModel(supabase, weekStart);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Week Overview"
          description="This page reads week status, sessions, order runs, and audit events from Phase 4 views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Week data is unavailable"
          description={result.error}
        />
      </>
    );
  }

  if (!result.data) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Week Overview"
          description="This page reads week status, sessions, order runs, and audit events from Phase 4 views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Week data is unavailable"
          description="The week overview read model returned no data."
        />
      </>
    );
  }

  const { weekStatus, sessions, orderRuns, auditEvents } = result.data;

  if (!weekStatus) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Week Overview"
          description="No operator_week_status row exists for this week."
        />
        <EmptyState
          icon={CalendarDays}
          title="Week not found"
          description="Choose a week from the service weeks list or ingest session data for this date range."
        />
      </>
    );
  }

  const latestOrderRun = orderRuns.find((run) => run.is_latest) ?? orderRuns[0];

  const readiness = [
    {
      label: "Source data",
      value: weekStatus.source_data_ready,
      detail: sessions.length
        ? `${sessions.length} session(s) visible`
        : "No session rows visible",
    },
    {
      label: "Menu offers",
      value: weekStatus.menu_offers_ready,
      href: `/weeks/${weekStart}/menu`,
      detail:
        (weekStatus.missing_offer_caterer_count ?? 0) > 0
          ? `${weekStatus.missing_offer_caterer_count} caterer offer set missing`
          : "Offer sets are present",
    },
    {
      label: "Variant review",
      value: weekStatus.variant_review_ready,
      href: `/weeks/${weekStart}/menu`,
      detail:
        (weekStatus.unreviewed_variant_count ?? 0) > 0
          ? `${weekStatus.unreviewed_variant_count} offered variant(s) pending`
          : "Offered variants are reviewed",
    },
    {
      label: "Approval",
      value: weekStatus.approval_state,
      href: `/weeks/${weekStart}/orders`,
      detail: latestOrderRun?.approved_at
        ? `Approved ${formatDateTime(latestOrderRun.approved_at)}`
        : "Review generated order runs before approval",
    },
    {
      label: "Caterer emails",
      value: weekStatus.export_state,
      href: `/weeks/${weekStart}/exports`,
      detail: `${formatEmailState(weekStatus.export_state)} · ${
        latestOrderRun?.exported_caterer_count ?? 0
      } snapshot(s) ready`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Week ${weekStart}`}
        title="Week Overview"
        description={`${formatStatus(
          weekStatus.validation_state,
        )} validation, ${formatEmailState(weekStatus.export_state)}`}
        actions={
          <>
            <Button asChild variant="primary">
              <Link href={`/weeks/${weekStart}/menu`}>
                Open menu setup
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/orders`}>
                View order runs
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/exports`}>
                Caterer emails
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/weeks">Back to weeks</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {readiness.map((item) => {
          const card = (
            <Card
              className={
                item.href
                  ? "h-full transition-colors hover:border-brand hover:bg-brand-tint"
                  : undefined
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  {item.label}
                  {item.href ? (
                    <ArrowRight
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge status={statusToken(item.value)} />
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              </CardContent>
            </Card>
          );

          return item.href ? (
            <Link
              className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={item.href}
              key={item.label}
            >
              {card}
            </Link>
          ) : (
            <div key={item.label}>{card}</div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>School</Th>
                    <Th>Caterer</Th>
                    <Th className="text-right">Enrolled</Th>
                    <Th className="text-right">Orderable</Th>
                    <Th>Email</Th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, index) => (
                    <tr key={session.session_id ?? index}>
                      <Td>{formatDate(session.session_date)}</Td>
                      <Td>
                        <div className="font-medium">
                          {session.school_name ?? "Unknown school"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {session.manager_name ?? "Manager not recorded"}
                        </div>
                      </Td>
                      <Td>{session.caterer_name ?? "Unassigned"}</Td>
                      <Td className="text-right">
                        {session.enrolled_count ?? 0}
                      </Td>
                      <Td className="text-right">
                        {session.orderable_student_count ?? 0}
                      </Td>
                      <Td>{formatEmailState(session.export_state)}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No sessions visible"
                description="This week has a status row, but no session rows are visible through operator_week_sessions."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              Order Runs
              <Button asChild size="sm" variant="ghost">
                <Link href={`/weeks/${weekStart}/orders`}>
                  View all
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orderRuns.length ? (
              <div className="space-y-3">
                {orderRuns.map((run) => (
                  <div
                    className="rounded-md border border-border bg-muted p-3"
                    key={run.order_run_id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        {run.is_latest ? "Latest run" : "Previous run"}
                      </div>
                      <StatusBadge status={statusToken(run.status)} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>{run.allocation_count ?? 0} allocations</div>
                      <div>{run.line_count ?? 0} lines</div>
                      <div>{run.issue_count ?? 0} issues</div>
                    </div>
                    {run.order_run_id ? (
                      <Button
                        asChild
                        className="mt-3 w-full"
                        size="sm"
                        variant="ghost"
                      >
                        <Link
                          href={`/weeks/${weekStart}/orders/${run.order_run_id}`}
                        >
                          Open run
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="No order runs generated"
                description="Order generation remains a backend/CLI operation until the job bridge is added."
              >
                <Button asChild variant="secondary">
                  <Link href={`/weeks/${weekStart}/orders`}>
                    Open order runs
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </EmptyState>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEvents.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((event, index) => (
                  <tr key={event.audit_id ?? index}>
                    <Td>{formatDateTime(event.created_at)}</Td>
                    <Td>
                      {formatAuditAction(event.display_action, event.action)}
                    </Td>
                    <Td>{event.actor_name ?? "Unknown operator"}</Td>
                    <Td>{event.reason ?? "No reason recorded"}</Td>
                  </tr>
                ))}
              </tbody>
            </CompactTable>
          ) : (
            <EmptyState
              icon={History}
              title="No audit events for this week"
              description="Approval, reopen, email preparation, and manual override events will appear after audited operations run."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
