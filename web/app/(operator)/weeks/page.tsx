import Link from "next/link";
import { ArrowRight, CalendarDays, DatabaseZap } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import { formatDate, formatStatus, statusToken } from "@/lib/operator-display";
import { getWeeksReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

export default async function WeeksPage() {
  const supabase = await createClient();
  const result = await getWeeksReadModel(supabase);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Weeks"
          title="Service Weeks"
          description="Service weeks are read from the authenticated operator_weeks view."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Weeks data is unavailable"
          description={result.error}
        />
      </>
    );
  }

  if (!result.data) {
    return (
      <>
        <PageHeader
          eyebrow="Weeks"
          title="Service Weeks"
          description="Service weeks are read from the authenticated operator_weeks view."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Weeks data is unavailable"
          description="The weeks read model returned no data."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Weeks"
        title="Service Weeks"
        description="Browse generated, approved, and exported state by service week."
      />

      <Card>
        <CardHeader>
          <CardTitle>Week Rows</CardTitle>
        </CardHeader>
        <CardContent>
          {result.data.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>Week</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Sessions</Th>
                  <Th className="text-right">Students</Th>
                  <Th className="text-right">Caterers</Th>
                  <Th className="text-right">Issues</Th>
                  <Th className="text-right">Exported</Th>
                  <Th className="text-right">Open</Th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((week, index) => {
                  const weekStart = week.week_start ?? "";

                  return (
                    <tr key={weekStart || index}>
                      <Td>
                        <div className="font-medium">
                          {formatDate(week.week_start)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          to {formatDate(week.week_end)}
                        </div>
                      </Td>
                      <Td>
                        <StatusBadge
                          status={statusToken(week.latest_order_run_status)}
                        />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatStatus(week.latest_order_run_status)}
                        </div>
                      </Td>
                      <Td className="text-right">{week.session_count ?? 0}</Td>
                      <Td className="text-right">{week.student_count ?? 0}</Td>
                      <Td className="text-right">{week.caterer_count ?? 0}</Td>
                      <Td className="text-right">
                        {week.allocation_issue_count ?? 0}
                      </Td>
                      <Td className="text-right">
                        {week.exported_caterer_count ?? 0}/
                        {week.caterer_count ?? 0}
                      </Td>
                      <Td className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/weeks/${weekStart}`}>
                            <ArrowRight className="size-4" aria-hidden="true" />
                            <span className="sr-only">
                              Open week {formatDate(week.week_start)}
                            </span>
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
              icon={CalendarDays}
              title="No service weeks"
              description="Ingest session data before the website can list weekly operating state."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
