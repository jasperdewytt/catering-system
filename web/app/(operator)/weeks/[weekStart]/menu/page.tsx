import Link from "next/link";
import { ClipboardList, DatabaseZap } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatus } from "@/lib/operator-display";
import { getMenuSetupReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";
import { MenuSetupClient } from "./menu-setup-client";

export default async function WeekMenuPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const { weekStart } = await params;
  const supabase = await createClient();
  const result = await getMenuSetupReadModel(supabase, weekStart);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Menu Setup"
          description="This page reads menu setup rows and readiness findings from authenticated operator views."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Menu setup data is unavailable"
          description={result.error}
        />
      </>
    );
  }

  if (!result.data?.menuRows.length) {
    return (
      <>
        <PageHeader
          eyebrow={`Week ${weekStart}`}
          title="Menu Setup"
          description="No caterer menu rows are visible for this week."
          actions={
            <Button asChild variant="secondary">
              <Link href={`/weeks/${weekStart}`}>Back to week</Link>
            </Button>
          }
        />
        <EmptyState
          icon={ClipboardList}
          title="No menu rows"
          description="Ingest caterer menus and sessions before selecting weekly menu offers."
        />
      </>
    );
  }

  const rows = result.data.menuRows;
  const findings = result.data.validationSummary;
  const catererCount = new Set(
    rows.map((row) => row.caterer_id).filter(Boolean),
  ).size;
  const offeredCount = rows.filter((row) => row.is_offered).length;
  const unreviewedOfferedCount = rows.filter(
    (row) => row.is_offered && !row.operator_reviewed,
  ).length;
  const errorCount = findings.filter(
    (finding) => finding.severity === "error",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow={`Week ${weekStart}`}
        title="Menu Setup"
        description={`${catererCount} caterer(s), ${offeredCount} offered option(s)`}
        actions={
          <Button asChild variant="secondary">
            <Link href={`/weeks/${weekStart}`}>Back to week</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Offer Sets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{offeredCount}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Variant offers saved across visible caterers.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Safety Review</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge
              status={unreviewedOfferedCount ? "Unreviewed" : "Ready"}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {unreviewedOfferedCount
                ? `${unreviewedOfferedCount} offered option(s) need review.`
                : "Offered variants are operator reviewed."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={errorCount ? "Blocked" : "Ready"} />
            <p className="mt-2 text-sm text-muted-foreground">
              {errorCount
                ? `${errorCount} blocking menu finding(s).`
                : `Latest finding state: ${formatStatus(findings[0]?.category ?? "ready")}.`}
            </p>
          </CardContent>
        </Card>
      </div>

      <MenuSetupClient findings={findings} rows={rows} weekStart={weekStart} />
    </>
  );
}
