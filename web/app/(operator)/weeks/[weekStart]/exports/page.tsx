import Link from "next/link";
import {
  ClipboardCheck,
  DatabaseZap,
  History,
  Mail,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, type StatusToken } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatAuditAction,
  formatDate,
  formatDateTime,
  formatEmailState,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import {
  getCatererEmailsReadModel,
  type OperatorCommunication,
  type OperatorCommunicationEvent,
  type OperatorCommunicationRecipient,
} from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

import { CatererEmailPreparationForm } from "./caterer-email-actions-client";

function emailStatusToken(value: string | null): StatusToken {
  if (value === "exported") {
    return "Exported";
  }

  if (value === "not_ready") {
    return "Blocked";
  }

  return "Unreviewed";
}

function byCommunicationId<T extends { communication_id: string | null }>(
  rows: T[],
) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    if (!row.communication_id) {
      continue;
    }

    grouped.set(row.communication_id, [
      ...(grouped.get(row.communication_id) ?? []),
      row,
    ]);
  }

  return grouped;
}

function TextPreview({
  children,
  tall = false,
}: {
  children: string;
  tall?: boolean;
}) {
  const className = [
    "mt-3 whitespace-pre-wrap rounded-md border border-border bg-card p-4 text-sm leading-6",
    tall ? "max-h-[32rem] overflow-auto" : "",
  ].join(" ");

  return <pre className={className}>{children}</pre>;
}

function EmailSnapshot({
  canRecordPreparation,
  communication,
  events,
  orderRunId,
  recipients,
  weekStart,
}: {
  canRecordPreparation: boolean;
  communication: OperatorCommunication;
  events: OperatorCommunicationEvent[];
  orderRunId: string;
  recipients: OperatorCommunicationRecipient[];
  weekStart: string;
}) {
  const communicationId = communication.communication_id;
  const disabledReason =
    communication.email_state !== "exported"
      ? "A backend email snapshot is required before this email can be previewed."
      : canRecordPreparation
        ? undefined
        : "Only approved, issue-free runs can record email preparation events.";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>
              {communication.caterer_name ?? "Unknown caterer"}
            </CardTitle>
            <CardDescription>
              {communication.total_quantity ?? 0} meal(s) across{" "}
              {communication.line_count ?? 0} order line(s)
            </CardDescription>
          </div>
          <StatusBadge status={emailStatusToken(communication.email_state)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {communication.email_state === "exported" && communicationId ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
              <div className="space-y-4">
                <section className="rounded-md border border-border bg-muted p-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Snapshot
                  </h3>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Subject</dt>
                      <dd className="font-medium">
                        {communication.subject ?? "No subject recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Template</dt>
                      <dd>
                        {communication.template_version ?? "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">First prepared</dt>
                      <dd>{formatDateTime(communication.exported_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Prepared by</dt>
                      <dd>{communication.exported_by ?? "Unknown operator"}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-md border border-border bg-muted p-4">
                  <h3 className="text-sm font-medium text-foreground">
                    Recipients
                  </h3>
                  {recipients.length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {recipients.map((recipient) => (
                        <div
                          className="rounded-md border border-border bg-card p-3 text-sm"
                          key={recipient.recipient_id}
                        >
                          <div className="font-medium">
                            {recipient.display_name ?? "Unnamed contact"}
                          </div>
                          <div className="text-muted-foreground">
                            {formatStatus(recipient.recipient_type)} ·{" "}
                            {formatStatus(recipient.role)} ·{" "}
                            {formatStatus(recipient.cc_preference)}
                          </div>
                          <div>{recipient.email ?? "No email recorded"}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="No recipient snapshots"
                      description="This persisted communication has no recipient rows."
                    />
                  )}
                </section>
              </div>

              <CatererEmailPreparationForm
                canRecord={canRecordPreparation}
                communicationId={communicationId}
                disabledReason={disabledReason}
                orderRunId={orderRunId}
                weekStart={weekStart}
              />
            </div>

            <section className="rounded-md border border-border bg-muted p-4">
              <h3 className="text-sm font-medium text-foreground">
                Rendered Email
              </h3>
              <TextPreview tall>
                {communication.rendered_text ?? "No rendered text recorded"}
              </TextPreview>
            </section>

            <section className="rounded-md border border-border bg-muted p-4">
              <h3 className="text-sm font-medium text-foreground">
                Delivery Notes
              </h3>
              <TextPreview>
                {communication.delivery_note_text ??
                  "No delivery notes recorded"}
              </TextPreview>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Preparation Events
              </h3>
              {events.length ? (
                <CompactTable>
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>Actor</Th>
                      <Th>Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.event_id}>
                        <Td>{formatDateTime(event.created_at)}</Td>
                        <Td>{event.actor_name ?? "Unknown operator"}</Td>
                        <Td>{event.reason ?? "No reason recorded"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </CompactTable>
              ) : (
                <EmptyState
                  icon={History}
                  title="No preparation events"
                  description="Preparation events will appear here after an audited event is recorded."
                />
              )}
            </section>
          </>
        ) : (
          <EmptyState
            icon={Mail}
            title={formatEmailState(communication.email_state)}
            description={
              disabledReason ??
              "This caterer email is not ready for operator preparation."
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

export default async function WeekExportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekStart: string }>;
  searchParams: Promise<{ orderRunId?: string }>;
}) {
  const { weekStart } = await params;
  const { orderRunId } = await searchParams;
  const supabase = await createClient();
  const result = await getCatererEmailsReadModel(
    supabase,
    weekStart,
    orderRunId,
  );

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Caterer Emails"
          description="This page reads persisted communication snapshots from Phase 4 views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Caterer emails are unavailable"
          description={result.error}
        />
      </>
    );
  }

  const data = result.data;
  const run = data?.selectedRun;

  if (!data || !run?.order_run_id) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${formatDate(weekStart)}`}
          title="Caterer Emails"
          description="No generated order run exists for this week yet."
          actions={
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}`}>Back to week</Link>
            </Button>
          }
        />
        <EmptyState
          icon={ClipboardCheck}
          title="No order run"
          description="Generate and approve an order run before caterer email snapshots can be reviewed."
        />
      </>
    );
  }

  const recipientsByCommunication = byCommunicationId(data.recipients);
  const eventsByCommunication = byCommunicationId(data.events);
  const selectedOrderRunId = run.order_run_id;
  const readyCount = data.communications.filter(
    (communication) => communication.email_state === "exported",
  ).length;
  const canRecordPreparation =
    run.status === "approved" && run.issue_count === 0;

  return (
    <>
      <PageHeader
        eyebrow={`Week ${formatDate(weekStart)}`}
        title="Caterer Emails"
        description={`${formatStatus(run.status)} run generated ${formatDateTime(
          run.generated_at,
        )}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}`}>Back to week</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/orders/${run.order_run_id}`}>
                Open order
              </Link>
            </Button>
            <StatusBadge status={statusToken(run.status)} />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Ready</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {readyCount}/{data.communications.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Run Issues</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {run.issue_count ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order Lines</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {run.line_count ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preparation Events</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data.events.length}
          </CardContent>
        </Card>
      </div>

      {data.orderRuns.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Order Runs</CardTitle>
            <CardDescription>
              Select another run to inspect its persisted email snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.orderRuns.map((orderRun) => (
              <Button
                asChild
                key={orderRun.order_run_id}
                size="sm"
                variant={
                  orderRun.order_run_id === run.order_run_id
                    ? "primary"
                    : "secondary"
                }
              >
                <Link
                  href={`/weeks/${weekStart}/exports?orderRunId=${orderRun.order_run_id}`}
                >
                  {formatDateTime(orderRun.generated_at)} ·{" "}
                  {formatStatus(orderRun.status)}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.communications.length ? (
        <div className="space-y-4">
          {data.communications.map((communication) => (
            <EmailSnapshot
              canRecordPreparation={canRecordPreparation}
              communication={communication}
              events={
                communication.communication_id
                  ? (eventsByCommunication.get(
                      communication.communication_id,
                    ) ?? [])
                  : []
              }
              key={`${communication.order_run_id}-${communication.caterer_id}`}
              orderRunId={selectedOrderRunId}
              recipients={
                communication.communication_id
                  ? (recipientsByCommunication.get(
                      communication.communication_id,
                    ) ?? [])
                  : []
              }
              weekStart={weekStart}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Mail}
          title="No caterer email rows"
          description="This run has no persisted order-line caterers to prepare email snapshots for."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {data.auditEvents.length ? (
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
                {data.auditEvents.map((event) => (
                  <tr key={event.audit_id}>
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
              title="No email audit events"
              description="Caterer email preparation audit rows will appear here."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
