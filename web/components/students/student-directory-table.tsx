"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, UserRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge, type StatusToken } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import { formatDate, formatStatus } from "@/lib/operator-display";
import type { OperatorStudent } from "@/lib/operator-read-models";

function dietaryToken(student: OperatorStudent): StatusToken {
  if ((student.pending_warning_count ?? 0) > 0) {
    return "Blocked";
  }

  if ((student.dietary_tags ?? []).length > 0) {
    return "Ready";
  }

  if (student.dietary_raw) {
    return "Unreviewed";
  }

  return "Generated";
}

function dietaryLabel(student: OperatorStudent): string {
  if ((student.pending_warning_count ?? 0) > 0) {
    return `${student.pending_warning_count} pending warning(s)`;
  }

  const tags = student.dietary_tags ?? [];
  if (tags.length) {
    return tags.map(formatStatus).join(", ");
  }

  return student.dietary_raw || "No dietary notes";
}

function contactSearch(student: OperatorStudent): string {
  return [
    student.student_name,
    student.school_name,
    student.subjects,
    student.dietary_raw,
    student.student_email,
    student.parent_name,
    student.parent_email,
    student.parent_mobile,
    ...(student.dietary_tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function StudentDirectoryTable({
  students,
}: {
  students: OperatorStudent[];
}) {
  const [query, setQuery] = useState("");
  const [optOutFilter, setOptOutFilter] = useState("all");
  const [dietaryFilter, setDietaryFilter] = useState("all");

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return students.filter((student) => {
      if (optOutFilter === "active" && student.opted_out) {
        return false;
      }

      if (optOutFilter === "opted_out" && !student.opted_out) {
        return false;
      }

      if (
        dietaryFilter === "warnings" &&
        (student.pending_warning_count ?? 0) === 0
      ) {
        return false;
      }

      if (
        dietaryFilter === "tagged" &&
        (student.dietary_tags ?? []).length === 0
      ) {
        return false;
      }

      if (
        normalizedQuery &&
        !contactSearch(student).includes(normalizedQuery)
      ) {
        return false;
      }

      return true;
    });
  }, [dietaryFilter, optOutFilter, query, students]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_11rem_12rem]">
        <label className="relative block">
          <span className="sr-only">Search students</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, school, dietary, contact"
          />
        </label>
        <label className="block">
          <span className="sr-only">Filter opt-out state</span>
          <select
            className="h-9 w-full rounded-[var(--radius)] border border-input bg-background px-3 text-sm"
            value={optOutFilter}
            onChange={(event) => setOptOutFilter(event.target.value)}
          >
            <option value="all">All students</option>
            <option value="active">Active only</option>
            <option value="opted_out">Opted out</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter dietary state</span>
          <select
            className="h-9 w-full rounded-[var(--radius)] border border-input bg-background px-3 text-sm"
            value={dietaryFilter}
            onChange={(event) => setDietaryFilter(event.target.value)}
          >
            <option value="all">All dietary states</option>
            <option value="warnings">Pending warnings</option>
            <option value="tagged">Has dietary tags</option>
          </select>
        </label>
      </div>

      {filteredStudents.length ? (
        <CompactTable>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>School</Th>
              <Th>Year</Th>
              <Th>State</Th>
              <Th>Dietary</Th>
              <Th>Enrolments</Th>
              <Th>Latest allocation</Th>
              <Th className="text-right">Open</Th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => {
              const studentId = student.student_id ?? "";

              return (
                <tr key={studentId || student.student_name}>
                  <Td>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          className="h-auto justify-start p-0 text-left font-medium text-foreground hover:bg-transparent"
                          variant="ghost"
                        >
                          {student.student_name ?? "Unknown student"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {student.student_name ?? "Unknown student"}
                          </DialogTitle>
                          <DialogDescription>
                            Parent and student contact details from the student
                            source file.
                          </DialogDescription>
                        </DialogHeader>
                        <dl className="grid gap-3 text-sm">
                          <div>
                            <dt className="text-muted-foreground">
                              Student email
                            </dt>
                            <dd>
                              {student.student_email ?? "No student email"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              Parent name
                            </dt>
                            <dd>{student.parent_name ?? "No parent name"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              Parent email
                            </dt>
                            <dd>{student.parent_email ?? "No parent email"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              Parent mobile
                            </dt>
                            <dd>
                              {student.parent_mobile ?? "No parent mobile"}
                            </dd>
                          </div>
                        </dl>
                      </DialogContent>
                    </Dialog>
                    <div className="max-w-56 truncate text-xs text-muted-foreground">
                      {student.subjects ?? "No subjects recorded"}
                    </div>
                  </Td>
                  <Td>{student.school_name ?? "Unknown school"}</Td>
                  <Td>Year {student.year_level ?? "?"}</Td>
                  <Td>
                    <StatusBadge
                      status={student.opted_out ? "Blocked" : "Ready"}
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {student.opted_out ? "Opted out" : "Active"}
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge status={dietaryToken(student)} />
                    <div className="mt-1 max-w-56 truncate text-xs text-muted-foreground">
                      {dietaryLabel(student)}
                    </div>
                  </Td>
                  <Td>
                    <div>{student.enrolment_count ?? 0} session(s)</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(student.first_session_date)} to{" "}
                      {formatDate(student.last_session_date)}
                    </div>
                  </Td>
                  <Td>
                    <div>
                      {student.latest_allocated_count ?? 0}/
                      {student.latest_allocation_count ?? 0} allocated
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(student.latest_allocation_statuses ?? [])
                        .map(formatStatus)
                        .join(", ") || "No latest allocation"}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/students/${studentId}`}>
                        <ArrowRight className="size-4" aria-hidden="true" />
                        <span className="sr-only">
                          Open {student.student_name ?? "student"}
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
          icon={UserRound}
          title="No matching students"
          description="Adjust the search or filters to inspect the operator-visible student rows."
        />
      )}
    </div>
  );
}
