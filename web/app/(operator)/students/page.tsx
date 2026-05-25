import { DatabaseZap, UserRound, Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StudentDirectoryTable } from "@/components/students/student-directory-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStudentsReadModel } from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

export default async function StudentsPage() {
  const supabase = await createClient();
  const result = await getStudentsReadModel(supabase);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Directory"
          title="Students"
          description="This page reads student inspection data from the authenticated operator_students view."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Students are unavailable"
          description={result.error}
        />
      </>
    );
  }

  const students = result.data ?? [];
  const optedOutCount = students.filter((student) => student.opted_out).length;
  const pendingWarningCount = students.reduce(
    (total, student) => total + (student.pending_warning_count ?? 0),
    0,
  );
  const latestAllocatedCount = students.reduce(
    (total, student) => total + (student.latest_allocated_count ?? 0),
    0,
  );
  const latestAllocationCount = students.reduce(
    (total, student) => total + (student.latest_allocation_count ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Students"
        description="Inspect source profile fields, opt-out state, dietary tags, warnings, enrolments, absences, and latest persisted allocation status."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>Visible source rows</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Users className="size-5 text-brand" aria-hidden="true" />
            <span className="text-2xl font-semibold">{students.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Opted Out</CardTitle>
            <CardDescription>
              Shown but excluded by backend rules
            </CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {optedOutCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dietary Warnings</CardTitle>
            <CardDescription>Pending review rows</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {pendingWarningCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest Allocations</CardTitle>
            <CardDescription>Allocated / visible latest rows</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {latestAllocatedCount}/{latestAllocationCount}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Rows</CardTitle>
          <CardDescription>
            Use the student name for contacts, or open the detail page for
            attendance, allocation, override, and audit context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length ? (
            <StudentDirectoryTable students={students} />
          ) : (
            <EmptyState
              icon={UserRound}
              title="No students found"
              description="Ingest student source data before the website can show student inspection rows."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
