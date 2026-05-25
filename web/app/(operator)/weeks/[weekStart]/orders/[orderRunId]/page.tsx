import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  DatabaseZap,
  History,
  Mail,
  Users,
} from "lucide-react";

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
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import {
  getOrderRunDetailReadModel,
  type OperatorOrderRunAllocation,
  type OperatorOrderRunContact,
} from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

import { OrderReviewActionsClient } from "./order-review-actions-client";
import {
  AllocationsTableClient,
  OrderLinesTableClient,
} from "./order-review-tables-client";

function countBy<T extends string | null>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = value ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function contactGroups(contacts: OperatorOrderRunContact[]) {
  const groups = new Map<
    string,
    {
      catererName: string;
      deliveryNotes: string;
      contacts: OperatorOrderRunContact[];
    }
  >();

  for (const contact of contacts) {
    const key = contact.caterer_id ?? contact.caterer_name ?? "unknown";
    const group = groups.get(key) ?? {
      catererName: contact.caterer_name ?? "Unknown caterer",
      deliveryNotes: contact.delivery_notes ?? "No delivery notes recorded",
      contacts: [],
    };

    group.contacts.push(contact);
    groups.set(key, group);
  }

  return Array.from(groups.values());
}

function allocationSummary(allocations: OperatorOrderRunAllocation[]) {
  return countBy(allocations.map((allocation) => allocation.allocation_status));
}

export default async function OrderRunDetailPage({
  params,
}: {
  params: Promise<{ weekStart: string; orderRunId: string }>;
}) {
  const { weekStart, orderRunId } = await params;
  const supabase = await createClient();
  const result = await getOrderRunDetailReadModel(
    supabase,
    weekStart,
    orderRunId,
  );

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Order Run"
          description="This page reads persisted order review data from Phase 4 views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Order run is unavailable"
          description={result.error}
        />
      </>
    );
  }

  const data = result.data;
  const run = data?.orderRun;

  if (!data || !run) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Order Run"
          description="No matching order run exists for this week."
          actions={
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/orders`}>Back to runs</Link>
            </Button>
          }
        />
        <EmptyState
          icon={ClipboardCheck}
          title="Run not found"
          description="Choose an order run from the week order-run list."
        />
      </>
    );
  }

  const issueCount = data.issues.length;
  const canApprove = run.status === "generated" && issueCount === 0;
  const canReopen = run.status === "approved";
  const allocationCounts = allocationSummary(data.allocations);
  const contactsByCaterer = contactGroups(data.contacts);

  return (
    <>
      <PageHeader
        eyebrow={`Week ${formatDate(weekStart)}`}
        title="Order Run Review"
        description={`${formatStatus(run.status)} run generated ${formatDateTime(
          run.generated_at,
        )}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/orders`}>Back to runs</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link
                href={`/weeks/${weekStart}/exports?orderRunId=${orderRunId}`}
              >
                Caterer emails
              </Link>
            </Button>
            <StatusBadge status={statusToken(run.status)} />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={statusToken(run.status)} />
            <p className="mt-3 text-sm text-muted-foreground">
              {run.is_latest ? "Latest generated run" : "Superseded run"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order Lines</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data.lines.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data.allocations.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Issues</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {issueCount}
          </CardContent>
        </Card>
      </div>

      <OrderReviewActionsClient
        allocations={data.allocations}
        canApprove={canApprove}
        canReopen={canReopen}
        contacts={data.contacts}
        issueCount={issueCount}
        lines={data.lines}
        orderRunId={orderRunId}
        status={run.status}
        weekStart={weekStart}
      />

      <Card>
        <CardHeader>
          <CardTitle>Order Lines</CardTitle>
        </CardHeader>
        <CardContent>
          {data.lines.length ? (
            <OrderLinesTableClient lines={data.lines} />
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="No order lines"
              description="Blocked runs may have issues without generated order lines."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Allocations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(allocationCounts).map(([status, count]) => (
                <span
                  className="rounded-full border border-border bg-muted px-2 py-1 text-xs"
                  key={status}
                >
                  {formatStatus(status)}: {count}
                </span>
              ))}
            </div>
            {data.allocations.length ? (
              <AllocationsTableClient allocations={data.allocations} />
            ) : (
              <EmptyState
                icon={Users}
                title="No allocations"
                description="This run has no persisted allocation rows."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issues</CardTitle>
          </CardHeader>
          <CardContent>
            {data.issues.length ? (
              <div className="space-y-3">
                {data.issues.map((issue) => (
                  <div
                    className="rounded-md border border-[var(--err-border)] bg-[var(--err-bg)] p-3 text-sm"
                    key={issue.issue_id}
                  >
                    <div className="flex items-center justify-between gap-3 font-medium text-[var(--err-fg)]">
                      <span>{formatStatus(issue.category)}</span>
                      <span>{formatStatus(issue.severity)}</span>
                    </div>
                    <p className="mt-2 text-[var(--err-fg)]">
                      {issue.message ?? "Issue message not recorded"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={AlertTriangle}
                title="No persisted issues"
                description="This run has no allocation issue rows. Approval is still enforced by the audited RPC."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contacts And Delivery Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {contactsByCaterer.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {contactsByCaterer.map((group) => (
                <div
                  className="rounded-md border border-border bg-muted p-4"
                  key={group.catererName}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Mail className="size-4" aria-hidden="true" />
                    {group.catererName}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {group.deliveryNotes}
                  </pre>
                  <div className="mt-4 space-y-2">
                    {group.contacts.map((contact, index) => (
                      <div
                        className="rounded-md border border-border bg-card p-3 text-sm"
                        key={contact.contact_id ?? index}
                      >
                        <div className="font-medium">
                          {contact.contact_name ?? "Unnamed contact"}
                        </div>
                        <div className="text-muted-foreground">
                          {formatStatus(contact.contact_role)} ·{" "}
                          {formatStatus(contact.recipient_kind)}
                        </div>
                        <div>{contact.email ?? "No email recorded"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Mail}
              title="No contacts visible"
              description="No caterer contacts are associated with this run's persisted order lines."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manual Override History</CardTitle>
          </CardHeader>
          <CardContent>
            {data.manualOverrides.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Type</Th>
                    <Th>Actor</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.manualOverrides.map((override) => (
                    <tr key={override.manual_override_id}>
                      <Td>{formatDateTime(override.created_at)}</Td>
                      <Td>{formatStatus(override.override_type)}</Td>
                      <Td>{override.actor_name ?? "Unknown operator"}</Td>
                      <Td>{override.reason ?? "No reason recorded"}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={History}
                title="No manual overrides"
                description="Override intent records will appear here without changing generated order facts."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Timeline</CardTitle>
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
                title="No audit events"
                description="Approve, reopen, communication, and override events scoped to this run will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
