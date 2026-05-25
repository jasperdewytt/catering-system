import { DatabaseZap, History, ScrollText, Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/operator-display";
import { getAuditReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

import { AuditTableClient } from "./audit-table-client";

function distinctCount(values: Array<string | null>) {
  return new Set(values.filter(Boolean)).size;
}

export default async function AuditPage() {
  const supabase = await createClient();
  const result = await getAuditReadModel(supabase);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Audit"
          title="Audit Events"
          description="This page reads the append-only operator audit trail from Phase 4 views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Audit events are unavailable"
          description={result.error}
        />
      </>
    );
  }

  const auditEvents = result.data?.auditEvents ?? [];
  const orderRunWeekStarts = result.data?.orderRunWeekStarts ?? {};
  const latestEvent = auditEvents[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Audit"
        title="Audit Events"
        description="Append-only operational history for approvals, menu setup, order review, override notes, and caterer emails."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Shown</CardTitle>
            <CardDescription>Most recent audit events</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ScrollText className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">{auditEvents.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest Event</CardTitle>
            <CardDescription>Newest recorded action</CardDescription>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {formatDateTime(latestEvent?.created_at ?? null)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actors</CardTitle>
            <CardDescription>Operators in this view</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Users className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">
              {distinctCount(auditEvents.map((event) => event.actor_name))}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Action Types</CardTitle>
            <CardDescription>Distinct audit actions</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <History className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">
              {distinctCount(auditEvents.map((event) => event.action))}
            </span>
          </CardContent>
        </Card>
      </div>

      {auditEvents.length ? (
        <AuditTableClient
          auditEvents={auditEvents}
          orderRunWeekStarts={orderRunWeekStarts}
        />
      ) : (
        <EmptyState
          icon={History}
          title="No audit events recorded"
          description="Audited workflow events will appear here after operator actions such as approval, menu setup, override notes, and caterer email preparation."
        />
      )}
    </>
  );
}
