import { MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatDateTime, formatStatus } from "@/lib/operator-display";
import {
  getFeedbackReadModel,
  type OperatorFeedbackRequest,
} from "@/lib/operator-read-models";
import { createClient } from "@/lib/supabase/server";

import { FeedbackLinkControl, FeedbackToolbar } from "./feedback-actions-client";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const result = await getFeedbackReadModel(supabase);

  if (result.error || !result.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Feedback"
          title="Feedback and quality"
          description="Student and session-manager feedback could not be loaded."
        />
        <EmptyState
          title="Feedback data unavailable"
          description={result.error ?? "Check operator access and read models."}
        />
      </div>
    );
  }

  const latest = result.data.overview[0] ?? null;
  const managerRequests = result.data.requests.filter(
    (request) => request.audience === "session_manager",
  );
  const pendingStudentRequests = result.data.requests.filter(
    (request) => request.audience === "student" && request.status !== "submitted",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Feedback"
        title="Feedback and quality"
        description="Collect student and session-manager feedback, track caterer performance, and feed approved signals back into meal-fit scoring."
        actions={<FeedbackToolbar />}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Requests"
          value={latest?.request_count ?? 0}
          detail={`${latest?.submitted_request_count ?? 0} submitted`}
        />
        <MetricCard
          label="Student rating"
          value={latest?.average_student_rating ?? "—"}
          detail={`${latest?.low_student_rating_count ?? 0} low ratings`}
        />
        <MetricCard
          label="Manager issues"
          value={latest?.manager_issue_count ?? 0}
          detail={`${latest?.manager_positive_count ?? 0} positive reports`}
        />
        <MetricCard
          label="Quality events"
          value={latest?.quality_event_count ?? 0}
          detail={`${latest?.serious_quality_event_count ?? 0} serious`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Response Trend</CardTitle>
            <CardDescription>
              Weekly response volume and completion rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.data.trends.length ? (
              <div className="space-y-3">
                {result.data.trends.map((trend) => (
                  <div key={trend.week_start ?? "unknown"} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>{formatDate(trend.week_start)}</span>
                      <span className="font-medium">
                        {trend.response_rate_percent ?? 0}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-brand"
                        style={{
                          width: `${Math.min(
                            100,
                            Number(trend.response_rate_percent ?? 0),
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {trend.submitted_count} of {trend.request_count} submitted
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No response trend yet"
                description="Feedback request counts appear after the feedback dispatcher creates request rows."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caterer Performance</CardTitle>
            <CardDescription>
              Stored feedback and quality events by caterer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Caterer</th>
                    <th className="py-2 pr-3">Avg</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Issues</th>
                    <th className="py-2 pr-3">Serious</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.caterers.map((row) => (
                    <tr key={row.caterer_id} className="border-t border-border">
                      <td className="py-2 pr-3 font-medium">{row.caterer_name}</td>
                      <td className="py-2 pr-3">{row.average_student_rating ?? "—"}</td>
                      <td className="py-2 pr-3">{row.student_feedback_count}</td>
                      <td className="py-2 pr-3">
                        {(row.manager_issue_count ?? 0) +
                          (row.review_quality_event_count ?? 0)}
                      </td>
                      <td className="py-2 pr-3">{row.serious_quality_event_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feedback Inbox</CardTitle>
            <CardDescription>
              Latest submitted student and session-manager feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.data.events.length ? (
              <div className="space-y-3">
                {result.data.events.slice(0, 12).map((event) => (
                  <article
                    key={event.feedback_id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">
                        {event.student_name ?? event.school_name ?? "Session"}
                      </span>
                      <span className="text-muted-foreground">
                        {formatStatus(event.feedback_type)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.dish_variant_name ?? event.caterer_name ?? "Catering"} ·{" "}
                      rating {event.rating ?? "—"} · {event.delivery_status ?? "meal"}
                    </p>
                    {event.free_text || event.requested_food ? (
                      <p className="mt-2 text-sm leading-6">
                        {event.free_text}
                        {event.requested_food ? ` Requested: ${event.requested_food}` : ""}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No submitted feedback yet"
                description="Student and manager submissions will appear here once forms are used."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitation Status</CardTitle>
            <CardDescription>
              Student requests are emailed automatically. For the demo, signed
              student links can also be opened from here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingStudentRequests.length ? (
              <div className="space-y-2">
                {pendingStudentRequests.slice(0, 10).map((request) => (
                  <RequestRow key={request.request_id} request={request} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No pending student invitations"
                description="When recent allocated meals are eligible, the dispatcher creates and sends student feedback invitations."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manager Links and QR</CardTitle>
          <CardDescription>
            Show the QR code at the session or copy the signed one-use form link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {managerRequests.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {managerRequests.slice(0, 12).map((request) => (
                <div
                  key={request.request_id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {request.school_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(request.session_date)} · {request.caterer_name}
                      </p>
                    </div>
                    <StatusBadge status={statusToken(request.status)} />
                  </div>
                  <div className="mt-3">
                    <FeedbackLinkControl requestId={request.request_id ?? ""} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No manager links yet"
              description="Run a feedback check after approved or generated orders exist to create session-manager feedback links."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function RequestRow({ request }: { request: OperatorFeedbackRequest }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="text-sm font-medium text-foreground">
          {request.student_name ?? "Student"} · {request.school_name}
        </div>
        <div className="text-xs leading-5 text-muted-foreground">
          Eligible {formatDateTime(request.eligible_at)} · expires{" "}
          {formatDateTime(request.expires_at)}
        </div>
        {request.last_error ? (
          <div className="text-xs text-[var(--err-fg)]">{request.last_error}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
        <StatusBadge status={statusToken(request.status)} />
        <FeedbackLinkControl
          requestId={request.request_id ?? ""}
          label="Show student link"
        />
      </div>
    </div>
  );
}

function statusToken(status: string | null) {
  if (status === "submitted" || status === "sent") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "expired") return "Superseded";
  return "Unreviewed";
}
