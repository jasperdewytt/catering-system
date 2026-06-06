import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  History,
  MessageSquareReply,
  Sparkles,
  Star,
  Store,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { CompactTable, Td, Th } from "@/components/ui/table";
import {
  formatAuditAction,
  formatAutopilotStatus,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatExceptionCategory,
  formatExceptionSeverity,
  formatReplyHandledStatus,
  formatStatus,
  statusToken,
} from "@/lib/operator-display";
import {
  getAutopilotReadModel,
  type OperatorAiInterpretation,
  type OperatorAutopilotException,
  type OperatorCatererQualitySignal,
  type OperatorExceptionResolution,
  type OperatorExceptionResolutionOption,
  type OperatorFeedbackEvent,
  type OperatorMealFitSignal,
} from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";
import { RunAutopilotClient } from "./run-autopilot-client";
import { ExceptionResolutionClient } from "./exception-resolution-client";

function formatNumber(value: number | null): string {
  return new Intl.NumberFormat("en-AU").format(value ?? 0);
}

function formatScore(value: number | null): string {
  if (value === null) {
    return "Not scored";
  }

  return value.toFixed(2);
}

function jsonPreview(value: unknown): string {
  if (value === null || value === undefined) {
    return "No JSON recorded";
  }

  return JSON.stringify(value, null, 2);
}

type ReplyReplacement = {
  affectedAllocationCount: number | null;
  replacementItem: string | null;
  revisedOrderRunId: string | null;
  selectionScore: number | null;
  selectionSource: string | null;
  unavailableItem: string | null;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function replyReplacement(metadata: unknown): ReplyReplacement | null {
  const root = objectValue(metadata);
  const replacement = objectValue(root?.replacement);

  if (!replacement) {
    return null;
  }

  return {
    affectedAllocationCount: numberValue(replacement.affected_allocation_count),
    replacementItem: stringValue(replacement.replacement_item),
    revisedOrderRunId: stringValue(root?.revised_order_run_id),
    selectionScore: numberValue(replacement.selection_score),
    selectionSource: stringValue(replacement.selection_source),
    unavailableItem: stringValue(replacement.unavailable_item),
  };
}

function formatSelectionSource(value: string | null): string {
  if (value === "meal_fit_inferred") {
    return "Selected by deterministic meal-fit ranking";
  }

  if (value === "caterer_proposed") {
    return "Proposed by caterer and safety-checked";
  }

  return "Replacement selection recorded";
}

function revisedThreadSummary(
  emailState: string | null,
  threadStatus: string | null,
): string {
  if (emailState === "sent" && threadStatus === "reply_in_thread") {
    return "Revised email sent in the original thread.";
  }

  if (emailState === "sent" && threadStatus === "message_id_pending") {
    return "Historical revised email sent before threading headers were recorded.";
  }

  if (emailState === "sent") {
    return "Revised email sent without complete threading evidence.";
  }

  return "Revised email has not been sent in the original thread.";
}

function StatusMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-border bg-muted p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ExceptionLinks({
  exception,
}: {
  exception: OperatorAutopilotException;
}) {
  const links = [
    exception.week_start
      ? {
          href: `/weeks/${exception.week_start}`,
          label: "Week",
        }
      : null,
    exception.week_start && exception.order_run_id
      ? {
          href: `/weeks/${exception.week_start}/orders/${exception.order_run_id}`,
          label: "Order",
        }
      : null,
    exception.caterer_id
      ? {
          href: `/caterers/${exception.caterer_id}`,
          label: "Caterer",
        }
      : null,
    exception.student_id
      ? {
          href: `/students/${exception.student_id}`,
          label: "Student",
        }
      : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  if (!links.length) {
    return (
      <span className="text-xs text-muted-foreground">No direct links</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Button asChild key={link.href} size="sm" variant="ghost">
          <Link href={link.href}>
            {link.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ))}
    </div>
  );
}

function ExceptionsSection({
  exceptions,
  options,
  resolutions,
  replyIdsWithInlineResolution,
  weekStart,
}: {
  exceptions: OperatorAutopilotException[];
  options: OperatorExceptionResolutionOption[];
  resolutions: OperatorExceptionResolution[];
  replyIdsWithInlineResolution: Set<string>;
  weekStart: string;
}) {
  const appliedResolutionExceptionIds = new Set(
    resolutions
      .filter((resolution) => resolution.status === "applied")
      .map((resolution) => resolution.exception_id),
  );
  const activeExceptions = exceptions.filter(
    (exception) =>
      exception.status === "open" &&
      exception.resolution_status !== "applied" &&
      !appliedResolutionExceptionIds.has(exception.exception_id),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exception Inbox</CardTitle>
        <CardDescription>
          Open unresolved items are shown first from stored autopilot exception
          rows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activeExceptions.length ? (
          <div className="space-y-3">
            {activeExceptions.map((exception) => (
              <div
                className="rounded-md border border-border bg-muted p-3"
                key={exception.exception_id}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={statusToken(exception.status)} />
                      <StatusBadge status={statusToken(exception.severity)} />
                      <span className="text-xs text-muted-foreground">
                        {formatExceptionSeverity(exception.severity)} ·{" "}
                        {formatExceptionCategory(exception.category)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">
                        {exception.title ?? "Untitled exception"}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {exception.complete_interpreted_summary ??
                          exception.detail ??
                          "No detail recorded."}
                      </p>
                    </div>
                    {exception.detail &&
                    exception.detail !==
                      exception.complete_interpreted_summary ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        Review reason: {exception.detail}
                      </p>
                    ) : null}
                    {exception.deterministic_block_reason ? (
                      <p className="text-sm leading-6 text-[var(--err-fg)]">
                        Deterministic block:{" "}
                        {exception.deterministic_block_reason}
                      </p>
                    ) : null}
                    {exception.recommended_action ? (
                      <p className="text-sm leading-6 text-foreground">
                        {exception.recommended_action}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDateTime(exception.created_at)}</span>
                      {exception.student_name ? (
                        <span>{exception.student_name}</span>
                      ) : null}
                      {exception.caterer_name ? (
                        <span>{exception.caterer_name}</span>
                      ) : null}
                      {exception.school_name ? (
                        <span>{exception.school_name}</span>
                      ) : null}
                    </div>
                  </div>
                  <ExceptionLinks exception={exception} />
                </div>
                {exception.original_reply_body ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-brand">
                      Show original email
                    </summary>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
                      {exception.original_reply_body}
                    </pre>
                  </details>
                ) : null}
                {exception.status === "open" &&
                exception.category === "caterer_reply" &&
                exception.caterer_reply_id &&
                !replyIdsWithInlineResolution.has(
                  exception.caterer_reply_id,
                ) ? (
                  <ExceptionResolutionClient
                    exception={exception}
                    options={options.filter(
                      (option) =>
                        option.exception_id === exception.exception_id,
                    )}
                    resolution={
                      resolutions.find(
                        (resolution) =>
                          resolution.resolution_id ===
                          exception.latest_resolution_id,
                      ) ?? null
                    }
                    weekStart={weekStart}
                  />
                ) : exception.resolution_status === "applied" ? (
                  <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
                    <p className="font-medium text-foreground">
                      Resolution applied
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-6 text-muted-foreground">
                      {exception.resolution_message_text ??
                        exception.resolved_note ??
                        "Resolution outcome recorded."}
                    </p>
                  </div>
                ) : exception.status === "dismissed" ? (
                  <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
                    <p className="font-medium text-foreground">Dismissed</p>
                    <p className="mt-1 whitespace-pre-wrap leading-6 text-muted-foreground">
                      {exception.resolved_note ?? "No dismissal note recorded."}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No current-week exceptions"
            description="Autopilot exceptions will appear here when a persisted gate, reply, or quality signal needs review."
          />
        )}
      </CardContent>
    </Card>
  );
}

function MealFitSection({ rows }: { rows: OperatorMealFitSignal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weak Meal-Fit Examples</CardTitle>
        <CardDescription>
          Lowest persisted allocation explanation scores for the current week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <CompactTable>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Chosen meal</Th>
                <Th>Top feasible</Th>
                <Th className="text-right">Score</Th>
                <Th>Explanation</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.allocation_id}>
                  <Td>
                    <div className="font-medium">
                      {row.student_name ?? "Unknown student"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.school_name ?? "School not recorded"} ·{" "}
                      {formatDate(row.session_date)}
                    </div>
                  </Td>
                  <Td>{row.chosen_display_name ?? "Not recorded"}</Td>
                  <Td>
                    <div>{row.top_feasible_display_name ?? "Not recorded"}</div>
                    <div className="text-xs text-muted-foreground">
                      Top score {formatScore(row.top_feasible_score)}
                    </div>
                  </Td>
                  <Td className="text-right">
                    {formatScore(row.chosen_score)}
                  </Td>
                  <Td className="max-w-md text-sm leading-6 text-muted-foreground">
                    {row.explanation ?? "No explanation recorded."}
                  </Td>
                </tr>
              ))}
            </tbody>
          </CompactTable>
        ) : (
          <EmptyState
            icon={Star}
            title="No meal-fit explanations"
            description="Persisted allocation explanations will appear after a meal-fit order run writes scoring provenance."
          />
        )}
      </CardContent>
    </Card>
  );
}

function QualitySection({ rows }: { rows: OperatorCatererQualitySignal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caterer Quality Signals</CardTitle>
        <CardDescription>
          Persisted quality events grouped by caterer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <CompactTable>
            <thead>
              <tr>
                <Th>Caterer</Th>
                <Th className="text-right">Events</Th>
                <Th className="text-right">Review</Th>
                <Th className="text-right">Serious</Th>
                <Th>Latest</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.caterer_id}>
                  <Td>
                    {row.caterer_id ? (
                      <Link
                        className="font-medium text-brand hover:text-brand-hover"
                        href={`/caterers/${row.caterer_id}`}
                      >
                        {row.caterer_name ?? "Unknown caterer"}
                      </Link>
                    ) : (
                      <span>{row.caterer_name ?? "Unknown caterer"}</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {formatNumber(row.quality_event_count)}
                  </Td>
                  <Td className="text-right">
                    {formatNumber(row.review_event_count)}
                  </Td>
                  <Td className="text-right">
                    {formatNumber(row.serious_event_count)}
                  </Td>
                  <Td>{formatDateTime(row.latest_event_at)}</Td>
                </tr>
              ))}
            </tbody>
          </CompactTable>
        ) : (
          <EmptyState
            icon={Store}
            title="No quality rows"
            description="Caterer quality signal rows will appear after feedback or reply handling records quality events."
          />
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackSection({ rows }: { rows: OperatorFeedbackEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback Stream</CardTitle>
        <CardDescription>
          Read-only current-week feedback from stored student and session rows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <CompactTable>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th>Who</Th>
                <Th>Meal or session</Th>
                <Th>Signal</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feedback_id}>
                  <Td>
                    <div>{formatStatus(row.feedback_type)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-medium">
                      {row.student_name ?? row.caterer_name ?? "Session"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.school_name ?? "School not recorded"} ·{" "}
                      {formatDate(row.session_date)}
                    </div>
                  </Td>
                  <Td>
                    {row.dish_variant_name ?? row.delivery_status ?? "Session"}
                  </Td>
                  <Td>
                    <div>
                      {row.rating !== null ? `${row.rating}/5` : "No rating"}
                      {row.liked !== null
                        ? row.liked
                          ? " · liked"
                          : " · disliked"
                        : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.free_text ?? row.leftover_level ?? "No note"}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </CompactTable>
        ) : (
          <EmptyState
            icon={MessageSquareReply}
            title="No feedback events"
            description="Current-week feedback appears here after seeded or real feedback rows are present."
          />
        )}
      </CardContent>
    </Card>
  );
}

function AiSection({ rows }: { rows: OperatorAiInterpretation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Interpretations</CardTitle>
        <CardDescription>
          Stored provenance for advisory parsing and explanation calls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <CompactTable>
            <thead>
              <tr>
                <Th>Purpose</Th>
                <Th>Model</Th>
                <Th>Confidence</Th>
                <Th>Review</Th>
                <Th>Context</Th>
                <Th>Parsed JSON</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ai_interpretation_id}>
                  <Td>
                    <div>{formatStatus(row.purpose)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </div>
                  </Td>
                  <Td>
                    <div>{row.model ?? "Model not recorded"}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.provider ?? "Provider not recorded"} ·{" "}
                      {row.prompt_version ?? "No prompt version"}
                    </div>
                  </Td>
                  <Td>{formatConfidence(row.confidence)}</Td>
                  <Td>
                    <StatusBadge
                      status={row.needs_human_review ? "Unreviewed" : "Ready"}
                    />
                  </Td>
                  <Td>
                    {row.caterer_reply_id ? (
                      <span>
                        Reply from {row.reply_caterer_name ?? "caterer"}
                      </span>
                    ) : row.autopilot_exception_id ? (
                      <span>
                        Exception: {row.exception_title ?? "untitled"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Feedback context
                      </span>
                    )}
                  </Td>
                  <Td>
                    <details className="max-w-sm">
                      <summary className="cursor-pointer text-sm font-medium text-brand">
                        View JSON
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
                        {jsonPreview(row.parsed_output)}
                      </pre>
                    </details>
                  </Td>
                </tr>
              ))}
            </tbody>
          </CompactTable>
        ) : (
          <EmptyState
            icon={BrainCircuit}
            title="No AI interpretations"
            description="AI provenance rows appear here after backend advisory parsing or explanation calls run."
          />
        )}
      </CardContent>
    </Card>
  );
}

export default async function AutopilotPage() {
  const supabase = await createClient();
  const result = await getAutopilotReadModel(supabase);

  if (result.error) {
    return (
      <>
        <PageHeader
          eyebrow="Autopilot"
          title="Catering Autopilot"
          description="Current-week automation state from secure operator data."
        />
        <EmptyState
          icon={DatabaseZap}
          title="Autopilot data is unavailable"
          description={result.error}
        />
      </>
    );
  }

  const data = result.data;

  if (!data?.currentWeek?.week_start) {
    return (
      <>
        <PageHeader
          eyebrow="Autopilot"
          title="Catering Autopilot"
          description="No service week was found in the operational dataset."
        />
        <EmptyState
          icon={Bot}
          title="No active week"
          description="Ingest sessions before autopilot can run the current-week demo."
        />
      </>
    );
  }

  const {
    currentWeek,
    autopilotStatus,
    exceptions,
    replies,
    resolutions,
    resolutionOptions,
    mealFitSignals,
    qualitySignals,
    feedbackEvents,
    aiInterpretations,
    timelineEvents,
  } = data;
  const weekStart = currentWeek.week_start;

  if (!weekStart) {
    return (
      <>
        <PageHeader
          eyebrow="Autopilot"
          title="Catering Autopilot"
          description="No service week was found in the operational dataset."
        />
        <EmptyState
          icon={Bot}
          title="No active week"
          description="Ingest sessions before autopilot can run the current-week demo."
        />
      </>
    );
  }

  const weekLabel = `${formatDate(weekStart)} to ${formatDate(
    currentWeek.week_end,
  )}`;
  const handledReplies = replies.filter((reply) =>
    ["handled", "auto_handled", "auto_adjusted"].includes(
      reply.handled_status ?? "",
    ),
  );
  const refusedReplies = replies.filter((reply) =>
    ["refused", "needs_review", "escalated", "failed"].includes(
      reply.handled_status ?? "",
    ),
  );
  const replyIdsWithInlineResolution = new Set(
    refusedReplies
      .map((reply) => reply.reply_id)
      .filter((replyId): replyId is string =>
        exceptions.some(
          (exception) =>
            exception.status === "open" &&
            exception.category === "caterer_reply" &&
            exception.caterer_reply_id === replyId,
        ),
      ),
  );

  return (
    <>
      <PageHeader
        eyebrow="Autopilot"
        title="Catering Autopilot"
        description={weekLabel}
      />

      <RunAutopilotClient weekStart={weekStart} />

      <Card>
        <CardHeader>
          <CardTitle>Current Week Status</CardTitle>
          <CardDescription>
            The button starts or resumes the current-week demo through the
            Python backend bridge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={statusToken(autopilotStatus?.status ?? null)}
                />
                <span className="text-lg font-semibold text-foreground">
                  {formatAutopilotStatus(autopilotStatus?.status ?? null)}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {autopilotStatus?.summary ??
                  "No autopilot run has been recorded for this week."}
              </p>
            </div>
            {autopilotStatus?.generated_order_run_id ? (
              <Button asChild variant="secondary">
                <Link
                  href={`/weeks/${weekStart}/orders/${autopilotStatus.generated_order_run_id}`}
                >
                  Open order run
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatusMetric
              label="Exceptions"
              value={formatNumber(autopilotStatus?.exception_count ?? 0)}
            />
            <StatusMetric
              label="Open"
              value={formatNumber(autopilotStatus?.open_exception_count ?? 0)}
            />
            <StatusMetric
              label="Blocking"
              value={formatNumber(
                autopilotStatus?.blocking_exception_count ?? 0,
              )}
            />
            <StatusMetric
              label="Prepared"
              value={formatNumber(autopilotStatus?.emails_prepared_count ?? 0)}
            />
            <StatusMetric
              label="Sent"
              value={formatNumber(autopilotStatus?.emails_sent_count ?? 0)}
            />
            <StatusMetric
              label="AI rows"
              value={formatNumber(
                autopilotStatus?.ai_interpretation_count ?? 0,
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Automation Timeline</CardTitle>
            <CardDescription>
              Audit events linked to the current autopilot or generated order
              run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timelineEvents.length ? (
              <div className="space-y-3">
                {timelineEvents.map((event) => (
                  <div
                    className="rounded-md border border-border bg-muted p-3"
                    key={event.audit_id}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {formatAuditAction(event.display_action, event.action)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {event.actor_name ?? "Unknown actor"}:{" "}
                      {event.reason ?? "No reason recorded"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="No linked timeline yet"
                description="Autopilot timeline events appear after a run records audit rows for the autopilot or generated order run."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reply Handling</CardTitle>
            <CardDescription>
              Latest caterer replies and automated adjustments for this service
              week.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {replies.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                    Handled
                  </div>
                  {handledReplies.length ? (
                    handledReplies.map((reply) => {
                      const replacement = replyReplacement(reply.metadata);

                      return (
                        <div
                          className="rounded-md border border-border bg-muted p-3"
                          key={reply.reply_id}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {reply.caterer_name ?? "Unknown caterer"}
                            </span>
                            <StatusBadge
                              status={statusToken(reply.handled_status)}
                            />
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {reply.complete_interpreted_summary ??
                              reply.handling_summary ??
                              reply.subject ??
                              "No summary"}
                          </p>
                          {replacement ? (
                            <div className="mt-3 rounded-md border border-border bg-card p-3">
                              <p className="text-sm font-medium text-foreground">
                                {replacement.unavailableItem ??
                                  "Unavailable meal"}{" "}
                                →{" "}
                                {replacement.replacementItem ??
                                  "Replacement not recorded"}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {formatSelectionSource(
                                  replacement.selectionSource,
                                )}
                                {replacement.affectedAllocationCount !== null
                                  ? ` · ${replacement.affectedAllocationCount} affected meal${replacement.affectedAllocationCount === 1 ? "" : "s"}`
                                  : ""}
                                {replacement.selectionScore !== null
                                  ? ` · score ${replacement.selectionScore.toFixed(3)}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {revisedThreadSummary(
                                  reply.revised_email_state,
                                  reply.revised_thread_status,
                                )}
                              </p>
                              {replacement.revisedOrderRunId ? (
                                <Button
                                  asChild
                                  className="mt-2"
                                  size="sm"
                                  variant="ghost"
                                >
                                  <Link
                                    href={`/weeks/${weekStart}/orders/${replacement.revisedOrderRunId}`}
                                  >
                                    Open revised order
                                    <ArrowRight
                                      className="size-4"
                                      aria-hidden="true"
                                    />
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatReplyHandledStatus(reply.handled_status)} ·{" "}
                            {formatConfidence(reply.confidence)} ·{" "}
                            {formatDateTime(
                              reply.handled_at ?? reply.received_at,
                            )}
                          </p>
                          {reply.resolution_message_text ? (
                            <div className="mt-2 rounded-md border border-border bg-card p-3">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Resolution outcome
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                                {reply.resolution_message_text}
                              </p>
                            </div>
                          ) : null}
                          {reply.original_reply_body ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm font-medium text-brand">
                                Show original email
                              </summary>
                              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
                                {reply.original_reply_body}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No handled replies are stored for this service week.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                    Refused Or Review
                  </div>
                  {refusedReplies.length ? (
                    refusedReplies.map((reply) => {
                      const exception =
                        exceptions.find(
                          (candidate) =>
                            candidate.status === "open" &&
                            candidate.category === "caterer_reply" &&
                            candidate.caterer_reply_id === reply.reply_id,
                        ) ?? null;
                      const resolution = exception
                        ? (resolutions.find(
                            (candidate) =>
                              candidate.resolution_id ===
                              exception.latest_resolution_id,
                          ) ?? null)
                        : null;

                      return (
                        <div
                          className="rounded-md border border-border bg-muted p-3"
                          key={reply.reply_id}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {reply.caterer_name ?? "Unknown caterer"}
                            </span>
                            <StatusBadge
                              status={statusToken(reply.handled_status)}
                            />
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {reply.complete_interpreted_summary ??
                              reply.handling_summary ??
                              reply.subject ??
                              "No summary"}
                          </p>
                          {reply.exception_detail ? (
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              Review reason: {reply.exception_detail}
                            </p>
                          ) : null}
                          {reply.deterministic_block_reason ? (
                            <p className="mt-2 text-sm leading-6 text-[var(--err-fg)]">
                              Deterministic block:{" "}
                              {reply.deterministic_block_reason}
                            </p>
                          ) : null}
                          {reply.recommended_action ? (
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {reply.recommended_action}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatReplyHandledStatus(reply.handled_status)} ·{" "}
                            {formatConfidence(reply.confidence)}
                          </p>
                          {reply.original_reply_body ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm font-medium text-brand">
                                Show original email
                              </summary>
                              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
                                {reply.original_reply_body}
                              </pre>
                            </details>
                          ) : null}
                          {exception ? (
                            <ExceptionResolutionClient
                              exception={exception}
                              options={resolutionOptions.filter(
                                (option) =>
                                  option.exception_id ===
                                  exception.exception_id,
                              )}
                              resolution={resolution}
                              weekStart={weekStart}
                            />
                          ) : (
                            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                              This reply has no open linked exception. Refresh
                              replies or review its audit history.
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No refused or review-required replies are stored for this
                      run.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={MessageSquareReply}
                title="No caterer replies"
                description="Handled and refused reply rows appear after incoming mail links to an order in this service week."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ExceptionsSection
        exceptions={exceptions}
        options={resolutionOptions}
        resolutions={resolutions}
        replyIdsWithInlineResolution={replyIdsWithInlineResolution}
        weekStart={weekStart}
      />

      <MealFitSection rows={mealFitSignals} />

      <div className="grid gap-4 xl:grid-cols-2">
        <QualitySection rows={qualitySignals} />
        <FeedbackSection rows={feedbackEvents} />
      </div>

      <AiSection rows={aiInterpretations} />

      <div className="flex justify-end">
        <Button asChild variant="secondary">
          <Link href="/audit">
            Open full audit
            <Sparkles className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </>
  );
}
