import Link from "next/link";
import { ArrowRight, ClipboardList, DatabaseZap } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatDate,
  formatDateTime,
  formatEmailState,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import { getOrdersIndexReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";
import { GenerateOrderRunClient } from "./generate-order-run-client";

export default async function WeekOrdersPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const supabase = await createClient();
  const result = await getOrdersIndexReadModel(supabase, weekStart);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Order Runs"
          description="Generated runs are read from the operator order-run view."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Order runs are unavailable"
          description={result.error}
        />
      </>
    );
  }

  const orderRuns = result.data?.orderRuns ?? [];
  const latestRun = orderRuns.find((run) => run.is_latest) ?? orderRuns[0];

  return (
    <>
      <PageHeader
        eyebrow={`Week ${formatDate(weekStart)}`}
        title="Order Runs"
        description={
          latestRun
            ? `${formatStatus(latestRun.status)} latest run, ${formatEmailState(
                latestRun.exported_caterer_count ? "partial" : "not_exported",
              )}`
            : "Generate a persisted run from Python-owned ordering logic."
        }
        actions={
          <>
            <GenerateOrderRunClient weekStart={weekStart} />
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/exports`}>Caterer emails</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}`}>Back to week</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Generated Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {orderRuns.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>Run</Th>
                  <Th>Status</Th>
                  <Th>Generated</Th>
                  <Th>Approved</Th>
                  <Th className="text-right">Lines</Th>
                  <Th className="text-right">Allocations</Th>
                  <Th className="text-right">Issues</Th>
                  <Th className="text-right">Emails</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {orderRuns.map((run) => (
                  <tr key={run.order_run_id}>
                    <Td>
                      <div className="font-medium">
                        {run.is_latest ? "Latest run" : "Superseded run"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {run.order_run_id}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={statusToken(run.status)} />
                    </Td>
                    <Td>
                      <div>{formatDateTime(run.generated_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {run.generated_by ?? "Generator not recorded"}
                      </div>
                    </Td>
                    <Td>
                      {run.approved_at ? (
                        <>
                          <div>{formatDateTime(run.approved_at)}</div>
                          <div className="text-xs text-muted-foreground">
                            {run.approved_by ?? "Operator not recorded"}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </Td>
                    <Td className="text-right">{run.line_count ?? 0}</Td>
                    <Td className="text-right">{run.allocation_count ?? 0}</Td>
                    <Td className="text-right">{run.issue_count ?? 0}</Td>
                    <Td className="text-right">
                      {run.exported_caterer_count ?? 0}
                    </Td>
                    <Td className="text-right">
                      {run.order_run_id ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/weeks/${weekStart}/orders/${run.order_run_id}`}
                          >
                            Review
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </Link>
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </CompactTable>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No order runs generated"
              description="Generate an order run to persist allocations, order lines, issues, and review state for this week."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
