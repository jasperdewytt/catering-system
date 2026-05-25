import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  Info,
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
  formatDate,
  formatDateTime,
  formatStatus,
} from "@/lib/operator-display";
import {
  getValidationReadModel,
  type OperatorOrderRunIssue,
  type OperatorValidationSummary,
} from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

function severityToken(severity: string | null): StatusToken {
  if (severity === "error" || severity === "blocked") {
    return "Blocked";
  }

  if (severity === "info" || severity === "ready") {
    return "Ready";
  }

  return "Unreviewed";
}

function findingCount(
  findings: OperatorValidationSummary[],
  predicate: (finding: OperatorValidationSummary) => boolean,
) {
  return findings
    .filter(predicate)
    .reduce((total, finding) => total + (finding.finding_count ?? 0), 0);
}

function isWarning(finding: OperatorValidationSummary) {
  return finding.severity === "warning" || finding.severity === "warn";
}

function isBlocking(finding: OperatorValidationSummary) {
  return finding.severity === "error" || finding.severity === "blocked";
}

function readModelRoute(route: string | null) {
  return route?.startsWith("/") ? route : null;
}

function affectedIds(issue: OperatorOrderRunIssue) {
  return [
    issue.student_id ? `Student: ${issue.student_id}` : null,
    issue.session_id ? `Session: ${issue.session_id}` : null,
    issue.dish_variant_id ? `Variant: ${issue.dish_variant_id}` : null,
  ].filter(Boolean);
}

export default async function WeekValidationPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const supabase = await createClient();
  const result = await getValidationReadModel(supabase, weekStart);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Validation"
          description="This page reads readiness summaries and latest persisted order-run issues from Phase 4 operator views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Validation read model is unavailable"
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
          title="Validation"
          description="This page reads readiness summaries and latest persisted order-run issues from Phase 4 operator views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Validation read model is unavailable"
          description="The validation read model returned no data."
        />
      </>
    );
  }

  const {
    weekStatus,
    orderRuns,
    latestOrderRun,
    validationSummary,
    latestOrderRunIssues,
  } = result.data;
  const blockingCount = findingCount(validationSummary, isBlocking);
  const warningCount = findingCount(validationSummary, isWarning);
  const infoCount = findingCount(
    validationSummary,
    (finding) => !isBlocking(finding) && !isWarning(finding),
  );

  return (
    <>
      <PageHeader
        eyebrow={`Week ${formatDate(weekStart)}`}
        title="Validation"
        description="Readiness summary from stored operator facts, plus allocation issues persisted on the latest order run. Full Python validation history is not shown until a findings table exists."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}`}>Week overview</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/menu`}>Menu setup</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}/orders`}>Order runs</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Blocking Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{blockingCount}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {weekStatus?.blocking_issue_count ?? blockingCount} blocking item(s)
              in the week status view.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{warningCount}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {weekStatus?.warning_count ?? warningCount} warning item(s) in the
              week status view.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Info Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{infoCount}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Current readiness state:{" "}
              {formatStatus(weekStatus?.validation_state ?? "not_available")}.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest Run Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {latestOrderRunIssues.length}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {latestOrderRun
                ? `${formatStatus(latestOrderRun.status)} run generated ${formatDateTime(
                    latestOrderRun.generated_at,
                  )}.`
                : `${orderRuns.length} order run(s) visible.`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Summary</CardTitle>
          <CardDescription>
            Aggregated findings exposed by operator_validation_summary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validationSummary.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Count</Th>
                  <Th>Caterer</Th>
                  <Th>Summary</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {validationSummary.map((finding, index) => {
                  const targetRoute = readModelRoute(finding.target_route);

                  return (
                    <tr
                      key={[
                        finding.severity,
                        finding.category,
                        finding.caterer_id,
                        finding.target_route,
                        index,
                      ].join(":")}
                    >
                      <Td>
                        <StatusBadge status={severityToken(finding.severity)} />
                      </Td>
                      <Td>{formatStatus(finding.category)}</Td>
                      <Td className="text-right">
                        {finding.finding_count ?? 0}
                      </Td>
                      <Td>{finding.caterer_name ?? "All caterers"}</Td>
                      <Td>
                        {finding.summary ?? "No summary text recorded."}
                      </Td>
                      <Td className="text-right">
                        {targetRoute ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={targetRoute}>
                              Open
                              <ArrowRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            </Link>
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </CompactTable>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No readiness findings for this week"
              description="The readiness summary view has no findings for this week."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Order-Run Issues</CardTitle>
          <CardDescription>
            Persisted allocation issue rows for the latest generated order run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!latestOrderRun ? (
            <EmptyState
              icon={ClipboardList}
              title="No order run generated"
              description="Order generation remains a backend CLI operation until the job bridge lands."
            >
              <code className="rounded-md border border-border bg-muted px-2 py-1 text-xs">
                uv run python -m padea_catering.ordering --week-start{" "}
                {weekStart}
              </code>
            </EmptyState>
          ) : latestOrderRunIssues.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Category</Th>
                  <Th>Message</Th>
                  <Th>Affected IDs</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {latestOrderRunIssues.map((issue, index) => {
                  const ids = affectedIds(issue);

                  return (
                    <tr key={issue.issue_id ?? index}>
                      <Td>
                        <StatusBadge status={severityToken(issue.severity)} />
                      </Td>
                      <Td>{formatStatus(issue.category)}</Td>
                      <Td>{issue.message ?? "Issue message not recorded."}</Td>
                      <Td>
                        {ids.length ? (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {ids.map((id) => (
                              <div key={id}>{id}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Not scoped
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/weeks/${weekStart}/orders/${latestOrderRun.order_run_id}`}
                          >
                            Run
                            <ArrowRight
                              className="size-4"
                              aria-hidden="true"
                            />
                          </Link>
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </CompactTable>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="No persisted allocation issues on the latest run"
              description="The latest generated run has no issue rows in operator_order_run_issues."
            >
              <Button asChild variant="secondary">
                <Link
                  href={`/weeks/${weekStart}/orders/${latestOrderRun.order_run_id}`}
                >
                  Open latest run
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </EmptyState>
          )}
        </CardContent>
      </Card>

      <EmptyState
        className="text-left"
        icon={Info}
        title="Validation remains backend-owned"
        description="This page displays stored readiness summaries and persisted order-run issues. It does not run Python validation, trigger order generation, or recompute safety-critical rules in TypeScript."
      />
    </>
  );
}
