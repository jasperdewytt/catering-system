"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, RotateCcw, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatAuditAction,
  formatDateTime,
  formatStatus,
} from "@/lib/operator-display";
import type { OperatorAuditEvent } from "@/lib/operator-read-models";

type AuditTableClientProps = {
  auditEvents: OperatorAuditEvent[];
  orderRunWeekStarts: Record<string, string>;
};

function eventKey(event: OperatorAuditEvent, index: number) {
  return event.audit_id ?? `${event.created_at ?? "unknown"}-${index}`;
}

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : "Not recorded";
}

function stringifyJson(value: unknown) {
  if (value === null || value === undefined) {
    return "Not recorded";
  }

  return JSON.stringify(value, null, 2);
}

function JsonPreview({ value }: { value: unknown }) {
  const className =
    "mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs leading-5";

  return <pre className={className}>{stringifyJson(value)}</pre>;
}

function uniqueOptions(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));
}

function searchableText(event: OperatorAuditEvent) {
  return [
    event.action,
    event.display_action,
    event.actor_name,
    event.entity_type,
    event.entity_id,
    event.order_run_id,
    event.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function AuditTableClient({
  auditEvents,
  orderRunWeekStarts,
}: AuditTableClientProps) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const actions = useMemo(
    () => uniqueOptions(auditEvents.map((event) => event.action)),
    [auditEvents],
  );
  const actors = useMemo(
    () => uniqueOptions(auditEvents.map((event) => event.actor_name)),
    [auditEvents],
  );
  const entityTypes = useMemo(
    () => uniqueOptions(auditEvents.map((event) => event.entity_type)),
    [auditEvents],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredEvents = useMemo(
    () =>
      auditEvents.filter((event) => {
        if (action !== "all" && event.action !== action) {
          return false;
        }

        if (actor !== "all" && event.actor_name !== actor) {
          return false;
        }

        if (entityType !== "all" && event.entity_type !== entityType) {
          return false;
        }

        if (
          normalizedQuery &&
          !searchableText(event).includes(normalizedQuery)
        ) {
          return false;
        }

        return true;
      }),
    [action, actor, auditEvents, entityType, normalizedQuery],
  );

  function resetFilters() {
    setQuery("");
    setAction("all");
    setActor("all");
    setEntityType("all");
    setExpandedKey(null);
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="audit-search">Search</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="pl-9"
                id="audit-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search action, actor, entity, reason, or run"
                value={query}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-action">Action</Label>
            <select
              className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
              id="audit-action"
              onChange={(event) => setAction(event.target.value)}
              value={action}
            >
              <option value="all">All actions</option>
              {actions.map((option) => (
                <option key={option} value={option}>
                  {formatAuditAction(null, option)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-actor">Actor</Label>
            <select
              className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
              id="audit-actor"
              onChange={(event) => setActor(event.target.value)}
              value={actor}
            >
              <option value="all">All actors</option>
              {actors.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-entity">Entity</Label>
            <select
              className="h-10 w-full rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/20"
              id="audit-entity"
              onChange={(event) => setEntityType(event.target.value)}
              value={entityType}
            >
              <option value="all">All entities</option>
              {entityTypes.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button className="w-full" onClick={resetFilters} type="button">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredEvents.length} of {auditEvents.length} event(s).
        </div>

        {filteredEvents.length ? (
          <CompactTable>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Actor</Th>
                <Th>Entity</Th>
                <Th>Reason</Th>
                <Th>Related Run</Th>
                <Th className="text-right">Details</Th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, index) => {
                const key = eventKey(event, index);
                const isExpanded = expandedKey === key;
                const weekStart = event.order_run_id
                  ? orderRunWeekStarts[event.order_run_id]
                  : undefined;

                return (
                  <Fragment key={key}>
                    <tr>
                      <Td>{formatDateTime(event.created_at)}</Td>
                      <Td>
                        {formatAuditAction(event.display_action, event.action)}
                      </Td>
                      <Td>{event.actor_name ?? "Unknown operator"}</Td>
                      <Td>
                        <div>{formatStatus(event.entity_type)}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {shortId(event.entity_id)}
                        </div>
                      </Td>
                      <Td className="max-w-md">
                        <div className="line-clamp-2">
                          {event.reason ?? "No reason recorded"}
                        </div>
                      </Td>
                      <Td>
                        {event.order_run_id && weekStart ? (
                          <Link
                            className="font-medium text-brand hover:underline"
                            href={`/weeks/${weekStart}/orders/${event.order_run_id}`}
                          >
                            {shortId(event.order_run_id)}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {shortId(event.order_run_id)}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedKey(isExpanded ? null : key)
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {isExpanded ? (
                            <ChevronDown
                              className="size-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="size-4"
                              aria-hidden="true"
                            />
                          )}
                          {isExpanded ? "Hide" : "View"}
                        </Button>
                      </Td>
                    </tr>
                    {isExpanded ? (
                      <tr key={`${key}-details`}>
                        <Td className="bg-muted" colSpan={7}>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <h3 className="text-sm font-medium">
                                Before State
                              </h3>
                              <JsonPreview value={event.before_state} />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium">
                                After State
                              </h3>
                              <JsonPreview value={event.after_state} />
                            </div>
                          </div>
                          <dl className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                            <div>
                              <dt className="font-medium text-foreground">
                                Audit ID
                              </dt>
                              <dd className="font-mono">
                                {event.audit_id ?? "Not recorded"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium text-foreground">
                                Entity ID
                              </dt>
                              <dd className="font-mono">
                                {event.entity_id ?? "Not recorded"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium text-foreground">
                                Order Run ID
                              </dt>
                              <dd className="font-mono">
                                {event.order_run_id ?? "Not recorded"}
                              </dd>
                            </div>
                          </dl>
                        </Td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </CompactTable>
        ) : (
          <EmptyState
            title="No matching audit events"
            description="Adjust the search or filters to inspect more of the audit trail."
          />
        )}
      </CardContent>
    </Card>
  );
}
