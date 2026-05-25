import Link from "next/link";
import { ArrowLeft, DatabaseZap, Store, Users } from "lucide-react";

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
import type { Json } from "@/types/supabase";
import {
  formatDate,
  formatDateTime,
  formatEmailState,
  formatMoney,
  formatStatus,
} from "@/lib/operator-display";
import { getCatererDetailReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

type Contact = {
  contact_id?: string;
  display_name?: string;
  role?: string;
  email?: string;
  cc_preference?: string;
  role_note?: string;
  is_verified?: boolean;
};

type WeeklyMinimum = {
  menu_item_count?: number;
  minimum_meals?: number;
};

type AssignedSchool = {
  school_id?: string;
  school_name?: string;
  session_count?: number;
  first_session_date?: string;
  last_session_date?: string;
};

type LatestOrderTotals = {
  order_run_id?: string | null;
  week_start?: string | null;
  status?: string | null;
  line_count?: number;
  session_count?: number;
  total_quantity?: number;
  total_amount?: number;
};

type LatestOrderLine = {
  order_line_id?: string;
  school_name?: string;
  session_date?: string;
  display_name?: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
};

type LatestCommunication = {
  communication_id?: string | null;
  order_run_id?: string | null;
  week_start?: string | null;
  email_state?: string | null;
  subject?: string | null;
  exported_at?: string | null;
  exported_by?: string | null;
  event_count?: number;
  latest_event_at?: string | null;
};

function jsonArray<T>(value: Json | null): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function jsonObject<T>(value: Json | null): T {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as T)
    : ({} as T);
}

function emailToken(value: string | null | undefined): StatusToken {
  if (value === "exported") {
    return "Exported";
  }

  if (value === "not_ready") {
    return "Blocked";
  }

  return "Unreviewed";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function CatererDetailPage({
  params,
}: {
  params: Promise<{ catererId: string }>;
}) {
  const { catererId } = await params;

  if (!isUuid(catererId)) {
    return (
      <>
        <PageHeader
          eyebrow="Caterer"
          title="Caterer not found"
          actions={
            <Button asChild variant="secondary">
              <Link href="/caterers">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Caterers
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={Store}
          title="Unknown caterer"
          description="The caterer id in the URL is not a valid caterer identifier."
        />
      </>
    );
  }

  const supabase = await createClient();
  const result = await getCatererDetailReadModel(supabase, catererId);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Caterer"
          title="Caterer Detail"
          description="This page reads a single row from the authenticated operator_caterer_detail view."
          actions={
            <Button asChild variant="secondary">
              <Link href="/caterers">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Caterers
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={DatabaseZap}
          title="Caterer detail is unavailable"
          description={result.error}
        />
      </>
    );
  }

  const caterer = result.data;

  if (!caterer) {
    return (
      <>
        <PageHeader
          eyebrow="Caterer"
          title="Caterer not found"
          actions={
            <Button asChild variant="secondary">
              <Link href="/caterers">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Caterers
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={Store}
          title="No caterer row"
          description="No operator-visible caterer exists for this identifier."
        />
      </>
    );
  }

  const contacts = jsonArray<Contact>(caterer.contacts);
  const weeklyMinimums = jsonArray<WeeklyMinimum>(caterer.weekly_minimums);
  const assignedSchools = jsonArray<AssignedSchool>(caterer.assigned_schools);
  const latestOrderTotals = jsonObject<LatestOrderTotals>(
    caterer.latest_order_totals,
  );
  const latestOrderLines = jsonArray<LatestOrderLine>(
    caterer.latest_order_lines,
  );
  const latestCommunication = jsonObject<LatestCommunication>(
    caterer.latest_communication,
  );

  return (
    <>
      <PageHeader
        eyebrow="Caterer"
        title={caterer.caterer_name ?? "Unknown caterer"}
        description={`${caterer.region ?? "No region recorded"} · ${formatMoney(
          caterer.per_item_price,
        )} per meal · ${formatMoney(caterer.delivery_fee)} delivery`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/caterers">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Caterers
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Schools</CardTitle>
            <CardDescription>Assigned from sessions</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Users className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">
              {caterer.assigned_school_count ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Source contact rows</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {caterer.contact_count ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Menu Variants</CardTitle>
            <CardDescription>Reviewed / total</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {caterer.reviewed_variant_count ?? 0}/{caterer.variant_count ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email State</CardTitle>
            <CardDescription>Latest persisted run</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge status={emailToken(latestCommunication.email_state)} />
            <div className="mt-2 text-sm text-muted-foreground">
              {formatEmailState(latestCommunication.email_state ?? null)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>
              Contact anomalies are shown verbatim from source data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contacts.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Email</Th>
                    <Th>CC</Th>
                    <Th>Verified</Th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.contact_id ?? contact.email}>
                      <Td>
                        <div className="font-medium">
                          {contact.display_name ?? "Unnamed contact"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.role_note ?? "No role note"}
                        </div>
                      </Td>
                      <Td>{formatStatus(contact.role ?? null)}</Td>
                      <Td>{contact.email ?? "No email recorded"}</Td>
                      <Td>{formatStatus(contact.cc_preference ?? null)}</Td>
                      <Td>{contact.is_verified ? "Yes" : "No"}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={Users}
                title="No contacts"
                description="No caterer contact rows are visible for this caterer."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Minimums</CardTitle>
            <CardDescription>Configured offer tiers</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyMinimums.length ? (
              <dl className="space-y-3 text-sm">
                {weeklyMinimums.map((minimum) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2"
                    key={minimum.menu_item_count}
                  >
                    <dt>{minimum.menu_item_count ?? 0} item(s)</dt>
                    <dd className="font-medium">
                      {minimum.minimum_meals ?? 0} meals
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState
                icon={Store}
                title="No minimum tiers"
                description="No weekly minimum configuration is visible for this caterer."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assigned Schools</CardTitle>
            <CardDescription>Session-derived school coverage</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedSchools.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>School</Th>
                    <Th className="text-right">Sessions</Th>
                    <Th>Date range</Th>
                  </tr>
                </thead>
                <tbody>
                  {assignedSchools.map((school) => (
                    <tr key={school.school_id ?? school.school_name}>
                      <Td>{school.school_name ?? "Unknown school"}</Td>
                      <Td className="text-right">
                        {school.session_count ?? 0}
                      </Td>
                      <Td>
                        {formatDate(school.first_session_date ?? null)} to{" "}
                        {formatDate(school.last_session_date ?? null)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={Users}
                title="No assigned schools"
                description="No sessions currently link this caterer to a school."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Menu Readiness</CardTitle>
            <CardDescription>Stored dish and variant state</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted p-3">
                <dt className="text-muted-foreground">Dishes</dt>
                <dd className="text-xl font-semibold">
                  {caterer.dish_count ?? 0}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <dt className="text-muted-foreground">Variants</dt>
                <dd className="text-xl font-semibold">
                  {caterer.variant_count ?? 0}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <dt className="text-muted-foreground">Available</dt>
                <dd className="text-xl font-semibold">
                  {caterer.available_variant_count ?? 0}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <dt className="text-muted-foreground">Unreviewed</dt>
                <dd className="text-xl font-semibold">
                  {caterer.unreviewed_variant_count ?? 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Persisted Order</CardTitle>
          <CardDescription>
            {formatDate(latestOrderTotals.week_start ?? null)} ·{" "}
            {formatStatus(latestOrderTotals.status ?? null)} ·{" "}
            {latestOrderTotals.total_quantity ?? 0} meal(s),{" "}
            {formatMoney(latestOrderTotals.total_amount ?? null)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latestOrderLines.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>School</Th>
                  <Th>Session</Th>
                  <Th>Variant</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {latestOrderLines.map((line) => (
                  <tr key={line.order_line_id ?? line.display_name}>
                    <Td>{line.school_name ?? "Unknown school"}</Td>
                    <Td>{formatDate(line.session_date ?? null)}</Td>
                    <Td>{line.display_name ?? "Unknown variant"}</Td>
                    <Td className="text-right">{line.quantity ?? 0}</Td>
                    <Td className="text-right">
                      {formatMoney(line.line_total ?? null)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </CompactTable>
          ) : (
            <EmptyState
              icon={Store}
              title="No latest order lines"
              description="No persisted order lines are visible for this caterer in the latest order run."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Communication Readiness</CardTitle>
          <CardDescription>
            Persisted email snapshot state for the latest order run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
            <div>
              <StatusBadge
                status={emailToken(latestCommunication.email_state)}
              />
              <div className="mt-2 text-sm text-muted-foreground">
                {formatEmailState(latestCommunication.email_state ?? null)}
              </div>
            </div>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{latestCommunication.subject ?? "No subject recorded"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prepared by</dt>
                <dd>
                  {latestCommunication.exported_by ?? "No operator recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prepared at</dt>
                <dd>
                  {formatDateTime(latestCommunication.exported_at ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Events</dt>
                <dd>{latestCommunication.event_count ?? 0}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
