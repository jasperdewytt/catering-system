import Link from "next/link";
import { ArrowRight, DatabaseZap, Mail, Store, Users } from "lucide-react";

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
  formatEmailState,
  formatMoney,
  formatStatus,
} from "@/lib/operator-display";
import { getCaterersReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

function emailToken(value: string | null): StatusToken {
  if (value === "exported") {
    return "Exported";
  }

  if (value === "not_ready") {
    return "Blocked";
  }

  return "Unreviewed";
}

function joinCounts(values: number[] | null): string {
  if (!values?.length) {
    return "No tiers";
  }

  return values.join(", ");
}

export default async function CaterersPage() {
  const supabase = await createClient();
  const result = await getCaterersReadModel(supabase);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Directory"
          title="Caterers"
          description="This page reads caterer readiness from the authenticated operator_caterers view."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Caterers are unavailable"
          description={result.error}
        />
      </>
    );
  }

  const caterers = result.data ?? [];
  const emailReadyCount = caterers.filter(
    (caterer) => caterer.email_state === "exported",
  ).length;
  const unreviewedVariantCount = caterers.reduce(
    (total, caterer) => total + (caterer.unreviewed_variant_count ?? 0),
    0,
  );
  const latestQuantity = caterers.reduce(
    (total, caterer) => total + (caterer.latest_order_quantity ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Caterers"
        description="Inspect assigned schools, contacts, weekly minimum tiers, stored menu review state, latest persisted order totals, and caterer email readiness."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Caterers</CardTitle>
            <CardDescription>Active directory rows</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Store className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">{caterers.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Schools</CardTitle>
            <CardDescription>Assigned school links</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Users className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">
              {caterers.reduce(
                (total, caterer) =>
                  total + (caterer.assigned_school_count ?? 0),
                0,
              )}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unreviewed Variants</CardTitle>
            <CardDescription>Stored menu review state</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {unreviewedVariantCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email Ready</CardTitle>
            <CardDescription>Latest persisted run</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Mail className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">
              {emailReadyCount}/{caterers.length}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Caterer Rows</CardTitle>
          <CardDescription>
            Latest persisted quantity shown: {latestQuantity} meal(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {caterers.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>Caterer</Th>
                  <Th>Schools</Th>
                  <Th>Contacts</Th>
                  <Th>Minimum tiers</Th>
                  <Th>Menu review</Th>
                  <Th>Latest order</Th>
                  <Th>Email state</Th>
                  <Th className="text-right">Open</Th>
                </tr>
              </thead>
              <tbody>
                {caterers.map((caterer) => {
                  const catererId = caterer.caterer_id ?? "";

                  return (
                    <tr key={catererId || caterer.caterer_name}>
                      <Td>
                        <div className="font-medium">
                          {caterer.caterer_name ?? "Unknown caterer"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(caterer.per_item_price)} per meal ·{" "}
                          {formatMoney(caterer.delivery_fee)} delivery
                        </div>
                      </Td>
                      <Td>
                        <div>
                          {caterer.assigned_school_count ?? 0} school(s)
                        </div>
                        <div className="max-w-52 truncate text-xs text-muted-foreground">
                          {(caterer.assigned_school_names ?? []).join(", ") ||
                            "No assigned schools"}
                        </div>
                      </Td>
                      <Td>
                        <div>{caterer.contact_count ?? 0} contact(s)</div>
                        <div className="max-w-48 truncate text-xs text-muted-foreground">
                          {caterer.primary_contact_name ?? "No primary contact"}
                          {caterer.primary_contact_email
                            ? ` · ${caterer.primary_contact_email}`
                            : ""}
                        </div>
                      </Td>
                      <Td>{joinCounts(caterer.valid_offer_counts)}</Td>
                      <Td>
                        <div>
                          {caterer.reviewed_variant_count ?? 0}/
                          {caterer.variant_count ?? 0} reviewed
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {caterer.available_variant_count ?? 0} available
                        </div>
                      </Td>
                      <Td>
                        <div>
                          {caterer.latest_order_quantity ?? 0} meal(s),{" "}
                          {caterer.latest_order_line_count ?? 0} line(s)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(caterer.latest_order_week_start)} ·{" "}
                          {formatStatus(caterer.latest_order_run_status)}
                        </div>
                      </Td>
                      <Td>
                        <StatusBadge status={emailToken(caterer.email_state)} />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatEmailState(caterer.email_state)}
                          {caterer.exported_at
                            ? ` · ${formatDateTime(caterer.exported_at)}`
                            : ""}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/caterers/${catererId}`}>
                            <ArrowRight className="size-4" aria-hidden="true" />
                            <span className="sr-only">
                              Open {caterer.caterer_name ?? "caterer"}
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
              icon={Store}
              title="No caterers found"
              description="Ingest caterer source data before the website can show caterer readiness."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
