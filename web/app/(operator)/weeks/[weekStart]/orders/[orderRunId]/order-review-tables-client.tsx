"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompactTable, Td, Th } from "@/components/ui/table";
import { formatDate, formatMoney, formatStatus } from "@/lib/operator-display";
import type {
  OperatorOrderRunAllocation,
  OperatorOrderRunLine,
} from "@/lib/operator-read-models";

type SortButtonProps = {
  label: string;
  onClick: () => void;
};

function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function normalized(value: string): string {
  return value.toLowerCase().trim();
}

function uniqueOptions(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

function SortButton({ label, onClick }: SortButtonProps) {
  return (
    <button
      className="inline-flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={onClick}
      type="button"
    >
      {label}
      <ArrowUpDown className="size-3" aria-hidden="true" />
    </button>
  );
}

function TableShell<T>({
  emptyDescription,
  emptyTitle,
  rowCount,
  table,
  totalCount,
}: {
  emptyDescription: string;
  emptyTitle: string;
  rowCount: number;
  table: ReturnType<typeof useReactTable<T>>;
  totalCount: number;
}) {
  if (totalCount > 0 && rowCount === 0) {
    return (
      <EmptyState
        icon={Search}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <CompactTable>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </Th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <Td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </CompactTable>
  );
}

export function OrderLinesTableClient({
  lines,
}: {
  lines: OperatorOrderRunLine[];
}) {
  const [search, setSearch] = useState("");
  const [catererFilter, setCatererFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "session_date", desc: false },
  ]);

  const catererOptions = useMemo(
    () => uniqueOptions(lines.map((line) => line.caterer_name)),
    [lines],
  );
  const schoolOptions = useMemo(
    () => uniqueOptions(lines.map((line) => line.school_name)),
    [lines],
  );

  const filteredLines = useMemo(() => {
    const query = normalized(search);

    return lines.filter((line) => {
      if (catererFilter !== "all" && line.caterer_name !== catererFilter) {
        return false;
      }

      if (schoolFilter !== "all" && line.school_name !== schoolFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return normalized(
        [
          line.caterer_name,
          line.school_name,
          line.session_date,
          line.display_name,
          line.quantity,
          line.unit_price,
          line.line_total,
        ]
          .map(text)
          .join(" "),
      ).includes(query);
    });
  }, [catererFilter, lines, schoolFilter, search]);

  const columns = useMemo<ColumnDef<OperatorOrderRunLine>[]>(
    () => [
      {
        accessorKey: "caterer_name",
        header: ({ column }) => (
          <SortButton
            label="Caterer"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => row.original.caterer_name ?? "Unknown caterer",
      },
      {
        accessorKey: "session_date",
        header: ({ column }) => (
          <SortButton
            label="Session"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div>{formatDate(row.original.session_date)}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.school_name ?? "Unknown school"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "school_name",
        header: ({ column }) => (
          <SortButton
            label="School"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => row.original.school_name ?? "Unknown school",
      },
      {
        accessorKey: "display_name",
        header: ({ column }) => (
          <SortButton
            label="Dish"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => row.original.display_name ?? "Unknown dish",
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <div className="text-right">
            <SortButton
              label="Qty"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.quantity ?? 0}</div>
        ),
      },
      {
        accessorKey: "unit_price",
        header: ({ column }) => (
          <div className="text-right">
            <SortButton
              label="Unit"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {formatMoney(row.original.unit_price)}
          </div>
        ),
      },
      {
        accessorKey: "line_total",
        header: ({ column }) => (
          <div className="text-right">
            <SortButton
              label="Total"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {formatMoney(row.original.line_total)}
          </div>
        ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredLines,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function resetFilters() {
    setSearch("");
    setCatererFilter("all");
    setSchoolFilter("all");
    setSorting([{ id: "session_date", desc: false }]);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="order-line-search">Search</Label>
          <Input
            id="order-line-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Caterer, school, dish, date"
            value={search}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="order-line-caterer">Caterer</Label>
          <select
            className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
            id="order-line-caterer"
            onChange={(event) => setCatererFilter(event.target.value)}
            value={catererFilter}
          >
            <option value="all">All caterers</option>
            {catererOptions.map((caterer) => (
              <option key={caterer} value={caterer}>
                {caterer}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="order-line-school">School</Label>
          <select
            className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
            id="order-line-school"
            onChange={(event) => setSchoolFilter(event.target.value)}
            value={schoolFilter}
          >
            <option value="all">All schools</option>
            {schoolOptions.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={resetFilters} type="button" variant="secondary">
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Showing {filteredLines.length} of {lines.length} order lines
      </div>
      <TableShell
        emptyDescription="Change or reset the search and filters to show order lines."
        emptyTitle="No matching order lines"
        rowCount={filteredLines.length}
        table={table}
        totalCount={lines.length}
      />
    </div>
  );
}

export function AllocationsTableClient({
  allocations,
}: {
  allocations: OperatorOrderRunAllocation[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "session_date", desc: false },
  ]);

  const statusOptions = useMemo(
    () =>
      uniqueOptions(
        allocations.map((allocation) => allocation.allocation_status),
      ),
    [allocations],
  );
  const sessionOptions = useMemo(
    () =>
      uniqueOptions(
        allocations.map((allocation) =>
          [allocation.school_name, allocation.session_date]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
    [allocations],
  );

  const filteredAllocations = useMemo(() => {
    const query = normalized(search);

    return allocations.filter((allocation) => {
      const sessionValue = [allocation.school_name, allocation.session_date]
        .filter(Boolean)
        .join(" · ");

      if (
        statusFilter !== "all" &&
        allocation.allocation_status !== statusFilter
      ) {
        return false;
      }

      if (sessionFilter !== "all" && sessionValue !== sessionFilter) {
        return false;
      }

      if (issuesOnly && (allocation.issue_count ?? 0) === 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      return normalized(
        [
          allocation.student_name,
          allocation.school_name,
          allocation.session_date,
          allocation.display_name,
          allocation.allocation_status,
          allocation.year_level,
          ...(allocation.dietary_tags ?? []),
        ]
          .map(text)
          .join(" "),
      ).includes(query);
    });
  }, [allocations, issuesOnly, search, sessionFilter, statusFilter]);

  const columns = useMemo<ColumnDef<OperatorOrderRunAllocation>[]>(
    () => [
      {
        accessorKey: "student_name",
        header: ({ column }) => (
          <SortButton
            label="Student"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div>{row.original.student_name ?? "Unknown student"}</div>
            <div className="text-xs text-muted-foreground">
              Year {row.original.year_level ?? "not recorded"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "session_date",
        header: ({ column }) => (
          <SortButton
            label="Session"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div>{formatDate(row.original.session_date)}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.school_name ?? "Unknown school"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "school_name",
        header: ({ column }) => (
          <SortButton
            label="School"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => row.original.school_name ?? "Unknown school",
      },
      {
        accessorKey: "display_name",
        header: ({ column }) => (
          <SortButton
            label="Dish"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => row.original.display_name ?? "No allocated dish",
      },
      {
        accessorKey: "allocation_status",
        header: ({ column }) => (
          <SortButton
            label="Status"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => formatStatus(row.original.allocation_status),
      },
      {
        accessorKey: "issue_count",
        header: ({ column }) => (
          <div className="text-right">
            <SortButton
              label="Issues"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.issue_count ?? 0}</div>
        ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredAllocations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setSessionFilter("all");
    setIssuesOnly(false);
    setSorting([{ id: "session_date", desc: false }]);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.75fr_0.9fr_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="allocation-search">Search</Label>
          <Input
            id="allocation-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Student, school, dish, status"
            value={search}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="allocation-status">Status</Label>
          <select
            className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
            id="allocation-status"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="allocation-session">Session</Label>
          <select
            className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
            id="allocation-session"
            onChange={(event) => setSessionFilter(event.target.value)}
            value={sessionFilter}
          >
            <option value="all">All sessions</option>
            {sessionOptions.map((session) => (
              <option key={session} value={session}>
                {session}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-10 items-center gap-2 self-end rounded-[var(--radius)] border border-border bg-card px-3 text-sm">
          <input
            checked={issuesOnly}
            className="size-4 accent-[var(--padea-crimson)]"
            onChange={(event) => setIssuesOnly(event.target.checked)}
            type="checkbox"
          />
          Issues only
        </label>
        <div className="flex items-end">
          <Button onClick={resetFilters} type="button" variant="secondary">
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Showing {filteredAllocations.length} of {allocations.length} allocations
      </div>
      <TableShell
        emptyDescription="Change or reset the search and filters to show allocations."
        emptyTitle="No matching allocations"
        rowCount={filteredAllocations.length}
        table={table}
        totalCount={allocations.length}
      />
    </div>
  );
}
