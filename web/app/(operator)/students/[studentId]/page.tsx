import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  DatabaseZap,
  Mail,
  ShieldAlert,
  UserRound,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge, type StatusToken } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatAuditAction,
  formatDate,
  formatDateTime,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import { getStudentDetailReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

type DietaryWarning = {
  warning_id?: string;
  raw_value?: string;
  status?: string;
  resolved_tag_codes?: string[] | null;
  resolved_at?: string | null;
  resolved_note?: string | null;
  created_at?: string | null;
};

type Enrolment = {
  session_id?: string;
  session_date?: string;
  school_name?: string;
  caterer_name?: string;
  start_time?: string | null;
  end_time?: string | null;
  dinner_time?: string | null;
  building?: string | null;
  room?: string | null;
  manager_name?: string | null;
  manager_mobile?: string | null;
  excluded_year_levels?: number[] | null;
  exclusion_reason?: string | null;
};

type Absence = {
  absence_id?: string;
  session_id?: string;
  session_date?: string;
  school_name?: string;
  note?: string | null;
  source_file?: string | null;
  created_at?: string | null;
};

type Allocation = {
  allocation_id?: string;
  order_run_id?: string;
  week_start?: string;
  run_status?: string;
  session_date?: string;
  school_name?: string;
  caterer_name?: string;
  display_name?: string | null;
  allocation_status?: string;
  reason_codes?: string[];
  dietary_tag_codes?: string[];
};

type ManualOverride = {
  override_id?: string;
  order_run_id?: string;
  actor_name?: string;
  override_type?: string;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  created_at?: string;
};

type AuditEvent = {
  audit_id?: string;
  order_run_id?: string;
  actor_name?: string;
  action?: string;
  display_action?: string;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  created_at?: string;
};

function jsonArray<T>(value: Json | null): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function dietaryToken(
  pendingWarningCount: number,
  tagCount: number,
): StatusToken {
  if (pendingWarningCount > 0) {
    return "Blocked";
  }

  if (tagCount > 0) {
    return "Ready";
  }

  return "Generated";
}

function formatTimeRange(enrolment: Enrolment): string {
  if (!enrolment.start_time && !enrolment.end_time) {
    return "No time recorded";
  }

  return `${enrolment.start_time ?? "?"} to ${enrolment.end_time ?? "?"}`;
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  if (!isUuid(studentId)) {
    return (
      <>
        <PageHeader
          eyebrow="Student"
          title="Student not found"
          actions={
            <Button asChild variant="secondary">
              <Link href="/students">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Students
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={UserRound}
          title="Unknown student"
          description="The student id in the URL is not a valid student identifier."
        />
      </>
    );
  }

  const supabase = await createClient();
  const result = await getStudentDetailReadModel(supabase, studentId);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Student"
          title="Student Detail"
          description="This page reads a single row from the authenticated operator_student_detail view."
          actions={
            <Button asChild variant="secondary">
              <Link href="/students">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Students
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={DatabaseZap}
          title="Student detail is unavailable"
          description={result.error}
        />
      </>
    );
  }

  const student = result.data;

  if (!student) {
    return (
      <>
        <PageHeader
          eyebrow="Student"
          title="Student not found"
          actions={
            <Button asChild variant="secondary">
              <Link href="/students">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Students
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={UserRound}
          title="No student row"
          description="No operator-visible student exists for this identifier."
        />
      </>
    );
  }

  const dietaryWarnings = jsonArray<DietaryWarning>(student.dietary_warnings);
  const enrolments = jsonArray<Enrolment>(student.enrolments);
  const absences = jsonArray<Absence>(student.absences);
  const allocations = jsonArray<Allocation>(student.latest_allocations);
  const manualOverrides = jsonArray<ManualOverride>(student.manual_overrides);
  const auditEvents = jsonArray<AuditEvent>(student.audit_events);
  const tagCount = student.dietary_tags?.length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title={student.student_name ?? "Unknown student"}
        description={`${student.school_name ?? "Unknown school"} · Year ${
          student.year_level ?? "?"
        } · ${student.opted_out ? "Opted out" : "Active"}`}
        actions={
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Mail className="size-4" aria-hidden="true" />
                  Contacts
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {student.student_name ?? "Unknown student"}
                  </DialogTitle>
                  <DialogDescription>
                    Parent and student contact details from the student source
                    file.
                  </DialogDescription>
                </DialogHeader>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Student email</dt>
                    <dd>{student.student_email ?? "No student email"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Parent name</dt>
                    <dd>{student.parent_name ?? "No parent name"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Parent email</dt>
                    <dd>{student.parent_email ?? "No parent email"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Parent mobile</dt>
                    <dd>{student.parent_mobile ?? "No parent mobile"}</dd>
                  </div>
                </dl>
              </DialogContent>
            </Dialog>
            <Button asChild variant="secondary">
              <Link href="/students">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Students
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Source: {student.source_file ?? "Not recorded"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge status={student.opted_out ? "Blocked" : "Ready"} />
            <div className="mt-2 text-sm text-muted-foreground">
              {student.subjects ?? "No subjects recorded"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dietary</CardTitle>
            <CardDescription>Tags and warning queue</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge
              status={dietaryToken(
                student.pending_warning_count ?? 0,
                tagCount,
              )}
            />
            <div className="mt-2 text-sm text-muted-foreground">
              {tagCount} tag(s), {student.pending_warning_count ?? 0} pending
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>Stored enrolments and absences</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {student.enrolment_count ?? 0}/{student.absence_count ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest Allocations</CardTitle>
            <CardDescription>
              {formatDate(student.latest_order_week_start)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {student.latest_allocated_count ?? 0}/
            {student.latest_allocation_count ?? 0}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dietary Context</CardTitle>
            <CardDescription>Stored source text and tags</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-muted-foreground">Raw source text</div>
              <div>{student.dietary_raw || "No dietary notes"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Tags</div>
              <div>
                {(student.dietary_tags ?? []).map(formatStatus).join(", ") ||
                  "No tags"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dietary Warnings</CardTitle>
            <CardDescription>
              Unrecognised or reviewed dietary source values
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dietaryWarnings.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Raw value</Th>
                    <Th>Status</Th>
                    <Th>Resolution</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {dietaryWarnings.map((warning) => (
                    <tr key={warning.warning_id ?? warning.raw_value}>
                      <Td>{warning.raw_value ?? "No raw value"}</Td>
                      <Td>
                        <StatusBadge
                          status={statusToken(warning.status ?? null)}
                        />
                      </Td>
                      <Td>
                        {(warning.resolved_tag_codes ?? [])
                          .map(formatStatus)
                          .join(", ") ||
                          warning.resolved_note ||
                          "No resolution recorded"}
                      </Td>
                      <Td>{formatDateTime(warning.created_at ?? null)}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="No dietary warnings"
                description="No dietary warning rows are visible for this student."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrolments</CardTitle>
          <CardDescription>
            Session membership and exclusion context
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrolments.length ? (
            <CompactTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Caterer</Th>
                  <Th>Time</Th>
                  <Th>Location</Th>
                  <Th>Manager</Th>
                  <Th>Exclusion</Th>
                </tr>
              </thead>
              <tbody>
                {enrolments.map((enrolment) => (
                  <tr key={enrolment.session_id ?? enrolment.session_date}>
                    <Td>{formatDate(enrolment.session_date ?? null)}</Td>
                    <Td>{enrolment.caterer_name ?? "Unknown caterer"}</Td>
                    <Td>{formatTimeRange(enrolment)}</Td>
                    <Td>
                      {[enrolment.building, enrolment.room]
                        .filter(Boolean)
                        .join(", ") || "No location"}
                    </Td>
                    <Td>
                      {[enrolment.manager_name, enrolment.manager_mobile]
                        .filter(Boolean)
                        .join(" ") || "No manager"}
                    </Td>
                    <Td>
                      {(enrolment.excluded_year_levels ?? []).length
                        ? `Years ${enrolment.excluded_year_levels?.join(", ")}`
                        : "No exclusion"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </CompactTable>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No enrolments"
              description="No session enrolments are visible for this student."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Absences</CardTitle>
            <CardDescription>Stored absence rows</CardDescription>
          </CardHeader>
          <CardContent>
            {absences.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Note</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {absences.map((absence) => (
                    <tr key={absence.absence_id ?? absence.session_id}>
                      <Td>{formatDate(absence.session_date ?? null)}</Td>
                      <Td>{absence.note ?? "No note"}</Td>
                      <Td>{absence.source_file ?? "Not recorded"}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No absences"
                description="No absence rows are visible for this student."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Allocations</CardTitle>
            <CardDescription>
              Persisted allocation rows from the latest order run
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allocations.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Caterer</Th>
                    <Th>Dish</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((allocation) => (
                    <tr
                      key={allocation.allocation_id ?? allocation.session_date}
                    >
                      <Td>{formatDate(allocation.session_date ?? null)}</Td>
                      <Td>{allocation.caterer_name ?? "Unknown caterer"}</Td>
                      <Td>{allocation.display_name ?? "No dish allocated"}</Td>
                      <Td>
                        <StatusBadge
                          status={statusToken(
                            allocation.allocation_status ?? null,
                          )}
                        />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatStatus(allocation.allocation_status ?? null)}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No latest allocations"
                description="No latest order-run allocation rows are visible for this student."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manual Overrides</CardTitle>
            <CardDescription>
              Relevant audited operator override notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {manualOverrides.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Created</Th>
                    <Th>Type</Th>
                    <Th>Actor</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {manualOverrides.map((override) => (
                    <tr key={override.override_id ?? override.created_at}>
                      <Td>{formatDateTime(override.created_at ?? null)}</Td>
                      <Td>{formatStatus(override.override_type ?? null)}</Td>
                      <Td>{override.actor_name ?? "Unknown actor"}</Td>
                      <Td>{override.reason ?? "No reason recorded"}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="No manual overrides"
                description="No relevant manual override rows are visible for this student."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Context</CardTitle>
            <CardDescription>Relevant append-only audit events</CardDescription>
          </CardHeader>
          <CardContent>
            {auditEvents.length ? (
              <CompactTable>
                <thead>
                  <tr>
                    <Th>Created</Th>
                    <Th>Action</Th>
                    <Th>Actor</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event) => (
                    <tr key={event.audit_id ?? event.created_at}>
                      <Td>{formatDateTime(event.created_at ?? null)}</Td>
                      <Td>
                        {formatAuditAction(
                          event.display_action ?? null,
                          event.action ?? null,
                        )}
                      </Td>
                      <Td>{event.actor_name ?? "Unknown actor"}</Td>
                      <Td>{event.reason ?? "No reason recorded"}</Td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="No audit events"
                description="No relevant audit events are visible for this student."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
